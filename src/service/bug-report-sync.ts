import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { BUG_REPORT_IMAGE_BUCKET } from "@/type/bug-report";

const ISSUE_IMAGE_TTL_SECONDS = 60 * 60 * 24 * 7;
const TITLE_MAX_LENGTH = 60;

type BugReportRow = {
  id: number;
  user_id: string;
  message: string;
  url: string;
  user_agent: string;
  commit_sha: string | null;
  created_at: string;
  image_paths: string[];
};

function buildTitle(message: string) {
  const firstLine = message.trim().split("\n")[0];

  return firstLine.length > TITLE_MAX_LENGTH
    ? `${firstLine.slice(0, TITLE_MAX_LENGTH)}…`
    : firstLine;
}

function buildBody(report: BugReportRow, imageUrls: string[]) {
  const lines = [
    report.message,
    "",
    `제보자: ${report.user_id}`,
    `URL: ${report.url}`,
    `User-Agent: ${report.user_agent}`,
    `커밋: ${report.commit_sha ?? "알 수 없음"}`,
    `제출 시각: ${report.created_at}`,
  ];

  if (imageUrls.length > 0) {
    lines.push("", "첨부 이미지 (7일 후 만료):", ...imageUrls);
  }

  return lines.join("\n");
}

async function getSignedImageUrls(paths: string[]) {
  if (paths.length === 0) return [];

  const { data, error } = await createAdminClient()
    .storage.from(BUG_REPORT_IMAGE_BUCKET)
    .createSignedUrls(paths, ISSUE_IMAGE_TTL_SECONDS);

  if (error) {
    console.error(error);
    return [];
  }

  return data.flatMap((entry) => (entry.signedUrl ? [entry.signedUrl] : []));
}

async function createGithubIssue(title: string, body: string) {
  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;

  if (!repo || !token) {
    throw new Error("GITHUB_REPOSITORY/GITHUB_TOKEN 환경 변수가 없어요.");
  }

  const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({ title, body }),
  });

  if (!res.ok) {
    throw new Error(`GitHub 이슈 생성 실패 (${res.status}): ${await res.text()}`);
  }

  const issue = (await res.json()) as { number: number };

  return issue.number;
}

export async function syncBugReportsToGithub() {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("bug_reports")
    .select(
      "id, user_id, message, url, user_agent, commit_sha, created_at, image_paths",
    )
    .is("resolved_at", null)
    .is("github_issue_number", null)
    .order("created_at");

  if (error) throw error;

  const reports = data as BugReportRow[];
  const failures: { id: number; message: string }[] = [];
  let created = 0;

  for (const report of reports) {
    try {
      const imageUrls = await getSignedImageUrls(report.image_paths);
      const issueNumber = await createGithubIssue(
        buildTitle(report.message),
        buildBody(report, imageUrls),
      );

      const { error: updateError } = await admin
        .from("bug_reports")
        .update({ github_issue_number: issueNumber })
        .eq("id", report.id);

      if (updateError) throw updateError;

      created++;
    } catch (err) {
      console.error("[bug-report-sync]", report.id, err);
      failures.push({
        id: report.id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { total: reports.length, created, failures };
}
