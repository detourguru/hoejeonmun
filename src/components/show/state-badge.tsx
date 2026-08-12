import { StateName } from "@/type/show";
import { Badge } from "../ui/badge";

const BADGE_VARIANT_BY_STATE = {
  개막예정: "upcoming",
  진행중: "ongoing",
} as const satisfies Record<StateName, string>;

export const StateBadge = ({ state }: { state: StateName }) => (
  <Badge variant={BADGE_VARIANT_BY_STATE[state]}>{state}</Badge>
);
