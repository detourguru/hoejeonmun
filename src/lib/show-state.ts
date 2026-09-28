import type { StateName } from "@/type/show";

export function computeShowState(
  periodStart: string,
  periodEnd: string,
  today: string,
): StateName {
  if (today < periodStart) return "공연예정";
  if (today > periodEnd) return "공연완료";

  return "공연중";
}
