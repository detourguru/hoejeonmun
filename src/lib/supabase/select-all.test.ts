import { describe, expect, it, vi } from "vitest";

import { chunkArray, selectAllRows } from "./select-all";

// Supabase처럼 한 번에 from~to 범위만 돌려주는 가짜 테이블
const fakeTable = (rowCount: number) => {
  const rows = Array.from({ length: rowCount }, (_, index) => index);

  return vi.fn((from: number, to: number) =>
    Promise.resolve({ data: rows.slice(from, to + 1), error: null }),
  );
};

describe("selectAllRows", () => {
  it("1,000행이 넘는 조회도 나눠 읽어서 뒤쪽 행이 잘리지 않는다", async () => {
    const query = fakeTable(2500);

    const rows = await selectAllRows(query);

    expect(rows).toStrictEqual(
      Array.from({ length: 2500 }, (_, index) => index),
    );
    expect(query).toHaveBeenCalledTimes(3);
  });

  it("행 수가 1,000의 배수여도 다음 범위가 비는 걸 확인하고 멈춘다", async () => {
    const query = fakeTable(2000);

    const rows = await selectAllRows(query);

    expect(rows).toHaveLength(2000);
    expect(query).toHaveBeenCalledTimes(3);
  });

  it("범위를 겹치거나 건너뛰지 않고 0~999, 1000~1999 순서로 요청한다", async () => {
    const query = fakeTable(1500);

    await selectAllRows(query);

    expect(query.mock.calls).toStrictEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });

  it("중간에 조회가 실패하면 일부만 담긴 결과 대신 에러를 낸다", async () => {
    const failure = new Error("조회 실패");
    const query = vi
      .fn()
      .mockResolvedValueOnce({ data: Array(1000).fill(0), error: null })
      .mockResolvedValueOnce({ data: null, error: failure });

    await expect(selectAllRows(query)).rejects.toBe(failure);
  });

  it("지정한 페이지 크기로 요청하고 모든 행을 순서대로 합친다", async () => {
    const query = fakeTable(5);

    expect(await selectAllRows(query, 2)).toStrictEqual([0, 1, 2, 3, 4]);
    expect(query.mock.calls).toStrictEqual([
      [0, 1],
      [2, 3],
      [4, 5],
    ]);
  });
});

describe("chunkArray", () => {
  it("정해진 크기씩 나누고 남은 항목은 마지막 묶음에 담는다", () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toStrictEqual([[1, 2], [3, 4], [5]]);
  });

  it("빈 목록은 요청할 묶음이 없다", () => {
    expect(chunkArray([], 2)).toStrictEqual([]);
  });
});
