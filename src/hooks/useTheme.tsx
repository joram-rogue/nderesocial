import { useEffect, useState, useCallback } from "react";

export type Theme = "coffee" | "midnight";
export type FontMode = "app" | "system";

const THEME_KEY = "ndere.theme";
const FONT_KEY = "ndere.font";
const WALL_KEY = "ndere.wallpaper"; // "" | preset id | data: URL

export const WALLPAPER_PRESETS: { id: string; label: string; css: string }[] = [
  { id: "", label: "None", css: "" },
  { id: "warm", label: "Warm", css: "linear-gradient(135deg,#3a1f12 0%,#1a0f0a 100%)" },
  { id: "rose", label: "Rose", css: "linear-gradient(160deg,#3b1d2a 0%,#120608 100%)" },
  { id: "ocean", label: "Ocean", css: "linear-gradient(160deg,#0c2340 0%,#06121f 100%)" },
  { id: "forest", label: "Forest", css: "linear-gradient(160deg,#1a3c2a 0%,#08130d 100%)" },
  { id: "noir", label: "Noir", css: "linear-gradient(180deg,#1a1a1a 0%,#000 100%)" },
  { id: "dots", label: "Dots", css: "radial-gradient(hsl(var(--primary)/.18) 1px,transparent 1px) 0 0/18px 18px, hsl(var(--background))" },
];

const apply = (t: Theme) => {
  const root = document.documentElement;
  root.classList.toggle("theme-midnight", t === "midnight");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", t === "midnight" ? "#080503" : "#1a0f0a");
};

const applyFont = (m: FontMode) => {
  document.documentElement.classList.toggle("font-system", m === "system");
};

export const wallpaperCss = (id: string): string => {
  if (!id) return "";
  if (id.startsWith("data:") || id.startsWith("http")) return `url("${id}") center/cover no-repeat`;
  return WALLPAPER_PRESETS.find((p) => p.id === id)?.css ?? "";
};

export const useTheme = () => {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "coffee";
    return (localStorage.getItem(THEME_KEY) as Theme) || "coffee";
  });
  const [fontMode, setFontModeState] = useState<FontMode>(() => {
    if (typeof window === "undefined") return "app";
    return (localStorage.getItem(FONT_KEY) as FontMode) || "app";
  });
  const [wallpaper, setWallpaperState] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(WALL_KEY) || "";
  });

  useEffect(() => { apply(theme); }, [theme]);
  useEffect(() => { applyFont(fontMode); }, [fontMode]);

  const setTheme = useCallback((t: Theme) => { localStorage.setItem(THEME_KEY, t); setThemeState(t); }, []);
  const toggle = useCallback(() => { setTheme(theme === "coffee" ? "midnight" : "coffee"); }, [theme, setTheme]);
  const setFontMode = useCallback((m: FontMode) => { localStorage.setItem(FONT_KEY, m); setFontModeState(m); }, []);
  const setWallpaper = useCallback((w: string) => { localStorage.setItem(WALL_KEY, w); setWallpaperState(w); }, []);

  return { theme, setTheme, toggle, fontMode, setFontMode, wallpaper, setWallpaper };
};
