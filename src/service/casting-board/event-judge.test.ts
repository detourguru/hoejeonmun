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
});
