/**
 * Express `trust proxy`: X-Forwarded-For is believed only from loopback and private addresses (Caddy on the
 * docker network). A request straight from the internet keeps its own address, so the header cannot be spoofed.
 */
export const TRUST_PROXY = 'loopback, uniquelocal';
