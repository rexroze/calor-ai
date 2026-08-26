"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type ThemeChoice = "dark" | "light" | "system";

const STORAGE_KEY = "calorai-theme";

const ThemeContext = createContext<{
  theme: ThemeChoice;
  setTheme: (choice: ThemeChoice) => void;
}>({ theme: "system", setTheme: () => {} });

function resolveAndApply(choice: ThemeChoice) {
  const dark =
    choice === "dark" ||
    (choice === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("light", !dark);
}

function isThemeChoice(value: unknown): value is ThemeChoice {
  return value === "dark" || value === "light" || value === "system";
}

/**
 * Client side of the class-on-html strategy. The inline script in
 * layout.tsx resolves the theme before paint; this provider keeps the
 * segment control honest and re-applies on OS changes while on "system".
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeChoice>("system");

  // Read stored choice one frame after mount — keeps SSR/client markup
  // identical (no hydration mismatch) and satisfies lint's no-sync-setState.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      let stored: unknown = null;
      try {
        stored = window.localStorage.getItem(STORAGE_KEY);
      } catch {
        // Private mode etc. — fall through to system.
      }
      if (isThemeChoice(stored)) {
        setThemeState(stored);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    resolveAndApply(theme);
    if (theme !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => resolveAndApply("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((choice: ThemeChoice) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      // Storage unavailable — apply for this session only.
    }
    setThemeState(choice);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
