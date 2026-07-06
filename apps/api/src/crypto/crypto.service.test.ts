import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret } from './crypto.service';

describe('crypto', () => {
  it('roundtrips and uses random IV', () => {
    const a = encryptSecret('tajne-heslo', 'secret1');
    const b = encryptSecret('tajne-heslo', 'secret1');
    expect(a).not.toBe(b);
    expect(decryptSecret(a, 'secret1')).toBe('tajne-heslo');
  });
  it('fails with wrong secret or tampered payload', () => {
    const enc = encryptSecret('x', 'secret1');
    expect(() => decryptSecret(enc, 'secret2')).toThrow();
    const [iv, tag, data] = enc.split(':');
    expect(() => decryptSecret(`${iv}:${tag}:${'00'.repeat(data.length / 2)}`, 'secret1')).toThrow();
  });
});
