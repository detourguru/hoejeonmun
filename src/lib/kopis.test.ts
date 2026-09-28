import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchKopis, fetchKopisAll, toArray } from "./kopis";

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
    const assertion = expect(promise).rejects.toThrow(
      "Failed to fetch data from KOPIS API",
    );

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
    const assertion = expect(promise).rejects.toThrow(
      "Failed to fetch data from KOPIS API",
    );

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

  it("200이어도 본문에 결과(dbs)가 없으면 쿼터 초과·키 만료 같은 에러 응답으로 보고 실패한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response("<error><returncode>99</returncode></error>"),
        ),
      ),
    );

    await expect(fetchKopis("/pblprfr", new URLSearchParams())).rejects.toThrow(
      "KOPIS returned an error response for /pblprfr",
    );
  });

  it("숫자처럼 보이는 값도 문자열 그대로 받는다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response("<dbs><db><mt20id>0012</mt20id></db></dbs>"),
        ),
      ),
    );

    expect(await fetchKopis("/pblprfr", new URLSearchParams())).toStrictEqual([
      { mt20id: "0012" },
    ]);
  });

  it("KOPIS 주소나 키가 설정되지 않았으면 요청하지 않고 실패한다", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("KOPIS_API_KEY", "");

    await expect(fetchKopis("/pblprfr", new URLSearchParams())).rejects.toThrow(
      "not defined in environment variables",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("캐시하지 않도록 하면 no-store로, 기본은 1시간 캐시와 태그를 붙여 요청한다", async () => {
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response("<dbs></dbs>")),
    );
    vi.stubGlobal("fetch", fetchMock);

    await fetchKopis("/a", new URLSearchParams(), { revalidate: false });
    await fetchKopis("/b", new URLSearchParams(), { tags: ["shows"] });

    expect(fetchMock.mock.calls[0][1]).toMatchObject({ cache: "no-store" });
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      next: { revalidate: 3600, tags: ["shows"] },
    });
  });
});

describe("fetchKopisAll", () => {
  // 페이지마다 rows개 이하의 공연을 돌려주는 가짜 KOPIS
  const mockPages = (sizes: number[]) => {
    const pages = [...sizes];
    const fetchMock = vi.fn<typeof fetch>(() => {
      const size = pages.shift() ?? 0;
      const items = Array.from(
        { length: size },
        (_, index) => `<db><mt20id>PF${index}</mt20id></db>`,
      ).join("");

      return Promise.resolve(new Response(`<dbs>${items}</dbs>`));
    });
    vi.stubGlobal("fetch", fetchMock);

    return fetchMock;
  };

  beforeEach(() => {
    vi.stubEnv("NEXT_KOPIS_API_URL", "https://kopis-test.com");
    vi.stubEnv("KOPIS_API_KEY", "fake-kopis-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("한 페이지가 가득 차면 다음 페이지를 이어서 조회하고, 덜 차면 마지막 페이지로 보고 멈춘다", async () => {
    const fetchMock = mockPages([2, 2, 1]);

    const shows = await fetchKopisAll("/pblprfr", new URLSearchParams(), {
      rows: 2,
      maxPages: 10,
    });

    expect(shows).toHaveLength(5);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("페이지마다 cpage를 1부터 올리고 rows를 붙여 요청한다", async () => {
    const fetchMock = mockPages([2, 0]);

    await fetchKopisAll(
      "/pblprfr",
      new URLSearchParams({ stdate: "20260901" }),
      {
        rows: 2,
        maxPages: 10,
      },
    );

    const urls = fetchMock.mock.calls.map(([url]) => new URL(String(url)));

    expect(urls.map((url) => url.searchParams.get("cpage"))).toStrictEqual([
      "1",
      "2",
    ]);
    expect(urls[0].searchParams.get("rows")).toBe("2");
    expect(urls[0].searchParams.get("stdate")).toBe("20260901");
  });

  it("maxPages까지 가득 차 있으면 거기서 멈추고 결과가 잘렸다고 경고한다", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = mockPages([2, 2, 2]);

    const shows = await fetchKopisAll("/pblprfr", new URLSearchParams(), {
      rows: 2,
      maxPages: 2,
    });

    expect(shows).toHaveLength(4);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalled();
  });
});
