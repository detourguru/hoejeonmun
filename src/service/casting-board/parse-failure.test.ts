import { expect, it, vi } from "vitest";

import { purgeExpiredParseFailureImages } from "./parse-failure";

vi.mock("server-only", () => ({}));

it("실패 기록이 오래됐어도 이후 저장에 쓰인 원본은 지우지 않는다", async () => {
  const remove = vi.fn().mockResolvedValue({ error: null });
  const updateIds = vi.fn().mockResolvedValue({ error: null });
  const admin = {
    from: () => ({
      select: () => ({
        is: () => ({
          lt: async () => ({
            data: [
              { id: 1, storage_path: "saved" },
              { id: 2, storage_path: "orphan" },
            ],
            error: null,
          }),
        }),
      }),
      update: () => ({ in: updateIds }),
    }),
    rpc: async () => ({
      data: [{ bucket_id: "casting-boards", name: "orphan" }],
      error: null,
    }),
    storage: { from: () => ({ remove }) },
  };
  expect(await purgeExpiredParseFailureImages(admin as never)).toEqual({
    purged: 1,
  });
  expect(remove).toHaveBeenCalledWith(["orphan"]);
  expect(updateIds).toHaveBeenCalledWith("id", [2]);
});
