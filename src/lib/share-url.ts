// 공유 링크에도 보던 달/보기 방식은 그대로 이어간다 (my-shows-tabs.tsx의 KEPT_PARAMS와 같은 목록)
const KEPT_PARAMS = ["month", "view"];

export function buildShareCalendarUrl(
  origin: string,
  token: string,
  searchParams: URLSearchParams,
): string {
  const params = new URLSearchParams();

  for (const key of KEPT_PARAMS) {
    const value = searchParams.get(key);

    if (value) params.set(key, value);
  }

  const query = params.toString();

  return `${origin}/share/${token}${query ? `?${query}` : ""}`;
}
