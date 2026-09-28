import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchKopis, toArray } from "./kopis";

describe("toArray", () => {
  // KOPIS XML은 항목이 하나면 객체로, 여럿이면 배열로 내려준다
  it("항목이 하나라서 객체로 온 값은 배열로 감싼다", () => {
    expect(toArray({ mt20id: "PF1" })).toStrictEqual([{ mt20id: "PF1" }]);
  });

  it("항목이 여럿이라 배열로 온 값은 그대로 쓴다", () => {
    const shows = [{ mt20id: "PF1" }, { mt20id: "PF2" }];

    expect(toArray(shows)).toBe(shows);
  });

  it.each([[undefined], [null]])(
    "항목이 없어 태그가 빠졌으면 빈 배열로 둔다: %j",
    (value) => {
      expect(toArray(value)).toStrictEqual([]);
    },
  );
});

describe("fetchKopis", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_KOPIS_API_URL", "https://kopis-test.com");
    vi.stubEnv("KOPIS_API_KEY", "fake-kopis-key");
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("KOPIS가 간헐적으로 400을 주면 다시 요청해서 결과를 받는다", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(new Response("", { status: 400 }));
    fetchMock.mockResolvedValueOnce(
      new Response("<dbs><db><mt20id>PF1</mt20id></db></dbs>"),
    );

    vi.stubGlobal("fetch", fetchMock);

    const promise = fetchKopis("/pblprfr", new URLSearchParams());

    await vi.runAllTimersAsync();

    expect(await promise).toStrictEqual([{ mt20id: "PF1" }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("요청이 잘못된 경우(404 등)는 다시 요청해도 소용없으니 바로 실패한다", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response("", { status: 404 })),
    );
    vi.stubGlobal("fetch", fetchMock);

    const promise = fetchKopis("/pblprfr", new URLSearchParams());
    const assertion = expect(promise).rejects.toThrow();

    await vi.runAllTimersAsync();
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("네트워크 오류가 나도 다시 요청해서 결과를 받는다", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(new Response("<dbs></dbs>"));
    vi.stubGlobal("fetch", fetchMock);

    const promise = fetchKopis("/pblprfr", new URLSearchParams());

    await vi.runAllTimersAsync();

    expect(await promise).toStrictEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("계속 실패하면 4번까지만 시도하고 포기해서 화면이 끝없이 기다리지 않는다", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response("", { status: 500 })),
    );
    vi.stubGlobal("fetch", fetchMock);

    const promise = fetchKopis("/pblprfr", new URLSearchParams());
    const assertion = expect(promise).rejects.toThrow();

    await vi.runAllTimersAsync();
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("동시에 많이 조회해도 KOPIS에는 8개까지만 한꺼번에 요청한다", async () => {
    const responders: (() => void)[] = [];
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          responders.push(() => resolve(new Response("<dbs></dbs>")));
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const promises = Array.from({ length: 10 }, (_, index) =>
      fetchKopis(`/pblprfr/PF${index}`, new URLSearchParams()),
    );

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(8);

    // 앞선 요청이 끝나면 기다리던 요청이 이어서 나간다
    while (responders.length > 0) {
      responders.shift()?.();
      await vi.advanceTimersByTimeAsync(0);
    }

    await Promise.all(promises);
    expect(fetchMock).toHaveBeenCalledTimes(10);
  });
});
