import React from "react";
import { describe, test, expect, beforeEach, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { toastMock, confettiSpy } = vi.hoisted(() => ({
  toastMock: {
    loading: vi.fn(() => "tid"),
    success: vi.fn(),
    error: vi.fn(),
  },
  confettiSpy: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: toastMock }));
vi.mock("canvas-confetti", () => ({ default: confettiSpy }));

import { useAction } from "./useAction";

function Probe({ fn, options, label = "go" }) {
  const { run, isPending, error } = useAction(fn, options);
  return (
    <div>
      <button onClick={() => run().catch(() => {})}>{label}</button>
      <span data-testid="pending">{isPending ? "yes" : "no"}</span>
      <span data-testid="error">{error ? error.message : ""}</span>
    </div>
  );
}

describe("useAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("runs success path with loading + success toasts", async () => {
    const fn = vi.fn().mockResolvedValue({ ok: true });
    render(
      <Probe
        fn={fn}
        options={{ loading: "Loading...", success: "Done" }}
      />
    );
    await userEvent.click(screen.getByText("go"));
    await waitFor(() => expect(fn).toHaveBeenCalled());
    expect(toastMock.loading).toHaveBeenCalledWith("Loading...");
    expect(toastMock.success).toHaveBeenCalledWith("Done", { id: "tid" });
    expect(screen.getByTestId("pending")).toHaveTextContent("no");
  });

  test("runs error path with loading + error toasts and exposes error", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("boom"));
    render(
      <Probe
        fn={fn}
        options={{
          loading: "Working...",
          error: (e) => `oops: ${e.message}`,
        }}
      />
    );
    await userEvent.click(screen.getByText("go"));
    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith("oops: boom", { id: "tid" })
    );
    expect(screen.getByTestId("error")).toHaveTextContent("boom");
  });

  test("toggles isPending while the promise is in flight", async () => {
    let resolve;
    const fn = vi.fn().mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        })
    );
    render(<Probe fn={fn} options={{}} />);
    await userEvent.click(screen.getByText("go"));
    expect(screen.getByTestId("pending")).toHaveTextContent("yes");
    await act(async () => {
      resolve({ ok: true });
    });
    await waitFor(() =>
      expect(screen.getByTestId("pending")).toHaveTextContent("no")
    );
  });

  test("fires confetti when the option is enabled", async () => {
    const fn = vi.fn().mockResolvedValue({});
    render(<Probe fn={fn} options={{ confetti: true }} />);
    await userEvent.click(screen.getByText("go"));
    await waitFor(() => expect(confettiSpy).toHaveBeenCalledTimes(2));
  });

  test("silent mode skips toasts entirely", async () => {
    const fn = vi.fn().mockResolvedValue({});
    render(<Probe fn={fn} options={{ silent: true, success: "Done" }} />);
    await userEvent.click(screen.getByText("go"));
    await waitFor(() => expect(fn).toHaveBeenCalled());
    expect(toastMock.loading).not.toHaveBeenCalled();
    expect(toastMock.success).not.toHaveBeenCalled();
  });
});
