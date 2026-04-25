import { useEffect, useState, useCallback } from "react";

export type Theme = "coffee" | "midnight";
const KEY = "ndere.theme";

const apply = (t: Theme) => {
  const root = document.documentElement;
  root.classList.toggle("theme-midnight", t === "midnight");
  // Update theme-color meta for status bar / installed PWA chrome
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", t === "midnight" ? "#080503" : "#1a0f0a");
};

export const useTheme = () => {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "coffee";
    return (localStorage.getItem(KEY) as Theme) || "coffee";
  });

  useEffect(() => { apply(theme); }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    localStorage.setItem(KEY, t);
    setThemeState(t);
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === "coffee" ? "midnight" : "coffee");
  }, [theme, setTheme]);

  return { theme, setTheme, toggle };
};
