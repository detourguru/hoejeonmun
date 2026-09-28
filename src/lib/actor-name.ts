// 예: "정 휘"와 "정휘"를 동일 인물로 처리하기 위함
export const normalizeActorName = (name: string) =>
  name.replace(/ 등$/, "").replace(/\s+/g, "");

export function splitActorNames(value?: string): string[] {
  if (!value) return [];

  return value
    .split(/[,/·\n]/)
    .map(normalizeActorName)
    .filter(Boolean);
}
