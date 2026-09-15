import { XMLParser } from "fast-xml-parser";
import { cache } from "react";

// 정수 타입을 숫자형으로 파싱하면 에러가 나므로 전부 문자열로 반환
const parser = new XMLParser({ parseTagValue: false });

// Kopis 조회 시 100건이 최대치
export const KOPIS_MAX_ROWS = 100;

const KOPIS_MAX_CONCURRENCY = 8;
// 조회 한 번이 대기하는 최대 시간
const KOPIS_TOTAL_TIMEOUT_MS = 10_000;
// 요청 한 번에 주는 최대 시간
const KOPIS_ATTEMPT_TIMEOUT_MS = 5_000;
// KOPIS 는 정상 요청에도 간헐적으로 400 을 주므로 재시도
const KOPIS_MAX_ATTEMPTS = 4;
const KOPIS_RETRY_DELAY_MS = 400;

class KopisHttpError extends Error {
  constructor(
    readonly status: number,
    statusText: string,
  ) {
    super(`Failed to fetch data from KOPIS API: ${statusText}`);
  }
}

class KopisBudgetError extends Error {}

let inFlight = 0;
const pending: (() => void)[] = [];

function acquireSlot(deadline: number): Promise<void> {
  if (inFlight < KOPIS_MAX_CONCURRENCY) {
    inFlight++;

    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const grant = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(
      () => {
        const index = pending.indexOf(grant);

        if (index >= 0) pending.splice(index, 1);

        reject(new KopisBudgetError("KOPIS 동시 요청 대기 중 시간 초과"));
      },
      Math.max(0, deadline - Date.now()),
    );

    pending.push(grant);
  });
}

function releaseSlot() {
  const next = pending.shift();

  if (next) next();
  else inFlight--;
}

async function withSlot<T>(task: () => Promise<T>, deadline: number) {
  await acquireSlot(deadline);

  try {
    return await task();
  } finally {
    releaseSlot();
  }
}

export type KopisCacheOptions = {
  revalidate?: number | false; // 초 단위 / false 면 캐시하지 않는다
  tags?: string[];
};

// Kopis XML은 항목이 하나면 배열로 감싸지 않고 단일 값으로 내려준다
export function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];

  return Array.isArray(value) ? value : [value];
}

const isRetryable = (error: unknown) =>
  error instanceof KopisHttpError
    ? error.status === 400 || error.status === 429 || error.status >= 500
    : error instanceof TypeError ||
      (error instanceof DOMException && error.name === "TimeoutError");

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchKopisText = cache(
  async (url: string, cacheOptionsJson: string): Promise<string> => {
    const { revalidate, tags } = JSON.parse(cacheOptionsJson) as {
      revalidate: number | false;
      tags?: string[];
    };
    const deadline = Date.now() + KOPIS_TOTAL_TIMEOUT_MS;

    for (let attempt = 1; ; attempt++) {
      try {
        return await withSlot(async () => {
          const timeout = Math.min(
            KOPIS_ATTEMPT_TIMEOUT_MS,
            deadline - Date.now(),
          );

          if (timeout <= 0) {
            throw new KopisBudgetError("KOPIS 조회 시간 초과");
          }

          const response = await fetch(url, {
            ...(revalidate === false
              ? { cache: "no-store" as const }
              : { next: { revalidate, tags } }),
            signal: AbortSignal.timeout(timeout),
          });

          const text = await response.text();

          if (!response.ok) {
            throw new KopisHttpError(response.status, response.statusText);
          }

          return text;
        }, deadline);
      } catch (error) {
        const delay = KOPIS_RETRY_DELAY_MS * attempt + Math.random() * 200;

        if (
          attempt >= KOPIS_MAX_ATTEMPTS ||
          !isRetryable(error) ||
          Date.now() + delay >= deadline
        ) {
          throw error;
        }

        await sleep(delay);
      }
    }
  },
);

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

  const body = await fetchKopisText(
    `${baseUrl}${path}?service=${apiKey}&${params.toString()}`,
    JSON.stringify({ revalidate, tags }),
  );

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
