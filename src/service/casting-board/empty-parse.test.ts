import { describe, expect, it } from "vitest";

import { classifyEmptyParse } from "./empty-parse";

describe("classifyEmptyParse", () => {
  it("추출된 항목이 없으면 표 없음으로 분류하고 Gemini 설명을 노출하지 않는다", () => {
    const result = classifyEmptyParse({
      castingChanges: { extracted: 0, retained: 0 },
    });

    expect(result.type).toBe("no_table_found");
    expect(result.filteredReasons).toEqual({});
    expect(result.message).toContain("찾지 못했어요");
  });

  it("회차 없는 스윙 변경 공지 2건이 모두 탈락하면 별도 실패 유형과 원인을 남긴다", () => {
    const result = classifyEmptyParse({
      castingChanges: { extracted: 2, retained: 0 },
      events: { extracted: 0, retained: 0 },
    });

    expect(result.type).toBe("all_filtered");
    expect(result.filteredReasons.castingChanges.filtered).toBe(2);
    expect(result.filteredReasons.castingChanges.reason).toContain(
      "회차 없는 교체 공지는 지원하지 않음",
    );
    expect(result.message).toContain("현재 지원하지 않아요");
    expect(result.message).not.toContain("추출했습니다");
  });

  it("정규화 탈락 건수는 카테고리별로 기록한다", () => {
    const result = classifyEmptyParse({
      performances: { extracted: 3, retained: 1 },
      events: { extracted: 2, retained: 0 },
    });

    expect(result.filteredReasons.performances.filtered).toBe(2);
    expect(result.filteredReasons.events.filtered).toBe(2);
  });

  it("추출한 항목이 모두 유지되면 탈락으로 분류하지 않는다", () => {
    const result = classifyEmptyParse({
      performances: { extracted: 1, retained: 1 },
    });

    expect(result.type).toBe("no_table_found");
  });
});
