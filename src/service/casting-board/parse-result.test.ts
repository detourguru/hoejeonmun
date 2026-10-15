import { describe, expect, it } from "vitest";

import { checkParseResultAccess, PARSE_RESULT_TTL_HOURS } from "./parse-result";

const NOW = Date.parse("2026-10-15T12:00:00Z");
const HOUR = 60 * 60 * 1000;

const row = (
  overrides: Partial<{
    user_id: string;
    show_id: string;
    upload_id: number | null;
    created_at: string;
  }> = {},
) => ({
  user_id: "user-1",
  show_id: "PF1",
  upload_id: null,
  created_at: new Date(NOW - HOUR).toISOString(),
  ...overrides,
});

const context = { userId: "user-1", showId: "PF1", now: NOW };

describe("checkParseResultAccess", () => {
  it("본인이 방금 파싱한 같은 공연의 결과면 그대로 쓴다", () => {
    const stored = row();

    expect(checkParseResultAccess(stored, context)).toStrictEqual({
      ok: true,
      row: stored,
    });
  });

  it("보관된 결과가 없으면 다시 올리라고 한다", () => {
    expect(checkParseResultAccess(null, context)).toMatchObject({
      ok: false,
      status: 404,
    });
  });

  it("다른 사람의 파싱 결과는 없는 것과 똑같이 답한다", () => {
    expect(
      checkParseResultAccess(row({ user_id: "user-2" }), context),
    ).toStrictEqual(checkParseResultAccess(null, context));
  });

  it("다른 공연의 파싱 결과로는 저장할 수 없다", () => {
    expect(
      checkParseResultAccess(row({ show_id: "PF2" }), context),
    ).toMatchObject({ ok: false, status: 400 });
  });

  it("이미 저장에 쓴 결과는 다시 쓸 수 없다", () => {
    expect(
      checkParseResultAccess(row({ upload_id: 7 }), context),
    ).toMatchObject({ ok: false, status: 409 });
  });

  it("보관 기간이 지난 결과는 쓸 수 없고, 기간 안이면 쓸 수 있다", () => {
    const ttl = PARSE_RESULT_TTL_HOURS * HOUR;

    expect(
      checkParseResultAccess(
        row({ created_at: new Date(NOW - ttl - 1).toISOString() }),
        context,
      ),
    ).toMatchObject({ ok: false, status: 410 });
    expect(
      checkParseResultAccess(
        row({ created_at: new Date(NOW - ttl).toISOString() }),
        context,
      ),
    ).toMatchObject({ ok: true });
  });
});
