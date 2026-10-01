// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_IMAGE_BYTES, MAX_IMAGE_COUNT } from "@/type/casting";

import { useImageSelection } from "./useImageSelection";

describe("useImageSelection", () => {
  beforeEach(() => {
    vi.spyOn(URL, "createObjectURL").mockImplementation(
      (file) => (file as File).name,
    );
    vi.spyOn(URL, "revokeObjectURL").mockImplementation((url) => url);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("처음에는 고른 파일 리스트가 비어있다", () => {
    const { result } = renderHook(useImageSelection);
    expect(result.current.files).toStrictEqual([]);
  });

  it("사진 2장을 고르면 목록과 미리보기가 2개가 된다.", () => {
    const file1 = new File(["file1"], "file1.png", { type: "image/png" });
    const file2 = new File(["file2"], "file2.png", { type: "image/png" });

    const { result } = renderHook(useImageSelection);

    act(() => {
      result.current.addFiles([file1, file2]);
    });

    expect(result.current.files).toStrictEqual([file1, file2]);
    expect(result.current.previewUrls).toStrictEqual([
      "file1.png",
      "file2.png",
    ]);
  });

  it("이미지 중 10MB가 넘는 사진이 섞여 있을 때 에러 메시지를 반환한다.", () => {
    const bigFile = new File(["f".repeat(MAX_IMAGE_BYTES + 1)], "bigfile.png", {
      type: "image/png",
    });
    const file = new File(["file"], "file.png", { type: "image/png" });

    const { result } = renderHook(useImageSelection);

    let output: { message: string | null; addedCount: number } = {
      message: "",
      addedCount: 0,
    };
    act(() => {
      output = result.current.addFiles([file, bigFile]);
    });

    expect(output.message).toBe("bigfile.png 파일이 10MB를 초과해 제외됐어요.");
    expect(output.addedCount).toBe(1);
  });

  it("선택된 이미지가 이미 있는 상태에서 이미지를 추가로 선택하면 기존 목록 뒤에 붙는다", () => {
    const file1 = new File(["file1"], "file1.png", { type: "image/png" });
    const file2 = new File(["file2"], "file2.png", { type: "image/png" });

    const { result } = renderHook(useImageSelection);

    act(() => {
      result.current.addFiles([file1]);
    });

    expect(result.current.files).toStrictEqual([file1]);

    act(() => {
      result.current.addFiles([file2]);
    });

    expect(result.current.files).toStrictEqual([file1, file2]);
  });

  it("선택된 이미지가 최대 장 수를 넘겼을 때 최대 장까지만 업로드되며 에러 메시지를 반환한다.", () => {
    const files = Array.from(
      { length: MAX_IMAGE_COUNT + 1 },
      (_, i) => new File([i.toString()], `file${i}.png`, { type: "image/png" }),
    );

    const { result } = renderHook(useImageSelection);

    let output: { message: string | null; addedCount: number } = {
      message: "",
      addedCount: 0,
    };
    act(() => {
      output = result.current.addFiles(files);
    });

    expect(result.current.files).toStrictEqual(files.slice(0, MAX_IMAGE_COUNT));
    expect(output.message).toBe(
      "이미지는 최대 5장까지 올릴 수 있어요. 1장은 제외됐어요.",
    );
  });

  it("이미지 중 사진 한장을 제외하면 그 사진만 사라지고 미리보기 URL도 해제된다", () => {
    const files = Array.from(
      { length: 5 },
      (_, i) => new File([i.toString()], `file${i}.png`, { type: "image/png" }),
    );

    const { result } = renderHook(useImageSelection);

    act(() => {
      result.current.addFiles(files);
    });

    expect(result.current.files.length).toBe(5);
    expect(result.current.previewUrls).toContain("file0.png");

    act(() => {
      result.current.removeFile(0);
    });

    expect(result.current.files.length).toBe(4);
    expect(result.current.previewUrls).not.toContain("file0.png");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("file0.png");
  });

  it("서버가 중복 이미지 여부를 반환한 뒤 중복 이미지를 빼면 중복 표시가 사라진다", () => {
    const files = Array.from(
      { length: 3 },
      (_, i) => new File([i.toString()], `file${i}.png`, { type: "image/png" }),
    );

    const { result } = renderHook(useImageSelection);

    act(() => {
      result.current.addFiles(files);
    });

    act(() => {
      result.current.setDuplicateIndexes([1]);
    });

    expect(result.current.duplicateIndexes).toStrictEqual([1]);

    act(() => {
      result.current.removeFile(1);
    });

    expect(result.current.duplicateIndexes).toStrictEqual([]);
  });

  it("중복 표시가 있는 상태에서 이미지를 더 고르면 중복 표시가 사라진다", () => {
    const file1 = new File(["file1"], "file1.png", { type: "image/png" });
    const file2 = new File(["file2"], "file2.png", { type: "image/png" });

    const { result } = renderHook(useImageSelection);

    act(() => {
      result.current.addFiles([file1]);
    });

    act(() => {
      result.current.setDuplicateIndexes([0]);
    });

    act(() => {
      result.current.addFiles([file2]);
    });

    expect(result.current.duplicateIndexes).toStrictEqual([]);
  });

  it("선택된 이미지를 취소하면 목록이 전부 비워지고 미리보기 URL도 모두 해제된다", () => {
    const files = Array.from(
      { length: 3 },
      (_, i) => new File([i.toString()], `file${i}.png`, { type: "image/png" }),
    );

    const { result } = renderHook(useImageSelection);

    act(() => {
      result.current.addFiles(files);
    });

    act(() => {
      result.current.clearFiles();
    });

    expect(result.current.files).toStrictEqual([]);
    expect(result.current.previewUrls).toStrictEqual([]);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(3);
  });
});
