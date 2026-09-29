import { describe, expect, it, vi } from "vitest";

import { BugReportRow, buildBody, buildTitle } from "./bug-report-sync";

vi.mock("server-only", () => ({}));

describe("buildTitle", () => {
  it("제보 내용의 첫 줄을 GitHub 이슈 제목으로 쓴다", () => {
    expect(buildTitle("  배우 필터가 이상해요\n자세한 내용...")).toBe(
      "배우 필터가 이상해요",
    );
  });

  it("첫 줄이 60자를 넘으면 60자까지만 쓰고 말줄임표를 붙인다", () => {
    const title = buildTitle("가".repeat(61));

    expect(title).toBe(`${"가".repeat(60)}…`);
  });

  it("첫 줄이 딱 60자면 말줄임표 없이 그대로 쓴다", () => {
    expect(buildTitle("가".repeat(60))).toBe("가".repeat(60));
  });

  it("60번째 글자 자리에 이모지가 걸려도 반쪽으로 깨지지 않게 이모지 단위로 자른다", () => {
    expect(buildTitle(`${"가".repeat(59)}😭😭`)).toBe(`${"가".repeat(59)}😭…`);
  });

  it("이모지도 한 글자로 세서 60글자 안에 이모지가 있으면 자르지 않는다", () => {
    const title = `${"가".repeat(59)}😭`;

    expect(buildTitle(title)).toBe(title);
  });
});

describe("buildBody", () => {
  const report: BugReportRow = {
    id: 1,
    user_id: "user-1",
    message: "배우 필터가 이상해요",
    url: "/show/PF1/castings",
    user_agent: "Mozilla/5.0",
    commit_sha: "abc123",
    created_at: "2026-09-28T12:00:00Z",
    image_paths: [],
  };

  it("제보 내용 아래에 재현에 필요한 정보(제보자, 화면 주소, 브라우저, 배포 커밋, 시각)를 붙인다", () => {
    expect(buildBody(report, [])).toBe(
      [
        "배우 필터가 이상해요",
        "",
        "제보자: user-1",
        "URL: /show/PF1/castings",
        "User-Agent: Mozilla/5.0",
        "커밋: abc123",
        "제출 시각: 2026-09-28T12:00:00Z",
      ].join("\n"),
    );
  });

  it("배포 커밋을 모르면 '알 수 없음'으로 적는다", () => {
    expect(buildBody({ ...report, commit_sha: null }, [])).toContain(
      "커밋: 알 수 없음",
    );
  });

  it("첨부 이미지가 있으면 7일 뒤 만료된다는 안내와 함께 주소를 맨 아래에 붙인다", () => {
    const body = buildBody(report, ["https://signed/1", "https://signed/2"]);

    expect(
      body.endsWith(
        [
          "첨부 이미지 (7일 후 만료):",
          "https://signed/1",
          "https://signed/2",
        ].join("\n"),
      ),
    ).toBe(true);
  });

  it("첨부 이미지가 없으면 이미지 안내를 붙이지 않는다", () => {
    expect(buildBody(report, [])).not.toContain("첨부 이미지");
  });
});
