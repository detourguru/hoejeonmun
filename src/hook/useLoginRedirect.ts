"use client";

import { useRouter } from "next/navigation";

export function useLoginRedirect(redirectTo: string) {
  const router = useRouter();

  return (message: string) => {
    if (message !== "로그인이 필요해요.") return false;

    router.push(`/login?next=${encodeURIComponent(redirectTo)}`);

    return true;
  };
}
