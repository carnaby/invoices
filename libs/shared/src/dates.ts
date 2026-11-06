// en-CA formats as YYYY-MM-DD. The server runs in UTC, the business is in Slovakia.
const bratislavaDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Bratislava',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Today's date in Bratislava as YYYY-MM-DD, independent of the machine's time zone. */
export function todayIso(now: Date = new Date()): string {
  return bratislavaDate.format(now);
}
