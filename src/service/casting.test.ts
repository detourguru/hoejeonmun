import { describe, expect, it, vi } from "vitest";

import {
  getPairKey,
  groupByDate,
  groupBySlot,
  groupSignedUrlsByUploadId,
  pickRecentCastingUploads,
  SlotCastingRow,
} from "./casting";

vi.mock("server-only", () => ({}));

describe("getPairKey", () => {
  it("캐스팅표 앞 두 열의 배우를 주연 페어로 묶어 표시한다", () => {
    expect(getPairKey(["정휘", "김철수", "박영희", "이민수"])).toBe(
      "정휘·김철수",
    );
  });

  it("배우가 한 명뿐이면 그 배우만 표시한다", () => {
    expect(getPairKey(["정휘"])).toBe("정휘");
  });
});

describe("groupByDate", () => {
  it("같은 날짜의 항목끼리 들어온 순서대로 묶는다", () => {
    const grouped = groupByDate([
      { date: "2026-09-28", time: "19:30" },
      { date: "2026-09-29", time: "14:00" },
      { date: "2026-09-28", time: "14:00" },
    ]);

    expect([...grouped.entries()]).toStrictEqual([
      [
        "2026-09-28",
        [
          { date: "2026-09-28", time: "19:30" },
          { date: "2026-09-28", time: "14:00" },
        ],
      ],
      ["2026-09-29", [{ date: "2026-09-29", time: "14:00" }]],
    ]);
  });
});

// slot_castings 뷰에서 읽은 배우 한 명 행
const row = (overrides: Partial<SlotCastingRow> = {}): SlotCastingRow => ({
  slot_id: 1,
  upload_id: 10,
  date: "2026-09-28",
  time: "19:30:00",
  role_name_raw: "햄릿",
  actor_name_raw: "김배우",
  actor_id: 100,
  verified: false,
  assignment_id: 1000,
  role_order: 0,
  upload_source: "user",
  fallback: false,
  variant: null,
  ...overrides,
});

describe("groupBySlot", () => {
  it("배우별로 나뉜 행을 회차 하나의 캐스팅으로 묶고, 캐스팅표에 적힌 순서를 지킨다", () => {
    const [slot] = groupBySlot([
      row({ role_name_raw: "햄릿", actor_name_raw: "김배우" }),
      row({ role_name_raw: "오필리아", actor_name_raw: "박배우" }),
    ]);

    expect(
      slot.casting.map(({ role, actor }) => `${role}:${actor}`),
    ).toStrictEqual(["햄릿:김배우", "오필리아:박배우"]);
  });

  it("다른 회차의 행은 회차별로 따로 묶는다", () => {
    const slots = groupBySlot([
      row({ slot_id: 1 }),
      row({ slot_id: 2, time: "14:00:00" }),
      row({ slot_id: 1, role_name_raw: "오필리아" }),
    ]);

    expect(slots.map(({ id, casting }) => [id, casting.length])).toStrictEqual([
      [1, 2],
      [2, 1],
    ]);
  });

  it("DB의 초 단위 시각(19:30:00)은 화면에 보이는 19:30으로 줄인다", () => {
    const [slot] = groupBySlot([row({ time: "19:30:00" })]);

    expect(slot.time).toBe("19:30");
  });

  it("앙상블처럼 한 배역에 배우가 여럿이면 모두 남긴다", () => {
    const [slot] = groupBySlot([
      row({ role_name_raw: "앙상블", actor_name_raw: "김배우" }),
      row({ role_name_raw: "앙상블", actor_name_raw: "이배우" }),
    ]);

    expect(slot.casting.map(({ actor }) => actor)).toStrictEqual([
      "김배우",
      "이배우",
    ]);
  });

  it("업로드 정보(누가 올렸는지, 회차 구분 등)와 배우별 확인 여부를 화면에 넘긴다", () => {
    const [slot] = groupBySlot([
      row({
        upload_id: 10,
        upload_source: "system",
        fallback: true,
        variant: "ROOM SEOUL",
        actor_id: null,
        verified: true,
      }),
    ]);

    expect(slot).toMatchObject({
      uploadId: 10,
      uploadSource: "system",
      fallback: true,
      variant: "ROOM SEOUL",
      casting: [{ actorId: null, verified: true }],
    });
  });
});

