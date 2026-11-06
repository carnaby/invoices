import { TRPCError } from '@trpc/server';

/**
 * Limits failed logins per visitor IP and per account (sliding window, in memory).
 * The API runs as a single process, so memory is enough; a restart clears the counters.
 *
 * Every attempt is counted as a failure *before* the password is checked and removed again on success,
 * so parallel requests cannot slip past the limit while argon2 is still verifying.
 */
export const LOGIN_LIMITS = { perIp: 5, perAccount: 30, windowMs: 15 * 60 * 1000 };
const MAX_KEYS = 10_000;

export class LoginThrottle {
  private failures = new Map<string, number[]>();

  constructor(
    private readonly limits = LOGIN_LIMITS,
    private readonly now: () => number = Date.now,
  ) {}

  /** Throws TOO_MANY_REQUESTS when blocked; otherwise records the attempt and returns a callback for success. */
  begin(ip: string, username: string): { succeeded(): void } {
    const t = this.now();
    const keys: [string, number][] = [
      ['ip:' + ipKey(ip), this.limits.perIp],
      ['user:' + username.trim().toLowerCase(), this.limits.perAccount],
    ];
    let waitMs = 0;
    for (const [key, limit] of keys) {
      const recent = this.recent(key, t);
      if (recent.length >= limit) waitMs = Math.max(waitMs, recent[recent.length - limit] + this.limits.windowMs - t);
    }
    if (waitMs > 0) {
      const minutes = Math.max(1, Math.ceil(waitMs / 60_000));
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: `Príliš veľa neúspešných pokusov o prihlásenie. Skúste to znova o ${minutes} min.`,
      });
    }
    this.prune(t);
    for (const [key] of keys) this.failures.set(key, [...this.recent(key, t), t]);
    return {
      succeeded: () => {
        for (const [key] of keys) this.failures.delete(key);
      },
    };
  }

  reset(): void {
    this.failures.clear();
  }

  private recent(key: string, t: number): number[] {
    return (this.failures.get(key) ?? []).filter((x) => x > t - this.limits.windowMs);
  }

  /** Keeps memory bounded when many addresses or usernames are tried. */
  private prune(t: number): void {
    if (this.failures.size < MAX_KEYS) return;
    for (const [key, times] of this.failures) {
      if (!times.some((x) => x > t - this.limits.windowMs)) this.failures.delete(key);
    }
    for (const key of this.failures.keys()) {
      if (this.failures.size < MAX_KEYS) break;
      this.failures.delete(key); // oldest first (Map keeps insertion order)
    }
  }
}

/** IPv4 as is (also when IPv4-mapped); IPv6 by its /64 prefix, which one visitor usually controls whole. */
export function ipKey(ip: string): string {
  const v4 = ip.match(/^(?:::ffff:)?(\d+\.\d+\.\d+\.\d+)$/i);
  if (v4) return v4[1];
  if (!ip.includes(':')) return ip;
  const [head, tail = ''] = ip.toLowerCase().split('::');
  const left = head ? head.split(':') : [];
  const right = ip.includes('::') && tail ? tail.split(':') : [];
  const groups = ip.includes('::') ? [...left, ...Array(8 - left.length - right.length).fill('0'), ...right] : left;
  return groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, '')).join(':') + '::/64';
}

export const loginThrottle = new LoginThrottle();
