export function toNumber(value: unknown): number {
  if (value && typeof value === 'object' && 'toNumber' in value) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value);
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatMonthReference(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function monthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function addMonths(date: Date, months: number): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1),
  );
}

export function startOfDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function endOfDay(date: Date): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
}

export function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function endOfMonth(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999),
  );
}

export function dueDateForReference(reference: string, paymentDay: number): Date {
  const [year, month] = reference.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(paymentDay, daysInMonth);
  return new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
}

export function clampPaymentDay(day: number, year: number, month: number): number {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Math.min(Math.max(day, 1), daysInMonth);
}

export function nextPaymentDate(paymentDay: number, from = new Date()): Date {
  const year = from.getUTCFullYear();
  const month = from.getUTCMonth();
  const day = clampPaymentDay(paymentDay, year, month + 1);
  let candidate = new Date(Date.UTC(year, month, day));

  if (candidate < startOfDay(from)) {
    const nextMonth = month + 1;
    const nextYear = nextMonth > 11 ? year + 1 : year;
    const normalizedMonth = nextMonth % 12;
    const nextDay = clampPaymentDay(
      paymentDay,
      nextYear,
      normalizedMonth + 1,
    );
    candidate = new Date(Date.UTC(nextYear, normalizedMonth, nextDay));
  }

  return candidate;
}
