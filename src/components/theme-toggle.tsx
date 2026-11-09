"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

const KEY = "hoejeonmun-theme";
const CHANGE_EVENT = "hoejeonmun-theme-change";
type Theme = "light" | "dark";

function getTheme(): Theme {
  const saved = localStorage.getItem(KEY);
  if (saved === "dark" || saved === "light") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  media.addEventListener("change", onChange);

  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
    media.removeEventListener("change", onChange);
  };
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getTheme, () => null);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    localStorage.setItem(KEY, next);
    document.documentElement.classList.toggle("dark", next === "dark");
    document.documentElement.style.colorScheme = next;
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={theme === null}
      className="text-text border-border inline-flex size-10 shrink-0 items-center justify-center rounded-lg border"
      aria-label={theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
      title={theme === "dark" ? "라이트 모드" : "다크 모드"}
    >
      {theme === "dark" ? (
        <Sun size={18} aria-hidden />
      ) : (
        <Moon size={18} aria-hidden />
      )}
    </button>
  );
}
