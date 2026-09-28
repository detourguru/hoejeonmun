import { describe, expect, it } from "vitest";

import { findNavSection } from "./nav-section";

describe("findNavSection", () => {
  // 하단 메뉴 순서 그대로 (짧은 경로가 먼저 와도 결과가 같아야 한다)
  const sections = ["/show", "/mypage", "/mypage/shows"];

  it("메뉴 첫 화면에서는 그 메뉴를 현재 메뉴로 표시한다", () => {
    expect(findNavSection("/mypage", sections)).toBe("/mypage");
  });

  it.each([
    ["/show/PF123", "/show"],
    ["/show/PF123/castings", "/show"],
    ["/mypage/settings", "/mypage"],
  ])(
    "메뉴의 하위 화면에 들어가도 그 메뉴를 현재 메뉴로 표시한다: %j",
    (pathname, expected) => {
      expect(findNavSection(pathname, sections)).toBe(expected);
    },
  );

  it("내 공연 하위 화면은 경로가 겹치는 마이페이지가 아니라 내 공연 메뉴로 표시한다", () => {
    expect(findNavSection("/mypage/shows/123", sections)).toBe(
      "/mypage/shows",
    );
  });

  it("이름 앞부분만 같은 다른 경로는 그 메뉴로 보지 않는다", () => {
    expect(findNavSection("/shows", sections)).toBeUndefined();
  });
});
