"use client";

import { useEffect } from "react";

const GUARD_STATE = { exitGuard: true };

// PWA에서 뒤로가기 시 브라우저 UI 없이 앱 종료되므로 히스토리를 쌓는다
export const ExitGuard = () => {
  useEffect(() => {
    // 일반브라우저에서는 적용하지않음
    if (!window.matchMedia("(display-mode: standalone)").matches) return;

    history.pushState(GUARD_STATE, "");

    const handlePopState = (event: PopStateEvent) => {
      if (!(event.state as typeof GUARD_STATE | null)?.exitGuard) return;

      history.pushState(GUARD_STATE, "");
    };

    window.addEventListener("popstate", handlePopState);

    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  return null;
};
