// Client PDF in the Helios "Stone For You" template, built in the browser.
// Positions come from ./layout.ts and texts/colours from config/brand.ts.

import { jsPDF } from "jspdf";
import { brand } from "@/config/brand";
import { cropToBox, loadImage } from "@/lib/images";
import { imageUrl } from "@/lib/imageUrl";
import { safeFileName } from "@/lib/text";
import type { SlabDetail } from "@/lib/types";
import * as L from "./layout";

export interface PdfOptions {
  client: string;
  location: string;
  includeRenders: boolean;
  onProgress?: (msg: string) => void;
}

const FONT = "DejaVu";

async function toBase64(url: string): Promise<string> {
  const buf = await (await fetch(url)).arrayBuffer();
  let s = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

async function addFonts(doc: jsPDF): Promise<string> {
  try {
    const [regular, bold] = await Promise.all([toBase64(brand.assets.fontRegular), toBase64(brand.assets.fontBold)]);
    doc.addFileToVFS("DejaVuSans.ttf", regular);
    doc.addFont("DejaVuSans.ttf", FONT, "normal");
    doc.addFileToVFS("DejaVuSans-Bold.ttf", bold);
    doc.addFont("DejaVuSans-Bold.ttf", FONT, "bold");
    return FONT;
  } catch {
    return "helvetica";
  }
}

/** A PNG data URL that keeps transparency (logos). */
async function pngData(url: string): Promise<{ data: string; ratio: number } | null> {
  try {
    const img = await loadImage(url);
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    c.getContext("2d")!.drawImage(img, 0, 0);
    return { data: c.toDataURL("image/png"), ratio: img.naturalWidth / img.naturalHeight };
  } catch {
    return null;
  }
}

/** Places a logo inside a box, keeping its proportions, centred. */
function addLogo(doc: jsPDF, logo: { data: string; ratio: number } | null, box: { x: number; y: number; w: number; h: number }) {
  if (!logo) return;
  const w = Math.min(box.w, box.h * logo.ratio);
  const h = w / logo.ratio;
  doc.addImage(logo.data, "PNG", box.x + (box.w - w) / 2, box.y + (box.h - h) / 2, w, h);
}

async function addCropped(doc: jsPDF, url: string, box: { x: number; y: number; w: number; h: number }) {
  const img = await loadImage(url);
  doc.addImage(cropToBox(img, box.w, box.h, L.imageQuality), "JPEG", box.x, box.y, box.w, box.h);
}

function navyPage(doc: jsPDF, first: boolean) {
  if (!first) doc.addPage([L.page.width, L.page.height], "landscape");
  doc.setFillColor(brand.colors.navy);
  doc.rect(0, 0, L.page.width, L.page.height, "F");
}

function text(doc: jsPDF, s: string, x: number, y: number, opts: { size: number; color: string; font: string; bold?: boolean; spacing?: number }) {
  doc.setFont(opts.font, opts.bold ? "bold" : "normal");
  doc.setFontSize(opts.size);
  doc.setTextColor(opts.color);
  doc.text(s, x, y, { baseline: "top", charSpace: opts.spacing ?? 0 });
}

function footer(doc: jsPDF, font: string, logo: { data: string; ratio: number } | null) {
  const f = L.footer;
  doc.setFillColor(brand.colors.cream);
  doc.rect(0, f.bandTop, L.page.width, L.page.height - f.bandTop, "F");
  addLogo(doc, logo, f.logo);
  text(doc, brand.categoryLine, f.category.x, f.category.y, { size: f.category.size, color: brand.colors.navy, font, spacing: f.category.spacing });
}

/** Largest equal-size 3:2 tiles for n renders, rows centred. */
export function renderTiles(n: number) {
  const { area, gap, tileRatio } = L.rendersPage;
  let best = { cols: 1, w: 0, h: 0 };
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const w = Math.min((area.w - gap * (cols - 1)) / cols, ((area.h - gap * (rows - 1)) / rows) * tileRatio);
    if (w > best.w) best = { cols, w, h: w / tileRatio };
  }
  const rows = Math.ceil(n / best.cols);
  const gridH = rows * best.h + (rows - 1) * gap;
  const top = area.y + (area.h - gridH) / 2;
  return Array.from({ length: n }, (_, i) => {
    const row = Math.floor(i / best.cols);
    const inRow = Math.min(best.cols, n - row * best.cols);
    const rowW = inRow * best.w + (inRow - 1) * gap;
    const left = area.x + (area.w - rowW) / 2;
    return { x: left + (i % best.cols) * (best.w + gap), y: top + row * (best.h + gap), w: best.w, h: best.h };
  });
}

