import { describe, expect, it } from "vitest";

import { parseRuntimeMinutes } from "./runtime";

describe("parseRuntimeMinutes", () => {
  it.each([
    ["2시간 30분", 150],
    ["2시간", 120],
    ["100분", 100],
    ["1시간30분", 90],
    ["2 시간 10 분", 130],
  ])("%j → %i분", (raw, expected) => {
    expect(parseRuntimeMinutes(raw)).toBe(expected);
  });

  it("인터미션 안내가 붙어 있어도 앞의 공연 시간을 쓴다", () => {
    expect(parseRuntimeMinutes("2시간 30분(인터미션 15분 포함)")).toBe(150);
  });

  it.each([[undefined], [""], ["미정"]])(
    "시간 정보가 없으면 null을 반환한다: %j",
    (raw) => {
      expect(parseRuntimeMinutes(raw)).toBeNull();
    },
  );
});
