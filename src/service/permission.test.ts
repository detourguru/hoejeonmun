import { beforeEach, describe, expect, it, vi } from "vitest";

import { getIsAdmin } from "@/service/admin";

import {
  canManageUpload,
  CORRECTION_LIMIT_PER_HOUR,
  isCorrectionLimited,
  Requester,
} from "./permission";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/service/admin", () => ({ getIsAdmin: vi.fn() }));

const requester = {
  userId: "user-1",
  supabase: {},
} as unknown as Requester;

const adminWithCount = (result: { count: number | null; error: unknown }) => {
  const gte = vi.fn().mockResolvedValue(result);
  const query = { eq: vi.fn(() => query), gte };

  return {
    client: {
      from: () => ({ select: () => query }),
    } as unknown as Parameters<typeof isCorrectionLimited>[0],
    query,
  };
};

describe("canManageUpload", () => {
  beforeEach(() => {
    vi.mocked(getIsAdmin).mockReset();
  });

  it("본인 업로드는 관리자인지 묻지 않고 허용한다", async () => {
    await expect(canManageUpload(requester, "user-1")).resolves.toBe(true);
    expect(getIsAdmin).not.toHaveBeenCalled();
  });

  it("남의 업로드는 관리자만 허용한다", async () => {
    vi.mocked(getIsAdmin).mockResolvedValueOnce(true);
    await expect(canManageUpload(requester, "user-2")).resolves.toBe(true);

    vi.mocked(getIsAdmin).mockResolvedValueOnce(false);
    await expect(canManageUpload(requester, "user-2")).resolves.toBe(false);
  });

  it("관리자 여부를 확인하지 못하면 허용하지 않고 에러를 낸다", async () => {
    vi.mocked(getIsAdmin).mockRejectedValueOnce(new Error("db down"));

    await expect(canManageUpload(requester, "user-2")).rejects.toThrow();
  });
});

describe("isCorrectionLimited", () => {
  beforeEach(() => {
    vi.mocked(getIsAdmin).mockReset();
  });

  it("한 시간 안의 본인 정정만 센다", async () => {
    const { client, query } = adminWithCount({ count: 0, error: null });

    await isCorrectionLimited(client, requester);

    expect(query.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(query.eq).toHaveBeenCalledWith("source", "correction");
    expect(query.gte).toHaveBeenCalledOnce();
  });

  it("한도 아래면 관리자인지 묻지 않고 허용한다", async () => {
    const { client } = adminWithCount({
      count: CORRECTION_LIMIT_PER_HOUR - 1,
      error: null,
    });

    await expect(isCorrectionLimited(client, requester)).resolves.toBe(false);
    expect(getIsAdmin).not.toHaveBeenCalled();
  });

  it("한도에 닿으면 막고, 관리자는 막지 않는다", async () => {
    const { client } = adminWithCount({
      count: CORRECTION_LIMIT_PER_HOUR,
      error: null,
    });

    vi.mocked(getIsAdmin).mockResolvedValueOnce(false);
    await expect(isCorrectionLimited(client, requester)).resolves.toBe(true);

    vi.mocked(getIsAdmin).mockResolvedValueOnce(true);
    await expect(isCorrectionLimited(client, requester)).resolves.toBe(false);
  });

  it("횟수를 세지 못하면 허용하지 않고 에러를 낸다", async () => {
    await expect(
      isCorrectionLimited(
        adminWithCount({ count: null, error: new Error("db down") }).client,
        requester,
      ),
    ).rejects.toThrow();
    await expect(
      isCorrectionLimited(
        adminWithCount({ count: null, error: null }).client,
        requester,
      ),
    ).rejects.toThrow();
  });
});
