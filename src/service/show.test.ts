import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Show } from "@/type/show";

import {
  filterShows,
  paginateShows,
  parseShowFilters,
  ShowFilters,
  sortShows,
} from "./show";

vi.mock("server-only", () => ({}));

const show = (overrides: Partial<Show> = {}): Show => ({
  mt20id: "PF000001",
  prfnm: "테스트 뮤지컬",
  prfpdfrom: "2026.09.01",
  prfpdto: "2026.11.30",
  fcltynm: "테스트 극장",
  poster: "",
  area: "서울특별시",
  genrenm: "뮤지컬",
  openrun: "N",
  prfstate: "공연중",
  ...overrides,
});

describe("parseShowFilters", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-28T03:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("주소창의 장르, 상태, 지역, 정렬 값 중 허용된 코드만 필터로 쓴다", () => {
    expect(
      parseShowFilters({
        shcate: "GGGA",
        prfstate: "02",
        signgucode: "43|44",
        sort: "openDate",
        venueType: "daehakro",
      }),
    ).toMatchObject({
      shcate: "GGGA",
      prfstate: "02",
      signgucode: "43|44",
      sort: "openDate",
      venueType: "daehakro",
    });
  });

  it("주소창을 직접 고쳐 없는 코드를 넣으면 그 필터는 무시한다", () => {
    expect(
      parseShowFilters({ shcate: "XXXX", prfstate: "99", sort: "popular" }),
    ).toMatchObject({
      shcate: undefined,
      prfstate: undefined,
      sort: undefined,
    });
  });

  it("같은 이름의 값이 여러 개 오면 첫 번째 값을 쓴다", () => {
    expect(parseShowFilters({ shcate: ["AAAA", "GGGA"] }).shcate).toBe("AAAA");
  });

  it("검색어는 앞뒤 공백을 지우고, 공백뿐이면 검색하지 않는다", () => {
    expect(parseShowFilters({ shprfnm: " 헬멧 " }).shprfnm).toBe("헬멧");
    expect(parseShowFilters({ shprfnm: "  " }).shprfnm).toBeUndefined();
  });

  describe("기간", () => {
    it("YYYY-MM-DD로 받은 기간을 KOPIS 형식(YYYYMMDD)으로 바꾼다", () => {
      expect(
        parseShowFilters({ from: "2026-10-01", to: "2026-10-31" }),
      ).toMatchObject({ from: "20261001", to: "20261031" });
    });

    it("시작일이 없거나 형식이 틀리면 서울 기준 오늘부터 찾는다", () => {
      expect(parseShowFilters({}).from).toBe("20260928");
      expect(parseShowFilters({ from: "10월 1일" }).from).toBe("20260928");
    });

    it("종료일이 없으면 시작일 하루만 찾는다", () => {
      expect(parseShowFilters({ from: "2026-10-01" })).toMatchObject({
        from: "20261001",
        to: "20261001",
      });
    });

    it("종료일이 시작일보다 앞서면 시작일 하루만 찾는다", () => {
      expect(
        parseShowFilters({ from: "2026-10-01", to: "2026-09-01" }),
      ).toMatchObject({ from: "20261001", to: "20261001" });
    });
  });

  it("페이지 번호는 1 이상의 정수만 쓰고, 그 외에는 첫 페이지로 둔다", () => {
    expect(parseShowFilters({ page: "3" }).page).toBe(3);

    for (const page of ["0", "-1", "1.5", "abc", undefined]) {
      expect(parseShowFilters({ page }).page).toBe(1);
    }
  });
});

