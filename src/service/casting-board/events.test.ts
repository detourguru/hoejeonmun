import { GoogleGenAI } from "@google/genai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExistingEvent, PendingEvent } from "@/type/casting";

import { judgeSameEventPairs } from "./event-judge";
import { suggestSameEvents } from "./events";

vi.mock("server-only", () => ({}));
vi.mock("./event-judge", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./event-judge")>()),
  judgeSameEventPairs: vi.fn(),
}));
vi.mock("@google/genai", () => ({ GoogleGenAI: vi.fn() }));

// 새로 올린 캐스팅보드에서 읽은 이벤트
const incoming = (overrides: Partial<PendingEvent> = {}): PendingEvent => ({
  title: "스페셜 커튼콜 위크",
  periodStart: "2026-09-01",
  periodEnd: "2026-09-07",
  printedStartWeekday: "",
  printedEndWeekday: "",
  source: "notice",
  imageIndex: 0,
  confirmReasons: [],
  overlapping: [],
  ...overrides,
});

// 이미 저장돼 있는 이벤트
const saved = (overrides: Partial<ExistingEvent> = {}): ExistingEvent => ({
  id: 1,
  groupId: 1,
  title: "스페셜 커튼콜 주차",
  periodStart: "2026-09-01",
  periodEnd: "2026-09-07",
  source: "notice",
  edited: false,
  ...overrides,
});

// Gemini가 "새 이벤트 incomingIndex번은 저장된 이벤트 savedId와 같다"고 답하게 만든다
const mockGeminiMatches = (
  matches: { incomingIndex: number; savedId: number }[],
) => {
  const create = vi
    .fn()
    .mockResolvedValue({ output_text: JSON.stringify({ matches }) });

  vi.mocked(GoogleGenAI).mockImplementation(function () {
    return { interactions: { create } } as unknown as GoogleGenAI;
  });

  return create;
};

beforeEach(() => {
  vi.stubEnv("JEV_API_KEY", "test-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("suggestSameEvents", () => {
  describe("Jev 키가 있으면 Jev로 판정한다", () => {
    it("같은 이벤트일 확률이 기준(0.6)을 넘는 저장된 이벤트 중 가장 높은 것을 같은 이벤트로 제안한다", async () => {
      vi.mocked(judgeSameEventPairs).mockResolvedValue([0.7, 0.8]);

      const result = await suggestSameEvents(
        [incoming()],
        [saved({ id: 1 }), saved({ id: 2 })],
      );

      expect(result).toStrictEqual(new Map([[0, 2]]));
    });

    it("기준(0.6)을 넘는 저장된 이벤트가 없으면 새 이벤트로 두고 아무것도 제안하지 않는다", async () => {
      vi.mocked(judgeSameEventPairs).mockResolvedValue([0.3, 0.59]);

      const result = await suggestSameEvents(
        [incoming()],
        [saved({ id: 1 }), saved({ id: 2 })],
      );

      expect(result).toStrictEqual(new Map());
    });

    it("새 이벤트가 여럿이면 각각 따로 가장 비슷한 저장된 이벤트를 제안한다", async () => {
      vi.mocked(judgeSameEventPairs).mockResolvedValue([0.9, 0.1, 0.2, 0.7]);

      const result = await suggestSameEvents(
        [incoming(), incoming({ title: "폴라로이드 증정" })],
        [saved({ id: 1 }), saved({ id: 2 })],
      );

      expect(result).toStrictEqual(
        new Map([
          [0, 1],
          [1, 2],
        ]),
      );
    });

    it("Jev로 판정했으면 Gemini는 부르지 않는다", async () => {
      vi.mocked(judgeSameEventPairs).mockResolvedValue([0.9]);

      await suggestSameEvents([incoming()], [saved()]);

      expect(GoogleGenAI).not.toHaveBeenCalled();
    });
  });

  it("Jev 호출이 실패하면 Gemini로 대신 판정해 업로드가 멈추지 않게 한다", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(judgeSameEventPairs).mockRejectedValue(new Error("Jev 장애"));
    mockGeminiMatches([{ incomingIndex: 0, savedId: 1 }]);

    const result = await suggestSameEvents([incoming()], [saved({ id: 1 })]);

    expect(result).toStrictEqual(new Map([[0, 1]]));
    expect(console.error).toHaveBeenCalled();
  });

  it("Jev 키가 없으면 Jev를 부르지 않고 바로 Gemini로 판정한다", async () => {
    vi.stubEnv("JEV_API_KEY", "");
    const create = mockGeminiMatches([{ incomingIndex: 0, savedId: 1 }]);

    const result = await suggestSameEvents([incoming()], [saved({ id: 1 })]);

    expect(judgeSameEventPairs).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(1);
    expect(result).toStrictEqual(new Map([[0, 1]]));
  });
});
