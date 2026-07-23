import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { formatThickness } from "@/lib/constants";
import { formatSft } from "@/lib/utils";
import { DriveActionItemsList } from "@/components/DriveActionItemsList";
import { SyncNowButton } from "@/components/SyncNowButton";
import { getSetting, SETTING_KEYS } from "@/lib/appSettings";
import type { DriveSyncSummary } from "@/lib/driveSync";

export const dynamic = "force-dynamic";

function SectionHeader({ title, count, accent }: { title: string; count: number; accent?: string }) {
  return (
    <summary className="flex cursor-pointer select-none items-center gap-2 p-4 font-serif text-base font-bold text-brown-800">
      {title}
      <span className={`badge ${accent ?? "bg-amber-200 text-amber-900"}`}>{count}</span>
    </summary>
  );
}

export default async function NeedsActionsPage() {
  const [blocks, actionItems, lastSyncSummaryRaw] = await Promise.all([
    prisma.block.findMany({
      where: { deletedAt: null, status: "NEEDS_PHOTOS" },
      orderBy: { createdAt: "asc" },
    }),
    prisma.actionItem.findMany({
      where: { status: "OPEN" },
      orderBy: { createdAt: "asc" },
    }),
    getSetting(SETTING_KEYS.driveLastSyncSummary),
  ]);

  const driveItems = actionItems.map((item) => ({
    id: item.id,
    message: item.message,
    driveFolderName: item.driveFolderName,
    images: item.images ? JSON.parse(item.images) : [],
  }));

  const lastSyncSummary: DriveSyncSummary | null = lastSyncSummaryRaw ? JSON.parse(lastSyncSummaryRaw) : null;
  const skippedFolders = lastSyncSummary?.skippedEmptyFolders ?? [];

  const total = blocks.length + driveItems.length;

  return (
    <div>
      <PageHeader
        title="Needs Actions"
        subtitle={`${total} item${total === 1 ? "" : "s"} waiting on staff · photo backlog + Google Drive sync questions`}
        actions={
          <>
            <SyncNowButton />
            <Link href="/photo-room" className="btn-primary text-sm">Open Photo Room →</Link>
          </>
        }
      />
      <div className="space-y-6 p-4 sm:p-6">
        <details open className="card overflow-hidden">
          <SectionHeader title="Block number discrepancies" count={driveItems.length} />
          <div className="border-t border-tan-200 p-4">
            <DriveActionItemsList items={driveItems} />
          </div>
        </details>

        <details open className="card overflow-hidden">
          <SectionHeader title="No photos" count={blocks.length} />
          <div className="border-t border-tan-200 p-4">
            {blocks.length === 0 ? (
              <p className="text-sm text-brown-400">The queue is clear — every block has photos.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-cream-200">
                  <thead className="bg-cream-100"><tr>
                    <th className="th">Block No</th><th className="th">Colour</th><th className="th">Exporter</th>
                    <th className="th">Thickness</th><th className="th">Slabs</th><th className="th">SFT</th><th className="th">Added</th><th className="th"></th>
                  </tr></thead>
                  <tbody className="divide-y divide-cream-100">
                    {blocks.map((b) => (
                      <tr key={b.id} className="hover:bg-cream-50">
                        <td className="td font-mono font-semibold">{b.blockNo}</td>
                        <td className="td">{b.colour}</td>
                        <td className="td text-brown-500">{b.exporter ?? "—"}</td>
                        <td className="td">{formatThickness(b.thicknessMm)}</td>
                        <td className="td">{b.pcs ?? "—"}</td>
                        <td className="td">{formatSft(b.totalSft)}</td>
                        <td className="td text-brown-400">{b.createdAt.toLocaleDateString()}</td>
                        <td className="td"><Link href={`/inventory/${b.id}`} className="btn-secondary text-xs">Add photos</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </details>

        {skippedFolders.length > 0 && (
          <details className="card overflow-hidden">
            <SectionHeader title="Skipped — no photos found" count={skippedFolders.length} accent="bg-cream-200 text-brown-600" />
            <div className="border-t border-tan-200 p-4">
              <p className="mb-3 text-xs text-brown-400">
                These Drive folders were scanned but had no photos anywhere inside them — nothing to import or match,
                not an error. They&apos;ll disappear from this list on their own once photos are added and synced.
              </p>
              <ul className="flex flex-wrap gap-2">
                {skippedFolders.map((name) => (
                  <li key={name} className="rounded-md bg-cream-100 px-2 py-1 text-xs text-brown-600">{name}</li>
                ))}
              </ul>
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
