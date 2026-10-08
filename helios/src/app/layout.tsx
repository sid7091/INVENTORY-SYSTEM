import type { Metadata, Viewport } from "next";
import { brand } from "@/config/brand";
import "./theme.css";

export const metadata: Metadata = {
  title: `${brand.shortName} · ${brand.appTitle}`,
  description: brand.tagline,
  appleWebApp: { capable: true, title: brand.shortName, statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: brand.colors.navy,
};

// Brand colours from src/config/brand.ts become CSS variables for theme.css.
const c = brand.colors;
const d = brand.darkColors;
const appVars = (p: { bg: string; surface: string; ink: string; muted: string; amber: string; rust: string }) => `
  --bg:${p.bg};--surface:${p.surface};--ink:${p.ink};--muted:${p.muted};--amber:${p.amber};--rust:${p.rust};
  --line:color-mix(in srgb, ${p.ink} 10%, transparent);
  --line-strong:color-mix(in srgb, ${p.ink} 18%, transparent);
  --amber-soft:color-mix(in srgb, ${p.amber} 14%, transparent);`;
const cssVars = `
:root{
  --navy:${c.navy};--cream:${c.cream};--white:${c.white};--on-accent:${c.white};
  --font-heading:"${brand.fonts.heading}";--font-body:"${brand.fonts.body}";
  ${appVars(c)}
  color-scheme: light;
}
@media (prefers-color-scheme: dark){ :root{ ${appVars(d)} color-scheme: dark; } }`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={brand.fonts.googleFontsUrl} />
        <style dangerouslySetInnerHTML={{ __html: cssVars }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
