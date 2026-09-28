import { GoogleGenAI } from "@google/genai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExistingEvent, ParsedEvent, PendingEvent } from "@/type/casting";

import { judgeSameEventPairs } from "./event-judge";
import { dedupeEvents, groupSameEvents, suggestSameEvents } from "./events";

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

// Gemini가 answer를 JSON으로 답하게 만든다
const mockGeminiAnswer = (answer: object) => {
  const create = vi
    .fn()
    .mockResolvedValue({ output_text: JSON.stringify(answer) });

  vi.mocked(GoogleGenAI).mockImplementation(function () {
    return { interactions: { create } } as unknown as GoogleGenAI;
  });

  return create;
};

// Gemini가 "새 이벤트 incomingIndex번은 저장된 이벤트 savedId와 같다"고 답하게 만든다
const mockGeminiMatches = (
  matches: { incomingIndex: number; savedId: number }[],
) => mockGeminiAnswer({ matches });

// 한 번의 업로드에서 읽은 공지 이벤트
const parsed = (
  title: string,
  overrides: Partial<ParsedEvent> = {},
): ParsedEvent => ({
  title,
  periodStart: "2026-09-01",
  periodEnd: "2026-09-07",
  printedStartWeekday: "",
  printedEndWeekday: "",
  imageIndex: 0,
  ...overrides,
});

beforeEach(() => {
  vi.stubEnv("JEV_API_KEY", "test-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("suggestSameEvents", () => {
  describe("Jev 키가 있으면 Jev로 판정한다", () => {
    it("같은 이벤트일 확률이 기준(0.6) 이상인 저장된 이벤트 중 가장 높은 것을 같은 이벤트로 제안한다", async () => {
      vi.mocked(judgeSameEventPairs).mockResolvedValue([0.7, 0.8]);

      const result = await suggestSameEvents(
        [incoming()],
        [saved({ id: 1 }), saved({ id: 2 })],
      );

      expect(result).toStrictEqual(new Map([[0, 2]]));
    });

    it("기준(0.6) 이상인 저장된 이벤트가 없으면 새 이벤트로 두고 아무것도 제안하지 않는다", async () => {
      vi.mocked(judgeSameEventPairs).mockResolvedValue([0.3, 0.59]);

      const result = await suggestSameEvents(
        [incoming()],
        [saved({ id: 1 }), saved({ id: 2 })],
      );

      expect(result).toStrictEqual(new Map());
    });

    it("새 이벤트가 여럿이면 각각 따로 가장 비슷한 저장된 이벤트를 제안한다", async () => {
      vi.mocked(judgeSameEventPairs).mockResolvedValue([0.9, 0.1, 0.2, 0.7]);
      const newEvents = [incoming(), incoming({ title: "폴라로이드 증정" })];
      const savedEvents = [
        saved({ id: 1 }),
        saved({ id: 2, title: "폴라로이드 제공" }),
      ];

      const result = await suggestSameEvents(newEvents, savedEvents);

      expect(judgeSameEventPairs).toHaveBeenCalledExactlyOnceWith([
        [newEvents[0], savedEvents[0]],
        [newEvents[0], savedEvents[1]],
        [newEvents[1], savedEvents[0]],
        [newEvents[1], savedEvents[1]],
      ]);
      expect(result).toStrictEqual(
        new Map([
          [0, 1],
          [1, 2],
        ]),
      );
    });

    it.each([0.5999, 0.6])(
      "확률 0.6부터 같은 이벤트로 제안한다: %s",
      async (probability) => {
        vi.mocked(judgeSameEventPairs).mockResolvedValue([probability]);

        expect(
          await suggestSameEvents([incoming()], [saved({ id: 7 })]),
        ).toStrictEqual(probability === 0.6 ? new Map([[0, 7]]) : new Map());
      },
    );

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

describe("groupSameEvents", () => {
  it.each([0.5999, 0.6])(
    "확률 0.6부터 같은 그룹으로 묶는다: %s",
    async (probability) => {
      vi.mocked(judgeSameEventPairs).mockResolvedValue([probability]);

      expect(
        await groupSameEvents([parsed("커튼콜 위크"), parsed("커튼콜 주간")]),
      ).toStrictEqual(probability === 0.6 ? [[0, 1]] : []);
    },
  );

  it("A와 B, B와 C가 같다고 판정되면 A와 C의 확률이 낮아도 셋을 한 이벤트로 묶는다", async () => {
    vi.mocked(judgeSameEventPairs).mockResolvedValue([0.9, 0.1, 0.8]);

    const groups = await groupSameEvents([
      parsed("스페셜 커튼콜 위크"),
      parsed("스페셜커튼콜 주차"),
      parsed("스페셜 커튼콜 주간"),
    ]);

    expect(groups).toStrictEqual([[0, 1, 2]]);
  });

  it("같다고 판정된 쌍이 없으면 묶지 않는다", async () => {
    vi.mocked(judgeSameEventPairs).mockResolvedValue([0.1]);

    expect(
      await groupSameEvents([parsed("폴라로이드 증정"), parsed("사인회")]),
    ).toStrictEqual([]);
  });

  it("Jev 호출이 실패하면 Gemini가 묶은 결과를 쓴다", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(judgeSameEventPairs).mockRejectedValue(new Error("Jev 장애"));
    mockGeminiAnswer({ groups: [[0, 1]] });

    expect(
      await groupSameEvents([
        parsed("스페셜 커튼콜 위크"),
        parsed("스페셜 커튼콜 주차"),
      ]),
    ).toStrictEqual([[0, 1]]);
  });
});

describe("dedupeEvents", () => {
  it("제목(띄어쓰기·문장부호 무시)과 기간이 똑같은 이벤트는 AI에게 묻지 않고 하나만 남긴다", async () => {
    const first = parsed("스페셜 커튼콜 위크");

    const result = await dedupeEvents([first, parsed("스페셜커튼콜위크!")]);

    expect(result).toStrictEqual([first]);
    expect(judgeSameEventPairs).not.toHaveBeenCalled();
  });

  it("AI가 같은 이벤트로 묶은 것들은 먼저 나온 하나만 남기고 나머지는 버린다", async () => {
    vi.mocked(judgeSameEventPairs).mockResolvedValue([0.9, 0.1, 0.1]);
    const calendar = parsed("스페셜 커튼콜 위크");
    const notice = parsed("스페셜 커튼콜 주차", { imageIndex: 1 });
    const other = parsed("폴라로이드 증정");

    expect(await dedupeEvents([calendar, notice, other])).toStrictEqual([
      calendar,
      other,
    ]);
  });

  it("Jev와 Gemini가 모두 실패해도 이벤트를 버리지 않고 그대로 돌려줘 업로드가 멈추지 않게 한다", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(judgeSameEventPairs).mockRejectedValue(new Error("Jev 장애"));
    vi.mocked(GoogleGenAI).mockImplementation(function () {
      throw new Error("Gemini 장애");
    });
    const events = [parsed("스페셜 커튼콜 위크"), parsed("폴라로이드 증정")];

    expect(await dedupeEvents(events)).toStrictEqual(events);
  });
});
