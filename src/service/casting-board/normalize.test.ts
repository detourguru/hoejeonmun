import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ExistingEvent,
  ParsedCancelledEvent,
  ParsedCancelledSlot,
  ParsedCastingChange,
  ParsedDateTag,
  ParsedEvent,
  ParsedPerformance,
  PerformanceSkipReason,
} from "@/type/casting";
import { ShowDetail } from "@/type/show";

import {
  agreesWithPrintedWeekday,
  dedupeByKey,
  findCastMismatchImageIndexes,
  hasKnownCastOverlap,
  isExactSameEvent,
  isNextDay,
  isPlaceholderActorName,
  mergePerSlotRuns,
  mergeSameDateTags,
  mergeWholeDayRuns,
  normalizeCancelledEvents,
  normalizeCancelledSlots,
  normalizeCastingChanges,
  normalizeDateTags,
  normalizeEvents,
  normalizeName,
  normalizePerformances,
  resolveRunWindow,
  sanitizeCutoffTime,
  sanitizeExactTimes,
  sanitizeSlotExceptions,
  slotKey,
  toKoreanWeekday,
  toPendingEvents,
  toTitleKey,
  unverifiedPoints,
} from "./normalize";

const show = (overrides: Partial<ShowDetail> = {}): ShowDetail => ({
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

// 2026-09-28은 월요일
const performance = (
  imageIndex: number,
  casting: Record<string, string[]>,
  overrides: Partial<ParsedPerformance> = {},
): ParsedPerformance => ({
  date: "2026-09-28",
  weekday: "월",
  time: "19:30",
  casting,
  imageIndex,
  confidence: 1,
  ...overrides,
});

const notice = (overrides: Partial<ParsedEvent> = {}): ParsedEvent => ({
  title: "폴라로이드 증정",
  periodStart: "2026-09-28",
  periodEnd: "2026-09-28",
  printedStartWeekday: "월",
  printedEndWeekday: "월",
  imageIndex: 0,
  ...overrides,
});

const dateTag = (
  tag: string,
  startDate: string,
  endDate: string,
  overrides: Partial<ParsedDateTag> = {},
): ParsedDateTag => ({
  tag,
  startDate,
  endDate,
  printedStartWeekday: "",
  printedEndWeekday: "",
  time: "",
  imageIndex: 1,
  ...overrides,
});

describe("mergeWholeDayRuns", () => {
  it("빈 배열이면 빈 배열을 반환한다", () => {
    expect(mergeWholeDayRuns([])).toStrictEqual([]);
  });

  it("순서가 섞여 있어도 연속된 날짜는 하나의 기간으로 합치고 떨어진 날짜는 따로 둔다", () => {
    expect(
      mergeWholeDayRuns([
        dateTag("프리뷰", "2026-09-03", "2026-09-03"),
        dateTag("프리뷰", "2026-09-01", "2026-09-01"),
        dateTag("프리뷰", "2026-09-02", "2026-09-02"),
        dateTag("프리뷰", "2026-09-05", "2026-09-05"),
      ]),
    ).toStrictEqual([
      dateTag("프리뷰", "2026-09-01", "2026-09-03"),
      dateTag("프리뷰", "2026-09-05", "2026-09-05"),
    ]);
  });

  it("여러 날에 걸친 배지도 끝나는 날 다음 날에 시작하는 배지와 합친다", () => {
    expect(
      mergeWholeDayRuns([
        dateTag("프리뷰", "2026-09-01", "2026-09-02"),
        dateTag("프리뷰", "2026-09-03", "2026-09-04"),
      ]),
    ).toStrictEqual([dateTag("프리뷰", "2026-09-01", "2026-09-04")]);
  });

  it("월이 바뀌어도 연속된 날짜면 합친다", () => {
    expect(
      mergeWholeDayRuns([
        dateTag("막공 주간", "2026-09-30", "2026-09-30"),
        dateTag("막공 주간", "2026-10-01", "2026-10-01"),
      ]),
    ).toStrictEqual([dateTag("막공 주간", "2026-09-30", "2026-10-01")]);
  });

  it("합친 기간은 첫 배지의 정보를 유지하고 끝 요일만 마지막 배지의 것으로 바꾼다", () => {
    expect(
      mergeWholeDayRuns([
        dateTag("프리뷰", "2026-09-01", "2026-09-01", {
          printedStartWeekday: "화",
          printedEndWeekday: "화",
          imageIndex: 0,
        }),
        dateTag("프리뷰", "2026-09-02", "2026-09-02", {
          printedStartWeekday: "수",
          printedEndWeekday: "수",
          imageIndex: 1,
        }),
      ]),
    ).toStrictEqual([
      dateTag("프리뷰", "2026-09-01", "2026-09-02", {
        printedStartWeekday: "화",
        printedEndWeekday: "수",
        imageIndex: 0,
      }),
    ]);
  });
});

describe("mergePerSlotRuns", () => {
  const slotTag = (
    date: string,
    time: string,
    overrides: Partial<ParsedDateTag> = {},
  ) => dateTag("커튼콜데이", date, date, { time, ...overrides });

  it("빈 배열이면 빈 배열을 반환한다", () => {
    expect(mergePerSlotRuns([])).toStrictEqual([]);
  });

  it("한 회차에만 붙은 배지는 합칠 대상이 없으면 회차 시각을 유지한 채 그대로 둔다", () => {
    expect(mergePerSlotRuns([slotTag("2026-09-01", "19:30")])).toStrictEqual([
      slotTag("2026-09-01", "19:30"),
    ]);
  });

  it("같은 날 여러 회차에 붙은 배지는 하나로 합치고, 적용 회차를 slots에 남긴다", () => {
    expect(
      mergePerSlotRuns([
        slotTag("2026-09-01", "19:30"),
        slotTag("2026-09-01", "14:00"),
      ]),
    ).toStrictEqual([
      dateTag("커튼콜데이", "2026-09-01", "2026-09-01", {
        slots: [
          { date: "2026-09-01", time: "14:00" },
          { date: "2026-09-01", time: "19:30" },
        ],
      }),
    ]);
  });

  it("연속된 날짜의 여러 회차에 붙은 배지는 하나의 기간으로 합치고, 적용 회차를 날짜/시각 순으로 slots에 남긴다", () => {
    expect(
      mergePerSlotRuns([
        slotTag("2026-09-02", "19:30"),
        slotTag("2026-09-01", "19:30"),
        slotTag("2026-09-02", "14:00"),
      ]),
    ).toStrictEqual([
      dateTag("커튼콜데이", "2026-09-01", "2026-09-02", {
        slots: [
          { date: "2026-09-01", time: "19:30" },
          { date: "2026-09-02", time: "14:00" },
          { date: "2026-09-02", time: "19:30" },
        ],
      }),
    ]);
  });

  it("날짜가 떨어진 회차의 배지는 합치지 않고, 혼자 남은 배지는 회차 시각을 유지한다", () => {
    expect(
      mergePerSlotRuns([
        slotTag("2026-09-01", "14:00"),
        slotTag("2026-09-01", "19:30"),
        slotTag("2026-09-05", "19:30"),
      ]),
    ).toStrictEqual([
      dateTag("커튼콜데이", "2026-09-01", "2026-09-01", {
        slots: [
          { date: "2026-09-01", time: "14:00" },
          { date: "2026-09-01", time: "19:30" },
        ],
      }),
      slotTag("2026-09-05", "19:30"),
    ]);
  });

  it("회차 배지를 합치면 첫 배지의 정보를 유지하고, 끝 요일은 마지막 회차 날짜의 요일로 채운다", () => {
    expect(
      mergePerSlotRuns([
        slotTag("2026-09-01", "19:30", {
          printedStartWeekday: "화",
          printedEndWeekday: "화",
          imageIndex: 0,
        }),
        slotTag("2026-09-02", "19:30", {
          printedStartWeekday: "수",
          printedEndWeekday: "",
          imageIndex: 1,
        }),
      ]),
    ).toStrictEqual([
      dateTag("커튼콜데이", "2026-09-01", "2026-09-02", {
        printedStartWeekday: "화",
        printedEndWeekday: "수",
        imageIndex: 0,
        slots: [
          { date: "2026-09-01", time: "19:30" },
          { date: "2026-09-02", time: "19:30" },
        ],
      }),
    ]);
  });
});

describe("mergeSameDateTags", () => {
  it("종류가 다른 배지는 날짜가 이어져도 합치지 않는다", () => {
    const result = mergeSameDateTags([
      dateTag("프리뷰", "2026-09-01", "2026-09-01"),
      dateTag("커튼콜데이", "2026-09-02", "2026-09-02"),
    ]);

    expect(result).toHaveLength(2);
    expect(result).toStrictEqual(
      expect.arrayContaining([
        dateTag("프리뷰", "2026-09-01", "2026-09-01"),
        dateTag("커튼콜데이", "2026-09-02", "2026-09-02"),
      ]),
    );
  });

  it("같은 종류라도 하루 전체 배지와 회차 배지는 서로 합치지 않는다", () => {
    const result = mergeSameDateTags([
      dateTag("프리뷰", "2026-09-01", "2026-09-01"),
      dateTag("프리뷰", "2026-09-02", "2026-09-02", { time: "19:30" }),
    ]);

    expect(result).toHaveLength(2);
    expect(result).toStrictEqual(
      expect.arrayContaining([
        dateTag("프리뷰", "2026-09-01", "2026-09-01"),
        dateTag("프리뷰", "2026-09-02", "2026-09-02", { time: "19:30" }),
      ]),
    );
  });

  it("같은 종류의 배지는 하루 전체 배지끼리, 회차 배지끼리 각각 합친다", () => {
    const result = mergeSameDateTags([
      dateTag("프리뷰", "2026-09-01", "2026-09-01"),
      dateTag("프리뷰", "2026-09-02", "2026-09-02"),
      dateTag("프리뷰", "2026-09-10", "2026-09-10", { time: "14:00" }),
      dateTag("프리뷰", "2026-09-10", "2026-09-10", { time: "19:30" }),
    ]);

    expect(result).toHaveLength(2);
    expect(result).toStrictEqual(
      expect.arrayContaining([
        dateTag("프리뷰", "2026-09-01", "2026-09-02"),
        dateTag("프리뷰", "2026-09-10", "2026-09-10", {
          slots: [
            { date: "2026-09-10", time: "14:00" },
            { date: "2026-09-10", time: "19:30" },
          ],
        }),
      ]),
    );
  });
});

describe("toKoreanWeekday", () => {
  it.each([["MON"], ["Mon."], ["monday"], ["월요일"], ["월"], [" 월 "]])(
    "영문/한글 표기와 상관없이 한 글자 한글 요일로 바꾼다: %j",
    (printed) => {
      expect(toKoreanWeekday(printed)).toBe("월");
    },
  );

  it.each([[""], ["  "]])(
    "요일이 적혀 있지 않으면 빈 문자열을 반환한다: %j",
    (printed) => {
      expect(toKoreanWeekday(printed)).toBe("");
    },
  );
});

describe("agreesWithPrintedWeekday", () => {
  // 2026-09-28은 월요일
  it.each([["월"], ["MON"], ["월요일"]])(
    "캐스팅보드에 적힌 요일이 실제 요일과 같으면 true를 반환한다: %j",
    (printed) => {
      expect(agreesWithPrintedWeekday("2026-09-28", printed)).toBe(true);
    },
  );

  it("캐스팅보드에 적힌 요일이 실제 요일과 다르면 false를 반환한다", () => {
    expect(agreesWithPrintedWeekday("2026-09-28", "화")).toBe(false);
  });

  it("요일이 적혀 있지 않으면 대조할 수 없으니 true를 반환한다", () => {
    expect(agreesWithPrintedWeekday("2026-09-28", "")).toBe(true);
  });
});

describe("isNextDay", () => {
  it.each([
    ["2026-09-28", "2026-09-29"],
    ["2026-09-30", "2026-10-01"],
    ["2026-12-31", "2027-01-01"],
    ["2028-02-28", "2028-02-29"],
  ])(
    "월/연도가 바뀌어도 바로 다음 날이면 true를 반환한다: %s → %s",
    (date, next) => {
      expect(isNextDay(date, next)).toBe(true);
    },
  );

  it.each([
    ["2026-09-28", "2026-09-28"],
    ["2026-09-28", "2026-09-30"],
    ["2026-09-29", "2026-09-28"],
  ])("같은 날, 이틀 뒤, 전날은 false를 반환한다: %s → %s", (date, next) => {
    expect(isNextDay(date, next)).toBe(false);
  });
});

describe("normalizeName", () => {
  it("앞뒤 공백을 지우고 사이의 연속 공백/줄바꿈은 공백 하나로 줄인다", () => {
    expect(normalizeName("  스페셜\n 커튼콜   위크 ")).toBe(
      "스페셜 커튼콜 위크",
    );
  });
});

describe("isPlaceholderActorName", () => {
  it.each([[""], ["-"], ["–"], ["—"], ["미정"], ["n/a"], ["N/A"], [" 미정 "]])(
    "배우 자리를 비워 둔 표시는 실제 배우가 아니다: %j",
    (name) => {
      expect(isPlaceholderActorName(name)).toBe(true);
    },
  );

  it("대소문자가 섞여 있어도 비워 둔 표시로 본다", () => {
    expect(isPlaceholderActorName("N/a")).toBe(true);
  });

  it("실제 배우 이름은 비워 둔 표시가 아니다", () => {
    expect(isPlaceholderActorName("정휘")).toBe(false);
  });
});

describe("slotKey", () => {
  it("날짜와 시각으로 회차 키를 만들고 시각의 초는 버린다", () => {
    expect(slotKey("2026-09-28", "19:30:00")).toBe("2026-09-28 19:30");
    expect(slotKey("2026-09-28", "19:30")).toBe("2026-09-28 19:30");
  });
});

describe("dedupeByKey", () => {
  it("키가 같은 항목은 처음 나온 것만 남기고 순서를 유지한다", () => {
    const items = [
      { id: 1, key: "a" },
      { id: 2, key: "b" },
      { id: 3, key: "a" },
      { id: 4, key: "c" },
    ];

    expect(dedupeByKey(items, (item) => item.key)).toStrictEqual([
      { id: 1, key: "a" },
      { id: 2, key: "b" },
      { id: 4, key: "c" },
    ]);
  });
});

describe("toTitleKey", () => {
  it.each([
    ["스페셜 커튼콜 위크"],
    [" 스페셜커튼콜위크 "],
    ["스페셜·커튼콜·위크"],
    ["[스페셜] 커튼콜 위크!"],
  ])("띄어쓰기, 문장부호만 다른 제목은 같은 키가 된다: %j", (title) => {
    expect(toTitleKey(title)).toBe("스페셜커튼콜위크");
  });

  it("영문은 소문자로 맞춘다", () => {
    expect(toTitleKey("Special Week")).toBe("specialweek");
  });
});

describe("isExactSameEvent", () => {
  const existing = (overrides: Partial<ExistingEvent> = {}): ExistingEvent => ({
    id: 1,
    groupId: 1,
    title: "스페셜 커튼콜 위크",
    periodStart: "2026-09-01",
    periodEnd: "2026-09-07",
    source: "badge",
    edited: false,
    ...overrides,
  });

  const pending = {
    title: "스페셜커튼콜위크!",
    periodStart: "2026-09-01",
    periodEnd: "2026-09-07",
  };

  it("제목 키와 기간이 모두 같으면 같은 이벤트다", () => {
    expect(isExactSameEvent(pending, existing())).toBe(true);
  });

  it.each([
    ["시작일", { periodStart: "2026-09-02" }],
    ["종료일", { periodEnd: "2026-09-08" }],
    ["제목", { title: "스페셜 커튼콜 데이" }],
  ])("%s이 다르면 같은 이벤트가 아니다", (_, overrides) => {
    expect(isExactSameEvent(pending, existing(overrides))).toBe(false);
  });

  it("정정된 이벤트는 최신 버전이 정정 내용을 가리지 않도록 자동으로 합칠 대상에서 뺀다", () => {
    expect(isExactSameEvent(pending, existing({ edited: true }))).toBe(false);
  });
});

describe("sanitizeSlotExceptions", () => {
  it("날짜 및 시각 형식이 맞지 않는 회차는 버린다", () => {
    expect(
      sanitizeSlotExceptions([
        { date: "2026-09-28", time: "19:30" },
        { date: "2026.09.28", time: "19:30" },
        { date: "2026-09-28", time: "7:30" },
        { date: "2026-09-28", time: "24:00" },
      ]),
    ).toStrictEqual([{ date: "2026-09-28", time: "19:30" }]);
  });

  it.each([[undefined], [[]], [[{ date: "", time: "" }]]])(
    "남는 회차가 없으면 undefined를 반환한다: %j",
    (slots) => {
      expect(sanitizeSlotExceptions(slots)).toBeUndefined();
    },
  );
});

describe("sanitizeExactTimes", () => {
  it("형식이 맞지 않는 시각은 버리고 중복은 하나만 남긴다", () => {
    expect(
      sanitizeExactTimes(["14:00", "19:30", "14:00", "오후 3시", "25:00"]),
    ).toStrictEqual(["14:00", "19:30"]);
  });

  it.each([[undefined], [[]], [["미정"]]])(
    "남는 시각이 없으면 undefined를 반환한다: %j",
    (times) => {
      expect(sanitizeExactTimes(times)).toBeUndefined();
    },
  );
});

describe("sanitizeCutoffTime", () => {
  it("앞뒤 공백을 지운 HH:mm 시각을 반환한다", () => {
    expect(sanitizeCutoffTime(" 18:00 ")).toBe("18:00");
  });

  it.each([[undefined], [""], ["6시"], ["18:60"]])(
    "HH:mm 형식이 아니면 undefined를 반환한다: %j",
    (time) => {
      expect(sanitizeCutoffTime(time)).toBeUndefined();
    },
  );
});

describe("resolveRunWindow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("오픈런이 아니면 KOPIS 공연 기간을 YYYY-MM-DD로 바꿔 쓴다", () => {
    expect(
      resolveRunWindow(
        show({ prfpdfrom: "2026.09.01", prfpdto: "2026.11.30" }),
      ),
    ).toStrictEqual({ from: "2026-09-01", to: "2026-11-30" });
  });

  it("오픈런은 공연 기간 대신 오늘 기준 앞뒤 3개월을 쓴다", () => {
    // 캐스팅보드엔 월/일만 적혀 있어, 수년짜리 오픈런 기간으로는 연도를 정할 수 없다
    vi.setSystemTime(new Date("2026-09-28T03:00:00Z"));

    expect(
      resolveRunWindow(
        show({ openrun: "Y", prfpdfrom: "2019.01.01", prfpdto: "2099.12.31" }),
      ),
    ).toStrictEqual({ from: "2026-06-28", to: "2026-12-28" });
  });

  it("오픈런의 '오늘'은 서울 날짜 기준이다", () => {
    // UTC로는 9/27이지만 서울은 9/28 00:00
    vi.setSystemTime(new Date("2026-09-27T15:00:00Z"));

    expect(resolveRunWindow(show({ openrun: "Y" }))).toStrictEqual({
      from: "2026-06-28",
      to: "2026-12-28",
    });
  });
});

