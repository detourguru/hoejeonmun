import { describe, expect, it } from "vitest";

import {
  classifyParseError,
  NO_TABLE_MESSAGE,
  parseErrorMessage,
} from "./parse-error-message";

describe("parse error messages", () => {
  it("이미지 디코딩 오류는 다른 이미지 업로드를 안내한다", () => {
    const error = new Error("Input buffer contains unsupported image format");
    expect(classifyParseError(error)).toBe("image");
    expect(parseErrorMessage(error)).toContain("다른 캡처나 원본 이미지");
  });

  it.each(["429 RESOURCE_EXHAUSTED", "503 UNAVAILABLE"])(
    "서비스 한도/과부하 %s",
    (message) => {
      expect(classifyParseError(new Error(message))).toBe("overloaded");
      expect(parseErrorMessage(new Error(message))).toContain("잠시 후");
    },
  );

  it("기타 오류는 기존 안내를 유지한다", () => {
    expect(parseErrorMessage(new Error("unknown"))).toBe(
      "캐스팅보드를 분석하지 못했어요. 잠시 후 다시 시도해 주세요.",
    );
  });

  it("표가 없으면 직접 등록을 안내한다", () => {
    expect(NO_TABLE_MESSAGE).toContain("직접 등록");
  });
});
