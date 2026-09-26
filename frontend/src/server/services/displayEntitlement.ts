import prisma from '../lib/prisma';
import { getOrganizationFeatures, addOnBoost } from '../middleware/subscription.middleware';

/**
 * What an organization may play on its lobby screens.
 *
 *  - Plans without adverts get a free trial, starting the first time they
 *    add media (plan feature `displayMediaTrialDays`, default 14), with a
 *    small playlist.
 *  - Plans with `displayMedia` include adverts with a capped playlist
 *    (`displayMediaItems`, default 5) and uploads up to the server limit.
 *  - Each lobby media pack (add-on, usually bought outright) unlocks large
 *    uploads and streams, and adds `PACK_ITEMS` playlist items.
 *
 * The ticker is free on every plan; only media is covered here.
 */

export const TRIAL_ITEMS = 3;
export const DEFAULT_PLAN_ITEMS = 5;
export const PACK_ITEMS = 25;
export const DEFAULT_TRIAL_DAYS = 14;
export const SERVER_UPLOAD_BYTES = 4 * 1024 * 1024;
export const PACK_UPLOAD_BYTES = 500 * 1024 * 1024;

export type DisplayMediaStatus = 'pack' | 'included' | 'trial' | 'trial_available' | 'trial_ended';

export interface DisplayEntitlement {
  status: DisplayMediaStatus;
  allowed: boolean;
  maxItems: number;
  maxUploadBytes: number;
  streaming: boolean;
  packs: number;
  trialDays: number;
  trialEndsAt: string | null;
  itemsUsed: number;
}

export async function getDisplayEntitlement(organizationId: string): Promise<DisplayEntitlement> {
  const [features, packs, org, itemsUsed] = await Promise.all([
    getOrganizationFeatures(organizationId) as Promise<Record<string, unknown>>,
    addOnBoost(organizationId, 'DISPLAY_MEDIA'),
    prisma.organization.findUnique({ where: { id: organizationId }, select: { displayMediaTrialStartedAt: true } }),
    prisma.displayMedia.count({ where: { organizationId } }),
  ]);

  const included = features.displayMedia === true;
  const planItems = typeof features.displayMediaItems === 'number' ? features.displayMediaItems : DEFAULT_PLAN_ITEMS;
  const trialDays = typeof features.displayMediaTrialDays === 'number' ? features.displayMediaTrialDays : DEFAULT_TRIAL_DAYS;
  const base = { packs, trialDays, itemsUsed };

  if (packs > 0) {
    return {
      ...base, status: 'pack', allowed: true, trialEndsAt: null, streaming: true,
      maxItems: (included ? planItems : TRIAL_ITEMS) + packs * PACK_ITEMS,
      maxUploadBytes: PACK_UPLOAD_BYTES,
    };
  }
  if (included) {
    return { ...base, status: 'included', allowed: true, trialEndsAt: null, streaming: false, maxItems: planItems, maxUploadBytes: SERVER_UPLOAD_BYTES };
  }

  let started = org?.displayMediaTrialStartedAt ?? null;
  // Media added before trials existed: the trial started with the first item.
  if (!started && itemsUsed > 0) {
    const first = await prisma.displayMedia.findFirst({ where: { organizationId }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } });
    if (first) {
      started = first.createdAt;
      await prisma.organization.update({ where: { id: organizationId }, data: { displayMediaTrialStartedAt: started } }).catch(() => {});
    }
  }
  const endsAt = started ? new Date(started.getTime() + trialDays * 86400000) : null;
  const common = { ...base, streaming: false, maxItems: TRIAL_ITEMS, maxUploadBytes: SERVER_UPLOAD_BYTES };
  if (trialDays <= 0) return { ...common, status: 'trial_ended', allowed: false, trialEndsAt: null };
  if (!started) return { ...common, status: 'trial_available', allowed: true, trialEndsAt: null };
  if (endsAt! > new Date()) return { ...common, status: 'trial', allowed: true, trialEndsAt: endsAt!.toISOString() };
  return { ...common, status: 'trial_ended', allowed: false, trialEndsAt: endsAt!.toISOString() };
}

export class DisplayMediaLimitError extends Error {
  constructor(message: string, public status = 403) {
    super(message);
  }
}

/**
 * Checks a new playlist item against the organization's entitlement, and
 * starts the free trial on first use. Throws DisplayMediaLimitError.
 */
export async function assertCanAddMedia(organizationId: string, opts: { kind: string; bytes?: number | null }) {
  const e = await getDisplayEntitlement(organizationId);
  if (!e.allowed) throw new DisplayMediaLimitError('Your free trial of lobby adverts has ended. Upgrade your plan or buy a lobby media pack to keep playing media.');
  if (e.itemsUsed >= e.maxItems) {
    throw new DisplayMediaLimitError(
      e.status === 'pack'
        ? `You’re using all ${e.maxItems} playlist items. Remove one, or add another media pack.`
        : `Your plan includes ${e.maxItems} playlist items. Remove one, or get a lobby media pack for more.`
    );
  }
  if (opts.kind === 'STREAM' && !e.streaming) throw new DisplayMediaLimitError('Streams and live video come with a lobby media pack.');
  if (opts.bytes && opts.bytes > e.maxUploadBytes) {
    throw new DisplayMediaLimitError(e.streaming ? 'That file is over 500MB.' : 'Files over 4MB come with a lobby media pack. Or add the video by link.');
  }
  if (e.status === 'trial_available') {
    await prisma.organization.update({ where: { id: organizationId }, data: { displayMediaTrialStartedAt: new Date() } });
  }
  return e;
}
