import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildExportWorkbook } from "@/lib/excel";
import { buildWhere, type BlockFilters } from "@/lib/blocks";

// Export the current (filtered) inventory to the Ready-to-Dispatch Excel layout.
export async function GET(req: NextRequest) {
  await requireUser();
  const sp = req.nextUrl.searchParams;
  const filters: BlockFilters = {
    q: sp.get("q") ?? undefined,
    colour: sp.get("colour") ?? undefined,
    exporter: sp.get("exporter") ?? undefined,
    quarry: sp.get("quarry") ?? undefined,
    thickness: sp.get("thickness") ?? undefined,
    status: sp.get("status") ?? undefined,
    category: sp.get("category") ?? undefined,
  };
  const includeNeedsPhotos = sp.get("all") === "1";

  const blocks = await prisma.block.findMany({
    where: buildWhere(filters, { includeNeedsPhotos }),
    orderBy: { blockNo: "asc" },
  });

  const buf = buildExportWorkbook(blocks);
  const date = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="helios-inventory-${date}.xlsx"`,
    },
  });
}
