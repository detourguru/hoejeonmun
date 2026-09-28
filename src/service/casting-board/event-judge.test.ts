import { describe, expect, it, vi } from "vitest";

import { askNouls } from "@/lib/typesafe";

import { judgeSameEventPairs } from "./event-judge";

vi.mock("@/lib/typesafe", () => ({ askNouls: vi.fn() }));

describe("judgeSameEventPairs", () => {
  it("이벤트 날짜가 크게 달라 판단이 필요없어 AI를 호출할 필요가 없을 때", async () => {
    const eventA = {
      title: "스페셜 커튼콜 위크",
      periodStart: "2026-09-01",
      periodEnd: "2026-09-07",
    };
    const eventB = {
      title: "스페셜 커튼콜 위크",
      periodStart: "2026-10-01",
      periodEnd: "2026-10-07",
    };

    const result = await judgeSameEventPairs([[eventA, eventB]]);

    expect(result).toStrictEqual([0]);
    expect(askNouls).not.toHaveBeenCalled();
  });

  it("이벤트 날짜가 겹쳐서 AI 판단이 필요해 호출을 해야할 때", async () => {
    vi.mocked(askNouls).mockResolvedValue({ pair_0: 0.9 });

    const eventA = {
      title: "스페셜 커튼콜 위크",
      periodStart: "2026-09-01",
      periodEnd: "2026-09-07",
    };
    const eventB = {
      title: "스페셜 커튼콜 위크",
      periodStart: "2026-09-01",
      periodEnd: "2026-09-07",
    };

    const result = await judgeSameEventPairs([[eventA, eventB]]);

    expect(askNouls).toHaveBeenCalled();
    expect(result).toStrictEqual([0.9]);
  });

  it("AI에게 여러 질문을 할때 100개씩 잘라서 호출한다", async () => {
    const firstAnswers = Object.fromEntries(
      Array.from({ length: 100 }, (_, index) => [`pair_${index}`, index / 100]),
    );
    vi.mocked(askNouls)
      .mockResolvedValueOnce(firstAnswers)
      .mockResolvedValueOnce({ pair_0: 0.99 });
    const eventA = {
      title: "스페셜 커튼콜 위크",
      periodStart: "2026-09-01",
      periodEnd: "2026-09-07",
    };
    const eventB = {
      title: "스페셜 커튼콜 위크",
      periodStart: "2026-09-01",
      periodEnd: "2026-09-07",
    };
    const pairs = Array.from(
      { length: 101 },
      (_, index) =>
        [
          { ...eventA, title: `공지 ${index}` },
          { ...eventB, title: `배지 ${index}` },
        ] as [typeof eventA, typeof eventB],
    );
    const result = await judgeSameEventPairs(pairs);

    expect(askNouls).toHaveBeenCalledTimes(2);
    const questions = vi.mocked(askNouls).mock.calls.map(([, batch]) => batch);
    expect(Object.keys(questions[0])).toHaveLength(100);
    expect(Object.keys(questions[1])).toStrictEqual(["pair_0"]);
    for (let index = 0; index < 100; index++) {
      expect(questions[0][`pair_${index}`]).toMatchObject({
        instructions: { a: `공지 ${index}`, b: `배지 ${index}` },
      });
    }
    expect(questions[1].pair_0).toMatchObject({
      instructions: { a: "공지 100", b: "배지 100" },
    });
    expect(result).toStrictEqual([
      ...Array.from({ length: 100 }, (_, index) => index / 100),
      0.99,
    ]);
  });

  it.each([
    ["2026-09-03", "2026-09-09", true],
    ["2026-09-04", "2026-09-09", false],
    ["2026-09-03", "2026-09-10", false],
  ])(
    "기간이 겹쳐도 시작일과 종료일 차이가 각각 2일 이내여야 묻는다: %s ~ %s",
    async (periodStart, periodEnd, shouldAsk) => {
      vi.mocked(askNouls).mockResolvedValue({ pair_0: 0.8 });
      const event = {
        title: "커튼콜",
        periodStart: "2026-09-01",
        periodEnd: "2026-09-07",
      };

      const result = await judgeSameEventPairs([
        [event, { ...event, periodStart, periodEnd }],
      ]);

      expect(askNouls).toHaveBeenCalledTimes(shouldAsk ? 1 : 0);
      expect(result).toStrictEqual([shouldAsk ? 0.8 : 0]);
    },
  );

  it("날짜 차이가 2일 이내여도 기간이 겹치지 않으면 묻지 않는다", async () => {
    const event = {
      title: "커튼콜",
      periodStart: "2026-09-01",
      periodEnd: "2026-09-01",
    };

    expect(
      await judgeSameEventPairs([
        [
          event,
          { ...event, periodStart: "2026-09-02", periodEnd: "2026-09-02" },
        ],
      ]),
    ).toStrictEqual([0]);
    expect(askNouls).not.toHaveBeenCalled();
  });

  it("날짜로 제외된 쌍이 섞여 있어도 응답을 원래 쌍의 위치에 넣는다", async () => {
    vi.mocked(askNouls).mockResolvedValue({ pair_0: 0.8, pair_1: 0.3 });
    const event = {
      title: "커튼콜",
      periodStart: "2026-09-01",
      periodEnd: "2026-09-07",
    };
    const distant = {
      ...event,
      periodStart: "2026-10-01",
      periodEnd: "2026-10-07",
    };

    const result = await judgeSameEventPairs([
      [event, distant],
      [event, event],
      [distant, event],
      [distant, distant],
    ]);

    expect(result).toStrictEqual([0, 0.8, 0, 0.3]);
    expect(askNouls).toHaveBeenCalledTimes(1);
    expect(Object.keys(vi.mocked(askNouls).mock.calls[0][1])).toStrictEqual([
      "pair_0",
      "pair_1",
    ]);
  });
});
