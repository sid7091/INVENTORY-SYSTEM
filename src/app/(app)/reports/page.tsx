import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { formatNumber, formatSft, daysBetween } from "@/lib/utils";
import { LIVE_STATUSES } from "@/lib/constants";

export const dynamic = "force-dynamic";

const LOW_STOCK_THRESHOLD = 3;
const AGED_DAYS = 120;

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <div className="mb-3">
        <h2 className="font-serif text-base font-bold text-brown-800">{title}</h2>
        {subtitle && <p className="text-xs text-brown-400">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-cream-200">
      <div className="h-full rounded-full bg-tan-400" style={{ width: `${pct}%` }} />
    </div>
  );
}

export default async function ReportsPage() {
  const live = { deletedAt: null, status: { in: LIVE_STATUSES } } as const;

  const [byColour, byExporter, byWarehouse, liveBlocks, needsPhotos, now] = await Promise.all([
    prisma.block.groupBy({ by: ["colour"], where: live, _count: { _all: true }, _sum: { totalSft: true, weightTons: true } }),
    prisma.block.groupBy({ by: ["exporter"], where: live, _count: { _all: true }, _sum: { totalSft: true } }),
    prisma.block.groupBy({ by: ["warehouse"], where: live, _count: { _all: true }, _sum: { totalSft: true } }),
    prisma.block.findMany({ where: live, select: { id: true, blockNo: true, colour: true, createdAt: true, totalSft: true } }),
    prisma.block.count({ where: { deletedAt: null, status: "NEEDS_PHOTOS" } }),
    Promise.resolve(new Date()),
  ]);

  // Low stock: colours with fewer than threshold live blocks.
  const lowStock = [...byColour].filter((c) => c._count._all < LOW_STOCK_THRESHOLD).sort((a, b) => a._count._all - b._count._all);

  // Aged blocks: live blocks older than AGED_DAYS.
  const aged = liveBlocks
    .map((b) => ({ ...b, age: daysBetween(now, b.createdAt) }))
    .filter((b) => b.age >= AGED_DAYS)
    .sort((a, b) => b.age - a.age)
    .slice(0, 25);

  const colourSorted = [...byColour].sort((a, b) => (b._sum.totalSft ?? 0) - (a._sum.totalSft ?? 0)).slice(0, 15);
  const maxColourSft = Math.max(1, ...colourSorted.map((c) => c._sum.totalSft ?? 0));
  const exporterSorted = [...byExporter].sort((a, b) => (b._sum.totalSft ?? 0) - (a._sum.totalSft ?? 0)).slice(0, 15);
  const maxExpSft = Math.max(1, ...exporterSorted.map((c) => c._sum.totalSft ?? 0));

  return (
    <div>
      <PageHeader title="Reports" subtitle="Live inventory = In Stock + Ready to Dispatch + Hold + Partially Sold" />
      <div className="grid gap-4 p-4 sm:gap-6 sm:p-6 lg:grid-cols-2">
        <Section title="Photo backlog" subtitle="Blocks still in the photo gate">
          <div className="flex items-center gap-4">
            <div className="text-4xl font-bold text-status-needsphotos">{formatNumber(needsPhotos, 0)}</div>
            <Link href="/needs-actions" className="btn-secondary text-sm">Open queue →</Link>
          </div>
        </Section>

        <Section title="Low stock by colour" subtitle={`Colours with fewer than ${LOW_STOCK_THRESHOLD} live blocks`}>
          {lowStock.length === 0 ? <p className="text-sm text-brown-400">No low-stock colours.</p> : (
            <ul className="max-h-64 space-y-1 overflow-y-auto">
              {lowStock.map((c) => (
                <li key={c.colour} className="flex items-center justify-between text-sm">
                  <Link href={`/inventory?colour=${encodeURIComponent(c.colour)}`} className="text-tan-500 hover:underline">{c.colour}</Link>
                  <span className="badge bg-red-100 text-red-700">{c._count._all} left</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Value by colour" subtitle="Top 15 by live SFT">
          <div className="space-y-2">
            {colourSorted.map((c) => (
              <div key={c.colour}>
                <div className="flex justify-between text-xs text-brown-600">
                  <span>{c.colour}</span>
                  <span>{formatSft(c._sum.totalSft ?? 0)} · {c._count._all} blk</span>
                </div>
                <Bar value={c._sum.totalSft ?? 0} max={maxColourSft} />
              </div>
            ))}
          </div>
        </Section>

        <Section title="Value by exporter" subtitle="Top 15 by live SFT">
          <div className="space-y-2">
            {exporterSorted.map((c) => (
              <div key={c.exporter ?? "—"}>
                <div className="flex justify-between text-xs text-brown-600">
                  <span>{c.exporter ?? "—"}</span>
                  <span>{formatSft(c._sum.totalSft ?? 0)} · {c._count._all} blk</span>
                </div>
                <Bar value={c._sum.totalSft ?? 0} max={maxExpSft} />
              </div>
            ))}
          </div>
        </Section>

        <Section title="Value by warehouse" subtitle="Live SFT & block count per yard">
          {byWarehouse.length === 0 ? <p className="text-sm text-brown-400">No warehouse data.</p> : (
            <table className="min-w-full text-sm">
              <tbody className="divide-y divide-cream-100">
                {byWarehouse.sort((a, b) => (b._sum.totalSft ?? 0) - (a._sum.totalSft ?? 0)).map((w) => (
                  <tr key={w.warehouse ?? "—"}>
                    <td className="py-1.5 text-brown-700">{w.warehouse ?? "Unassigned"}</td>
                    <td className="py-1.5 text-right text-brown-500">{w._count._all} blk</td>
                    <td className="py-1.5 text-right font-medium text-brown-800">{formatSft(w._sum.totalSft ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <Section title="Aged blocks" subtitle={`Live blocks in stock ${AGED_DAYS}+ days`}>
          {aged.length === 0 ? <p className="text-sm text-brown-400">No aged blocks.</p> : (
            <ul className="max-h-64 space-y-1 overflow-y-auto">
              {aged.map((b) => (
                <li key={b.id} className="flex items-center justify-between text-sm">
                  <Link href={`/inventory/${b.id}`} className="font-mono text-tan-500 hover:underline">{b.blockNo}</Link>
                  <span className="text-brown-500">{b.colour}</span>
                  <span className="badge bg-amber-100 text-amber-800">{b.age} days</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}
