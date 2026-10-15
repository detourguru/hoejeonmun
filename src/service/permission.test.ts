import { beforeEach, describe, expect, it, vi } from "vitest";

import { getIsAdmin } from "@/service/admin";

import { canManageUpload, Requester } from "./permission";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/service/admin", () => ({ getIsAdmin: vi.fn() }));

const requester = {
  userId: "user-1",
  supabase: {},
} as unknown as Requester;

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
