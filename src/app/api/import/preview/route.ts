import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseWorkbook } from "@/lib/excel";

// Dry-run: parse the uploaded workbook, validate, and classify each row as a
// NEW block or an UPDATE to an existing one. No writes happen here.
export async function POST(req: NextRequest) {
  await requireUser();
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file uploaded." }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const { rows, errors, warnings, detectedHeaders, totalDataRows } = parseWorkbook(buf);

  const blockNos = rows.map((r) => r.blockNo);
  const existing = await prisma.block.findMany({
    where: { blockNo: { in: blockNos } },
    select: { blockNo: true, deletedAt: true },
  });
  const existingSet = new Map(existing.map((e) => [e.blockNo, e]));

  const preview = rows.map((r) => {
    const ex = existingSet.get(r.blockNo);
    return {
      ...r,
      action: ex ? (ex.deletedAt ? "restore-update" : "update") : "create",
    };
  });

  const summary = {
    totalRows: totalDataRows,
    valid: rows.length,
    create: preview.filter((p) => p.action === "create").length,
    update: preview.filter((p) => p.action === "update").length,
    restore: preview.filter((p) => p.action === "restore-update").length,
    errorCount: errors.length,
    warningCount: warnings.length,
  };

  return NextResponse.json({ summary, rows: preview, errors, warnings, detectedHeaders });
}