describe("filterShows", () => {
  // 2026-10-01 하루를 찾는 기본 필터
  const filters = (overrides: Partial<ShowFilters> = {}): ShowFilters => ({
    page: 1,
    from: "20261001",
    to: "20261001",
    ...overrides,
  });

  it("고른 장르의 공연만 남긴다", () => {
    const musical = show({ genrenm: "뮤지컬" });
    const play = show({ genrenm: "연극" });

    expect(
      filterShows([musical, play], filters({ shcate: "AAAA" })),
    ).toStrictEqual([play]);
  });

  it("고른 공연 상태의 공연만 남긴다", () => {
    const running = show({ prfstate: "공연중" });
    const upcoming = show({ prfstate: "공연예정" });

    expect(
      filterShows([running, upcoming], filters({ prfstate: "01" })),
    ).toStrictEqual([upcoming]);
  });

  it("여러 도를 묶은 지역(예: 충청)을 고르면 그 도들의 공연을 모두 남긴다", () => {
    const north = show({ area: "충청북도" });
    const south = show({ area: "충청남도" });
    const seoul = show({ area: "서울특별시" });

    expect(
      filterShows([north, south, seoul], filters({ signgucode: "43|44" })),
    ).toStrictEqual([north, south]);
  });

  it("검색어는 띄어쓰기와 대소문자를 무시하고 공연 이름에 포함되는지 본다", () => {
    const helmet = show({ prfnm: "더 헬멧 ROOM SEOUL" });
    const other = show({ prfnm: "다른 공연" });

    expect(
      filterShows([helmet, other], filters({ shprfnm: "헬멧 room" })),
    ).toStrictEqual([helmet]);
  });

  it("공연 기간이 찾는 기간과 하루라도 겹치면 남기고, 겹치지 않으면 뺀다", () => {
    const overlapping = show({
      prfpdfrom: "2026.09.01",
      prfpdto: "2026.10.01",
    });
    const endedBefore = show({
      prfpdfrom: "2026.09.01",
      prfpdto: "2026.09.30",
    });
    const startsAfter = show({
      prfpdfrom: "2026.10.02",
      prfpdto: "2026.12.31",
    });

    expect(
      filterShows([overlapping, endedBefore, startsAfter], filters()),
    ).toStrictEqual([overlapping]);
  });
});

describe("paginateShows", () => {
  // 한 페이지 30개 기준, 65개면 30 / 30 / 5
  const shows = Array.from({ length: 65 }, (_, index) =>
    show({ mt20id: `PF${index}` }),
  );

  it("요청한 페이지의 공연과 전체 페이지 수를 돌려준다", () => {
    const { items, page, totalPages } = paginateShows(shows, 3);

    expect(items.map(({ mt20id }) => mt20id)).toStrictEqual([
      "PF60",
      "PF61",
      "PF62",
      "PF63",
      "PF64",
    ]);
    expect({ page, totalPages }).toStrictEqual({ page: 3, totalPages: 3 });
  });

  it("없는 페이지를 요청하면 가장 가까운 첫 페이지나 마지막 페이지를 보여 준다", () => {
    expect(paginateShows(shows, 0).page).toBe(1);
    expect(paginateShows(shows, 99).page).toBe(3);
  });

  it("공연이 없어도 빈 첫 페이지 하나로 보여 준다", () => {
    expect(paginateShows([], 1)).toStrictEqual({
      items: [],
      page: 1,
      totalPages: 1,
    });
  });
});

describe("sortShows", () => {
  it("공연중 → 공연예정 → 공연종료 순으로 먼저 나눈다", () => {
    const ended = show({ prfnm: "종료", prfstate: "공연완료" });
    const upcoming = show({ prfnm: "예정", prfstate: "공연예정" });
    const running = show({ prfnm: "진행", prfstate: "공연중" });

    expect(
      sortShows([ended, upcoming, running]).map(({ prfnm }) => prfnm),
    ).toStrictEqual(["진행", "예정", "종료"]);
  });

  it("기본은 곧 끝나는 공연부터 보여 준다 (오픈런이 있어 개막일보다 종료일 기준)", () => {
    const later = show({ prfnm: "늦게 끝남", prfpdto: "2026.12.31" });
    const sooner = show({ prfnm: "곧 끝남", prfpdto: "2026.10.31" });

    expect(sortShows([later, sooner]).map(({ prfnm }) => prfnm)).toStrictEqual([
      "곧 끝남",
      "늦게 끝남",
    ]);
  });

  it("개막일순을 고르면 먼저 개막한 공연부터 보여 준다", () => {
    const later = show({ prfnm: "늦게 개막", prfpdfrom: "2026.10.01" });
    const sooner = show({ prfnm: "먼저 개막", prfpdfrom: "2026.09.01" });

    expect(
      sortShows([later, sooner], "openDate").map(({ prfnm }) => prfnm),
    ).toStrictEqual(["먼저 개막", "늦게 개막"]);
  });

  it("날짜까지 같으면 공연 이름순으로 보여 준다", () => {
    const b = show({ prfnm: "나 공연" });
    const a = show({ prfnm: "가 공연" });

    expect(sortShows([b, a]).map(({ prfnm }) => prfnm)).toStrictEqual([
      "가 공연",
      "나 공연",
    ]);
  });

  it("받은 목록의 순서는 바꾸지 않고 새 목록을 돌려준다", () => {
    const original = [show({ prfnm: "나" }), show({ prfnm: "가" })];

    sortShows(original);

    expect(original.map(({ prfnm }) => prfnm)).toStrictEqual(["나", "가"]);
  });
});
