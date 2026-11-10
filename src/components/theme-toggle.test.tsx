// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { ThemeToggle } from "./theme-toggle";

let dark = false;
let onMediaChange: () => void;

beforeEach(() => {
  localStorage.clear();
  dark = false;
  document.documentElement.classList.remove("dark");
  vi.stubGlobal("matchMedia", () => ({
    matches: dark,
    addEventListener: (_: string, listener: () => void) => {
      onMediaChange = listener;
    },
    removeEventListener: vi.fn(),
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("시스템 테마 변경이 버튼과 실제 화면에 함께 반영된다", () => {
  render(<ThemeToggle />);
  act(() => {
    dark = true;
    onMediaChange();
  });
  expect(document.documentElement.classList.contains("dark")).toBe(true);
  expect(document.documentElement.style.colorScheme).toBe("dark");
});

it("다른 탭에서 저장한 테마가 화면에도 반영되고 시스템 설정보다 우선한다", () => {
  render(<ThemeToggle />);
  act(() => {
    localStorage.setItem("hoejeonmun-theme", "dark");
    window.dispatchEvent(new Event("storage"));
  });
  expect(document.documentElement.classList.contains("dark")).toBe(true);
  act(() => {
    localStorage.setItem("hoejeonmun-theme", "light");
    dark = true;
    onMediaChange();
  });
  expect(document.documentElement.classList.contains("dark")).toBe(false);
});
