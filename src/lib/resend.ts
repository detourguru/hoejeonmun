import "server-only";

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendBugReportEmail({
  message,
  url,
  userAgent,
  commitSha,
}: {
  message: string;
  url: string;
  userAgent: string;
  commitSha?: string | null;
}) {
  try {
    const { error } = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: process.env.BUG_REPORT_EMAIL_TO!,
      subject: "[회전문] 버그 리포트 도착",
      text: [
        `내용: ${message}`,
        `URL: ${url}`,
        `User-Agent: ${userAgent}`,
        `커밋: ${commitSha ?? "알 수 없음"}`,
        `제출 시각: ${new Date().toISOString()}`,
      ].join("\n"),
    });

    if (error) {
      console.error("[bug-report email]", error);
      return { ok: false as const };
    }

    return { ok: true as const };
  } catch (error) {
    console.error("[bug-report email]", error);
    return { ok: false as const };
  }
}
