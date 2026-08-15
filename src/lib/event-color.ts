const EVENT_COLORS = [
  "bg-point text-text",
  "bg-point/55 text-text",
  "bg-point/30 text-text",
  "bg-point/15 text-text",
  "bg-transparent text-text",
] as const;

export function getEventColorMap(ids: number[]): Map<number, string> {
  const unique = [...new Set(ids)].sort((a, b) => a - b);

  return new Map(
    unique.map((id, index) => [id, EVENT_COLORS[index % EVENT_COLORS.length]]),
  );
}
