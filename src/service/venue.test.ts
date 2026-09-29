import { describe, expect, it, vi } from "vitest";

import { parseSeatScale } from "./venue";

vi.mock("server-only", () => ({}));

describe("parseSeatScale", () => {
  // 좌석 수는 대극장 필터(1,000석 이상)에 쓰인다
  it.each([
    ["1200", 1200],
    ["1,200", 1200],
    ["1,200석", 1200],
    [" 350 ", 350],
  ])(
    "KOPIS가 쉼표나 '석'을 붙여 줘도 좌석 수를 숫자로 읽는다: %j",
    (raw, expected) => {
      expect(parseSeatScale(raw)).toBe(expected);
    },
  );

  it.each([[undefined], [""], ["미정"]])(
    "좌석 수가 없거나 숫자가 없으면 모르는 값으로 두어 대극장으로 잘못 분류하지 않는다: %j",
    (raw) => {
      expect(parseSeatScale(raw)).toBeNull();
    },
  );
});
