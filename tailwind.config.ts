import type { Config } from "tailwindcss";

/**
 * EAGLE brand tokens — warm tan / brown / cream palette used across Eagle Stone apps.
 * Exposed as Tailwind colours so the whole staff app shares one design system.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: {
          50: "#FBF8F3",
          100: "#F5EFE6",
          200: "#EDE3D4",
          300: "#E2D3BC",
        },
        tan: {
          100: "#E6D5B8",
          200: "#D8C3A5",
          300: "#C9A66B",
          400: "#B98F4E",
          500: "#A87D3E",
        },
        brown: {
          400: "#8A6A4A",
          500: "#6B4F3A",
          600: "#57402F",
          700: "#4A3728",
          800: "#3A2B1F",
          900: "#2A1F16",
        },
        eagle: {
          gold: "#B08D57",
          bark: "#4A3728",
          sand: "#EDE3D4",
        },
        // Semantic status colours (kept warm to fit the brand).
        status: {
          instock: "#3F7D53",
          reserved: "#B4881E",
          sold: "#7A5FA6",
          damaged: "#C05746",
          returned: "#6B7280",
          needsphotos: "#B98F4E",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        serif: ["ui-serif", "Georgia", "Cambria", "serif"],
      },
      boxShadow: {
        card: "0 1px 3px rgba(74, 55, 40, 0.08), 0 1px 2px rgba(74, 55, 40, 0.06)",
        cardhover: "0 6px 16px rgba(74, 55, 40, 0.14)",
      },
    },
  },
  plugins: [],
};

export default config;
