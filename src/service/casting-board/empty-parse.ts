import { NO_TABLE_MESSAGE } from "./parse-error-message";

export type NormalizationCounts = Record<
  string,
  { extracted: number; retained: number }
>;

export function classifyEmptyParse(counts?: NormalizationCounts) {
  const filteredReasons: Record<string, { filtered: number; reason: string }> =
    {};

  for (const [category, count] of Object.entries(counts ?? {})) {
    const filtered = Math.max(0, count.extracted - count.retained);
    if (filtered === 0) continue;

    filteredReasons[category] = {
      filtered,
      reason:
        category === "castingChanges"
          ? "날짜·시간·배역·배우·공연 기간 또는 이미지 번호 조건 불일치 (회차 없는 교체 공지는 지원하지 않음)"
          : "날짜·시간·공연 기간 또는 필수 항목 등 정규화 조건 불일치",
    };
  }

  const allFiltered = Object.keys(filteredReasons).length > 0;

  return {
    type: allFiltered ? ("all_filtered" as const) : ("no_table_found" as const),
    filteredReasons,
    message: allFiltered
      ? "안내 내용을 읽었지만 날짜·회차 등의 정보를 확인할 수 없어 저장하지 못했어요. 회차 없는 캐스팅 변경 공지는 현재 지원하지 않아요. 날짜와 시간이 표시된 이미지를 사용해 주세요."
      : NO_TABLE_MESSAGE,
  };
}
