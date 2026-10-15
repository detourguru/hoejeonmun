import { isCronAuthorized } from "@/lib/cron";
import { syncBugReportsToGithub } from "@/service/bug-report-sync";

export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await syncBugReportsToGithub();

  return Response.json(result);
}
