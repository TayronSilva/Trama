const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

const MONTHS_SHORT = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

const WEEKDAYS = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
];

export const WEEKDAY_LABELS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];

const pad = (value) => String(value).padStart(2, '0');

const dateKey = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export function parseMonthParam(value, now = new Date()) {
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? '');
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (month >= 1 && month <= 12) return { year, month };
  }
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function monthBounds(year, month) {
  const lastDay = new Date(year, month, 0).getDate();
  return {
    start: `${year}-${pad(month)}-01`,
    end: `${year}-${pad(month)}-${pad(lastDay)}`,
  };
}

export function buildMonthGrid(year, month, today = new Date()) {
  const firstOfMonth = new Date(year, month - 1, 1);
  const mondayOffset = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(year, month - 1, 1 - mondayOffset);
  const todayKey = dateKey(today);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + index,
    );
    const key = dateKey(date);
    return {
      date: key,
      day: date.getDate(),
      inMonth: date.getFullYear() === year && date.getMonth() === month - 1,
      isToday: key === todayKey,
    };
  });
}

export function shiftMonth(year, month, delta) {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

export function parseLocalDateTime(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value ?? '');
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hours = Number(match[4]);
  const minutes = Number(match[5]);
  const date = new Date(year, month - 1, day, hours, minutes);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hours ||
    date.getMinutes() !== minutes
  ) {
    return null;
  }

  return date;
}

export function formatDateShort(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '');
  if (!match) return value;
  return `${Number(match[3])} ${MONTHS_SHORT[Number(match[2]) - 1]}`;
}

export function formatDateTime(value) {
  const date = parseLocalDateTime(value);
  if (!date) return value;
  return `${formatDateShort(value)}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatLongDate(value) {
  const date = parseLocalDateTime(`${value}T12:00`);
  if (!date) return value;
  return `${WEEKDAYS[date.getDay()]}, ${date.getDate()} de ${MONTHS[date.getMonth()]}`;
}

export function monthLabel(year, month) {
  return `${MONTHS[month - 1]} de ${year}`;
}

export function toInputValue(date) {
  return `${dateKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function tomorrowAt(hours, minutes, now = new Date()) {
  return toInputValue(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, hours, minutes));
}

export function dateWithOffset(days, hours, minutes, now = new Date()) {
  return toInputValue(new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, hours, minutes));
}
