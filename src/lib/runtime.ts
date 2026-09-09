export const DEFAULT_RUNTIME_MINUTES = 150;

export function parseRuntimeMinutes(raw?: string): number | null {
  if (!raw) return null;

  const hoursMatch = raw.match(/(\d+)\s*시간/);
  const minutesMatch = raw.match(/(\d+)\s*분/);

  if (!hoursMatch && !minutesMatch) return null;

  const hours = hoursMatch ? Number(hoursMatch[1]) : 0;
  const minutes = minutesMatch ? Number(minutesMatch[1]) : 0;

  return hours * 60 + minutes;
}
