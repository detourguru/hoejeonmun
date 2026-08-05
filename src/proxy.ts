import { NextRequest } from "next/server";
import { updateSession } from "./lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // FIXME: 로그인 페이지 만들면 보호할 라우트 목록 정해서 리다이렉트 조건 다시 추가
  //   matcher: [
  //     "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  //   ],
};
