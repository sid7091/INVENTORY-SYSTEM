// Domain constants shared across the app. Enums are plain string unions so the
// SQLite Prisma provider stays happy while we keep strong typing in TS.

// -- Workflow status ---------------------------------------------------------

export const STATUSES = [
  "NEEDS_PHOTOS",
  "IN_STOCK",
  "READY_TO_DISPATCH",
  "HOLD",
  "PARTIALLY_SOLD",
  "SOLD",
] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<Status, string> = {
  NEEDS_PHOTOS: "Needs Photos",
  IN_STOCK: "In Stock",
  READY_TO_DISPATCH: "Ready to Dispatch",
  HOLD: "Hold",
  PARTIALLY_SOLD: "Partially Sold",
  SOLD: "Sold",
};

// Statuses a user may transition a block to from the status-change action.
// NEEDS_PHOTOS is never a manual target — it is only set on creation and
// cleared automatically once a photo is attached (the photo gate).
export const ASSIGNABLE_STATUSES: Status[] = [
  "IN_STOCK",
  "READY_TO_DISPATCH",
  "HOLD",
  "PARTIALLY_SOLD",
  "SOLD",
];

// Statuses that count as "live" inventory (still physically held) for reports.
// SOLD is excluded; a partially-sold block still has stock remaining.
export const LIVE_STATUSES: Status[] = [
  "IN_STOCK",
  "READY_TO_DISPATCH",
  "HOLD",
  "PARTIALLY_SOLD",
];

// -- Business category (last spreadsheet column) -----------------------------

export const CATEGORIES = [
  "HELIOS_LISTED",
  "HOLD_HARI_PRASAD",
  "ANW_CUSTOMER_HOLD",
  "PARTIALLY_SOLD",
  "PHOTOS_PENDING",
  "TO_BE_READY",
  "OTHER",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  HELIOS_LISTED: "Helios Listed Blocks",
  HOLD_HARI_PRASAD: "Hold by Hari Prasad Garu",
  ANW_CUSTOMER_HOLD: "ANW Customers Hold Blocks",
  PARTIALLY_SOLD: "Partially Sold",
  PHOTOS_PENDING: "Photos Pending",
  TO_BE_READY: "To Be Ready Blocks",
  OTHER: "Other",
};

// Map the free-text category text from the spreadsheet to our enum.
export function normaliseCategory(raw: string | null | undefined): Category {
  const s = (raw ?? "").trim().toUpperCase();
  if (!s) return "HELIOS_LISTED";
  if (s.includes("HELIOS LISTED")) return "HELIOS_LISTED";
  if (s.includes("HARI PRASAD")) return "HOLD_HARI_PRASAD";
  if (s.includes("ANW CUSTOMER")) return "ANW_CUSTOMER_HOLD";
  if (s.includes("PARTIALLY SOLD")) return "PARTIALLY_SOLD";
  if (s.includes("PHOTOS PENDING")) return "PHOTOS_PENDING";
  if (s.includes("TO BE READY")) return "TO_BE_READY";
  return "OTHER";
}

// -- Thickness normalisation -------------------------------------------------

// Spreadsheet thickness is free text ("18 MM", "16MM", "15.5 MM"). Store the
// numeric millimetre value so it can be filtered/sorted reliably.
export function normaliseThickness(raw: string | number | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const m = String(raw).replace(",", ".").match(/([\d.]+)/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) ? n : null;
}

export function formatThickness(mm: number | null | undefined): string {
  if (mm == null) return "—";
  return `${mm} MM`;
}

// -- Excel column layout (exact order from Ready_to_dispatch.xlsx) -----------

// Header row 2 of the sheet, in order. Import maps by matching these headers
// (case-insensitive, whitespace-tolerant) so re-exports round-trip cleanly.
export const EXCEL_COLUMNS = [
  { key: "sNo", header: "S NO" },
  { key: "blockNo", header: "BLOCK NO" },
  { key: "quarryNo", header: "QUARRY NO" },
  { key: "colour", header: "COLOUR" },
  { key: "exporter", header: "EXPORTER NAME" },
  { key: "quarry", header: "QUARRY NAME" },
  { key: "weightTons", header: "WEIGHT (Tons)" },
  { key: "lengthCm", header: "Length (CM)" },
  { key: "heightCm", header: "Height (CM)" },
  { key: "pcs", header: "PCS" },
  { key: "endPcs", header: "END PCS" },
  { key: "totalSft", header: "Total Quantity (SFT)" },
  { key: "thickness", header: "THICKNESS" },
  { key: "category", header: "CATEGORY" },
] as const;

export type ExcelColumnKey = (typeof EXCEL_COLUMNS)[number]["key"];

// -- Admin "Clear all data" reset ---------------------------------------------

export const CLEAR_DATA_CONFIRM_PHRASE = "DELETE ALL DATA";
