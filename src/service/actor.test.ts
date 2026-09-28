import { describe, expect, it, vi } from "vitest";

import { displayActorName } from "./actor";

vi.mock("server-only", () => ({}));

describe("displayActorName", () => {
  it("애정배우에 별칭을 붙였으면 별칭으로 보여 준다", () => {
    expect(displayActorName({ id: 1, name: "정휘", alias: "휘휘" })).toBe(
      "휘휘",
    );
  });

  it("별칭이 없으면 배우 이름으로 보여 준다", () => {
    expect(displayActorName({ id: 1, name: "정휘", alias: null })).toBe("정휘");
  });
});
