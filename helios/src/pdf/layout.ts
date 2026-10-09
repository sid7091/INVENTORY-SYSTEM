// Every position in the client PDF ("Stone For You" template). Units are pt,
// measured from the top-left corner; text uses baseline "top".
// To move something on the PDF, change a number here — not in buildPdf.ts.

export const page = { width: 960, height: 540 } as const;

export const logoPage = {
  logo: { x: 277.9, y: 58.3, w: 406.8, h: 406.8 },
} as const;

export const coverPage = {
  x: 339.1,
  words: { size: 81, ys: [150.8, 228.7, 306.7] },
  byLine: { y: 390.8, size: 18, spacing: 2.6 },
  curated: { y: 440, size: 12.5, spacing: 1.2, locationGap: 22 },
} as const;

export const footer = {
  bandTop: 462.8,
  logo: { x: 24.5, y: 469.4, w: 59, h: 59 },
  category: { x: 216.2, y: 488.3, size: 15.3, spacing: 1.1 },
} as const;

export const productPage = {
  textX: 54,
  textMaxWidth: 250,
  block: { y: 28.4, size: 16, spacing: 1.2 },
  name: {
    size: 24.7,
    lineHeight: 39.1,
    // 1–2 lines start here; 3–4 lines start at shortBase − lines × perLine.
    yOneOrTwoLines: 198.2,
    manyLinesBase: 230,
    manyLinesPerLine: 19.5,
    maxLines: 4,
  },
  details: { size: 15.5, spacing: 1, gap: 35.9, lastLineY: 422.2 },
  photo: { x: 334.7, y: 25.2, w: 546.2, h: 409.6 },
} as const;

export const rendersPage = {
  area: { x: 54, y: 25.2, w: 852, h: 409.6 },
  gap: 10,
  perPage: 4,
  tileRatio: 3 / 2, // width / height
} as const;

export const thankYouPage = {
  x: 318.9,
  words: { size: 103.5, ys: [142.2, 240.6] },
  byLine: { y: 357, size: 22.9, spacing: 3.2 },
  paragraph: { centerX: 480, y: 410.2, size: 13.7, lineStep: 16.45 },
} as const;

// Images are cropped to their box in a canvas before going into the PDF, at
// this multiple of the box width (capped), to keep the file WhatsApp-sized.
export const imageQuality = { scale: 2.4, maxPx: 1800, jpeg: 0.86 } as const;
