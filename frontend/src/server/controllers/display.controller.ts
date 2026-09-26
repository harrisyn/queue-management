import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import prisma from '../lib/prisma';
import { listScopeOrgId, loadCaller } from '../middleware/tenantScope.middleware';
import { getActiveFileStorageProvider } from '../services/fileStorage';
import { emitToLocation, SOCKET_EVENTS } from '../lib/realtime';
import { getDisplayEntitlement, assertCanAddMedia, DisplayMediaLimitError, SERVER_UPLOAD_BYTES } from '../services/displayEntitlement';
import { playlistsOnNow } from '../services/displaySchedule';
import { validTimeZone } from '../utils/date';

/**
 * Lobby screens: the ticker and the media (adverts, announcements, videos)
 * that plays between calls. Config lives on Location.displayConfig; media
 * rows are org-wide (locationId null) or pinned to one location.
 */

export interface DisplayConfig {
  ticker: { enabled: boolean; messages: string[]; speed: 'slow' | 'normal' | 'fast' };
  media: { enabled: boolean; mode: 'interstitial' | 'split'; everySeconds: number };
  callFlash: boolean;
}

export const DEFAULT_DISPLAY_CONFIG: DisplayConfig = {
  ticker: { enabled: false, messages: [], speed: 'normal' },
  media: { enabled: false, mode: 'interstitial', everySeconds: 90 },
  callFlash: true,
};

const clamp = (n: unknown, min: number, max: number, fallback: number) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;
};

export function normalizeDisplayConfig(raw: unknown): DisplayConfig {
  const src = (raw && typeof raw === 'object' ? raw : {}) as any;
  const d = DEFAULT_DISPLAY_CONFIG;
  const messages = Array.isArray(src.ticker?.messages)
    ? src.ticker.messages.map((m: unknown) => String(m).trim().slice(0, 200)).filter(Boolean).slice(0, 20)
    : d.ticker.messages;
  return {
    ticker: {
      enabled: typeof src.ticker?.enabled === 'boolean' ? src.ticker.enabled : d.ticker.enabled,
      messages,
      speed: ['slow', 'normal', 'fast'].includes(src.ticker?.speed) ? src.ticker.speed : d.ticker.speed,
    },
    media: {
      enabled: typeof src.media?.enabled === 'boolean' ? src.media.enabled : d.media.enabled,
      mode: src.media?.mode === 'split' ? 'split' : 'interstitial',
      everySeconds: clamp(src.media?.everySeconds, 20, 1800, d.media.everySeconds),
    },
    callFlash: typeof src.callFlash === 'boolean' ? src.callFlash : d.callFlash,
  };
}

const KINDS = ['IMAGE', 'VIDEO', 'STREAM'] as const;

/** YouTube, Vimeo or an HLS (.m3u8) stream: things that play but aren't files. */
export function isStreamUrl(url: string) {
  return /(^https?:\/\/)?(www\.|m\.)?(youtube\.com|youtu\.be|vimeo\.com|player\.vimeo\.com)\//i.test(url) || /\.m3u8(\?|#|$)/i.test(url);
}

function limitResponse(res: Response, err: unknown) {
  if (err instanceof DisplayMediaLimitError) {
    res.status(err.status).json({ error: err.message, upgradeRequired: true });
    return true;
  }
  return false;
}
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const VIDEO_TYPES = ['video/mp4', 'video/webm'];
// Serverless request bodies top out around 4.5MB; bigger videos go in by link.
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

const mediaUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES } }).single('file');

export const mediaUploadMiddleware = (req: Request, res: Response, next: NextFunction) => {
  mediaUpload(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'That file is over 4MB. Upload a smaller one, or add a video by link.' });
    }
    if (err) return res.status(400).json({ error: err instanceof Error ? err.message : 'Upload failed' });
    next();
  });
};

function parseDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function isHttpUrl(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

/** Tell every screen that shows this media (one location, or the whole org) to refetch. */
async function notifyScreens(organizationId: string, locationId: string | null) {
  const ids = locationId
    ? [locationId]
    : (await prisma.location.findMany({ where: { organizationId }, select: { id: true } })).map((l) => l.id);
  ids.forEach((id) => emitToLocation(id, SOCKET_EVENTS.LOCATION_UPDATED, { type: 'display' }));
}

async function resolveLocation(idOrCode: string) {
  return prisma.location.findFirst({
    where: { OR: [{ id: idOrCode }, { publicCode: idOrCode }] },
    select: { id: true, organizationId: true, displayConfig: true, timezone: true },
  });
}

function mediaFilter(organizationId: string, locationId: string) {
  return { organizationId, OR: [{ locationId: null }, { locationId }] };
}

// ---- Public (the screen itself) ----

export const getPublicDisplayContent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const location = await resolveLocation(req.params.locationId);
    if (!location) return res.status(404).json({ error: 'Not found' });
    const now = new Date();
    const liveMedia = {
      isActive: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
      ],
    };
    const mediaSelect = { id: true, kind: true, url: true, title: true, durationSeconds: true };

    // Playlists decide what plays when; with none, the whole library plays.
    const playlists = await prisma.displayPlaylist.findMany({
      where: { organizationId: location.organizationId, OR: [{ locationId: null }, { locationId: location.id }] },
      include: { items: { orderBy: { sortOrder: 'asc' }, include: { media: { select: { ...mediaSelect, isActive: true, startsAt: true, endsAt: true } } } } },
    });
    let media: { id: string; kind: string; url: string; title: string; durationSeconds: number }[];
    let playing: string[] = [];
    if (playlists.length > 0) {
      const on = playlistsOnNow(playlists, location.id, now, validTimeZone(location.timezone));
      playing = on.map((p) => p.name);
      const seen = new Set<string>();
      media = on
        .flatMap((p) => p.items.map((i) => i.media))
        .filter((m) => m.isActive && (!m.startsAt || m.startsAt <= now) && (!m.endsAt || m.endsAt > now))
        .filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)))
        .map(({ id, kind, url, title, durationSeconds }) => ({ id, kind, url, title, durationSeconds }));
    } else {
      media = await prisma.displayMedia.findMany({
        where: { ...mediaFilter(location.organizationId, location.id), ...liveMedia },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: mediaSelect,
      });
    }
    // Only what the plan allows: nothing after a trial ends, streams only
    // with a media pack, and no more items than the playlist limit.
    const entitlement = await getDisplayEntitlement(location.organizationId);
    const config = normalizeDisplayConfig(location.displayConfig);
    const playable = entitlement.allowed
      ? media.filter((m) => m.kind !== 'STREAM' || entitlement.streaming).slice(0, entitlement.maxItems)
      : [];
    if (!entitlement.allowed) config.media.enabled = false;
    res.set('Cache-Control', 'no-store');
    res.json({ config, media: playable, playing });
  } catch (error) {
    next(error);
  }
};

// ---- Admin ----

export const getDisplayConfig = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const location = await prisma.location.findUnique({ where: { id: req.params.locationId }, select: { displayConfig: true } });
    if (!location) return res.status(404).json({ error: 'Not found' });
    res.json(normalizeDisplayConfig(location.displayConfig));
  } catch (error) {
    next(error);
  }
};

export const updateDisplayConfig = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = normalizeDisplayConfig(req.body);
    const location = await prisma.location.update({
      where: { id: req.params.locationId },
      data: { displayConfig: config as any },
      select: { id: true, organizationId: true },
    });
    await notifyScreens(location.organizationId, location.id);
    res.json(config);
  } catch (error) {
    next(error);
  }
};

