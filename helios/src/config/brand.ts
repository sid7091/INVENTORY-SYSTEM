// Every colour, brand text and asset path lives here. Nothing else in the app
// should contain a hex code or a Helios phrase — change it here and it changes
// everywhere (app, branded photos and the client PDF).

export const brand = {
  name: "Helios Stone",
  shortName: "Helios",
  appTitle: "Slab library",
  tagline: "Exotic marble, quartzite, granite, quartz and onyx",

  colors: {
    navy: "#0A213A",
    cream: "#EAE4D8",
    white: "#FCFAF7",
    bg: "#E7E5E1",
    surface: "#F6F5F2",
    ink: "#1E1C19",
    muted: "#6B665E",
    amber: "#B8761E",
    rust: "#9A3F1E",
  },

  // App colours used when the phone is in dark mode (brand navy/cream stay).
  darkColors: {
    bg: "#11161D",
    surface: "#1A212B",
    ink: "#ECE8E1",
    muted: "#A39E95",
    amber: "#D3923D",
    rust: "#CF6A45",
  },

  fonts: {
    heading: "Marcellus",
    body: "Instrument Sans",
    googleFontsUrl:
      "https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&family=Marcellus&display=swap",
  },

  // Files in public/brand/. Replace them with the real artwork from the
  // artifact export (same file names) — no code change needed.
  assets: {
    logoMain: "/brand/logo-main.png", // cream logo, used on navy (PDF cover, photo band)
    logoFooter: "/brand/logo-footer.png", // navy logo, used on the cream PDF footer
    building: "/brand/building.jpg", // last PDF page; skipped if the file is missing
    fontRegular: "/brand/DejaVuSans.ttf",
    fontBold: "/brand/DejaVuSans-Bold.ttf",
  },

  // Printed on the PDF product pages' footer.
  categoryLine: "QUARTZITES   I   IMPORTED MARBLE   I   GRANITE   I   QUARTZ   I   ONYX",

  pdf: {
    fileName: "Helios - Stone For You",
    coverWords: ["Stone", "For", "You"],
    byLine: "BY TEAM HELIOS",
    curatedFor: "CURATED FOR",
    thankWords: ["Thank", "You"],
    thankYouParagraph: [
      "Thank you for your interest in our unique stone collection! Each piece is one-of-a-kind,",
      "showcasing distinct characteristics. Please note that the images represent the essence",
      "of our stones only.",
    ],
  },

  // Clients (architects / customers) get an "Enquire on WhatsApp" button that
  // opens a chat with this number. International format, digits only.
  // Leave empty to hide the button.
  whatsappNumber: "",

  // Let architects and customers request an account from the login page.
  // Requests wait on the Team page until an admin approves them.
  allowClientRegistration: true,
} as const;

export type BrandColor = keyof typeof brand.colors;