describe("findCastMismatchImageIndexes", () => {
  const knownShow = show({ prfcast: "정휘, 김철수 등" });

  it("KOPIS 출연진과 겹치는 배우가 하나도 없는 이미지만 골라낸다", () => {
    expect(
      findCastMismatchImageIndexes(
        [
          performance(0, { 주인공: ["정휘"] }),
          performance(1, { 주인공: ["다른배우"] }),
        ],
        knownShow,
      ),
    ).toStrictEqual(new Set([1]));
  });

  it("같은 이미지의 회차 중 하나라도 겹치는 배우가 있으면 그 이미지는 맞는 것으로 본다", () => {
    expect(
      findCastMismatchImageIndexes(
        [
          performance(0, { 주인공: ["다른배우"] }),
          performance(0, { 주인공: ["다른배우"], 친구: ["김철수"] }),
        ],
        knownShow,
      ),
    ).toStrictEqual(new Set());
  });

  it("KOPIS 출연진 끝의 ' 등'을 떼고 대조한다", () => {
    expect(
      findCastMismatchImageIndexes(
        [performance(0, { 친구: ["김철수"] })],
        knownShow,
      ),
    ).toStrictEqual(new Set());
  });

  it("KOPIS 출연진 정보가 없으면 대조하지 않는다", () => {
    expect(
      findCastMismatchImageIndexes(
        [performance(0, { 주인공: ["다른배우"] })],
        show({ prfcast: undefined }),
      ),
    ).toStrictEqual(new Set());
  });

  it("오픈런은 KOPIS 출연진이 개막 당시 기준이라 대조하지 않는다", () => {
    expect(
      findCastMismatchImageIndexes(
        [performance(0, { 주인공: ["다른배우"] })],
        show({ openrun: "Y", prfcast: "정휘" }),
      ),
    ).toStrictEqual(new Set());
  });

  describe("hasKnownCastOverlap", () => {
    it("모든 이미지가 KOPIS 출연진과 겹치면 true를 반환한다", () => {
      expect(
        hasKnownCastOverlap([performance(0, { 주인공: ["정휘"] })], knownShow),
      ).toBe(true);
    });

    it("겹치지 않는 이미지가 하나라도 있으면 false를 반환한다", () => {
      expect(
        hasKnownCastOverlap(
          [
            performance(0, { 주인공: ["정휘"] }),
            performance(1, { 주인공: ["다른배우"] }),
          ],
          knownShow,
        ),
      ).toBe(false);
    });
  });
});

