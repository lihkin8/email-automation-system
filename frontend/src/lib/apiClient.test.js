import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { ApiError, apiClient, onColdStart } from "./apiClient";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
}

describe("apiClient", () => {
  test("appends query params and includes credentials", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    const promise = apiClient.get("/items", { params: { page: 2 } });
    await vi.runAllTimersAsync();
    await promise;

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/items?page=2");
    expect(init.credentials).toBe("include");
    expect(init.method).toBe("GET");
  });

  test("returns parsed JSON on 2xx", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ hello: "world" }));
    const promise = apiClient.get("/x");
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toEqual({ hello: "world" });
  });

  test("returns null for 204", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const promise = apiClient.delete("/x");
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBeNull();
  });

  test("throws ApiError with friendly message for 401", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: "nope" }, { status: 401 }));
    const promise = apiClient.get("/x").catch((err) => err);
    await vi.runAllTimersAsync();
    const err = await promise;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(401);
    expect(err.message).toBe("nope");
  });

  test("uses default message when body has no detail", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, { status: 500 }));
    const promise = apiClient.get("/x").catch((err) => err);
    await vi.runAllTimersAsync();
    const err = await promise;
    expect(err.status).toBe(500);
    expect(err.message).toMatch(/server hit an error/i);
  });

  test("notifies cold-start listeners when a request crosses 2.5s", async () => {
    let resolveFetch;
    fetchMock.mockImplementation(
      () =>
        new Promise((r) => {
          resolveFetch = r;
        })
    );

    const seen = [];
    const off = onColdStart((n) => seen.push(n));

    const promise = apiClient.get("/slow");
    // Cross the 2.5s threshold without resolving the fetch yet.
    await vi.advanceTimersByTimeAsync(2600);
    expect(seen.at(-1)).toBe(1);

    resolveFetch(jsonResponse({}));
    await promise;
    expect(seen.at(-1)).toBe(0);
    off();
  });

  test("network failure surfaces an ApiError with status 0", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const promise = apiClient.get("/x").catch((err) => err);
    await vi.runAllTimersAsync();
    const err = await promise;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(0);
    expect(err.message).toMatch(/network error/i);
  });
});
