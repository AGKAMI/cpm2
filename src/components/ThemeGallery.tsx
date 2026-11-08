"use client";

import { useTheme } from "@/hooks/useTheme";
import { PALETTES, type Palette, type ThemeMode, type ThemeTone } from "@/lib/themes";

const MODES: { id: ThemeMode; label: string }[] = [
  { id: "night", label: "Midnight" },
  { id: "paper", label: "Daylight" },
];

const GROUPS: { tone: ThemeTone; title: string; detail: string }[] = [
  { tone: "single", title: "Single tone", detail: "One accent over neutral glass." },
  { tone: "double", title: "Double tone", detail: "An accent plus a counterpoint." },
];

export function ThemeGallery() {
  const { mode, setMode, palette, setPalette } = useTheme();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-sm text-[12px] leading-relaxed text-ink-soft">
          Surfaces stay neutral. Choose the cabin light and the accent pair.
        </p>
        <div
          className="inline-flex rounded-full p-1"
          role="group"
          aria-label="Cabin light"
        >
          {MODES.map((item) => {
            const active = mode === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setMode(item.id)}
                aria-pressed={active}
                className={`cursor-pointer rounded-full px-3 py-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors ${
                  active
                    ? "bg-racing text-racing shadow-[inset_0_1px_0_inset-shadow]"
                    : "text-ink-faint hover:text-ink"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {GROUPS.map((group) => (
        <section key={group.tone}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 className="panel-title">{group.title}</h3>
            <span className="text-[10px] text-ink-faint">{group.detail}</span>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {PALETTES.filter((item) => item.tone === group.tone).map((item) => (
              <PaletteCard
                key={item.id}
                palette={item}
                mode={mode}
                active={item.id === palette}
                onSelect={() => setPalette(item.id)}
              />
            ))}
          </div>
        </section>
      ))}

      <p className="text-[10px] leading-relaxed text-ink-faint">
        Saved on this machine. Borders, glass tint and ambient light follow the accent.
      </p>
    </div>
  );
}

function PaletteCard({
  palette,
  mode,
  active,
  onSelect,
}: {
  palette: Palette;
  mode: ThemeMode;
  active: boolean;
  onSelect: () => void;
}) {
  const colors = palette[mode];
  const swatches = [colors.primary, colors.secondary];
  const hexes = `${colors.primary} · ${colors.secondary}`;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      title={`${palette.name} - ${hexes}`}
      className={`group relative cursor-pointer rounded-[14px] border p-3 text-left transition-[border-color,background-color,transform] duration-150 active:scale-[0.99] ${
        active
          ? "border-racing bg-racing"
          : "border-border bg-background hover:border-primary hover:text-primary-foreground hover:border-racing"
      }`}
    >
      <div className="flex items-center gap-1.5" aria-hidden="true">
        {swatches.map((color) => (
          <span
            key={color}
            className="h-7 flex-1 rounded-[7px] border border-ink shadow-[inset_0_1px_0_inset-shadow]"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[12px] font-semibold text-ink">{palette.name}</span>
        <span className="num text-[9px] uppercase tracking-[0.12em] text-ink-faint">
          {palette.tone === "single" ? "1 tone" : "2 tone"}
        </span>
      </div>
      <p className="mt-1 text-[10px] leading-snug text-ink-faint">{palette.note}</p>
      <p className="num mt-1 text-[9px] text-ink-faint">{hexes}</p>

      {active ? (
        <span className="absolute right-2 top-2 grid h-4 w-4 place-items-center rounded-full bg-racing text-paper">
          <svg
            viewBox="0 0 24 24"
            className="h-2.5 w-2.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            aria-hidden="true"
          >
            <path d="M5 12.5l4.2 4.2L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      ) : null}
    </button>
  );
}
