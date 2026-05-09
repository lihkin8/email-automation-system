import { useEffect, useSyncExternalStore } from "react";

const STORAGE_KEY = "theme";
const THEMES = new Set(["system", "light", "dark"]);
const listeners = new Set();

function getStoredTheme() {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage?.getItem(STORAGE_KEY);
  return THEMES.has(stored) ? stored : null;
}

function getSystemTheme() {
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function resolveTheme(value) {
  return value === "system" ? getSystemTheme() : value;
}

export function getInitialTheme() {
  return getStoredTheme() ?? getSystemTheme() ?? "dark";
}

export function applyTheme(value) {
  const preference = THEMES.has(value) ? value : "dark";
  const resolved = resolveTheme(preference);

  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.classList.toggle("light", resolved === "light");
  window.localStorage?.setItem(STORAGE_KEY, preference);
  for (const listener of listeners) listener();
  return resolved;
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return getStoredTheme() ?? getInitialTheme();
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, () => "dark");
  const resolvedTheme = resolveTheme(theme);

  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if ((getStoredTheme() ?? "system") === "system") applyTheme("system");
    };
    media.addEventListener?.("change", onChange);
    return () => media.removeEventListener?.("change", onChange);
  }, []);

  return {
    theme,
    resolvedTheme,
    setTheme: applyTheme,
  };
}
