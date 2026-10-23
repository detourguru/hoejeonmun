export const fail = (
  status: number,
  message: string,
  extra?: Record<string, unknown>,
) => Response.json({ message, ...extra }, { status });

export const errorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;

  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }

  return "알 수 없는 오류";
};

export const DEADLINE_EXCEEDED = Symbol("deadline-exceeded");

export async function withDeadline<T>(
  work: Promise<T>,
  ms: number,
): Promise<T | typeof DEADLINE_EXCEEDED> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<typeof DEADLINE_EXCEEDED>((resolve) => {
    timer = setTimeout(() => resolve(DEADLINE_EXCEEDED), Math.max(0, ms));
  });

  try {
    return await Promise.race([work, deadline]);
  } finally {
    clearTimeout(timer);
  }
}
