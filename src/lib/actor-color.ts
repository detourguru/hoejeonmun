export const SLOT_COLOR = "border border-border bg-sub text-text";

// 배우 식별 색상표. 무지개색 대신 브랜드 토큰(primary/point/text-muted)의 농도만 달리해 구분한다.
// 배우 id로 고르므로 어느 화면에서 봐도 같은 배우는 항상 같은 색이다.
const ACTOR_COLORS = [
  "bg-primary/15 text-primary",
  "bg-point/40 text-text",
  "bg-primary text-white",
  "bg-text-muted/20 text-text",
  "bg-primary/40 text-text",
] as const;

export function getActorColor(actorId: number): string {
  return ACTOR_COLORS[actorId % ACTOR_COLORS.length];
}
