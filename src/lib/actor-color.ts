export const SLOT_COLOR = "border border-border bg-sub text-text";

// 배우 식별 색상표. 헷갈리지 않도록 색상환에서 고르게 떨어뜨린 색만 골랐다.
// 배우 id로 고르므로 어느 화면에서 봐도 같은 배우는 항상 같은 색이다.
const ACTOR_COLORS = [
  "bg-red-100 text-red-700",
  "bg-amber-100 text-amber-700",
  "bg-lime-100 text-lime-700",
  "bg-emerald-100 text-emerald-700",
  "bg-cyan-100 text-cyan-700",
  "bg-blue-100 text-blue-700",
  "bg-violet-100 text-violet-700",
  "bg-fuchsia-100 text-fuchsia-700",
] as const;

export function getActorColor(actorId: number): string {
  return ACTOR_COLORS[actorId % ACTOR_COLORS.length];
}
