import { describe, expect, it, vi } from "vitest";

import { chunk, normalizePosterUrl } from "./poster-thumbnail";

vi.mock("server-only", () => ({}));

describe("normalizePosterUrl", () => {
  // 저장된 원본 주소와 비교해 포스터가 바뀌었을 때만 썸네일을 다시 만든다
  it.each([
    ["http://www.kopis.or.kr/upload/poster/PF1.gif"],
    ["https://kopis.or.kr/upload/poster/PF1.gif"],
    [" https://www.kopis.or.kr/upload/poster/PF1.gif "],
  ])(
    "KOPIS 포스터는 http/https·www 여부가 달라도 같은 포스터로 보고 썸네일을 다시 만들지 않는다: %j",
    (url) => {
      expect(normalizePosterUrl(url)).toBe("kopis.or.kr/upload/poster/PF1.gif");
    },
  );

  it("KOPIS 포스터 주소의 쿼리가 다르면 다른 포스터로 본다", () => {
    expect(
      normalizePosterUrl("http://www.kopis.or.kr/upload/poster/PF1.gif?v=2"),
    ).toBe("kopis.or.kr/upload/poster/PF1.gif?v=2");
  });

  it("KOPIS가 아닌 주소는 표준 형식으로만 정리한다", () => {
    expect(normalizePosterUrl("https://example.com/poster.png")).toBe(
      "https://example.com/poster.png",
    );
  });

  it("주소 형식이 아니면 앞뒤 공백만 지운다", () => {
    expect(normalizePosterUrl(" poster.png ")).toBe("poster.png");
  });
});

describe("chunk", () => {
  it("정해진 크기로 나누고 남는 항목은 마지막 묶음에 담는다", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toStrictEqual([[1, 2], [3, 4], [5]]);
  });

  it("빈 목록은 묶음 없이 빈 배열을 돌려준다", () => {
    expect(chunk([], 2)).toStrictEqual([]);
  });
});
