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
  night: { bg: "#010d16", surface: "#05131d", ink: "#f5f9ff" },
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
    paper: { primary: "#3e4b52", deep: "#283438", secondary: "#576972" },
  },
  {
    id: "ember",
    name: "Ember",
    tone: "single",
    note: "Burnt orange, warm cabin.",
    night: { primary: "#ffb35c", deep: "#d9822a", secondary: "#ffd8a8" },
    paper: { primary: "#9d4c40", deep: "#7e413b", secondary: "#935500" },
  },
  {
    id: "crimson",
    name: "Crimson",
    tone: "single",
    note: "Race red, high alert.",
    night: { primary: "#ff5d6c", deep: "#c92f3f", secondary: "#ffb3b8" },
    paper: { primary: "#b90098", deep: "#8e0077", secondary: "#b2099d" },
  },
  {
    id: "azure",
    name: "Azure",
    tone: "single",
    note: "Ice blue, night highway.",
    night: { primary: "#6cc7ff", deep: "#2f8fd6", secondary: "#a8e0ff" },
    paper: { primary: "#00748d", deep: "#005a6f", secondary: "#007e37" },
  },
  {
    id: "monaco",
    name: "Monaco",
    tone: "double",
    note: "Red and cream, old-school paddock.",
    night: { primary: "#14161b", deep: "#14161b", secondary: "#14161b" },
    paper: { primary: "#c900a1", deep: "#930078", secondary: "#8b5a30" },
  },
  {
    id: "solar",
    name: "Solar",
    tone: "double",
    note: "Orange and cyan, sunset run.",
    night: { primary: "#fac547", deep: "#c8942d", secondary: "#c39553" },
    paper: { primary: "#a5434e", deep: "#8a4119", secondary: "#007c37" },
  },
  {
    id: "neon",
    name: "Neon",
    tone: "double",
    note: "Magenta and cyan, underground.",
    night: { primary: "#4d9aff", deep: "#026fd7", secondary: "#2784d5" },
    paper: { primary: "#be00e3", deep: "#9000ac", secondary: "#007d24" },
  },
  {
    id: "grandprix",
    name: "Grand Prix",
    tone: "double",
    note: "Gold and oxblood, trophy room.",
    night: { primary: "#ef4b67", deep: "#b21f41", secondary: "#c8536c" },
    paper: { primary: "#845d2b", deep: "#6c4924", secondary: "#ab0090" },
  },
];

export function isPaletteId(value: string | null): value is PaletteId {
  return value !== null && (PALETTE_IDS as readonly string[]).includes(value);
}