describe("normalizePerformances", () => {
  // 공연 기간 2026-09-01 ~ 2026-11-30, 이미지 1장
  const normalize = (performances: ParsedPerformance[]) =>
    normalizePerformances(performances, show({ prfcast: "정휘, 김철수" }), 1);

  it("날짜, 시각의 공백을 지우고 배역, 배우 이름을 정리한다", () => {
    expect(
      normalize([
        performance(
          0,
          {
            " 주인공 ": ["정 휘, 김철수 등", "정휘"],
            친구: ["미정"],
            "": ["이름없는배역"],
          },
          { date: " 2026-09-28 ", time: " 19:30 " },
        ),
      ]),
    ).toStrictEqual({
      performances: [performance(0, { 주인공: ["정휘", "김철수"] })],
      skipped: [],
    });
  });

  it.each<[string, Partial<ParsedPerformance>, PerformanceSkipReason]>([
    ["날짜 형식이 틀리면", { date: "9/28" }, "invalid_date"],
    ["시각 형식이 틀리면", { time: "7시 30분" }, "invalid_time"],
    ["공연 기간 밖이면", { date: "2026-12-01", weekday: "화" }, "out_of_range"],
    ["적힌 요일이 실제 요일과 다르면", { weekday: "화" }, "weekday_mismatch"],
    ["남는 배우가 없으면", { casting: { 주인공: ["미정"] } }, "empty_casting"],
    ["없는 이미지 번호면", { imageIndex: 1 }, "invalid_image_index"],
  ])("%s 회차를 빼고 이유를 남긴다", (_, overrides, reason) => {
    const raw = performance(0, { 주인공: ["정휘"] }, overrides);

    expect(normalize([raw])).toStrictEqual({
      performances: [],
      skipped: [{ imageIndex: raw.imageIndex, raw, reason }],
    });
  });

  it("같은 날짜, 시각의 회차가 또 나오면 처음 것만 남기고 뒤의 것은 중복으로 뺀다", () => {
    const first = performance(0, { 주인공: ["정휘"] });
    const second = performance(0, { 주인공: ["김철수"] });

    expect(normalize([first, second])).toStrictEqual({
      performances: [first],
      skipped: [{ imageIndex: 0, raw: second, reason: "duplicate" }],
    });
  });

  it("배역으로 잘못 읽힌 EPISODE 열은 회차 구분(variant)으로 옮긴다", () => {
    const { performances } = normalize([
      performance(0, { EPISODE: ["ROOM SEOUL"], 주인공: ["정휘"] }),
    ]);

    expect(performances).toStrictEqual([
      performance(0, { 주인공: ["정휘"] }, { variant: "ROOM SEOUL" }),
    ]);
  });

  it("회차 구분이 따로 읽혔으면 EPISODE 열보다 그 값을 쓴다", () => {
    const { performances } = normalize([
      performance(
        0,
        { EPISODE: ["ROOM SEOUL"], 주인공: ["정휘"] },
        { variant: "ROOM ALEPPO" },
      ),
    ]);

    expect(performances[0].variant).toBe("ROOM ALEPPO");
    expect(performances[0].casting).toStrictEqual({ 주인공: ["정휘"] });
  });

  it("KOPIS 출연진과 겹치지 않는 이미지의 회차는 빼지 않고 castMismatch로 표시한다", () => {
    const { performances } = normalize([
      performance(0, { 주인공: ["다른배우"] }),
    ]);

    expect(performances).toStrictEqual([
      performance(0, { 주인공: ["다른배우"] }, { castMismatch: true }),
    ]);
  });
});

