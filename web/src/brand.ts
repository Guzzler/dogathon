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

export const sidekickTheme: AppTheme = {
  name: "Sidekick",
  tagline: "your rescue-ops sidekick.",
  logo: {
    horizontal: "/brand/logo-horizontal.png",
    mark: "/brand/mark.png",
    favicon: "/brand/favicon.png",
  },
  palette: {
    evergreen: "#2D5A3D",
    copper: "#C4955A",
    cream: "#F6F1E9",
    ink: "#173526",
    muted: "#726A5E",
    panel: "#FFFCF6",
    border: "#DED5C6",
    danger: "#A84034",
    success: "#2F7A4B",
  },
};

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
