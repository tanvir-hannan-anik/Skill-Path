/** Returns YYYY-MM-DD for a Date in the user's local timezone. */
export function toDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Returns the 5 days centered on today (today ± 2). */
export function rollingFiveDays(today: Date = new Date()) {
  return Array.from({ length: 5 }, (_, i) => {
    const date = addDays(today, i - 2);
    return {
      day: date.toLocaleDateString(undefined, { weekday: 'short' }),
      date: String(date.getDate()).padStart(2, '0'),
      fullDate: toDateKey(date),
      status: i < 2 ? 'past' : i === 2 ? 'today' : 'future',
    } as const;
  });
}