describe("normalizeDateTags", () => {
  // 공연 기간 2026-09-01 ~ 2026-11-30, 이미지 2장
  // 회차: 9/28(월) 19:30, 9/29(화) 14:00/19:30
  const performances = [
    performance(0, { 주인공: ["정휘"] }),
    performance(0, { 주인공: ["정휘"] }, { date: "2026-09-29", time: "14:00" }),
    performance(0, { 주인공: ["정휘"] }, { date: "2026-09-29", time: "19:30" }),
  ];

  const normalize = (dateTags: ParsedDateTag[]) =>
    normalizeDateTags(dateTags, show(), 2, performances);

  it("배지 이름, 날짜, 요일, 시각의 앞뒤 공백을 지운다", () => {
    expect(
      normalize([
        dateTag(" 막공 ", " 2026-09-28 ", " 2026-09-28 ", {
          printedStartWeekday: " 월 ",
          printedEndWeekday: " 월 ",
          time: " 19:30 ",
        }),
      ]),
    ).toStrictEqual([
      dateTag("막공", "2026-09-28", "2026-09-28", {
        printedStartWeekday: "월",
        printedEndWeekday: "월",
        time: "19:30",
      }),
    ]);
  });

  it("회차에 붙은 배지는 그 날짜, 시각의 회차가 있으면 남긴다", () => {
    expect(
      normalize([
        dateTag("커튼콜데이", "2026-09-29", "2026-09-29", { time: "14:00" }),
      ]),
    ).toHaveLength(1);
  });

  it.each<[string, ParsedDateTag]>([
    ["배지 이름이 비어 있으면", dateTag(" ", "2026-09-28", "2026-09-28")],
    ["날짜 형식이 틀리면", dateTag("프리뷰", "9/28", "2026-09-28")],
    [
      "시작일이 종료일보다 늦으면",
      dateTag("프리뷰", "2026-09-29", "2026-09-28"),
    ],
    [
      "공연 시작 전 날짜가 있으면",
      dateTag("프리뷰", "2026-08-31", "2026-09-28"),
    ],
    [
      "공연 종료 뒤 날짜가 있으면",
      dateTag("프리뷰", "2026-09-28", "2026-12-01"),
    ],
    [
      "적힌 요일이 실제 요일과 다르면",
      dateTag("프리뷰", "2026-09-28", "2026-09-28", {
        printedStartWeekday: "화",
      }),
    ],
    [
      "하루 전체 배지인데 그 기간에 회차가 하나도 없으면",
      dateTag("프리뷰", "2026-10-05", "2026-10-06"),
    ],
    [
      "회차 배지의 시각 형식이 틀리면",
      dateTag("막공", "2026-09-28", "2026-09-28", { time: "7시 30분" }),
    ],
    [
      "회차 배지가 하루가 아니라 기간에 걸쳐 있으면",
      dateTag("막공", "2026-09-28", "2026-09-29", { time: "19:30" }),
    ],
    [
      "회차 배지의 날짜, 시각에 해당하는 회차가 없으면",
      dateTag("막공", "2026-09-28", "2026-09-28", { time: "14:00" }),
    ],
    [
      "없는 이미지 번호면",
      dateTag("프리뷰", "2026-09-28", "2026-09-28", { imageIndex: 2 }),
    ],
  ])("%s 버린다", (_, invalid) => {
    expect(normalize([invalid])).toStrictEqual([]);
  });

  it("같은 배지가 여러 번 읽히면 하나만 남긴다", () => {
    expect(
      normalize([
        dateTag("프리뷰", "2026-09-28", "2026-09-28"),
        dateTag("프리뷰", "2026-09-28", "2026-09-28", { imageIndex: 0 }),
      ]),
    ).toStrictEqual([dateTag("프리뷰", "2026-09-28", "2026-09-28")]);
  });

  it("검증을 통과한 배지는 연속된 날짜끼리 합친다", () => {
    expect(
      normalize([
        dateTag("프리뷰", "2026-09-28", "2026-09-28"),
        dateTag("프리뷰", "2026-09-29", "2026-09-29"),
      ]),
    ).toStrictEqual([dateTag("프리뷰", "2026-09-28", "2026-09-29")]);
  });
});

