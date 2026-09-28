import { describe, it, expect } from "vitest";

import { normalizeActorName, splitActorNames } from "./actor-name";

describe("normalizeActorName", () => {
  it("배우 이름에 공백이 있을 경우 공백이 없는 상태로 만든다", () => {
    expect(normalizeActorName("정 휘")).toBe("정휘");
  });

  it("배우 이름 끝에 ' 등'이 포함된 경우 배우 이름만을 반환한다", () => {
    expect(normalizeActorName("정휘 등")).toBe("정휘");
  });

  it("배우 이름이 '등'으로 끝나는 경우에는 이름의 일부로 보고 제거하지 않는다", () => {
    expect(normalizeActorName("신호등")).toBe("신호등");
  });

  it("배우 이름과 ' 등' 사이에 공백이 1개 이상일 때에도 공백 없이 배우 이름만을 반환한다", () => {
    expect(normalizeActorName("정휘  등")).toBe("정휘");
    expect(normalizeActorName("정휘   등")).toBe("정휘");
  });
});

describe("splitActorNames", () => {
  it.each([["a,b,c"], ["a/b/c"], ["a·b·c"], ["a\nb\nc"]])(
    "문자열 %j를 받아 배열로 반환한다",
    (input) => {
      expect(splitActorNames(input)).toStrictEqual(["a", "b", "c"]);
    },
  );

  it.each([[""], [undefined]])("%j를 받아 빈 배열로 반환한다", (input) => {
    expect(splitActorNames(input)).toStrictEqual([]);
  });

  it("문자열 '정 휘, 김철수 등'을 받아 각 이름의 공백과 문자열 끝의 ' 등'을 제외하고 반환한다", () => {
    expect(splitActorNames("정 휘, 김철수 등")).toStrictEqual([
      "정휘",
      "김철수",
    ]);
  });
});
