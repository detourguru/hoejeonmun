export const fail = (status: number, message: string) =>
  Response.json({ message }, { status });

export const errorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;

  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }

  return "알 수 없는 오류";
};
