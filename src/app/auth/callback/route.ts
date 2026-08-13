import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_NEXT = "/show";

const resolveNext = (next: string | null) => {
  if (!next?.startsWith("/") || next.startsWith("//")) return DEFAULT_NEXT;

  return next;
};

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const next = resolveNext(searchParams.get("next"));
  const code = searchParams.get("code");

  // 사용자가 카카오 동의 화면에서 취소하면 code 대신 error가 온다
  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=cancelled`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error(error);

    return NextResponse.redirect(`${origin}/login?error=failed`);
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  const baseUrl =
    process.env.NODE_ENV === "development" || !forwardedHost
      ? origin
      : `https://${forwardedHost}`;

  return NextResponse.redirect(`${baseUrl}${next}`);
}
