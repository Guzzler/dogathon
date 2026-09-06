import type { CSSProperties } from "react";

export interface AppTheme {
  name: string;
  tagline: string;
  logo: {
    horizontal: string;
    mark: string;
    favicon: string;
  };
  palette: {
    evergreen: string;
    copper: string;
    cream: string;
    ink: string;
    muted: string;
    panel: string;
    border: string;
    danger: string;
    success: string;
  };
}

/* There is exactly one theme, and it is pawthwayTheme below. An unused second one
   (sidekickTheme, from before the project was called Pawthway) used to sit here with a
   full matching shape, which is precisely the trap DC-2 names: two theme objects, one
   wired in, nothing saying which. Removed 2026-09-05. */
export const pawthwayTheme: AppTheme = {
  name: "Pawthway",
  tagline: "the guided path from foster to forever.",
  logo: {
    horizontal: "/brand/logo-horizontal.png",
    mark: "/brand/mark.png",
    favicon: "/brand/favicon.png",
  },
  palette: {
    evergreen: "#E8734A",
    copper: "#F4A860",
    cream: "#FFF7EE",
    ink: "#2B2118",
    muted: "#8A7A6B",
    panel: "#FFFFFF",
    border: "#F0DFCC",
    danger: "#C0392B",
    success: "#3F9142",
  },
};

export function themeVars(theme: AppTheme): CSSProperties {
  return {
    "--brand-name": `"${theme.name}"`,
    "--color-evergreen": theme.palette.evergreen,
    "--color-copper": theme.palette.copper,
    "--color-cream": theme.palette.cream,
    "--color-ink": theme.palette.ink,
    "--color-muted": theme.palette.muted,
    "--color-panel": theme.palette.panel,
    "--color-border": theme.palette.border,
    "--color-danger": theme.palette.danger,
    "--color-success": theme.palette.success,
  } as CSSProperties;
}
