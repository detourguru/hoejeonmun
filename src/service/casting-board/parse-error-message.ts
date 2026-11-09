export type ParseErrorCategory = "image" | "overloaded" | "other";

export function classifyParseError(error: unknown): ParseErrorCategory {
  const message = error instanceof Error ? error.message : String(error);
  if (
    /429|503|RESOURCE_EXHAUSTED|UNAVAILABLE|quota|rate.limit|overload/i.test(
      message,
    )
  ) {
    return "overloaded";
  }
  if (
    /sharp|jpeg|jpg|png|webp|decode|corrupt|unsupported.image|invalid.image|Input buffer/i.test(
      message,
    )
  ) {
    return "image";
  }
  return "other";
}

export function parseErrorMessage(error: unknown): string {
  switch (classifyParseError(error)) {
    case "image":
      return "이미지를 읽지 못했어요. 같은 이미지 대신 다른 캡처나 원본 이미지로 다시 올려주세요.";
    case "overloaded":
      return "이미지 분석 서비스가 혼잡하거나 사용량 한도에 도달했어요. 잠시 후 다시 시도해 주세요.";
    default:
      return "캐스팅보드를 분석하지 못했어요. 잠시 후 다시 시도해 주세요.";
  }
}

export const NO_TABLE_MESSAGE =
  "이미지에서 캐스팅 표나 이벤트 안내를 찾지 못했어요. 날짜별 캐스팅 정보가 없다면 직접 등록 기능을 이용해 주세요.";
