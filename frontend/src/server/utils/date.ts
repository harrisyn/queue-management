export const parseTimeToDate = (timeStr: string, baseDate: Date): Date => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const date = new Date(baseDate);
  date.setHours(hours, minutes, 0, 0);
  return date;
};

export const getStartOfDay = (date: Date = new Date()): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const getEndOfDay = (date: Date = new Date()): Date => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

export const isDayActive = (date: Date, activeDays: string): boolean => {
  const dayOfWeek = date.getDay();
  const activeDaysArray = activeDays.split(',').map(Number);
  return activeDaysArray.includes(dayOfWeek);
};

export const generateTimeSlots = (
  startTime: string,
  endTime: string,
  slotDuration: number,
  baseDate: Date
): { startTime: Date; endTime: Date }[] => {
  const slots: { startTime: Date; endTime: Date }[] = [];
  const start = parseTimeToDate(startTime, baseDate);
  const end = parseTimeToDate(endTime, baseDate);

  let currentStart = new Date(start);
  while (currentStart < end) {
    const slotEnd = new Date(currentStart.getTime() + slotDuration * 60000);
    if (slotEnd <= end) {
      slots.push({
        startTime: new Date(currentStart),
        endTime: slotEnd,
      });
    }
    currentStart = slotEnd;
  }

  return slots;
};

export const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};
