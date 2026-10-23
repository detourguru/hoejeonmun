import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEADLINE_EXCEEDED, errorMessage, withDeadline } from "./api";

describe("errorMessage", () => {
  it("Error 객체는 그 메시지를 그대로 쓴다", () => {
    expect(errorMessage(new Error("요청 시간 초과"))).toBe("요청 시간 초과");
  });

  it("Error가 아니어도 message를 가진 객체(예: Supabase 에러)면 그 메시지를 쓴다", () => {
    expect(
      errorMessage({ message: "duplicate key value", code: "23505" }),
    ).toBe("duplicate key value");
  });

  it.each([[null], [undefined], ["문자열 에러"], [{ code: "23505" }]])(
    "메시지를 꺼낼 수 없으면 '알 수 없는 오류'로 보여 준다: %j",
    (error) => {
      expect(errorMessage(error)).toBe("알 수 없는 오류");
    },
  );
});

describe("withDeadline", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const settleAfter = <T>(ms: number, value: T) =>
    new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

  it("마감 전에 끝난 작업은 그 결과를 돌려준다", async () => {
    const result = withDeadline(settleAfter(1_000, "분석 완료"), 5_000);

    await vi.advanceTimersByTimeAsync(1_000);

    await expect(result).resolves.toBe("분석 완료");
  });

  it("마감까지 끝나지 않은 작업은 기다리지 않고 마감 초과를 알린다", async () => {
    const result = withDeadline(new Promise(() => {}), 5_000);

    await vi.advanceTimersByTimeAsync(5_000);

    await expect(result).resolves.toBe(DEADLINE_EXCEEDED);
  });

  it("마감 전에 실패한 작업은 그 에러를 그대로 던진다", async () => {
    const result = withDeadline(
      Promise.reject(new Error("Gemini 요청 실패")),
      5_000,
    );

    await expect(result).rejects.toThrow("Gemini 요청 실패");
  });
});
