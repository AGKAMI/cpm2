export type ThemeMode = "night" | "paper";
export type ThemeTone = "single" | "double";

export const PALETTE_IDS = [
  "titanium",
  "ember",
  "crimson",
  "azure",
  "monaco",
  "solar",
  "neon",
  "grandprix",
] as const;

export type PaletteId = (typeof PALETTE_IDS)[number];

export type PaletteColors = {
  primary: string;
  deep: string;
  secondary: string;
};

export type Palette = {
  id: PaletteId;
  name: string;
  tone: ThemeTone;
  note: string;
  night: PaletteColors;
  paper: PaletteColors;
};

export const DEFAULT_PALETTE: PaletteId = "titanium";

/** Neutral surfaces shared by every palette. Keep in sync with globals.css. */
export const PALETTE_BASE: Record<ThemeMode, { bg: string; surface: string; ink: string }> = {
  night: { bg: "#090b0f", surface: "#14161b", ink: "#f2f5f8" },
  paper: { bg: "#f1f3f5", surface: "#fafbfd", ink: "#0e1217" },
};

/**
 * Accent pairs. CSS owns the live OKLCH values; these are the picker's
 * preview swatches and hex labels (the sRGB equivalents of the CSS values).
 * Keep both copies in sync.
 */
export const PALETTES: Palette[] = [
  {
    id: "titanium",
    name: "Titanium",
    tone: "single",
    note: "Factory silver on graphite.",
    night: { primary: "#dbe2ea", deep: "#aab6c4", secondary: "#9aa7b8" },
    paper: { primary: "#3f4a57", deep: "#2a333e", secondary: "#596879" },
  },
  {
    id: "ember",
    name: "Ember",
    tone: "single",
    note: "Burnt orange, warm cabin.",
    night: { primary: "#ffb35c", deep: "#d9822a", secondary: "#ffd8a8" },
    paper: { primary: "#9c5400", deep: "#7d4506", secondary: "#945700" },
  },
  {
    id: "crimson",
    name: "Crimson",
    tone: "single",
    note: "Race red, high alert.",
    night: { primary: "#ff5d6c", deep: "#c92f3f", secondary: "#ffb3b8" },
    paper: { primary: "#b32033", deep: "#8a1526", secondary: "#ad434f" },
  },
  {
    id: "azure",
    name: "Azure",
    tone: "single",
    note: "Ice blue, night highway.",
    night: { primary: "#6cc7ff", deep: "#2f8fd6", secondary: "#a8e0ff" },
    paper: { primary: "#036baa", deep: "#0a5487", secondary: "#006d9d" },
  },
  {
    id: "monaco",
    name: "Monaco",
    tone: "double",
    note: "Red and cream, old-school paddock.",
    night: { primary: "#ff5a5f", deep: "#c92f3f", secondary: "#f2d6a2" },
    paper: { primary: "#c12535", deep: "#8f1725", secondary: "#8b5d05" },
  },
  {
    id: "solar",
    name: "Solar",
    tone: "double",
    note: "Orange and cyan, sunset run.",
    night: { primary: "#ff9f43", deep: "#d97708", secondary: "#59d2ff" },
    paper: { primary: "#a44d00", deep: "#8a4600", secondary: "#006d95" },
  },
  {
    id: "neon",
    name: "Neon",
    tone: "double",
    note: "Magenta and cyan, underground.",
    night: { primary: "#ff5ccb", deep: "#c0268f", secondary: "#58e0ff" },
    paper: { primary: "#b0187a", deep: "#850f5c", secondary: "#006f8d" },
  },
  {
    id: "grandprix",
    name: "Grand Prix",
    tone: "double",
    note: "Gold and oxblood, trophy room.",
    night: { primary: "#e8c15a", deep: "#b8902f", secondary: "#ff6b6b" },
    paper: { primary: "#856012", deep: "#6b4c0f", secondary: "#a62a38" },
  },
];

export function isPaletteId(value: string | null): value is PaletteId {
  return value !== null && (PALETTE_IDS as readonly string[]).includes(value);
}
