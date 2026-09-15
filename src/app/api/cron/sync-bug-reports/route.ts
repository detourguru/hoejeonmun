import { syncBugReportsToGithub } from "@/service/bug-report-sync";

export const maxDuration = 60;

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");

  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await syncBugReportsToGithub();

  return Response.json(result);
}
