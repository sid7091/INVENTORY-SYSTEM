import "server-only";
import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";
import { LIVE_STATUSES } from "./constants";

export interface BlockFilters {
  q?: string;
  colour?: string;
  exporter?: string;
  quarry?: string;
  thickness?: string;
  status?: string;
  category?: string;
}

// Build the Prisma where-clause for the main inventory list.
// NEEDS_PHOTOS blocks are always hidden here (the photo gate) unless a caller
// explicitly opts in via includeNeedsPhotos.
export function buildWhere(
  filters: BlockFilters,
  opts: { includeNeedsPhotos?: boolean; includeDeleted?: boolean } = {},
): Prisma.BlockWhereInput {
  const where: Prisma.BlockWhereInput = {};
  const and: Prisma.BlockWhereInput[] = [];

  if (!opts.includeDeleted) where.deletedAt = null;

  if (filters.status) {
    where.status = filters.status;
  } else if (!opts.includeNeedsPhotos) {
    where.status = { not: "NEEDS_PHOTOS" };
  }

  if (filters.colour) where.colour = filters.colour;
  if (filters.exporter) where.exporter = filters.exporter;
  if (filters.quarry) where.quarry = filters.quarry;
  if (filters.category) where.category = filters.category;
  if (filters.thickness) {
    const n = parseFloat(filters.thickness);
    if (Number.isFinite(n)) where.thicknessMm = n;
  }

  if (filters.q) {
    const q = filters.q.trim();
    and.push({
      OR: [
        { blockNo: { contains: q } },
        { quarryNo: { contains: q } },
        { colour: { contains: q } },
        { exporter: { contains: q } },
        { quarry: { contains: q } },
      ],
    });
  }

  if (and.length) where.AND = and;
  return where;
}

// Distinct values that populate the filter dropdowns.
export async function getFilterOptions() {
  const blocks = await prisma.block.findMany({
    where: { deletedAt: null },
    select: { colour: true, exporter: true, quarry: true, thicknessMm: true },
  });
  const uniq = (arr: (string | null)[]) =>
    [...new Set(arr.filter((v): v is string => !!v))].sort();
  return {
    colours: uniq(blocks.map((b) => b.colour)),
    exporters: uniq(blocks.map((b) => b.exporter)),
    quarries: uniq(blocks.map((b) => b.quarry)),
    thicknesses: [...new Set(blocks.map((b) => b.thicknessMm).filter((v): v is number => v != null))].sort((a, b) => a - b),
  };
}

export async function getDashboardStats() {
  const [total, needsPhotos, live, statusGroups, sftAgg] = await Promise.all([
    prisma.block.count({ where: { deletedAt: null } }),
    prisma.block.count({ where: { deletedAt: null, status: "NEEDS_PHOTOS" } }),
    prisma.block.count({ where: { deletedAt: null, status: { in: LIVE_STATUSES } } }),
    prisma.block.groupBy({
      by: ["status"],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
    prisma.block.aggregate({
      where: { deletedAt: null, status: { in: LIVE_STATUSES } },
      _sum: { totalSft: true, weightTons: true },
    }),
  ]);
  return {
    total,
    needsPhotos,
    live,
    byStatus: Object.fromEntries(statusGroups.map((g) => [g.status, g._count._all])),
    liveSft: sftAgg._sum.totalSft ?? 0,
    liveTons: sftAgg._sum.weightTons ?? 0,
  };
}
