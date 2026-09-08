// 즐겨찾기 배우 일정처럼 여러 공연이 한 캘린더에 섞일 때 공연별로 구분해서 보여준다
const SHOW_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
  "bg-cyan-100 text-cyan-700",
] as const;

export function getShowColorMap(showIds: string[]): Map<string, string> {
  const unique = [...new Set(showIds)].sort();

  return new Map(
    unique.map((id, index) => [id, SHOW_COLORS[index % SHOW_COLORS.length]]),
  );
}