describe("groupSignedUrlsByUploadId", () => {
  // 원본 이미지 경로 → 잠깐만 열리는 서명 주소
  const signedByPath = new Map([
    ["uploads/10/0.jpg", "https://signed/10-0"],
    ["uploads/10/1.jpg", "https://signed/10-1"],
    ["uploads/20/0.jpg", "https://signed/20-0"],
  ]);

  it("업로드마다 원본 이미지 주소를 이미지 순서대로 묶어서 원본 보기에서 올린 순서대로 보이게 한다", () => {
    const grouped = groupSignedUrlsByUploadId(
      [
        { upload_id: 10, storage_path: "uploads/10/0.jpg" },
        { upload_id: 20, storage_path: "uploads/20/0.jpg" },
        { upload_id: 10, storage_path: "uploads/10/1.jpg" },
      ],
      signedByPath,
    );

    expect([...grouped.entries()]).toStrictEqual([
      [10, ["https://signed/10-0", "https://signed/10-1"]],
      [20, ["https://signed/20-0"]],
    ]);
  });

  it("서명 주소를 못 받은 이미지(파일이 지워졌거나 서명 실패)는 깨진 이미지로 보이지 않게 빼고 나머지만 보여 준다", () => {
    const grouped = groupSignedUrlsByUploadId(
      [
        { upload_id: 10, storage_path: "uploads/10/0.jpg" },
        { upload_id: 10, storage_path: "uploads/10/missing.jpg" },
      ],
      signedByPath,
    );

    expect(grouped.get(10)).toStrictEqual(["https://signed/10-0"]);
  });

  it("이미지를 하나도 못 받은 업로드는 목록에 넣지 않는다", () => {
    const grouped = groupSignedUrlsByUploadId(
      [{ upload_id: 30, storage_path: "uploads/30/missing.jpg" }],
      signedByPath,
    );

    expect(grouped.has(30)).toBe(false);
  });
});

describe("pickRecentCastingUploads", () => {
  const upload = (
    showId: string,
    createdAt: string,
    assignmentCount: number,
    eventCount: number,
  ) => ({
    show_id: showId,
    created_at: createdAt,
    assignments: [{ count: assignmentCount }],
    events: [{ count: eventCount }],
  });

  it("이벤트만 올린 업로드는 최근 소식에 캐스팅보드 업로드로 따로 띄우지 않는다", () => {
    expect(
      pickRecentCastingUploads([upload("PF1", "2026-10-01", 0, 2)], 10),
    ).toStrictEqual([]);
  });

  it("캐스팅과 이벤트를 함께 올린 업로드는 캐스팅보드 업로드로도 보여 준다", () => {
    expect(
      pickRecentCastingUploads([upload("PF1", "2026-10-01", 102, 3)], 10),
    ).toStrictEqual([{ showId: "PF1", uploadedAt: "2026-10-01" }]);
  });

  it("이벤트만 올린 최신 업로드에 가려지지 않고 그 공연의 마지막 캐스팅보드 업로드 시각을 보여 준다", () => {
    expect(
      pickRecentCastingUploads(
        [upload("PF1", "2026-10-01", 0, 1), upload("PF1", "2026-09-30", 80, 0)],
        10,
      ),
    ).toStrictEqual([{ showId: "PF1", uploadedAt: "2026-09-30" }]);
  });

  it("같은 공연에 캐스팅보드가 여러 번 올라와도 가장 최근 것 하나만 보여 준다", () => {
    expect(
      pickRecentCastingUploads(
        [
          upload("PF1", "2026-10-01", 50, 0),
          upload("PF2", "2026-09-30", 50, 0),
          upload("PF1", "2026-09-29", 50, 0),
        ],
        10,
      ),
    ).toStrictEqual([
      { showId: "PF1", uploadedAt: "2026-10-01" },
      { showId: "PF2", uploadedAt: "2026-09-30" },
    ]);
  });

  it("보여 줄 공연 수를 넘으면 거기서 자른다", () => {
    expect(
      pickRecentCastingUploads(
        [
          upload("PF1", "2026-10-01", 50, 0),
          upload("PF2", "2026-09-30", 50, 0),
        ],
        1,
      ),
    ).toStrictEqual([{ showId: "PF1", uploadedAt: "2026-10-01" }]);
  });
});