export const listDisplayMedia = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const organizationId = await listScopeOrgId(req, req.query.organizationId as string | undefined);
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' });
    const media = await prisma.displayMedia.findMany({
      where: { organizationId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    res.json(media);
  } catch (error) {
    next(error);
  }
};

async function callerOrgId(req: Request, locationId: string | null): Promise<string | null> {
  if (locationId) {
    return (await prisma.location.findUnique({ where: { id: locationId }, select: { organizationId: true } }))?.organizationId ?? null;
  }
  return (await loadCaller(req))?.organizationId ?? (req.body?.organizationId as string) ?? null;
}

function readFields(body: any) {
  const title = String(body?.title ?? '').trim().slice(0, 120);
  const durationSeconds = clamp(body?.durationSeconds, 3, 600, 12);
  const locationId = body?.locationId ? String(body.locationId) : null;
  return { title, durationSeconds, locationId };
}

export const createDisplayMedia = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, durationSeconds, locationId } = readFields(req.body);
    const kind = String(req.body?.kind || '').toUpperCase();
    const url = String(req.body?.url || '').trim();
    if (!KINDS.includes(kind as any)) return res.status(400).json({ error: 'Choose an image, a video or a stream.' });
    if (!isHttpUrl(url)) return res.status(400).json({ error: 'Enter a full link starting with https://' });
    if (kind === 'STREAM' && !isStreamUrl(url)) return res.status(400).json({ error: 'Streams can be YouTube or Vimeo links, or an HLS (.m3u8) address.' });
    const organizationId = await callerOrgId(req, locationId);
    if (!organizationId) return res.status(400).json({ error: 'No organization for this media.' });
    try {
      await assertCanAddMedia(organizationId, { kind });
    } catch (err) {
      if (limitResponse(res, err)) return;
      throw err;
    }

    const last = await prisma.displayMedia.findFirst({ where: { organizationId }, orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } });
    const media = await prisma.displayMedia.create({
      data: {
        organizationId,
        locationId,
        kind,
        url,
        title: title || (kind === 'VIDEO' ? 'Video' : 'Image'),
        durationSeconds,
        sortOrder: (last?.sortOrder ?? -1) + 1,
        startsAt: parseDate(req.body?.startsAt) ?? null,
        endsAt: parseDate(req.body?.endsAt) ?? null,
      },
    });
    await notifyScreens(organizationId, locationId);
    res.status(201).json(media);
  } catch (error) {
    next(error);
  }
};

export const uploadDisplayMedia = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'Choose a file to upload.' });
    const kind = IMAGE_TYPES.includes(file.mimetype) ? 'IMAGE' : VIDEO_TYPES.includes(file.mimetype) ? 'VIDEO' : null;
    if (!kind) return res.status(400).json({ error: 'Use a PNG, JPG, WebP or GIF image, or an MP4 or WebM video.' });

    const provider = await getActiveFileStorageProvider();
    if (!provider) return res.status(400).json({ error: 'File uploads aren’t set up yet. Add the media by link instead.' });

    const { title, durationSeconds, locationId } = readFields(req.body);
    const organizationId = await callerOrgId(req, locationId);
    if (!organizationId) return res.status(400).json({ error: 'No organization for this media.' });
    try {
      await assertCanAddMedia(organizationId, { kind, bytes: file.size });
    } catch (err) {
      if (limitResponse(res, err)) return;
      throw err;
    }

    let uploaded;
    try {
      uploaded = await provider.uploadFile(file.buffer, file.originalname, file.mimetype);
    } catch (err) {
      console.error('Display media upload failed:', err);
      return res.status(502).json({ error: 'The upload didn’t go through. Try again shortly.' });
    }

    const last = await prisma.displayMedia.findFirst({ where: { organizationId }, orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } });
    const media = await prisma.displayMedia.create({
      data: {
        organizationId,
        locationId,
        kind,
        url: uploaded.url,
        fileId: uploaded.fileId,
        title: title || file.originalname.replace(/\.[^.]+$/, '').slice(0, 120),
        durationSeconds,
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
    });
    await notifyScreens(organizationId, locationId);
    res.status(201).json(media);
  } catch (error) {
    next(error);
  }
};

export const getMediaEntitlement = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const organizationId = await callerOrgId(req, null);
    if (!organizationId) return res.status(400).json({ error: 'No organization.' });
    res.json(await getDisplayEntitlement(organizationId));
  } catch (error) {
    next(error);
  }
};

/** Whether the browser can upload big files straight to storage. */
export const getUploadConfig = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const organizationId = await callerOrgId(req, null);
    const entitlement = organizationId ? await getDisplayEntitlement(organizationId) : null;
    // Large files are part of the media pack.
    const bigAllowed = !!entitlement && entitlement.maxUploadBytes > SERVER_UPLOAD_BYTES;
    const provider = bigAllowed ? await getActiveFileStorageProvider().catch(() => null) : null;
    const direct = provider?.directUploadConfig?.() ?? null;
    res.json({ serverMaxBytes: MAX_UPLOAD_BYTES, direct: direct ? { ...direct, maxBytes: entitlement!.maxUploadBytes } : null, largeFilesNeedPack: !bigAllowed });
  } catch (error) {
    next(error);
  }
};

