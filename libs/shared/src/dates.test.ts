import { describe, expect, it } from 'vitest';
import { todayIso } from './dates';

describe('todayIso', () => {
  it('uses the Bratislava date, not UTC, just after midnight in winter (UTC+1)', () => {
    expect(todayIso(new Date('2026-01-14T23:30:00Z'))).toBe('2026-01-15');
  });

  it('uses the Bratislava date just after midnight in summer (UTC+2)', () => {
    expect(todayIso(new Date('2026-07-14T22:30:00Z'))).toBe('2026-07-15');
  });

  it('stays on the same day before Bratislava midnight', () => {
    expect(todayIso(new Date('2026-07-14T21:30:00Z'))).toBe('2026-07-14');
  });

  it('defaults to now and returns YYYY-MM-DD', () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