describe("unverifiedPoints", () => {
  // 9/28(월) 하루짜리 공지 이벤트, 요일까지 맞게 적혀 있어 확인할 게 없는 상태
  const event = (
    overrides: Partial<Parameters<typeof unverifiedPoints>[0]> = {},
  ) => ({
    source: "notice" as const,
    periodStart: "2026-09-28",
    periodEnd: "2026-09-28",
    printedStartWeekday: "월",
    printedEndWeekday: "월",
    ...overrides,
  });

  it("날짜, 요일이 확실하고 모든 회차에 적용되면 업로더에게 확인을 요청하지 않는다", () => {
    expect(unverifiedPoints(event())).toStrictEqual([]);
  });

  it("캐스팅표 옆 배지가 여러 날에 걸치면, AI가 기간을 한 줄씩 잘못 읽었을 수 있어 확인을 요청한다", () => {
    expect(
      unverifiedPoints(
        event({
          source: "badge",
          periodEnd: "2026-09-29",
          printedEndWeekday: "화",
        }),
      ),
    ).toStrictEqual(["range_badge"]);
  });

  it("공지 이벤트는 기간이 글자로 적혀 있어, 여러 날에 걸쳐도 기간 때문에 확인을 요청하지 않는다", () => {
    expect(
      unverifiedPoints(
        event({ periodEnd: "2026-09-29", printedEndWeekday: "화" }),
      ),
    ).toStrictEqual([]);
  });

  it.each([[{ printedStartWeekday: "" }], [{ printedEndWeekday: "" }]])(
    "요일이 안 적혀 있으면 날짜를 제대로 읽었는지 검증할 수 없어 확인을 요청한다: %j",
    (overrides) => {
      expect(unverifiedPoints(event(overrides))).toStrictEqual([
        "no_printed_weekday",
      ]);
    },
  );

  it("적힌 요일이 날짜와 맞지 않으면 날짜(특히 연도)를 잘못 읽었을 수 있어 확인을 요청한다", () => {
    expect(unverifiedPoints(event({ printedEndWeekday: "화" }))).toStrictEqual([
      "weekday_mismatch",
    ]);
  });

  it.each([
    [{ includedSlots: [{ date: "2026-09-28", time: "19:30" }] }],
    [{ excludedSlots: [{ date: "2026-09-28", time: "19:30" }] }],
    [{ listedSlots: [{ date: "2026-09-28", time: "19:30" }] }],
    [{ periodStartCutoffTime: "18:00" }],
    [{ periodEndCutoffTime: "18:00" }],
  ])(
    "기간 중 일부 회차만 포함 혹은 제외되면 적용 회차를 잘못 읽었을 수 있어 확인을 요청한다: %j",
    (overrides) => {
      expect(unverifiedPoints(event(overrides))).toStrictEqual([
        "has_slot_exceptions",
      ]);
    },
  );

  it("AI가 '예외 없음'을 빈 목록으로 보내도 예외로 착각해 확인을 요청하지 않는다", () => {
    expect(
      unverifiedPoints(event({ includedSlots: [], exactTimes: [] })),
    ).toStrictEqual([]);
  });

  it("특정 시각 회차에만 적용되는 케이스는 AI가 시각을 잘못 해석했을 수 있어 확인을 요청한다", () => {
    expect(unverifiedPoints(event({ exactTimes: ["19:30"] }))).toStrictEqual([
      "has_specific_times",
    ]);
  });

  it("확인이 필요한 이유가 여러 개면 모두 업로더에게 보여 준다", () => {
    expect(
      unverifiedPoints(
        event({
          source: "badge",
          periodEnd: "2026-09-29",
          printedEndWeekday: "",
          exactTimes: ["19:30"],
        }),
      ),
    ).toStrictEqual([
      "range_badge",
      "no_printed_weekday",
      "has_specific_times",
    ]);
  });
});

