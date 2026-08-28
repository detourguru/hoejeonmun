import { FavoriteActorsSection } from "@/components/mypage/favorite-actors-section";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "애정배우 | 회전문",
};

// 비로그인 접근은 proxy에서 /login으로 보낸다
export default function Page() {
  return <FavoriteActorsSection />;
}
