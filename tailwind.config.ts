/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Background / foreground
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Card / popover
        card: "var(--card)",
        "card-foreground": "var(--card-foreground)",
        popover: "var(--popover)",
        "popover-foreground": "var(--popover-foreground)",
        // Primary / secondary / accent
        primary: "var(--primary)",
        "primary-foreground": "var(--primary-foreground)",
        secondary: "var(--secondary)",
        "secondary-foreground": "var(--secondary-foreground)",
        accent: "var(--accent)",
        "accent-foreground": "var(--accent-foreground)",
        // Muted / destructive
        muted: "var(--muted)",
        "muted-foreground": "var(--muted-foreground)",
        destructive: "var(--destructive)",
        "destructive-foreground": "var(--destructive-foreground)",
        // Border / input / ring
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        // Legacy aether-* component colors (kept for existing components)
        "aether-text": "var(--foreground)",
        "aether-text-soft": "var(--muted-foreground)",
        "aether-text-faint": "var(--muted-foreground)",
        "aether-accent": "var(--primary)",
        "aether-paper": "var(--background)",
        "aether-paper-raised": "var(--card)",
        "aether-paper-sunken": "var(--card)",
        "aether-glass": "var(--background)",
        "aether-aurora": "var(--accent)",
        "ink": "var(--foreground)",
        "ink-soft": "var(--muted-foreground)",
        "ink-faint": "var(--muted-foreground)",
        "racing": "var(--primary)",
        "racing-deep": "var(--primary)",
        "racing-soft": "var(--primary)",
        "brass": "var(--accent)",
        "oxblood": "var(--destructive)",
        "blueprint": "var(--primary)",
        "silver": "var(--muted-foreground)",
        "bronze": "var(--accent)",
        "void": "var(--background)",
        "edge": "var(--border)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "var(--radius-md)",
        sm: "var(--radius-sm)",
      },
    },
  },
  plugins: [],
}
