import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { retryDueDeliveries } from '../services/webhooks.service';
import { sendAppointmentReminders } from '../services/reminders.service';
import { createDailyDigest } from '../controllers/ai.controller';
import { sendNotificationEmail } from '../utils/email';
import { buildAppUrl } from '../config/appConfig';

// Scheduled jobs, triggered by Vercel Cron (or any scheduler) with
// `Authorization: Bearer $CRON_SECRET`.
const router = Router();

function requireCronSecret(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.authorization?.replace(/^Bearer /, '') || '';
  const ok =
    !!secret && given.length === secret.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

router.use(requireCronSecret);

// Every few minutes: webhook retries + expired-row cleanup.
router.all('/frequent', async (_req, res, next) => {
  try {
    const retried = await retryDueDeliveries();
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [buckets, codes] = await Promise.all([
      prisma.rateLimitBucket.deleteMany({ where: { windowStart: { lt: dayAgo } } }),
      prisma.verificationCode.deleteMany({ where: { expiresAt: { lt: dayAgo } } }),
    ]);
    res.json({ retried, cleaned: { rateLimitBuckets: buckets.count, verificationCodes: codes.count } });
  } catch (error) {
    next(error);
  }
});

// Once a day: appointment reminders for tomorrow + AI digests.
router.all('/daily', async (_req, res, next) => {
  try {
    const reminders = await sendAppointmentReminders();

    const orgs = await prisma.organization.findMany({
      where: { aiEnabled: true, status: 'ACTIVE' },
      select: { id: true, name: true, slug: true },
    });
    let digests = 0;
    for (const org of orgs) {
      try {
        const digest = await createDailyDigest(org.id);
        if (!digest) continue;
        digests++;
        const admins = await prisma.user.findMany({
          where: { organizationId: org.id, role: 'ORG_ADMIN', isActive: true },
          select: { email: true },
        });
        const link = buildAppUrl('/analytics', org.slug);
        for (const admin of admins) {
          await sendNotificationEmail(admin.email, `${org.name}: yesterday at a glance`, `${digest.answer}

More detail: ${link}`, org.name);
        }
      } catch (error) {
        console.error(`Digest failed for org ${org.id}:`, error);
      }
    }
    res.json({ reminders, digests });
  } catch (error) {
    next(error);
  }
});

export default router;
