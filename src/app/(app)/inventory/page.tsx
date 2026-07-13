import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Filters, ViewToggle } from "@/components/Filters";
import { BlockGrid, BlockTable } from "@/components/BlockViews";
import { buildWhere, getFilterOptions, type BlockFilters } from "@/lib/blocks";
import { prisma } from "@/lib/prisma";
import { formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 48;

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const filters: BlockFilters = {
    q: str(sp.q), colour: str(sp.colour), exporter: str(sp.exporter),
    quarry: str(sp.quarry), thickness: str(sp.thickness), status: str(sp.status), category: str(sp.category),
  };
  const view = (str(sp.view) as "grid" | "list") || "grid";
  const page = Math.max(1, parseInt(str(sp.page) || "1", 10) || 1);
  const where = buildWhere(filters);

  const [blocks, total, options] = await Promise.all([
    prisma.block.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { photos: { where: { isPrimary: true }, take: 1, select: { url: true } } },
    }),
    prisma.block.count({ where }),
    getFilterOptions(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const exportQs = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v).map(([k, v]) => [k, v as string]),
  ).toString();

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle={`${formatNumber(total, 0)} block${total === 1 ? "" : "s"} · photo-gated blocks are hidden here`}
        actions={
          <>
            <a href={`/api/export?${exportQs}`} className="btn-secondary text-sm">Export Excel</a>
            <Link href="/inventory/new" className="btn-primary text-sm">+ New Block</Link>
          </>
        }
      />
      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Filters options={options} />
          <ViewToggle current={view} />
        </div>

        {view === "grid" ? <BlockGrid blocks={blocks} /> : <BlockTable blocks={blocks} />}

        {totalPages > 1 && (
          <Pagination page={page} totalPages={totalPages} sp={sp} />
        )}
      </div>
    </div>
  );
}

function Pagination({ page, totalPages, sp }: { page: number; totalPages: number; sp: Record<string, string | string[] | undefined> }) {
  const build = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (k === "page") continue;
      if (typeof v === "string" && v) params.set(k, v);
    }
    params.set("page", String(p));
    return `/inventory?${params.toString()}`;
  };
  return (
    <div className="flex items-center justify-center gap-2 pt-2">
      {page > 1 && <Link href={build(page - 1)} className="btn-secondary text-sm">← Prev</Link>}
      <span className="text-sm text-brown-500">Page {page} of {totalPages}</span>
      {page < totalPages && <Link href={build(page + 1)} className="btn-secondary text-sm">Next →</Link>}
    </div>
  );
}
