// The server runs in UTC, the business is in Slovakia.
const bratislavaDate = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Bratislava',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Today's date in Bratislava as YYYY-MM-DD, independent of the machine's time zone and locale data. */
export function todayIso(now: Date = new Date()): string {
  // Built from parts: the order and separators of a formatted string depend on the runtime's locale data.
  const part = (type: 'year' | 'month' | 'day') =>
    bratislavaDate.formatToParts(now).find((p) => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
