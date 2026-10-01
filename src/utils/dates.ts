/**
 * Calendar-date helpers for the training plan. Dates are local calendar
 * days stored as `YYYY-MM-DD` strings (no time, no time zone), so a
 * workout never shifts to another day when the user travels.
 */

export type ISODate = string;

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** Monday-first weekday letters for calendar headers. */
export const WEEKDAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function pad(n: number) {
  return n.toString().padStart(2, '0');
}

export function toISODate(date: Date): ISODate {
  const month = pad(date.getMonth() + 1);
  return `${date.getFullYear()}-${month}-${pad(date.getDate())}`;
}

/** Local midnight of an ISO date. */
export function parseISODate(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Whole days since 1970-01-01, so consecutive dates are consecutive numbers. */
export function dayNumber(iso: ISODate): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

export function todayISO(): ISODate {
  return toISODate(new Date());
}

export function addDays(iso: ISODate, days: number): ISODate {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

/** 0 = Monday ... 6 = Sunday. */
export function mondayIndex(iso: ISODate): number {
  return (parseISODate(iso).getDay() + 6) % 7;
}

/** Monday of the week containing the date. */
export function startOfWeek(iso: ISODate): ISODate {
  return addDays(iso, -mondayIndex(iso));
}

/** The 7 dates (Monday to Sunday) of the week containing the date. */
export function weekDates(iso: ISODate): ISODate[] {
  const monday = startOfWeek(iso);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** First day of the month containing the date. */
export function startOfMonth(iso: ISODate): ISODate {
  return `${iso.slice(0, 7)}-01`;
}

export function addMonths(iso: ISODate, months: number): ISODate {
  const date = parseISODate(startOfMonth(iso));
  date.setMonth(date.getMonth() + months);
  return toISODate(date);
}

export function isSameMonth(a: ISODate, b: ISODate) {
  return a.slice(0, 7) === b.slice(0, 7);
}

/**
 * Monday-first calendar grid for a month: whole weeks, padded with days
 * from the previous and next months.
 */
export function monthGrid(iso: ISODate): ISODate[][] {
  const first = startOfMonth(iso);
  const nextMonth = addMonths(first, 1);
  const weeks: ISODate[][] = [];
  let day = startOfWeek(first);
  while (day < nextMonth) {
    weeks.push(weekDates(day));
    day = addDays(day, 7);
  }
  return weeks;
}

export function dayOfMonth(iso: ISODate): number {
  return Number(iso.slice(8, 10));
}

/** "Wed" */
export function formatWeekdayShort(iso: ISODate): string {
  return WEEKDAYS[parseISODate(iso).getDay()].slice(0, 3);
}

/** "Wed 30" */
export function formatDayLabel(iso: ISODate): string {
  return `${formatWeekdayShort(iso)} ${dayOfMonth(iso)}`;
}

/** "October 2026" */
export function formatMonthLabel(iso: ISODate): string {
  const date = parseISODate(iso);
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * "Today, 7:42 AM", "Yesterday, 7:42 AM", or "Tue, 29 Sep, 7:42 AM" for a
 * moment in time (ms), in the device's local time.
 */
export function formatRunDateTime(timestamp: number, now: Date = new Date()): string {
  const date = new Date(timestamp);
  const hours = date.getHours();
  const time = `${hours % 12 === 0 ? 12 : hours % 12}:${pad(date.getMinutes())} ${
    hours < 12 ? 'AM' : 'PM'
  }`;

  const iso = toISODate(date);
  const today = toISODate(now);
  if (iso === today) return `Today, ${time}`;
  if (iso === addDays(today, -1)) return `Yesterday, ${time}`;
  const month = MONTHS[date.getMonth()].slice(0, 3);
  return `${formatWeekdayShort(iso)}, ${date.getDate()} ${month}, ${time}`;
}

/** "Wednesday, October 30", for screen readers. */
export function formatLongDate(iso: ISODate): string {
  const date = parseISODate(iso);
  const weekday = WEEKDAYS[date.getDay()];
  return `${weekday}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}
