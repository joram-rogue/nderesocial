// Filter presets — CSS filter strings. Stored on user_reels.filter so playback can re-apply.
export type FilterPreset = {
  id: string;
  label: string;
  css: string;
};

export const FILTER_PRESETS: FilterPreset[] = [
  { id: "none",     label: "Original", css: "none" },
  { id: "warm",     label: "Warm",     css: "saturate(1.15) sepia(0.18) contrast(1.05) brightness(1.03)" },
  { id: "cool",     label: "Cool",     css: "saturate(1.1) hue-rotate(-10deg) contrast(1.05) brightness(1.02)" },
  { id: "noir",     label: "Noir",     css: "grayscale(1) contrast(1.25) brightness(0.95)" },
  { id: "vivid",    label: "Vivid",    css: "saturate(1.6) contrast(1.15)" },
  { id: "fade",     label: "Fade",     css: "saturate(0.7) contrast(0.92) brightness(1.08)" },
  { id: "ndere",    label: "Ndere",    css: "saturate(1.25) sepia(0.25) contrast(1.1) brightness(1.05) hue-rotate(-8deg)" },
];

export const buildAdjustCss = (a: { brightness: number; contrast: number; saturate: number }) =>
  `brightness(${a.brightness}) contrast(${a.contrast}) saturate(${a.saturate})`;

export const composeCss = (presetCss: string, adjustCss: string) => {
  if (presetCss === "none") return adjustCss;
  return `${presetCss} ${adjustCss}`;
};
