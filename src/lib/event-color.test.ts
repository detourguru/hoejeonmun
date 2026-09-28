import { describe, expect, it } from "vitest";

import { getEventBarColor, getEventCardColor } from "./event-color";

describe.each([
  ["캘린더 이벤트 막대", getEventBarColor],
  ["이벤트 카드", getEventCardColor],
])("%s 색", (_, getColor) => {
  const normalColor = getColor("스페셜 커튼콜");

  it.each([["첫공"], ["막공"], ["프리뷰"]])(
    "첫공/막공, 프리뷰는 일반 이벤트와 다른 색으로 눈에 띄게 한다: %j",
    (title) => {
      expect(getColor(title)).not.toBe(normalColor);
    },
  );

  it("첫공/막공과 프리뷰도 서로 다른 색으로 구분한다", () => {
    expect(getColor("첫공")).not.toBe(getColor("프리뷰"));
  });

  it.each([["첫공 무대인사"], ["막공 기념 포토카드"], ["프리뷰 할인"]])(
    "이름에 첫공/막공, 프리뷰가 들어갔지만 실제 첫공/막공/프리뷰가 아닌 이벤트는 일반 이벤트 색으로 둔다: %j",
    (title) => {
      expect(getColor(title)).toBe(normalColor);
    },
  );
});
