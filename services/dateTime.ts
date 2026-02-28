const EAT_TIME_ZONE = 'Africa/Nairobi';

const formatPartMap = (value: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  return {
    year: parts.find((part) => part.type === 'year')?.value ?? '1970',
    month: parts.find((part) => part.type === 'month')?.value ?? '01',
    day: parts.find((part) => part.type === 'day')?.value ?? '01',
  };
};

export const getDateIsoInTimeZone = (timeZone: string, source = new Date()) => {
  const { year, month, day } = formatPartMap(source, timeZone);
  return `${year}-${month}-${day}`;
};

export const getTodayIsoInEAT = (source = new Date()) => getDateIsoInTimeZone(EAT_TIME_ZONE, source);

export const parseIsoDateAsLocalMidnight = (isoDate: string) => new Date(`${isoDate}T00:00:00`);
