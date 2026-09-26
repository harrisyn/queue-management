import prisma from '../lib/prisma';
import { getStartOfDay, getEndOfDay } from '../utils/date';
import { consumeCredits } from '../middleware/subscription.middleware';
import { sendNotificationEmail } from '../utils/email';
import { getSmsProvider } from './sms';
import { readNotificationSettings } from './notifications.service';

const isRealEmail = (email: string) => !email.endsWith('@guest.qms.local');

/**
 * Reminds patients about tomorrow's appointments (APPOINTMENT_REMINDER),
 * once per appointment: the Notification row's queueEntryId holds
 * `appointment:<id>` as the dedupe key. Channels follow the org's
 * notification settings; each message uses a credit.
 */
export async function sendAppointmentReminders(): Promise<number> {
  const tomorrow = new Date(Date.now() + 86400000);
  const appointments = await prisma.appointment.findMany({
    where: {
      status: { in: ['SCHEDULED', 'CONFIRMED'] },
      slot: { startTime: { gte: getStartOfDay(tomorrow), lte: getEndOfDay(tomorrow) } },
    },
    include: {
      user: { select: { id: true, email: true, phone: true, firstName: true } },
      slot: { select: { startTime: true } },
      service: {
        select: {
          name: true,
          location: { select: { name: true, organization: { select: { id: true, name: true, notificationSettings: true, status: true } } } },
        },
      },
    },
    take: 5000,
  });

  const sms = getSmsProvider();
  let sent = 0;
  for (const appt of appointments) {
    const org = appt.service.location.organization;
    if (org.status !== 'ACTIVE') continue;
    const dedupeKey = `appointment:${appt.id}`;
    const already = await prisma.notification.findFirst({ where: { queueEntryId: dedupeKey, type: 'APPOINTMENT_REMINDER' } });
    if (already) continue;

    const settings = readNotificationSettings(org.notificationSettings);
    const time = appt.slot.startTime.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
    const message = `Reminder: your ${appt.service.name} appointment at ${appt.service.location.name} is tomorrow at ${time}. Please check in at reception when you arrive.`;

    let delivered = false;
    if (settings.email && isRealEmail(appt.user.email)) {
      const credit = await consumeCredits(org.id, 'EMAIL', 1, 'appointment reminder');
      if (credit.allowed && (await sendNotificationEmail(appt.user.email, 'Appointment reminder', message, org.name)).success) {
        delivered = true;
      }
    }
    if (settings.sms && appt.user.phone && sms) {
      const credit = await consumeCredits(org.id, 'SMS', 1, 'appointment reminder');
      if (credit.allowed && (await sms.send(appt.user.phone, `${org.name}: ${message}`)).success) delivered = true;
    }

    await prisma.notification.create({
      data: {
        userId: appt.user.id,
        type: 'APPOINTMENT_REMINDER',
        channel: delivered ? (settings.email && isRealEmail(appt.user.email) ? 'EMAIL' : 'SMS') : 'IN_APP',
        message,
        queueEntryId: dedupeKey,
      },
    });
    if (delivered) sent++;
  }
  return sent;
}
