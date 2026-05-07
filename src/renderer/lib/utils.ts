export function pad2(n: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(2, '0');
}

export function getLocalDateString(date: Date = new Date()): string {
  return date.toISOString().split('T')[0];
}

export function formatMinutes(minutes: number): string {
  if (minutes < 1) return '< 1m';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
