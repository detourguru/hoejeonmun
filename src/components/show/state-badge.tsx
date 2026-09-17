import { StateName } from "@/type/show";

import { Badge } from "../ui/badge";

const BADGE_VARIANT_BY_STATE = {
  공연예정: "upcoming",
  공연중: "ongoing",
  공연완료: "done",
} as const satisfies Record<StateName, string>;

export const StateBadge = ({ state }: { state: StateName }) => (
  <Badge variant={BADGE_VARIANT_BY_STATE[state]}>{state}</Badge>
);
