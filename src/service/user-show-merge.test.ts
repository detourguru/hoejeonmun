import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchKopisAll } from "@/lib/kopis";
import { Show } from "@/type/show";

import { findKopisTwin } from "./user-show-merge";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/kopis", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/kopis")>()),
  fetchKopisAll: vi.fn(),
}));

// 사용자가 직접 등록한 공연
const userShow = {
  id: "local-1",
  title: "헬멧",
  period_start: "2026-09-01",
  period_end: "2026-11-30",
  venue: "플러스씨어터",
};

// 같은 기간에 KOPIS에서 찾은 공연
const kopisShow = (overrides: Partial<Show> = {}): Show => ({
  mt20id: "PF000001",
  prfnm: "헬멧 [대학로]",
  prfpdfrom: "2026.09.01",
  prfpdto: "2026.11.30",
  fcltynm: "플러스씨어터(구. 컬처스페이스엔유) (플러스씨어터)",
  poster: "",
  area: "서울특별시",
  genrenm: "연극",
  openrun: "N",
  prfstate: "공연중",
  ...overrides,
});

// 장르별로 한 번씩 조회하므로 첫 장르에서만 후보가 나오게 한다
const stubCandidates = (candidates: Show[]) => {
  vi.mocked(fetchKopisAll)
    .mockResolvedValueOnce(candidates)
    .mockResolvedValue([]);
};

describe("findKopisTwin", () => {
  beforeEach(() => {
    vi.mocked(fetchKopisAll).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("제목이 들어 있고 기간과 공연장이 같은 KOPIS 공연이 하나뿐이면 같은 공연으로 보고 합친다", async () => {
    const twin = kopisShow();
    stubCandidates([twin]);

    expect(await findKopisTwin(userShow)).toBe(twin);
  });

  it("공연장을 '플러스씨어터'처럼 짧게 적어도 KOPIS의 긴 공연장 이름 안에 있으면 같은 곳으로 본다", async () => {
    stubCandidates([kopisShow({ fcltynm: "플러스씨어터 (플러스씨어터)" })]);

    expect(await findKopisTwin(userShow)).not.toBeNull();
  });

  it.each<[string, Partial<Show>]>([
    ["시작일이 하루 다른", { prfpdfrom: "2026.09.02" }],
    ["종료일이 하루 다른", { prfpdto: "2026.11.29" }],
    ["공연장이 다른", { fcltynm: "링크아트센터 (벅스홀)" }],
    ["이름에 등록한 제목이 없는", { prfnm: "햄릿" }],
  ])(
    "%s KOPIS 공연은 다른 공연일 수 있어 합치지 않는다",
    async (_, overrides) => {
      stubCandidates([kopisShow(overrides)]);

      expect(await findKopisTwin(userShow)).toBeNull();
    },
  );

  it("조건에 맞는 KOPIS 공연이 둘 이상이면 어느 쪽인지 알 수 없어 합치지 않는다", async () => {
    stubCandidates([
      kopisShow({ mt20id: "PF000001" }),
      kopisShow({ mt20id: "PF000002" }),
    ]);

    expect(await findKopisTwin(userShow)).toBeNull();
  });

  it("제목이 한 글자뿐이면 엉뚱한 공연과 겹치기 쉬워 KOPIS를 찾아보지 않고 합치지 않는다", async () => {
    expect(await findKopisTwin({ ...userShow, title: "헬" })).toBeNull();
    expect(fetchKopisAll).not.toHaveBeenCalled();
  });

  it("'헬멧: 룸 서울'처럼 부제가 붙은 제목은 앞부분 '헬멧'으로 KOPIS를 검색한다", async () => {
    await findKopisTwin({ ...userShow, title: "헬멧: 룸 서울" });

    const [, params] = vi.mocked(fetchKopisAll).mock.calls[0];

    expect(params.get("shprfnm")).toBe("헬멧");
  });
});
