import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { getDashboardStats } from "@/lib/blocks";
import { prisma } from "@/lib/prisma";
import { formatNumber, formatSft } from "@/lib/utils";
import { STATUS_LABELS, type Status } from "@/lib/constants";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { BRAND } from "@/lib/brand";

export const dynamic = "force-dynamic";

function Stat({ label, value, href, accent }: { label: string; value: string; href?: string; accent?: string }) {
  const inner = (
    <div className="card p-4 transition-shadow hover:shadow-cardhover">
      <div className="text-xs font-semibold uppercase tracking-wide text-brown-400">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${accent ?? "text-brown-800"}`}>{value}</div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default async function DashboardPage() {
  const stats = await getDashboardStats();
  const recent = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
    include: { user: { select: { name: true } }, block: { select: { blockNo: true } } },
  });

  return (
    <div>
      <PageHeader title="Dashboard" subtitle={`${BRAND.name} · block-level inventory overview`} />
      <div className="space-y-6 p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="Total Blocks" value={formatNumber(stats.total, 0)} href="/inventory" />
          <Stat label="Live Inventory" value={formatNumber(stats.live, 0)} href="/inventory?status=IN_STOCK" accent="text-status-instock" />
          <Stat label="Needs Photos" value={formatNumber(stats.needsPhotos, 0)} href="/needs-photos" accent="text-status-needsphotos" />
          <Stat label="Live Volume" value={formatSft(stats.liveSft)} />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="card p-5 lg:col-span-1">
            <h2 className="mb-3 font-serif text-base font-bold text-brown-800">By Status</h2>
            <div className="space-y-2">
              {(Object.keys(STATUS_LABELS) as Status[]).map((s) => (
                <Link key={s} href={s === "NEEDS_PHOTOS" ? "/needs-photos" : `/inventory?status=${s}`}
                  className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-cream-100">
                  <StatusBadge status={s} />
                  <span className="text-sm font-semibold text-brown-700">{formatNumber(stats.byStatus[s] ?? 0, 0)}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="card p-5 lg:col-span-2">
            <h2 className="mb-3 font-serif text-base font-bold text-brown-800">Recent Activity</h2>
            <ul className="divide-y divide-cream-200">
              {recent.length === 0 && <li className="py-3 text-sm text-brown-400">No activity yet.</li>}
              {recent.map((log) => (
                <li key={log.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span className="text-brown-700">
                    <span className="font-semibold">{log.action.replace(/_/g, " ")}</span>
                    {log.block && <> · <Link href={`/inventory/${log.blockId}`} className="text-tan-500 hover:underline">{log.block.blockNo}</Link></>}
                    {log.reason && <span className="text-brown-400"> — {log.reason}</span>}
                  </span>
                  <span className="whitespace-nowrap text-xs text-brown-400">
                    {log.user?.name ?? "system"} · {log.createdAt.toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
