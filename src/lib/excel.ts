import * as XLSX from "xlsx";
import { EXCEL_COLUMNS, normaliseThickness, normaliseCategory, type Category } from "./constants";

export interface ParsedRow {
  rowIndex: number; // 1-based data row number (for user-facing messages)
  blockNo: string;
  quarryNo: string | null;
  colour: string;
  exporter: string | null;
  quarry: string | null;
  weightTons: number | null;
  lengthCm: number | null;
  heightCm: number | null;
  pcs: number | null;
  endPcs: number | null;
  totalSft: number | null;
  thicknessMm: number | null;
  category: Category;
}

export interface RowError {
  rowIndex: number;
  field: string;
  message: string;
}

export interface ParseResult {
  rows: ParsedRow[];
  errors: RowError[]; // blocking — abort the all-or-nothing commit
  warnings: RowError[]; // non-blocking — surfaced but import still proceeds
  detectedHeaders: string[];
  totalDataRows: number;
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function int(v: unknown): number | null {
  const n = num(v);
  return n == null ? null : Math.round(n);
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function normHeader(h: unknown): string {
  return String(h ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

// Locate the header row (the one containing "BLOCK NO"), then map each of our
// known columns to a physical column index.
function locateColumns(matrix: unknown[][]): { headerRow: number; map: Record<string, number>; headers: string[] } | null {
  for (let r = 0; r < Math.min(matrix.length, 10); r++) {
    const row = matrix[r] ?? [];
    const normed = row.map(normHeader);
    if (normed.some((h) => h === "block no")) {
      const map: Record<string, number> = {};
      for (const col of EXCEL_COLUMNS) {
        const target = normHeader(col.header);
        const idx = normed.findIndex((h) => h === target);
        if (idx >= 0) map[col.key] = idx;
      }
      // The Ready-to-Dispatch sheet carries the category/grouping in the column
      // right after THICKNESS, but that column has no header cell. Fall back to
      // its position so values like "PHOTOS PENDING" are not silently dropped.
      if (map.category == null && map.thickness != null) {
        map.category = map.thickness + 1;
      }
      return { headerRow: r, map, headers: row.map((h) => String(h ?? "")) };
    }
  }
  return null;
}

export function parseWorkbook(buffer: Buffer): ParseResult {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });

  const located = locateColumns(matrix);
  if (!located) {
    return {
      rows: [],
      errors: [{ rowIndex: 0, field: "file", message: "Could not find a 'BLOCK NO' header row. Is this the Ready-to-Dispatch layout?" }],
      warnings: [],
      detectedHeaders: [],
      totalDataRows: 0,
    };
  }

  const { headerRow, map, headers } = located;
  const rows: ParsedRow[] = [];
  const errors: RowError[] = [];
  const warnings: RowError[] = [];
  const seen = new Map<string, number>(); // blockNo -> first row index within this file
  let dataRowCount = 0;

  const get = (row: unknown[], key: string) => (map[key] != null ? row[map[key]] : null);

  for (let r = headerRow + 1; r < matrix.length; r++) {
    const row = matrix[r] ?? [];
    const blockNo = str(get(row, "blockNo"));
    // Skip fully empty rows and section/title rows silently.
    const anyValue = row.some((c) => c != null && String(c).trim() !== "");
    if (!blockNo && !anyValue) continue;
    if (!blockNo) continue;

    dataRowCount++;
    const rowIndex = dataRowCount;

    const rawColour = str(get(row, "colour"));
    const parsed: ParsedRow = {
      rowIndex,
      blockNo: blockNo.toUpperCase(),
      quarryNo: str(get(row, "quarryNo")),
      // A blank colour cell is a warning, not a hard failure — default it so a
      // single empty cell can't reject an otherwise-valid production file.
      colour: rawColour ?? "UNSPECIFIED",
      exporter: str(get(row, "exporter")),
      quarry: str(get(row, "quarry")),
      weightTons: num(get(row, "weightTons")),
      lengthCm: num(get(row, "lengthCm")),
      heightCm: num(get(row, "heightCm")),
      pcs: int(get(row, "pcs")),
      endPcs: int(get(row, "endPcs")),
      totalSft: num(get(row, "totalSft")),
      thicknessMm: normaliseThickness(get(row, "thickness") as string | number | null),
      category: normaliseCategory(str(get(row, "category"))),
    };

    // Validation — blocking errors vs non-blocking warnings.
    if (!rawColour) {
      warnings.push({ rowIndex, field: "colour", message: `Row ${rowIndex} (${parsed.blockNo}): colour blank — imported as UNSPECIFIED` });
    }
    if (parsed.weightTons != null && parsed.weightTons < 0) {
      errors.push({ rowIndex, field: "weightTons", message: `Row ${rowIndex} (${parsed.blockNo}): weight cannot be negative` });
    }
    if (parsed.pcs != null && parsed.pcs < 0) {
      errors.push({ rowIndex, field: "pcs", message: `Row ${rowIndex} (${parsed.blockNo}): PCS cannot be negative` });
    }
    const dup = seen.get(parsed.blockNo);
    if (dup != null) {
      errors.push({ rowIndex, field: "blockNo", message: `Row ${rowIndex}: duplicate block number ${parsed.blockNo} (also on row ${dup})` });
    } else {
      seen.set(parsed.blockNo, rowIndex);
    }

    rows.push(parsed);
  }

  return { rows, errors, warnings, detectedHeaders: headers.filter(Boolean), totalDataRows: dataRowCount };
}

// -- Export -----------------------------------------------------------------

export interface ExportBlock {
  blockNo: string;
  quarryNo: string | null;
  colour: string;
  exporter: string | null;
  quarry: string | null;
  weightTons: number | null;
  lengthCm: number | null;
  heightCm: number | null;
  pcs: number | null;
  endPcs: number | null;
  totalSft: number | null;
  thicknessMm: number | null;
  category: string;
  status: string;
}

export function buildExportWorkbook(blocks: ExportBlock[]): Buffer {
  const header = [
    "S NO", "BLOCK NO", "QUARRY NO", "COLOUR", "EXPORTER NAME", "QUARRY NAME",
    "WEIGHT (Tons)", "Length (CM)", "Height (CM)", "PCS", "END PCS",
    "Total Quantity (SFT)", "THICKNESS", "CATEGORY", "STATUS",
  ];
  const rows = blocks.map((b, i) => [
    i + 1,
    b.blockNo,
    b.quarryNo,
    b.colour,
    b.exporter,
    b.quarry,
    b.weightTons,
    b.lengthCm,
    b.heightCm,
    b.pcs,
    b.endPcs,
    b.totalSft,
    b.thicknessMm != null ? `${b.thicknessMm} MM` : null,
    b.category,
    b.status,
  ]);
  const ws = XLSX.utils.aoa_to_sheet([["READY TO DISPATCH BLOCKS"], header, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Inventory");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
