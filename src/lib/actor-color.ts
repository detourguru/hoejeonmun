// 페어 별로 배당받을 색 조합
const COLORS = [
  "bg-rose-100 text-rose-900",
  "bg-amber-100 text-amber-900",
  "bg-teal-100 text-teal-900",
  "bg-indigo-100 text-indigo-900",
  "bg-orange-100 text-orange-900",
  "bg-sky-100 text-sky-900",
  "bg-fuchsia-100 text-fuchsia-900",
  "bg-lime-100 text-lime-900",
  "bg-violet-100 text-violet-900",
  "bg-emerald-100 text-emerald-900",
  "bg-red-100 text-red-900",
  "bg-cyan-100 text-cyan-900",
] as const;

export const FALLBACK_COLOR = "bg-surface text-text";

// FIXME: 조합이 COLORS.length 보다 많으면 색이 겹칠 수 있다
// 전체 기간의 keys를 받아와야 달을 넘겨도 같은 페어가 동일한 색을 유지함
export function getColorMap(keys: string[]): Map<string, string> {
  const unique = [...new Set(keys)].filter(Boolean).sort();

  return new Map(
    unique.map((key, index) => [key, COLORS[index % COLORS.length]]),
  );
}
