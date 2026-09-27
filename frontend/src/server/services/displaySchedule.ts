import { zonedParts } from '../utils/date';

/**
 * Which playlists are on right now at a location. Days and times are the
 * location's local time; an end time earlier than the start runs overnight.
 * When several are on, only the highest priority (lowest number) plays, so
 * a "takes over" promotion replaces the everyday playlist while it runs.
 */

export interface SchedulablePlaylist {
  id: string;
  locationId: string | null;
  days: string;
  startTime: string | null;
  endTime: string | null;
  priority: number;
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  createdAt: Date;
}

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
};

export function isPlaylistOn(p: SchedulablePlaylist, locationId: string, now: Date, tz?: string): boolean {
  if (!p.isActive) return false;
  if (p.locationId && p.locationId !== locationId) return false;
  if (p.startsAt && now < p.startsAt) return false;
  if (p.endsAt && now >= p.endsAt) return false;

  const local = tz ? zonedParts(now, tz) : { weekday: now.getDay(), hour: now.getHours(), minute: now.getMinutes() };
  const nowMin = local.hour * 60 + local.minute;
  const days = p.days.split(',').filter(Boolean).map(Number);
  const start = p.startTime ? minutes(p.startTime) : 0;
  const end = p.endTime ? minutes(p.endTime) : 24 * 60;

  if (start < end) return days.includes(local.weekday) && nowMin >= start && nowMin < end;
  // Overnight (e.g. 22:00-02:00): today's evening, or the early hours after yesterday.
  const yesterday = (local.weekday + 6) % 7;
  return (days.includes(local.weekday) && nowMin >= start) || (days.includes(yesterday) && nowMin < end);
}

export function playlistsOnNow<T extends SchedulablePlaylist>(playlists: T[], locationId: string, now: Date, tz?: string): T[] {
  const on = playlists.filter((p) => isPlaylistOn(p, locationId, now, tz));
  if (on.length === 0) return [];
  const top = Math.min(...on.map((p) => p.priority));
  return on.filter((p) => p.priority === top).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}