describe("toPendingEvents", () => {
  it("공지에서 읽은 이벤트를 확인 화면에 올릴 형태로 바꾸고, 확인이 필요한 이유를 붙인다", () => {
    const [pending] = toPendingEvents([], [notice({ exactTimes: ["19:30"] })]);

    expect(pending).toMatchObject({
      title: "폴라로이드 증정",
      source: "notice",
      exactTimes: ["19:30"],
      confirmReasons: ["has_specific_times"],
      overlapping: [],
    });
  });

  it("캐스팅표 내에 붙은 이벤트 배지도 이벤트와 같은 형식으로 저장하고 배지 이름을 이벤트 제목으로 쓴다", () => {
    const [pending] = toPendingEvents(
      [
        dateTag("프리뷰", "2026-09-28", "2026-09-28", {
          printedStartWeekday: "월",
          printedEndWeekday: "월",
        }),
      ],
      [],
    );

    expect(pending).toMatchObject({
      title: "프리뷰",
      periodStart: "2026-09-28",
      periodEnd: "2026-09-28",
      source: "badge",
      confirmReasons: [],
    });
    expect(pending.exactTimes).toBeUndefined();
  });

  it("한 회차에만 붙은 배지는 그날의 다른 회차가 아니라 그 회차에만 적용되게 한다", () => {
    const [pending] = toPendingEvents(
      [dateTag("막공", "2026-09-28", "2026-09-28", { time: "19:30" })],
      [],
    );

    expect(pending.exactTimes).toStrictEqual(["19:30"]);
  });

  it("커튼콜데이 표시가 9/28 19:30, 9/29 14:00에만 있으면, 확인 화면에서도 이 두 회차에만 체크되도록 넘긴다", () => {
    const slots = [
      { date: "2026-09-28", time: "19:30" },
      { date: "2026-09-29", time: "14:00" },
    ];

    const [pending] = toPendingEvents(
      [dateTag("커튼콜데이", "2026-09-28", "2026-09-29", { slots })],
      [],
    );

    expect(pending.exactTimes).toBeUndefined();
    expect(pending.listedSlots).toStrictEqual(slots);
  });

  it("공지 이벤트 뒤에 배지를 이어 붙인다", () => {
    const pending = toPendingEvents(
      [dateTag("프리뷰", "2026-09-28", "2026-09-28")],
      [notice()],
    );

    expect(pending.map(({ source }) => source)).toStrictEqual([
      "notice",
      "badge",
    ]);
  });
});

