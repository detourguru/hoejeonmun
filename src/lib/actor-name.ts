export const normalizeActorName = (name: string) =>
  name
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s*등$/, "");

export function splitActorNames(value?: string): string[] {
  if (!value) return [];

  return value
    .split(/[,/·\n]/)
    .map(normalizeActorName)
    .filter(Boolean);
}

export const hasMoreActors = (value?: string) =>
  /\s*등$/.test(value?.trim() ?? "");
