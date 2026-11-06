import { describe, expect, it } from 'vitest';
import { ipKey, LoginThrottle } from './login-throttle';

const limits = { perIp: 5, perAccount: 30, windowMs: 15 * 60 * 1000 };
function setup() {
  let t = 1_000_000;
  const throttle = new LoginThrottle(limits, () => t);
  return { throttle, advance: (ms: number) => (t += ms) };
}
const fail = (th: LoginThrottle, ip: string, user = 'carnaby') => th.begin(ip, user); // never succeeds

describe('LoginThrottle', () => {
  it('blocks the 6th attempt from one IP after 5 failures, another IP still works', () => {
    const { throttle } = setup();
    for (let i = 0; i < 5; i++) fail(throttle, '203.0.113.7');
    expect(() => fail(throttle, '203.0.113.7')).toThrow(expect.objectContaining({ code: 'TOO_MANY_REQUESTS' }));
    expect(() => throttle.begin('198.51.100.1', 'carnaby').succeeded()).not.toThrow();
  });

  it('blocks per IP regardless of the username tried', () => {
    const { throttle } = setup();
    for (let i = 0; i < 5; i++) fail(throttle, '203.0.113.7', `user${i}`);
    expect(() => fail(throttle, '203.0.113.7', 'other')).toThrow(/Skúste to znova o 15 min/);
  });

  it('releases the IP after the window', () => {
    const { throttle, advance } = setup();
    for (let i = 0; i < 5; i++) fail(throttle, '203.0.113.7');
    advance(limits.windowMs - 1000);
    expect(() => fail(throttle, '203.0.113.7')).toThrow(/1 min/);
    advance(1001);
    expect(() => fail(throttle, '203.0.113.7')).not.toThrow();
  });

  it('blocks one account after 30 failures from many IPs (distributed guessing), case-insensitive', () => {
    const { throttle } = setup();
    for (let i = 0; i < 30; i++) fail(throttle, `203.0.113.${i}`, i % 2 ? 'Carnaby' : 'carnaby ');
    expect(() => fail(throttle, '198.51.100.1')).toThrow(expect.objectContaining({ code: 'TOO_MANY_REQUESTS' }));
    expect(() => fail(throttle, '198.51.100.1', 'someone-else')).not.toThrow();
  });

  it('a successful login clears the counters of its IP and account', () => {
    const { throttle } = setup();
    for (let i = 0; i < 4; i++) fail(throttle, '203.0.113.7');
    throttle.begin('203.0.113.7', 'carnaby').succeeded();
    for (let i = 0; i < 5; i++) fail(throttle, '203.0.113.7');
    expect(() => fail(throttle, '203.0.113.7')).toThrow();
  });

  it('counts an attempt before the password check, so parallel attempts cannot exceed the limit', () => {
    const { throttle } = setup();
    let started = 0;
    for (let i = 0; i < 10; i++) {
      try {
        throttle.begin('203.0.113.7', 'carnaby');
        started++;
      } catch {
        // blocked
      }
    }
    expect(started).toBe(5);
  });
});

describe('ipKey', () => {
  it('keeps IPv4 and unwraps IPv4-mapped IPv6', () => {
    expect(ipKey('203.0.113.7')).toBe('203.0.113.7');
    expect(ipKey('::ffff:203.0.113.7')).toBe('203.0.113.7');
  });
  it('groups IPv6 by /64', () => {
    expect(ipKey('2001:db8:1:2:aaaa::1')).toBe('2001:db8:1:2::/64');
    expect(ipKey('2001:0db8:0001:0002:ffff:ffff:ffff:ffff')).toBe('2001:db8:1:2::/64');
    expect(ipKey('2001:db8::1')).toBe('2001:db8:0:0::/64');
    expect(ipKey('::1')).toBe('0:0:0:0::/64');
  });
});