/** Registers a file the browser uploaded straight to storage. */
export const registerDirectUpload = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fileId = String(req.body?.fileId || '');
    if (!/^[0-9a-f-]{36}$/i.test(fileId)) return res.status(400).json({ error: 'That upload didn’t finish. Try again.' });
    const provider = await getActiveFileStorageProvider();
    if (!provider?.confirmDirectUpload) return res.status(400).json({ error: 'Direct uploads aren’t available.' });
    const early = await callerOrgId(req, req.body?.locationId ? String(req.body.locationId) : null);
    if (!early) return res.status(400).json({ error: 'No organization for this media.' });
    try {
      await assertCanAddMedia(early, { kind: String(req.body?.mimeType || '').startsWith('video/') ? 'VIDEO' : 'IMAGE', bytes: Number(req.body?.size) || null });
    } catch (err) {
      await provider.deleteFile(fileId).catch(() => {});
      if (limitResponse(res, err)) return;
      throw err;
    }

    let confirmed;
    try {
      confirmed = await provider.confirmDirectUpload(fileId);
    } catch (err) {
      console.error('Confirming direct upload failed:', err);
      return res.status(502).json({ error: 'The file couldn’t be saved. Try uploading it again.' });
    }
    const mime = confirmed.mimeType || String(req.body?.mimeType || '');
    const kind = IMAGE_TYPES.includes(mime) ? 'IMAGE' : VIDEO_TYPES.includes(mime) || mime.startsWith('video/') ? 'VIDEO' : null;
    if (!kind) {
      await provider.deleteFile(fileId).catch(() => {});
      return res.status(400).json({ error: 'Use an image or an MP4 or WebM video.' });
    }

    const { title, durationSeconds, locationId } = readFields(req.body);
    const organizationId = await callerOrgId(req, locationId);
    if (!organizationId) return res.status(400).json({ error: 'No organization for this media.' });
    const last = await prisma.displayMedia.findFirst({ where: { organizationId }, orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } });
    const media = await prisma.displayMedia.create({
      data: {
        organizationId,
        locationId,
        kind,
        url: confirmed.url,
        fileId,
        title: title || (kind === 'VIDEO' ? 'Video' : 'Image'),
        durationSeconds,
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
    });
    await notifyScreens(organizationId, locationId);
    res.status(201).json(media);
  } catch (error) {
    next(error);
  }
};

export const updateDisplayMedia = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.displayMedia.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const b = req.body || {};
    const data: Record<string, unknown> = {};
    if (b.title !== undefined) data.title = String(b.title).trim().slice(0, 120) || existing.title;
    if (b.durationSeconds !== undefined) data.durationSeconds = clamp(b.durationSeconds, 3, 600, existing.durationSeconds);
    if (typeof b.isActive === 'boolean') data.isActive = b.isActive;
    if (b.locationId !== undefined) data.locationId = b.locationId || null;
    const startsAt = parseDate(b.startsAt);
    const endsAt = parseDate(b.endsAt);
    if (startsAt !== undefined) data.startsAt = startsAt;
    if (endsAt !== undefined) data.endsAt = endsAt;

    const media = await prisma.displayMedia.update({ where: { id: existing.id }, data });
    await notifyScreens(existing.organizationId, null);
    res.json(media);
  } catch (error) {
    next(error);
  }
};

export const reorderDisplayMedia = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ids: string[] = Array.isArray(req.body?.items) ? req.body.items.map((i: any) => String(i?.id)) : [];
    if (ids.length === 0) return res.status(400).json({ error: 'Nothing to reorder.' });
    await prisma.$transaction(ids.map((id, sortOrder) => prisma.displayMedia.update({ where: { id }, data: { sortOrder } })));
    const first = await prisma.displayMedia.findUnique({ where: { id: ids[0] }, select: { organizationId: true } });
    if (first) await notifyScreens(first.organizationId, null);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
};

