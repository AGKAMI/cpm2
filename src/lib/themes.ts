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
  night: { bg: "#0a0c10", surface: "#12151b", ink: "#f3f5f7" },
  paper: { bg: "#f1f3f5", surface: "#fafbfc", ink: "#101318" },
};

/**
 * Accent pairs. CSS owns the live values; these are the picker's preview
 * swatches and hex labels. Keep both copies in sync.
 */
export const PALETTES: Palette[] = [
  {
    id: "titanium",
    name: "Titanium",
    tone: "single",
    note: "Factory silver on graphite.",
    night: { primary: "#dbe2ea", deep: "#aab6c4", secondary: "#9aa7b8" },
    paper: { primary: "#3f4a57", deep: "#2a333e", secondary: "#5c6b7c" },
  },
  {
    id: "ember",
    name: "Ember",
    tone: "single",
    note: "Burnt orange, warm cabin.",
    night: { primary: "#ffb35c", deep: "#d9822b", secondary: "#ffd8a8" },
    paper: { primary: "#a85f0e", deep: "#7d4506", secondary: "#b97a2a" },
  },
  {
    id: "crimson",
    name: "Crimson",
    tone: "single",
    note: "Race red, high alert.",
    night: { primary: "#ff5d6c", deep: "#c92f3f", secondary: "#ffb3b8" },
    paper: { primary: "#b31f33", deep: "#8a1526", secondary: "#c25660" },
  },
  {
    id: "azure",
    name: "Azure",
    tone: "single",
    note: "Ice blue, night highway.",
    night: { primary: "#6cc7ff", deep: "#2f8fd6", secondary: "#a8e0ff" },
    paper: { primary: "#0e6fae", deep: "#0a5487", secondary: "#2a8bbd" },
  },
  {
    id: "monaco",
    name: "Monaco",
    tone: "double",
    note: "Red and cream, old-school paddock.",
    night: { primary: "#ff5a5f", deep: "#c92f3f", secondary: "#f2d6a2" },
    paper: { primary: "#c02434", deep: "#8f1725", secondary: "#9a6b1f" },
  },
  {
    id: "solar",
    name: "Solar",
    tone: "double",
    note: "Orange and cyan, sunset run.",
    night: { primary: "#ff9f43", deep: "#d97706", secondary: "#5ad2ff" },
    paper: { primary: "#b45c00", deep: "#8a4600", secondary: "#0b7fa8" },
  },
  {
    id: "neon",
    name: "Neon",
    tone: "double",
    note: "Magenta and cyan, underground.",
    night: { primary: "#ff5ccb", deep: "#c0268f", secondary: "#58e0ff" },
    paper: { primary: "#b0177a", deep: "#850f5c", secondary: "#0a7f9e" },
  },
  {
    id: "grandprix",
    name: "Grand Prix",
    tone: "double",
    note: "Gold and oxblood, trophy room.",
    night: { primary: "#e8c15a", deep: "#b8902f", secondary: "#ff6b6b" },
    paper: { primary: "#8a651a", deep: "#6b4c0f", secondary: "#a62a38" },
  },
];

export function isPaletteId(value: string | null): value is PaletteId {
  return value !== null && (PALETTE_IDS as readonly string[]).includes(value);
}
