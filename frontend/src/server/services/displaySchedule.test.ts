import { describe, it, expect } from 'vitest';
import { isPlaylistOn, playlistsOnNow, SchedulablePlaylist } from './displaySchedule';

const base: SchedulablePlaylist = {
  id: 'p', locationId: null, days: '1,4', startTime: '08:00', endTime: '12:00', priority: 2,
  isActive: true, startsAt: null, endsAt: null, createdAt: new Date('2026-01-01'),
};
// Monday 28 Sep 2026, 09:30 in Accra (UTC+0)
const monMorning = new Date('2026-09-28T09:30:00Z');

describe('playlist schedule', () => {
  it('plays on the chosen days and hours only', () => {
    expect(isPlaylistOn(base, 'loc', monMorning, 'Africa/Accra')).toBe(true);
    expect(isPlaylistOn(base, 'loc', new Date('2026-10-01T09:30:00Z'), 'Africa/Accra')).toBe(true); // Thursday
    expect(isPlaylistOn(base, 'loc', new Date('2026-09-29T09:30:00Z'), 'Africa/Accra')).toBe(false); // Tuesday
    expect(isPlaylistOn(base, 'loc', new Date('2026-09-28T12:00:00Z'), 'Africa/Accra')).toBe(false); // ends at 12:00
  });

  it('uses the location’s clock', () => {
    // 09:30 UTC is 12:30 in Nairobi: outside 08:00-12:00 there.
    expect(isPlaylistOn(base, 'loc', monMorning, 'Africa/Nairobi')).toBe(false);
  });

  it('runs overnight windows into the next morning', () => {
    const late = { ...base, days: '5', startTime: '22:00', endTime: '02:00' }; // Friday night
    expect(isPlaylistOn(late, 'loc', new Date('2026-10-02T23:00:00Z'), 'UTC')).toBe(true);
    expect(isPlaylistOn(late, 'loc', new Date('2026-10-03T01:00:00Z'), 'UTC')).toBe(true); // Saturday 1am
    expect(isPlaylistOn(late, 'loc', new Date('2026-10-03T03:00:00Z'), 'UTC')).toBe(false);
  });

  it('respects location, dates and pausing', () => {
    expect(isPlaylistOn({ ...base, locationId: 'other' }, 'loc', monMorning, 'UTC')).toBe(false);
    expect(isPlaylistOn({ ...base, endsAt: new Date('2026-09-28T00:00:00Z') }, 'loc', monMorning, 'UTC')).toBe(false);
    expect(isPlaylistOn({ ...base, isActive: false }, 'loc', monMorning, 'UTC')).toBe(false);
  });

  it('plays only the highest priority when several are on', () => {
    const everyday = { ...base, id: 'everyday', days: '0,1,2,3,4,5,6', startTime: null, endTime: null };
    const promo = { ...base, id: 'promo', priority: 1 };
    expect(playlistsOnNow([everyday, promo], 'loc', monMorning, 'UTC').map((p) => p.id)).toEqual(['promo']);
    expect(playlistsOnNow([everyday, promo], 'loc', new Date('2026-09-29T09:30:00Z'), 'UTC').map((p) => p.id)).toEqual(['everyday']);
  });
});
