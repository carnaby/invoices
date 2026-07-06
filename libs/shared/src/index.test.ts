import { describe, expect, it } from 'vitest';
import { SHARED_VERSION } from './index';

describe('shared', () => {
  it('exports version marker', () => {
    expect(SHARED_VERSION).toBe(1);
  });
});
