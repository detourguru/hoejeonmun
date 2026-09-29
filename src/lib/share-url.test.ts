import { describe, expect, it } from "vitest";

import { buildShareCalendarUrl } from "./share-url";

describe("buildShareCalendarUrl", () => {
  it("month/view는 그대로 쿼리에 담는다", () => {
    const searchParams = new URLSearchParams("month=2026-10&view=list");

    expect(
      buildShareCalendarUrl("https://example.com", "abc123", searchParams),
    ).toBe("https://example.com/share/abc123?month=2026-10&view=list");
  });

  it("쿼리가 없으면 물음표 없이 링크만 만든다", () => {
    const searchParams = new URLSearchParams();

    expect(
      buildShareCalendarUrl("https://example.com", "abc123", searchParams),
    ).toBe("https://example.com/share/abc123");
  });

  it("month/view 외의 파라미터(tab 등)는 공유 링크에 넣지 않는다", () => {
    const searchParams = new URLSearchParams("tab=favorite&month=2026-10");

    expect(
      buildShareCalendarUrl("https://example.com", "abc123", searchParams),
    ).toBe("https://example.com/share/abc123?month=2026-10");
  });
});
