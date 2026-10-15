import { afterEach, describe, expect, it, vi } from "vitest";

import { isCronAuthorized } from "./cron";

const requestWith = (authorization?: string) =>
  new Request("https://example.com/api/cron/test", {
    headers: authorization ? { authorization } : {},
  });

describe("isCronAuthorized", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("CRON_SECRET과 같은 Bearer 토큰이면 통과시킨다", () => {
    vi.stubEnv("CRON_SECRET", "secret");

    expect(isCronAuthorized(requestWith("Bearer secret"))).toBe(true);
  });

  it("토큰이 다르거나 없으면 막는다", () => {
    vi.stubEnv("CRON_SECRET", "secret");

    expect(isCronAuthorized(requestWith("Bearer wrong"))).toBe(false);
    expect(isCronAuthorized(requestWith())).toBe(false);
  });

  it.each([[undefined], [""]])(
    "CRON_SECRET이 설정되지 않았으면(%j) 'Bearer undefined' 헤더도 막는다",
    (secret) => {
      vi.stubEnv("CRON_SECRET", secret);

      expect(isCronAuthorized(requestWith("Bearer undefined"))).toBe(false);
      expect(isCronAuthorized(requestWith("Bearer "))).toBe(false);
    },
  );
});