function productPage(doc: jsPDF, slab: SlabDetail, font: string) {
  const p = L.productPage;
  const white = brand.colors.white;

  // Block no. — one line; shrink to fit the column.
  const blockText = `BLOCK NO : ${slab.block}`.toUpperCase();
  let size: number = p.block.size;
  doc.setFont(font, "normal");
  doc.setFontSize(size);
  while (size > 8 && doc.getTextWidth(blockText) + p.block.spacing * blockText.length > p.textMaxWidth) {
    size -= 0.5;
    doc.setFontSize(size);
  }
  text(doc, blockText, p.textX, p.block.y, { size, color: white, font, spacing: p.block.spacing });

  // Name, wrapped, up to 4 lines.
  doc.setFont(font, "normal");
  doc.setFontSize(p.name.size);
  const lines = (doc.splitTextToSize(slab.name.toUpperCase(), p.textMaxWidth) as string[]).slice(0, p.name.maxLines);
  const nameY = lines.length <= 2 ? p.name.yOneOrTwoLines : p.name.manyLinesBase - lines.length * p.name.manyLinesPerLine;
  lines.forEach((ln, i) => text(doc, ln, p.textX, nameY + i * p.name.lineHeight, { size: p.name.size, color: white, font }));

  // Details, anchored so the last line sits at lastLineY.
  const details = [
    slab.material?.toUpperCase(),
    slab.color && `COLOR : ${slab.color}`.toUpperCase(),
    slab.size && `SIZE : ${slab.size}`.toUpperCase(),
    slab.quantity && `QUANTITY : ${slab.quantity}`.toUpperCase(),
  ].filter((s): s is string => !!s);
  details.forEach((d, i) => {
    const y = p.details.lastLineY - (details.length - 1 - i) * p.details.gap;
    text(doc, d, p.textX, y, { size: p.details.size, color: white, font, spacing: p.details.spacing });
  });
}

export async function buildStoneForYouPdf(slabs: SlabDetail[], opts: PdfOptions): Promise<{ blob: Blob; fileName: string }> {
  const say = opts.onProgress ?? (() => {});
  say("Loading fonts and logos…");
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: [L.page.width, L.page.height], compress: true });
  const [font, logoMain, logoFooter] = await Promise.all([addFonts(doc), pngData(brand.assets.logoMain), pngData(brand.assets.logoFooter)]);
  const c = brand.colors;

  // 1. Logo page
  navyPage(doc, true);
  addLogo(doc, logoMain, L.logoPage.logo);

  // 2. Stone For You
  navyPage(doc, false);
  const cp = L.coverPage;
  brand.pdf.coverWords.forEach((w, i) => text(doc, w, cp.x, cp.words.ys[i], { size: cp.words.size, color: c.white, font, bold: true }));
  text(doc, brand.pdf.byLine, cp.x, cp.byLine.y, { size: cp.byLine.size, color: c.cream, font, spacing: cp.byLine.spacing });
  if (opts.client.trim()) {
    const style = { size: cp.curated.size, color: c.cream, font, spacing: cp.curated.spacing };
    text(doc, `${brand.pdf.curatedFor}  ${opts.client.trim().toUpperCase()}`, cp.x, cp.curated.y, style);
    if (opts.location.trim()) text(doc, opts.location.trim().toUpperCase(), cp.x, cp.curated.y + cp.curated.locationGap, style);
  }

  // 3. Each slab: product page, then renders pages
  for (const [i, slab] of slabs.entries()) {
    say(`Adding ${slab.name} (${i + 1} of ${slabs.length})…`);
    navyPage(doc, false);
    footer(doc, font, logoFooter);
    productPage(doc, slab, font);
    const cover = slab.images[0];
    if (cover) await addCropped(doc, imageUrl(cover.id), L.productPage.photo);

    const renders = opts.includeRenders ? slab.images.slice(1) : [];
    for (let start = 0; start < renders.length; start += L.rendersPage.perPage) {
      const chunk = renders.slice(start, start + L.rendersPage.perPage);
      navyPage(doc, false);
      footer(doc, font, logoFooter);
      const tiles = renderTiles(chunk.length);
      for (const [j, r] of chunk.entries()) await addCropped(doc, imageUrl(r.id), tiles[j]);
    }
  }

  // 4. Thank You
  navyPage(doc, false);
  const t = L.thankYouPage;
  brand.pdf.thankWords.forEach((w, i) => text(doc, w, t.x, t.words.ys[i], { size: t.words.size, color: c.white, font, bold: true }));
  text(doc, brand.pdf.byLine, t.x, t.byLine.y, { size: t.byLine.size, color: c.cream, font, spacing: t.byLine.spacing });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(t.paragraph.size);
  doc.setTextColor(c.cream);
  brand.pdf.thankYouParagraph.forEach((ln, i) =>
    doc.text(ln, t.paragraph.centerX, t.paragraph.y + i * t.paragraph.lineStep, { baseline: "top", align: "center" }),
  );

  // 5. Building photo (skipped if the file isn't there yet)
  try {
    const building = await loadImage(brand.assets.building);
    doc.addPage([L.page.width, L.page.height], "landscape");
    doc.addImage(cropToBox(building, L.page.width, L.page.height, L.imageQuality), "JPEG", 0, 0, L.page.width, L.page.height);
  } catch {
    /* no building photo uploaded */
  }

  say("Finishing…");
  const name = [opts.client.trim(), opts.location.trim()].filter(Boolean).join(" ");
  const fileName = safeFileName(`${brand.pdf.fileName}${name ? ` - ${name}` : ""}`) + ".pdf";
  return { blob: doc.output("blob"), fileName };
}
