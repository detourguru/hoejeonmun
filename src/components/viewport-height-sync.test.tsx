// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ViewportHeightSync } from "./viewport-height-sync";

describe("ViewportHeightSync", () => {
  let unmount: (() => void) | undefined;

  beforeEach(() => {
    document.documentElement.style.removeProperty("--app-height");
  });

  afterEach(() => {
    unmount?.();
    unmount = undefined;
    document.documentElement.style.removeProperty("--app-height");
  });

  it("마운트되면 현재 window.innerHeight를 --app-height로 등록한다", () => {
    vi.stubGlobal("innerHeight", 640);

    ({ unmount } = render(<ViewportHeightSync />));

    expect(
      document.documentElement.style.getPropertyValue("--app-height"),
    ).toBe("640px");
  });

  it("resize 이벤트가 발생하면 바뀐 높이로 다시 계산한다", () => {
    vi.stubGlobal("innerHeight", 640);
    ({ unmount } = render(<ViewportHeightSync />));

    vi.stubGlobal("innerHeight", 480);
    window.dispatchEvent(new Event("resize"));

    expect(
      document.documentElement.style.getPropertyValue("--app-height"),
    ).toBe("480px");
  });

  it("pageshow 이벤트가 발생하면 바뀐 높이로 다시 계산한다", () => {
    vi.stubGlobal("innerHeight", 640);
    ({ unmount } = render(<ViewportHeightSync />));

    vi.stubGlobal("innerHeight", 700);
    window.dispatchEvent(new Event("pageshow"));

    expect(
      document.documentElement.style.getPropertyValue("--app-height"),
    ).toBe("700px");
  });

  it("언마운트되면 리스너를 정리해 이후 resize에는 반응하지 않는다", () => {
    vi.stubGlobal("innerHeight", 640);
    const { unmount } = render(<ViewportHeightSync />);
    unmount();

    vi.stubGlobal("innerHeight", 320);
    window.dispatchEvent(new Event("resize"));

    expect(
      document.documentElement.style.getPropertyValue("--app-height"),
    ).toBe("640px");
  });
});
