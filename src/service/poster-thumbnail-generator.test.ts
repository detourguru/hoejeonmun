import { describe, expect, it, vi } from "vitest";

import { orderPending } from "./poster-thumbnail-generator";

vi.mock("server-only", () => ({}));

const POSTER = "http://www.kopis.or.kr/upload/poster/PF1.gif";

const failure = (
  showId: string,
  lastAttemptAt: string,
  sourceUrl = "kopis.or.kr/upload/poster/PF1.gif",
) =>
  [
    showId,
    {
      show_id: showId,
      source_url: sourceUrl,
      attempts: 1,
      last_attempt_at: lastAttemptAt,
    },
  ] as const;

const idsOf = ({ ordered }: ReturnType<typeof orderPending>) =>
  ordered.map(({ showId }) => showId);

describe("orderPending", () => {
  it("실패한 적 없는 포스터를 먼저 만들어서, 계속 실패하는 포스터 때문에 새 공연 썸네일이 밀리지 않게 한다", () => {
    const result = orderPending(
      [
        { showId: "FAILED", poster: POSTER },
        { showId: "NEW", poster: POSTER },
      ],
      new Map([failure("FAILED", "2026-09-28T00:00:00Z")]),
    );

    expect(idsOf(result)).toStrictEqual(["NEW", "FAILED"]);
  });

  it("실패한 포스터끼리는 가장 오래전에 시도한 것부터 다시 만든다", () => {
    const result = orderPending(
      [
        { showId: "RECENT", poster: POSTER },
        { showId: "OLD", poster: POSTER },
      ],
      new Map([
        failure("RECENT", "2026-09-28T12:00:00Z"),
        failure("OLD", "2026-09-27T12:00:00Z"),
      ]),
    );

    expect(idsOf(result)).toStrictEqual(["OLD", "RECENT"]);
  });

  it("실패한 뒤 포스터가 바뀐 공연은 새 포스터로 보고 먼저 만든다", () => {
    const result = orderPending(
      [
        { showId: "FAILED", poster: POSTER },
        {
          showId: "CHANGED",
          poster: "http://www.kopis.or.kr/upload/poster/PF2.gif",
        },
      ],
      new Map([
        failure("FAILED", "2026-09-28T00:00:00Z"),
        failure("CHANGED", "2026-09-27T00:00:00Z"),
      ]),
    );

    expect(idsOf(result)).toStrictEqual(["CHANGED", "FAILED"]);
    expect(
      result.failureOf({
        showId: "CHANGED",
        poster: "http://www.kopis.or.kr/upload/poster/PF2.gif",
      }),
    ).toBeUndefined();
  });

  it("주소 표기만 다른(https, www 유무) 같은 포스터는 실패한 포스터로 본다", () => {
    const result = orderPending(
      [
        {
          showId: "FAILED",
          poster: "https://kopis.or.kr/upload/poster/PF1.gif",
        },
      ],
      new Map([failure("FAILED", "2026-09-28T00:00:00Z")]),
    );

    expect(result.failureOf(result.ordered[0])).toBeDefined();
  });
});
