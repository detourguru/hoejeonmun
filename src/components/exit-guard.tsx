"use client";

import { useEffect } from "react";
import { toast } from "sonner";

const GUARD_STATE = { exitGuard: true };

type NavigationWindow = Window & {
  navigation?: { currentEntry: { index: number } | null };
};

export const ExitGuard = () => {
  useEffect(() => {
    // 일반브라우저에서는 적용하지않음
    if (!window.matchMedia("(display-mode: standalone)").matches) return;

    const { navigation } = window as NavigationWindow;

    if (!navigation) return;

    const isAtFirstEntry = () => navigation.currentEntry?.index === 0;

    const arm = () => {
      if (isAtFirstEntry()) history.pushState(GUARD_STATE, "");
    };

    const handlePopState = () => {
      if (!isAtFirstEntry()) return;

      toast("한 번 더 누르면 종료돼요", { id: "exit-guard", duration: 2000 });
    };

    window.addEventListener("click", arm, { capture: true });
    window.addEventListener("keydown", arm, { capture: true });
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("click", arm, { capture: true });
      window.removeEventListener("keydown", arm, { capture: true });
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  return null;
};