export const deleteDisplayMedia = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.displayMedia.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await prisma.displayMedia.delete({ where: { id: existing.id } });
    if (existing.fileId) {
      const provider = await getActiveFileStorageProvider().catch(() => null);
      // Non-fatal: an orphaned file only costs storage.
      await provider?.deleteFile(existing.fileId).catch((err) => console.error('Failed to delete display media file:', err));
    }
    await notifyScreens(existing.organizationId, existing.locationId);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

// ---- Playlists ----

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function readPlaylist(body: any) {
  const out: Record<string, unknown> = {};
  if (body?.name !== undefined) out.name = String(body.name).trim().slice(0, 80) || 'Playlist';
  if (body?.locationId !== undefined) out.locationId = body.locationId || null;
  if (body?.days !== undefined) {
    const days = [...new Set(String(body.days).split(',').map((d) => Number(d)).filter((d) => d >= 0 && d <= 6))].sort();
    out.days = days.join(',');
  }
  for (const key of ['startTime', 'endTime'] as const) {
    if (body?.[key] !== undefined) out[key] = body[key] && TIME.test(String(body[key])) ? String(body[key]) : null;
  }
  if (body?.priority !== undefined) out.priority = [1, 2, 3].includes(Number(body.priority)) ? Number(body.priority) : 2;
  if (typeof body?.isActive === 'boolean') out.isActive = body.isActive;
  const starts = parseDate(body?.startsAt);
  const ends = parseDate(body?.endsAt);
  if (starts !== undefined) out.startsAt = starts;
  if (ends !== undefined) out.endsAt = ends;
  return out;
}

const playlistInclude = { items: { orderBy: { sortOrder: 'asc' as const }, select: { mediaId: true, sortOrder: true } } };

export const listPlaylists = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const organizationId = await listScopeOrgId(req, req.query.organizationId as string | undefined);
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' });
    const playlists = await prisma.displayPlaylist.findMany({
      where: { organizationId },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      include: playlistInclude,
    });
    res.json(playlists);
  } catch (error) {
    next(error);
  }
};

export const createPlaylist = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = readPlaylist({ name: 'New playlist', ...req.body });
    const organizationId = await callerOrgId(req, (data.locationId as string) || null);
    if (!organizationId) return res.status(400).json({ error: 'No organization.' });
    if (data.days === '') return res.status(400).json({ error: 'Pick at least one day.' });
    const playlist = await prisma.displayPlaylist.create({
      data: { ...(data as any), organizationId },
      include: playlistInclude,
    });
    await notifyScreens(organizationId, playlist.locationId);
    res.status(201).json(playlist);
  } catch (error) {
    next(error);
  }
};

export const updatePlaylist = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.displayPlaylist.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const data = readPlaylist(req.body);
    if (data.days === '') return res.status(400).json({ error: 'Pick at least one day.' });
    const playlist = await prisma.displayPlaylist.update({ where: { id: existing.id }, data: data as any, include: playlistInclude });
    await notifyScreens(existing.organizationId, null);
    res.json(playlist);
  } catch (error) {
    next(error);
  }
};

export const deletePlaylist = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.displayPlaylist.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await prisma.displayPlaylist.delete({ where: { id: existing.id } });
    await notifyScreens(existing.organizationId, null);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

/** Replaces a playlist's items with the given media, in that order. */
export const setPlaylistItems = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const playlist = await prisma.displayPlaylist.findUnique({ where: { id: req.params.id } });
    if (!playlist) return res.status(404).json({ error: 'Not found' });
    const ids: string[] = Array.isArray(req.body?.mediaIds) ? [...new Set<string>(req.body.mediaIds.map(String))] : [];
    const owned = await prisma.displayMedia.count({ where: { id: { in: ids }, organizationId: playlist.organizationId } });
    if (owned !== ids.length) return res.status(404).json({ error: 'Not found' });
    await prisma.$transaction([
      prisma.displayPlaylistItem.deleteMany({ where: { playlistId: playlist.id } }),
      prisma.displayPlaylistItem.createMany({ data: ids.map((mediaId, sortOrder) => ({ playlistId: playlist.id, mediaId, sortOrder })) }),
    ]);
    await notifyScreens(playlist.organizationId, null);
    res.json(await prisma.displayPlaylist.findUnique({ where: { id: playlist.id }, include: playlistInclude }));
  } catch (error) {
    next(error);
  }
};
