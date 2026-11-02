/** Date-local filters for the Scanner daily laboratory. No API or REAL data. */
const fmt = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit'
});
export function romeDay(value) {
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? fmt.format(d) : '';
}
export function isSameRomeDay(value, reference) {
  const a = romeDay(value), b = romeDay(reference);
  return !!a && !!b && a === b;
}
