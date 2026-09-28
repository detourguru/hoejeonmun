import { describe, expect, it } from "vitest";

import { describeGeminiError } from "./prompt";

describe("describeGeminiError", () => {
  it("원인(cause)으로 이어진 에러를 끝까지 따라가 로그 한 줄로 보여 준다", () => {
    const network = Object.assign(new Error("socket hang up"), {
      code: "ECONNRESET",
    });
    const error = new Error("Gemini 호출 실패", { cause: network });

    expect(describeGeminiError(error)).toBe(
      "Error: Gemini 호출 실패 <- caused by <- Error: socket hang up (code=ECONNRESET)",
    );
  });

  it("Error가 아닌 값이 던져지면 문자열로 바꿔 보여 준다", () => {
    expect(describeGeminiError("timeout")).toBe("timeout");
  });
});
