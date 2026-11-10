import { beforeEach, expect, it, vi } from "vitest";

import { createAdminClient } from "@/lib/supabase/admin";
import { getActionAuth } from "@/service/action-auth";
import { getIsAdmin } from "@/service/admin";

import {
  moderateUpload,
  previewUploadModeration,
  retryModerationCleanup,
  unbanUploadUser,
} from "./moderation-actions";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/service/action-auth", () => ({ getActionAuth: vi.fn() }));
vi.mock("@/service/admin", () => ({ getIsAdmin: vi.fn() }));
vi.mock("@/service/casting", () => ({
  CASTING_FEED_CACHE_TAG: "feed",
  showCastTag: (id: string) => id,
}));
vi.mock("@/service/upload-moderation", () => ({
  retryUploadStorageCleanup: vi.fn(),
}));
const request = {
  uploadId: 1,
  allUploads: false,
  ban: true,
  reason: "abuse",
  expectedIds: [1],
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getActionAuth).mockResolvedValue({
    userId: "user",
    supabase: {} as never,
  });
  vi.mocked(getIsAdmin).mockResolvedValue(false);
});
it("일반 사용자는 미리보기/삭제/해제/재시도를 직접 호출해도 DB에 접근하지 못한다", async () => {
  await expect(previewUploadModeration(1, true)).rejects.toThrow("운영자");
  expect((await moderateUpload(request)).ok).toBe(false);
  await expect(unbanUploadUser("user", "reason")).rejects.toThrow("운영자");
  await expect(retryModerationCleanup()).rejects.toThrow("운영자");
  expect(createAdminClient).not.toHaveBeenCalled();
});
it("전체 삭제와 무관하게 현재 업로드 삭제+밴을 요청할 수 있다", async () => {
  vi.mocked(getIsAdmin).mockResolvedValue(true);
  const rpc = vi.fn().mockResolvedValue({
    data: { id: 1, showIds: ["show"], deleted: 1 },
    error: null,
  });
  vi.mocked(createAdminClient).mockReturnValue({ rpc } as never);
  expect(await moderateUpload(request)).toEqual({ ok: true, deleted: 1 });
  expect(rpc).toHaveBeenCalledWith(
    "moderate_upload",
    expect.objectContaining({ p_all: false, p_ban: true, p_expected_ids: [1] }),
  );
});
