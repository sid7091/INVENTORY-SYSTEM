import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { formatThickness } from "@/lib/constants";
import { formatSft } from "@/lib/utils";
import { ActionItemCard } from "@/components/ActionItemCard";

export const dynamic = "force-dynamic";

export default async function NeedsActionsPage() {
  const [blocks, actionItems] = await Promise.all([
    prisma.block.findMany({
      where: { deletedAt: null, status: "NEEDS_PHOTOS" },
      orderBy: { createdAt: "asc" },
    }),
    prisma.actionItem.findMany({
      where: { status: "OPEN" },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const total = blocks.length + actionItems.length;

  return (
    <div>
      <PageHeader
        title="Needs Actions"
        subtitle={`${total} item${total === 1 ? "" : "s"} waiting on staff · photo backlog + Google Drive sync questions`}
        actions={<Link href="/photo-room" className="btn-primary text-sm">Open Photo Room →</Link>}
      />
      <div className="space-y-8 p-4 sm:p-6">
        {actionItems.length > 0 && (
          <section>
            <h2 className="mb-3 font-serif text-base font-bold text-brown-800">
              Drive sync questions ({actionItems.length})
            </h2>
            <div className="space-y-3">
              {actionItems.map((item) => (
                <ActionItemCard
                  key={item.id}
                  id={item.id}
                  message={item.message}
                  driveFolderName={item.driveFolderName}
                  images={item.images ? JSON.parse(item.images) : []}
                />
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-3 font-serif text-base font-bold text-brown-800">
            Photo backlog ({blocks.length})
          </h2>
          {blocks.length === 0 ? (
            <div className="card flex flex-col items-center justify-center py-16 text-center">
              <div className="text-4xl">✓</div>
              <p className="mt-3 text-sm font-medium text-brown-600">The queue is clear — every block has photos.</p>
            </div>
          ) : (
            <div className="card overflow-x-auto">
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
        </section>
      </div>
    </div>
  );
}
