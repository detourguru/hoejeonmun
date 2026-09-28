import { describe, expect, it } from "vitest";

import { errorMessage } from "./api";

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
