import { beforeEach, describe, expect, test, vi } from "vitest";

import { applyTheme, getInitialTheme } from "@/lib/theme";

function mockSystemTheme(matches) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
}

describe("theme helpers", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    mockSystemTheme(false);
  });

  test("getInitialTheme prefers localStorage", () => {
    localStorage.setItem("theme", "dark");
    mockSystemTheme(false);

    expect(getInitialTheme()).toBe("dark");
  });

  test("getInitialTheme falls back to system preference", () => {
    mockSystemTheme(true);

    expect(getInitialTheme()).toBe("dark");
  });

  test("getInitialTheme defaults to dark without a system signal", () => {
    window.matchMedia = undefined;

    expect(getInitialTheme()).toBe("dark");
  });

  test("applyTheme toggles the root class and stores preference", () => {
    applyTheme("light");
    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("theme")).toBe("light");
  });
});
