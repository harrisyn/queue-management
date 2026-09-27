import { describe, it, expect } from 'vitest';
import { getStartOfDay, getEndOfDay, parseTimeToDate, generateTimeSlots, isDayActive, hourIn, startOfLocalDate } from './date';

describe('timezone-aware dates', () => {
  // 2026-09-26 22:30 UTC is already the 27th in Nairobi (UTC+3).
  const lateUtc = new Date('2026-09-26T22:30:00Z');

  it('finds the local day, not the server’s', () => {
    expect(getStartOfDay(lateUtc, 'Africa/Nairobi').toISOString()).toBe('2026-09-26T21:00:00.000Z');
    expect(getEndOfDay(lateUtc, 'Africa/Nairobi').toISOString()).toBe('2026-09-27T20:59:59.999Z');
    expect(getStartOfDay(lateUtc, 'Africa/Accra').toISOString()).toBe('2026-09-26T00:00:00.000Z');
  });

  it('reads opening hours as local wall-clock time', () => {
    const day = new Date('2026-09-26T09:00:00Z');
    expect(parseTimeToDate('08:00', day, 'Africa/Nairobi').toISOString()).toBe('2026-09-26T05:00:00.000Z');
    expect(parseTimeToDate('08:00', day, 'America/New_York').toISOString()).toBe('2026-09-26T12:00:00.000Z');
    const slots = generateTimeSlots('08:00', '09:00', 30, day, 'Europe/London');
    expect(slots.map((s) => s.startTime.toISOString())).toEqual(['2026-09-26T07:00:00.000Z', '2026-09-26T07:30:00.000Z']);
  });

  it('handles a daylight-saving change', () => {
    // London clocks go back at 02:00 BST on 25 Oct 2026; the day is 25 hours long.
    const start = getStartOfDay(new Date('2026-10-25T12:00:00Z'), 'Europe/London');
    const end = getEndOfDay(new Date('2026-10-25T12:00:00Z'), 'Europe/London');
    expect(start.toISOString()).toBe('2026-10-24T23:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-25T23:59:59.999Z');
  });

  it('uses the local weekday and hour', () => {
    // Saturday 22:30 UTC is Sunday in Nairobi.
    expect(isDayActive(lateUtc, '0', 'Africa/Nairobi')).toBe(true);
    expect(isDayActive(lateUtc, '6', 'Africa/Nairobi')).toBe(false);
    expect(hourIn(lateUtc, 'Africa/Nairobi')).toBe(1);
    expect(startOfLocalDate('2026-09-27', 'Africa/Nairobi').toISOString()).toBe('2026-09-26T21:00:00.000Z');
  });
});
