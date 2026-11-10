// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import {
  moderateUpload,
  previewUploadModeration,
} from "@/app/(main)/show/[id]/moderation-actions";

import { UploadModerationControls } from "./upload-moderation-controls";

vi.mock("@/app/(main)/show/[id]/moderation-actions", () => ({
  moderateUpload: vi.fn(),
  previewUploadModeration: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
vi.mock("@/components/bottom-sheet", () => ({
  BottomSheet: ({
    open,
    children,
  }: {
    open: boolean;
    children: React.ReactNode;
  }) => (open ? <div>{children}</div> : null),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("단건 삭제와 밴을 독립 선택하고 확인한 ID 목록으로 실행한다", async () => {
  const user = userEvent.setup();
  vi.mocked(previewUploadModeration).mockResolvedValue({
    userId: "target-user",
    uploads: [{ id: 42, show_id: "show", show_title: "공연" }],
  });
  vi.mocked(moderateUpload).mockResolvedValue({ ok: true, deleted: 1 });
  render(<UploadModerationControls uploadId={42} />);
  await user.click(screen.getByText("업로드 운영 조치"));
  expect(
    (screen.getByLabelText("이 사용자의 전체 업로드 삭제") as HTMLInputElement)
      .checked,
  ).toBe(false);
  await user.click(
    screen.getByLabelText("향후 업로드 차단 (로그인·신고·정정은 유지)"),
  );
  await user.type(screen.getByLabelText("조치 사유"), "스팸");
  await user.click(screen.getByText("삭제 범위 확인"));
  expect(await screen.findByText("대상 사용자: target-user")).toBeDefined();
  await user.click(screen.getByText("위 범위로 삭제 확정"));
  expect(moderateUpload).toHaveBeenCalledWith({
    uploadId: 42,
    allUploads: false,
    ban: true,
    reason: "스팸",
    expectedIds: [42],
  });
});
