import { describe, expect, it } from "vitest";

import { firstGrapheme, graphemeLength, truncateGraphemes } from "./grapheme";

const RABBIT = "🐰";
// 👩 + ZWJ + ❤️ + ZWJ + 💋 + ZWJ + 👨 로 이어 붙인 결합 이모지
const KISS = "👩‍❤️‍💋‍👨";

describe("graphemeLength", () => {
  it.each([
    ["정휘", 2],
    [RABBIT, 1],
    [KISS, 1],
    [`휘${RABBIT}${KISS}`, 3],
    ["", 0],
  ])("%j는 눈에 보이는 글자 %i개로 센다", (value, expected) => {
    expect(graphemeLength(value)).toBe(expected);
  });
});

describe("truncateGraphemes", () => {
  it("이모지를 중간에서 자르지 않고 글자 단위로 자른다", () => {
    expect(truncateGraphemes(`${KISS}${RABBIT}정휘`, 2)).toBe(
      `${KISS}${RABBIT}`,
    );
  });

  it("최대 길이보다 짧으면 그대로 반환한다", () => {
    expect(truncateGraphemes("정휘", 10)).toBe("정휘");
  });
});

describe("firstGrapheme", () => {
  it.each([
    ["정휘", "정"],
    [`${KISS}정휘`, KISS],
    ["", ""],
  ])("%j의 첫 글자 → %j", (value, expected) => {
    expect(firstGrapheme(value)).toBe(expected);
  });
});
