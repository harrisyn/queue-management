const prefixes = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const generateTicketNumber = (
  servicePrefix: string | null,
  sequenceNumber: number
): string => {
  const prefix = servicePrefix || prefixes[0];
  const paddedNumber = sequenceNumber.toString().padStart(3, '0');
  return `${prefix}${paddedNumber}`;
};

export const getNextSequence = async (
  prisma: any,
  queueId: string
): Promise<number> => {
  const lastEntry = await prisma.queueEntry.findFirst({
    where: { queueId },
    orderBy: { createdAt: 'desc' },
    select: { ticketNumber: true },
  });

  if (!lastEntry) return 1;

  const match = lastEntry.ticketNumber.match(/\d+$/);
  const lastNumber = match ? parseInt(match[0], 10) : 0;
  return lastNumber + 1;
};

export const generateQRData = (entry: {
  id: string;
  ticketNumber: string;
  queueId: string;
}): string => {
  return JSON.stringify({
    entryId: entry.id,
    ticket: entry.ticketNumber,
    queueId: entry.queueId,
    timestamp: new Date().toISOString(),
  });
};