describe("normalizeEvents", () => {
  // 공연 기간 2026-09-01 ~ 2026-11-30, 이미지 1장
  const normalize = (events: ParsedEvent[]) =>
    normalizeEvents(events, show(), 1);

  it("AI가 읽은 제목, 기간, 요일의 앞뒤 공백을 지우고, 내용 없는 설명은 없는 것으로 둔다", () => {
    const [event] = normalize([
      notice({
        title: " 폴라로이드 증정 ",
        description: "  ",
        periodStart: " 2026-09-28 ",
        periodEnd: " 2026-09-28 ",
        printedStartWeekday: " 월 ",
        printedEndWeekday: " 월 ",
      }),
    ]);

    expect(event).toMatchObject({
      title: "폴라로이드 증정",
      periodStart: "2026-09-28",
      periodEnd: "2026-09-28",
      printedStartWeekday: "월",
      printedEndWeekday: "월",
    });
    expect(event.description).toBeUndefined();
  });

  it.each<[string, Partial<ParsedEvent>]>([
    ["제목이 비어 있는", { title: " " }],
    ["날짜를 읽지 못한", { periodStart: "9/28" }],
    [
      "시작일이 종료일보다 늦은",
      { periodStart: "2026-09-29", periodEnd: "2026-09-28" },
    ],
    [
      "공연 시작 전에 끝나서 다른 공연 것으로 보이는",
      { periodStart: "2026-08-01", periodEnd: "2026-08-31" },
    ],
    [
      "공연이 끝난 뒤에 시작해서 다른 공연 것으로 보이는",
      { periodStart: "2026-12-01", periodEnd: "2026-12-31" },
    ],
    ["없는 이미지에서 나온", { imageIndex: 1 }],
  ])("%s 이벤트는 저장하지 않는다", (_, overrides) => {
    expect(normalize([notice(overrides)])).toStrictEqual([]);
  });

  it("공연 기간에 일부만 걸친 이벤트는 이 공연 것으로 보고 남긴다", () => {
    expect(
      normalize([
        notice({ periodStart: "2026-08-25", periodEnd: "2026-09-05" }),
      ]),
    ).toHaveLength(1);
  });

  it("요일이 날짜와 맞지 않아도 오탈자일 수 있어 버리지 않는다 (확인 화면에서 확인을 요청한다)", () => {
    expect(normalize([notice({ printedStartWeekday: "화" })])).toHaveLength(1);
  });

  it("적용 회차 정보 중 형식이 틀린 값만 걸러 내고 이벤트는 남긴다", () => {
    const [event] = normalize([
      notice({
        exactTimes: ["19:30", "오후 3시"],
        excludedSlots: [{ date: "9/28", time: "19:30" }],
        periodEndCutoffTime: "18:00",
      }),
    ]);

    expect(event).toMatchObject({
      exactTimes: ["19:30"],
      periodEndCutoffTime: "18:00",
    });
    expect(event.excludedSlots).toBeUndefined();
  });

  it("띄어쓰기, 문장부호만 다른 같은 이벤트가 여러 번 읽히면 처음 것 하나만 남긴다", () => {
    const first = notice({ title: "스페셜 커튼콜 위크" });

    const events = normalize([first, notice({ title: "스페셜커튼콜위크!" })]);

    expect(events).toHaveLength(1);
    expect(events[0].title).toBe("스페셜 커튼콜 위크");
  });

  it("제목이 같아도 기간이 다르면 다른 이벤트로 둔다", () => {
    expect(
      normalize([
        notice({ title: "스페셜 커튼콜 위크", periodEnd: "2026-09-28" }),
        notice({ title: "스페셜 커튼콜 위크", periodEnd: "2026-09-29" }),
      ]),
    ).toHaveLength(2);
  });
});

