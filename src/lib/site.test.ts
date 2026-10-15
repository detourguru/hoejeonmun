import { describe, expect, it } from "vitest";

import { isUpdateNoticeActive } from "./site";

describe("isUpdateNoticeActive", () => {
  it("공지 날짜 당일부터 이틀 뒤까지 3일 동안 띄운다", () => {
    expect(isUpdateNoticeActive("2026-10-08", "2026-10-08")).toBe(true);
    expect(isUpdateNoticeActive("2026-10-08", "2026-10-10")).toBe(true);
  });

  it("공지 날짜로부터 3일이 지나면 띄우지 않는다", () => {
    expect(isUpdateNoticeActive("2026-10-08", "2026-10-11")).toBe(false);
    expect(isUpdateNoticeActive("2026-10-08", "2026-10-15")).toBe(false);
  });

  it("월이 바뀌어도 3일을 센다", () => {
    expect(isUpdateNoticeActive("2026-09-29", "2026-10-01")).toBe(true);
    expect(isUpdateNoticeActive("2026-09-29", "2026-10-02")).toBe(false);
  });
});
