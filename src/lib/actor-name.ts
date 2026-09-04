// 예: "정 휘"와 "정휘"를 동일 인물로 처리하기 위함
export const normalizeActorName = (name: string) =>
  name.replace(/\s+/g, "").replace(/등$/, "");

export function splitActorNames(value?: string): string[] {
  if (!value) return [];

  return value
    .split(/[,/·\n]/)
    .map(normalizeActorName)
    .filter(Boolean);
}

export const hasMoreActors = (value?: string) =>
  /\s*등$/.test(value?.trim() ?? "");