describe("normalizeCancelledSlots", () => {
  // 공연 기간 2026-09-01 ~ 2026-11-30, 이미지 1장
  const normalize = (slots: ParsedCancelledSlot[]) =>
    normalizeCancelledSlots(slots, show(), 1);

  const cancelled = (
    overrides: Partial<ParsedCancelledSlot> = {},
  ): ParsedCancelledSlot => ({
    date: "2026-09-28",
    time: "19:30",
    imageIndex: 0,
    ...overrides,
  });

  it("취소 공지에서 읽은 회차의 날짜, 시각 앞뒤 공백을 지운다", () => {
    expect(
      normalize([cancelled({ date: " 2026-09-28 ", time: " 19:30 " })]),
    ).toStrictEqual([cancelled()]);
  });

  it.each<[string, Partial<ParsedCancelledSlot>]>([
    ["날짜를 읽지 못한", { date: "9/28" }],
    ["시각을 읽지 못한", { time: "7시 30분" }],
    ["공연 기간 밖의", { date: "2026-12-01" }],
    ["없는 이미지에서 나온", { imageIndex: 1 }],
  ])("%s 회차 취소는 반영하지 않는다", (_, overrides) => {
    expect(normalize([cancelled(overrides)])).toStrictEqual([]);
  });

  it("같은 회차의 취소가 여러 번 읽히면 하나만 남긴다", () => {
    expect(
      normalize([cancelled(), cancelled({ date: " 2026-09-28 " })]),
    ).toStrictEqual([cancelled()]);
  });
});

describe("normalizeCastingChanges", () => {
  // 공연 기간 2026-09-01 ~ 2026-11-30, 이미지 1장
  const normalize = (changes: ParsedCastingChange[]) =>
    normalizeCastingChanges(changes, show(), 1);

  const change = (
    overrides: Partial<ParsedCastingChange> = {},
  ): ParsedCastingChange => ({
    date: "2026-09-28",
    time: "19:30",
    role: "주인공",
    actor: "김철수",
    imageIndex: 0,
    ...overrides,
  });

  it("바뀐 배우 이름은 띄어쓰기를 없애 등록된 배우와 맞추고, 배역 이름은 공백만 정리한다", () => {
    expect(
      normalize([change({ role: " 남자 주인공 ", actor: " 김 철수 " })]),
    ).toStrictEqual([change({ role: "남자 주인공", actor: "김철수" })]);
  });

  it.each<[string, Partial<ParsedCastingChange>]>([
    ["날짜를 읽지 못한", { date: "9/28" }],
    ["시각을 읽지 못한", { time: "7시 30분" }],
    ["공연 기간 밖의", { date: "2026-12-01" }],
    ["배역을 읽지 못한", { role: " " }],
    ["배우를 읽지 못한", { actor: " " }],
    ["배우가 '미정'인", { actor: "미정" }],
    ["없는 이미지에서 나온", { imageIndex: 1 }],
  ])("%s 캐스팅 변경은 반영하지 않는다", (_, overrides) => {
    expect(normalize([change(overrides)])).toStrictEqual([]);
  });

  it("같은 회차·같은 배역의 변경이 여러 번 읽히면 처음 것만 남긴다", () => {
    expect(
      normalize([change({ actor: "김철수" }), change({ actor: "정휘" })]),
    ).toStrictEqual([change({ actor: "김철수" })]);
  });

  it("같은 회차라도 배역이 다르면 각각의 변경으로 남긴다", () => {
    expect(
      normalize([change({ role: "주인공" }), change({ role: "친구" })]),
    ).toHaveLength(2);
  });
});

describe("normalizeCancelledEvents", () => {
  // 공연 기간 2026-09-01 ~ 2026-11-30, 이미지 1장
  const normalize = (events: ParsedCancelledEvent[]) =>
    normalizeCancelledEvents(events, show(), 1);

  const cancelled = (
    overrides: Partial<ParsedCancelledEvent> = {},
  ): ParsedCancelledEvent => ({
    title: "스페셜 커튼콜 위크",
    periodStart: "2026-09-28",
    periodEnd: "2026-10-04",
    imageIndex: 0,
    ...overrides,
  });

  it("취소 공지에서 읽은 이벤트의 제목, 기간 앞뒤 공백을 지운다", () => {
    expect(
      normalize([
        cancelled({
          title: " 스페셜 커튼콜 위크 ",
          periodStart: " 2026-09-28 ",
          periodEnd: " 2026-10-04 ",
        }),
      ]),
    ).toStrictEqual([cancelled()]);
  });

  it.each<[string, Partial<ParsedCancelledEvent>]>([
    ["제목이 비어 있는", { title: " " }],
    ["날짜를 읽지 못한", { periodStart: "9/28" }],
    [
      "시작일이 종료일보다 늦은",
      { periodStart: "2026-10-04", periodEnd: "2026-09-28" },
    ],
    [
      "공연 기간과 전혀 겹치지 않는",
      { periodStart: "2026-12-01", periodEnd: "2026-12-07" },
    ],
    ["없는 이미지에서 나온", { imageIndex: 1 }],
  ])("%s 이벤트 취소는 반영하지 않는다", (_, overrides) => {
    expect(normalize([cancelled(overrides)])).toStrictEqual([]);
  });

  it("공연 기간에 일부만 걸친 이벤트 취소는 반영한다", () => {
    expect(
      normalize([
        cancelled({ periodStart: "2026-11-25", periodEnd: "2026-12-05" }),
      ]),
    ).toHaveLength(1);
  });

  it("여러 이미지에서 같은 이벤트 취소를 띄어쓰기, 문장부호만 다르게 읽으면 처음 것 하나만 남긴다", () => {
    expect(
      normalize([cancelled(), cancelled({ title: "스페셜커튼콜위크!" })]),
    ).toStrictEqual([cancelled()]);
  });
});
