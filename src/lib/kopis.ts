import { XMLParser } from "fast-xml-parser";

// 정수 타입을 숫자형으로 파싱하면 에러가 나므로 전부 문자열로 반환
const parser = new XMLParser({ parseTagValue: false });

// Kopis 조회 시 100건이 최대치
export const KOPIS_MAX_ROWS = 100;

export type KopisCacheOptions = {
  revalidate?: number | false; // 초 단위 / false 면 캐시하지 않는다
  tags?: string[];
};

// Kopis XML은 항목이 하나면 배열로 감싸지 않고 단일 값으로 내려준다
export function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];

  return Array.isArray(value) ? value : [value];
}

export async function fetchKopis<T>(
  path: string,
  params: URLSearchParams,
  { revalidate = 60 * 60, tags }: KopisCacheOptions = {},
): Promise<T[]> {
  const baseUrl = process.env.NEXT_KOPIS_API_URL;
  const apiKey = process.env.KOPIS_API_KEY;

  if (!baseUrl || !apiKey) {
    throw new Error(
      "KOPIS API URL or API Key is not defined in environment variables.",
    );
  }

  const response = await fetch(
    `${baseUrl}${path}?service=${apiKey}&${params.toString()}`,
    revalidate === false
      ? { cache: "no-store" }
      : { next: { revalidate, tags } },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch data from KOPIS API: ${response.statusText}`,
    );
  }

  const body = await response.text();
  const parsed = parser.parse(body);

  // dbs가 없으면 200 응답이어도 에러응답임 (쿼터 초과, 키 만료 등)
  if (!parsed || !("dbs" in parsed)) {
    throw new Error(
      `KOPIS returned an error response for ${path}: ${body.slice(0, 200)}`,
    );
  }

  // dbs 는 있는데 db 가 없으면 조건에 맞는 공연이 없는 정상 응답임
  return toArray<T>(parsed.dbs?.db);
}

// 순회를 돌며 결과 호출
export async function fetchKopisAll<T>(
  path: string,
  params: URLSearchParams,
  {
    rows = KOPIS_MAX_ROWS,
    maxPages,
    ...cacheOptions
  }: KopisCacheOptions & { rows?: number; maxPages: number },
): Promise<T[]> {
  const collected: T[] = [];

  for (let cpage = 1; cpage <= maxPages; cpage++) {
    const pageParams = new URLSearchParams(params);
    pageParams.set("cpage", String(cpage));
    pageParams.set("rows", String(rows));

    const page = await fetchKopis<T>(path, pageParams, cacheOptions);

    collected.push(...page);

    if (page.length < rows) return collected;
  }

  console.warn(
    `[kopis] ${path} 결과가 maxPages(${maxPages})를 넘어 잘렸습니다. 총 ${collected.length}건까지만 반환합니다.`,
  );

  return collected;
}
