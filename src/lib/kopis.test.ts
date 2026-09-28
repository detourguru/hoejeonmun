import { describe, expect, it } from "vitest";

import { toArray } from "./kopis";

describe("toArray", () => {
  // KOPIS XML은 항목이 하나면 객체로, 여럿이면 배열로 내려준다
  it("항목이 하나라서 객체로 온 값은 배열로 감싼다", () => {
    expect(toArray({ mt20id: "PF1" })).toStrictEqual([{ mt20id: "PF1" }]);
  });

  it("항목이 여럿이라 배열로 온 값은 그대로 쓴다", () => {
    const shows = [{ mt20id: "PF1" }, { mt20id: "PF2" }];

    expect(toArray(shows)).toBe(shows);
  });

  it.each([[undefined], [null]])(
    "항목이 없어 태그가 빠졌으면 빈 배열로 둔다: %j",
    (value) => {
      expect(toArray(value)).toStrictEqual([]);
    },
  );
});
