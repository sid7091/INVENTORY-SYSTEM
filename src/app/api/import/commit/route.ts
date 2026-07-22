import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseWorkbook } from "@/lib/excel";
import { logAudit, diff } from "@/lib/audit";

const IMPORT_KEYS = [
  "quarryNo", "colour", "exporter", "quarry", "weightTons", "lengthCm",
  "heightCm", "pcs", "endPcs", "totalSft", "thicknessMm", "category",
];

// Transactional, all-or-nothing commit. If ANY row fails validation, nothing is
// written. New blocks enter the photo gate (NEEDS_PHOTOS); existing blocks are
// updated in place (status untouched).
export async function POST(req: NextRequest) {
  const user = await requireUser();
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file uploaded." }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const { rows, errors } = parseWorkbook(buf);

  if (errors.length > 0) {
    return NextResponse.json(
      { error: `Import aborted: ${errors.length} validation error(s). Fix them and re-upload.`, errors },
      { status: 422 },
    );
  }
  if (rows.length === 0) {
    return NextResponse.json({ error: "No valid rows to import." }, { status: 422 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      let created = 0;
      let updated = 0;
      for (const r of rows) {
        const existing = await tx.block.findUnique({ where: { blockNo: r.blockNo } });
        const payload = {
          quarryNo: r.quarryNo,
          colour: r.colour,
          exporter: r.exporter,
          quarry: r.quarry,
          weightTons: r.weightTons,
          lengthCm: r.lengthCm,
          heightCm: r.heightCm,
          pcs: r.pcs,
          endPcs: r.endPcs,
          totalSft: r.totalSft,
          thicknessMm: r.thicknessMm,
          category: r.category,
        };
        if (existing) {
          const after = await tx.block.update({
            where: { id: existing.id },
            data: { ...payload, deletedAt: null, version: { increment: 1 } },
          });
          const changes = diff(existing as unknown as Record<string, unknown>, after as unknown as Record<string, unknown>, IMPORT_KEYS);
          if (Object.keys(changes).length > 0) {
            await logAudit(tx, { action: "IMPORT_UPDATE", userId: user.userId, blockId: existing.id, reason: "Bulk Excel import", changes });
          }
          updated++;
        } else {
          const block = await tx.block.create({
            data: { ...payload, blockNo: r.blockNo, status: "NEEDS_PHOTOS" },
          });
          await logAudit(tx, { action: "IMPORT_CREATE", userId: user.userId, blockId: block.id, reason: "Bulk Excel import" });
          created++;
        }
      }
      await logAudit(tx, { action: "IMPORT", userId: user.userId, reason: `Imported ${created} new, updated ${updated} existing block(s)` });
      return { created, updated };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: `Import failed and was rolled back: ${(e as Error).message}` }, { status: 500 });
  }
}
