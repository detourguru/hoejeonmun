import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  attachAmbiguousBadgeFlags,
  attachOverlappingEvents,
  attachSuggestedDuplicates,
  insertParseResult,
  logParseFailure,
  parseCastingBoardWithConsensus,
  toPendingEvents,
} from "@/service/casting-board";
import type { PendingEvent } from "@/type/casting";

import { maxDuration, POST } from "./route";

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getClaims: async () => ({ data: { claims: { sub: "user-1" } } }),
    },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: {
      from: () => ({
        download: async () => ({ data: new Blob(["image"]), error: null }),
      }),
    },
  }),
}));

vi.mock("@/service/show", () => ({
  getShow: async () => ({ mt20id: "PF301308" }),
}));

vi.mock("@/service/casting-board", () => ({
  attachAmbiguousBadgeFlags: vi.fn(),
  attachOverlappingEvents: vi.fn(),
  attachSuggestedDuplicates: vi.fn(),
  findDuplicateReasons: async () => [null],
  hashImages: async () => ["hash"],
  insertParseResult: vi.fn(),
  logParseFailure: vi.fn(),
  parseCastingBoardWithConsensus: vi.fn(),
  toPendingEvents: vi.fn(),
}));

const request = () =>
  new Request("http://localhost/api/casting-boards/parse", {
    method: "POST",
    body: JSON.stringify({
      showId: "PF301308",
      storagePaths: ["user-1/PF301308/weekly-event.jpg"],
    }),
  });

const event = {
  title: "스페셜 커튼콜 (장면시연) 위크",
  periodStart: "2026-11-09",
  periodEnd: "2026-11-15",
  printedStartWeekday: "월",
  printedEndWeekday: "일",
  imageIndex: 0,
};

const parsed = {
  performances: [],
  skipped: [],
  dateTags: [],
  events: [event],
  cancelledSlots: [],
  castingChanges: [],
  cancelledEvents: [],
  reason: "",
};

describe("POST /api/casting-boards/parse", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("분석이 끝나지 않으면 Vercel이 함수를 끊기 전에 시간 초과로 기록하고 응답한다", async () => {
    vi.mocked(parseCastingBoardWithConsensus).mockReturnValue(
      new Promise(() => {}),
    );

    let response: Response | undefined;

    void POST(request()).then((value) => {
      response = value;
    });

    await vi.advanceTimersByTimeAsync(maxDuration * 1000 - 1);

    expect(response?.status).toBe(504);
    await expect(response?.json()).resolves.toMatchObject({ retained: true });
    expect(logParseFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        showId: "PF301308",
        userId: "user-1",
        type: "timeout",
      }),
    );
  });

  it("분석이 마감 안에 끝나면 결과를 보관하고 시간 초과로 기록하지 않는다", async () => {
    const pending: PendingEvent[] = [
      { ...event, source: "notice", confirmReasons: [], overlapping: [] },
    ];

    vi.mocked(parseCastingBoardWithConsensus).mockResolvedValue(parsed);
    vi.mocked(toPendingEvents).mockReturnValue(pending);
    vi.mocked(attachOverlappingEvents).mockResolvedValue(pending);
    vi.mocked(attachAmbiguousBadgeFlags).mockResolvedValue(pending);
    vi.mocked(attachSuggestedDuplicates).mockResolvedValue(pending);
    vi.mocked(insertParseResult).mockResolvedValue("parse-1");

    const response = await POST(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      parseId: "parse-1",
      events: pending,
    });
    expect(logParseFailure).not.toHaveBeenCalled();
  });
});
