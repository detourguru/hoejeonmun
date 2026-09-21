export const SLOT_COLOR = "border border-border bg-sub text-text";

// 배우 식별 색상표. globals.css의 tone 토큰(브랜드 남색·노랑에서 출발한 차분한 8색)을 쓴다.
// 배우 id로 고르므로 어느 화면에서 봐도 같은 배우는 항상 같은 색이다.
const ACTOR_COLORS = [
  "bg-tone-1 text-tone-1-fg",
  "bg-tone-2 text-tone-2-fg",
  "bg-tone-3 text-tone-3-fg",
  "bg-tone-4 text-tone-4-fg",
  "bg-tone-5 text-tone-5-fg",
  "bg-tone-6 text-tone-6-fg",
  "bg-tone-7 text-tone-7-fg",
  "bg-tone-8 text-tone-8-fg",
] as const;

export function getActorColor(actorId: number): string {
  return ACTOR_COLORS[actorId % ACTOR_COLORS.length];
}
