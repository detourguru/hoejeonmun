export const SLOT_COLOR = "border border-border bg-sub text-text";

const ACTOR_COLORS = [
  "bg-tone-1 text-tone-1-fg",
  "bg-tone-2 text-tone-2-fg",
  "bg-tone-3 text-tone-3-fg",
  "bg-tone-4 text-tone-4-fg",
  "bg-tone-5 text-tone-5-fg",
  "bg-tone-6 text-tone-6-fg",
  "bg-tone-7 text-tone-7-fg",
  "bg-tone-8 text-tone-8-fg",
  "bg-tone-9 text-tone-9-fg",
  "bg-tone-10 text-tone-10-fg",
  "bg-tone-11 text-tone-11-fg",
  "bg-tone-12 text-tone-12-fg",
] as const;

export function getActorColorMap(actorIds: number[]): Map<number, string> {
  const unique = [...new Set(actorIds)];

  return new Map(
    unique.map((id, index) => [id, ACTOR_COLORS[index % ACTOR_COLORS.length]]),
  );
}
