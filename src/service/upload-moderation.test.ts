import { beforeEach, expect, it, vi } from "vitest";

import { createAdminClient } from "@/lib/supabase/admin";

import { retryUploadStorageCleanup } from "./upload-moderation";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

it("이미지 삭제 실패는 큐에 남기고 성공한 항목만 제거한다", async () => {
  const remove = vi
    .fn()
    .mockResolvedValueOnce({ error: { message: "storage offline" } })
    .mockResolvedValueOnce({ error: null });
  const writes: { kind: string; id: number; values?: unknown }[] = [];
  const client = {
    storage: { from: () => ({ remove }) },
    from: () => ({
      select: () => ({
        order: () => ({
          limit: () =>
            Promise.resolve({
              data: [
                { id: 1, storage_paths: ["a"], attempts: 0 },
                { id: 2, storage_paths: ["b"], attempts: 2 },
              ],
              error: null,
            }),
        }),
      }),
      update: (values: unknown) => ({
        eq: async (_: string, id: number) => {
          writes.push({ kind: "update", id, values });
          return { error: null };
        },
      }),
      delete: () => ({
        eq: async (_: string, id: number) => {
          writes.push({ kind: "delete", id });
          return { error: null };
        },
      }),
    }),
  };
  vi.mocked(createAdminClient).mockReturnValue(client as never);
  expect(await retryUploadStorageCleanup()).toEqual({ checked: 2, failed: 1 });
  expect(writes).toEqual([
    {
      kind: "update",
      id: 1,
      values: { attempts: 1, last_error: "storage offline" },
    },
    { kind: "delete", id: 2 },
  ]);
});
