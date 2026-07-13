import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { StatusChangeModal } from "@/components/StatusChangeModal";
import { DeleteBlockButton } from "@/components/DeleteBlockButton";
import { PhotoUploader } from "@/components/PhotoUploader";
import { HistoryTimeline } from "@/components/HistoryTimeline";
import { formatNumber, formatSft } from "@/lib/utils";
import { formatThickness, CATEGORY_LABELS, type Category } from "@/lib/constants";

export const dynamic = "force-dynamic";

function Spec({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-brown-400">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-brown-800">{value}</dd>
    </div>
  );
}

export default async function BlockDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const block = await prisma.block.findUnique({
    where: { id },
    include: {
      photos: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      slabs: { orderBy: { slabNo: "asc" } },
      auditLogs: { orderBy: { createdAt: "desc" }, include: { user: { select: { name: true } } } },
    },
  });
  if (!block || block.deletedAt) notFound();

  const gated = block.status === "NEEDS_PHOTOS";

  return (
    <div>
      <PageHeader
        title={block.blockNo}
        subtitle={`${block.colour} · v${block.version}`}
        actions={
          <>
            <StatusChangeModal blockId={block.id} version={block.version} current={block.status} />
            <Link href={`/inventory/${block.id}/edit`} className="btn-secondary text-sm">Edit</Link>
            <DeleteBlockButton blockId={block.id} blockNo={block.blockNo} />
          </>
        }
      />

      <div className="grid gap-6 p-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-serif text-base font-bold text-brown-800">Specifications</h2>
              <StatusBadge status={block.status} />
            </div>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              <Spec label="Block No" value={<span className="font-mono">{block.blockNo}</span>} />
              <Spec label="Quarry No" value={block.quarryNo ?? "—"} />
              <Spec label="Colour" value={block.colour} />
              <Spec label="Exporter" value={block.exporter ?? "—"} />
              <Spec label="Quarry" value={block.quarry ?? "—"} />
              <Spec label="Warehouse" value={block.warehouse ?? "—"} />
              <Spec label="Category" value={CATEGORY_LABELS[block.category as Category] ?? block.category} />
              <Spec label="Weight" value={block.weightTons != null ? `${formatNumber(block.weightTons)} t` : "—"} />
              <Spec label="Length" value={block.lengthCm != null ? `${formatNumber(block.lengthCm)} cm` : "—"} />
              <Spec label="Height" value={block.heightCm != null ? `${formatNumber(block.heightCm)} cm` : "—"} />
              <Spec label="Thickness" value={formatThickness(block.thicknessMm)} />
              <Spec label="PCS" value={block.pcs ?? "—"} />
              <Spec label="End PCS" value={block.endPcs ?? "—"} />
              <Spec label="Total SFT" value={formatSft(block.totalSft)} />
            </dl>
          </section>

          <section className="card p-5">
            <PhotoUploader blockId={block.id} photos={block.photos} gated={gated} />
          </section>

          {block.slabs.length > 0 && (
            <section className="card p-5">
              <h2 className="mb-3 font-serif text-base font-bold text-brown-800">Slabs ({block.slabs.length})</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-cream-200">
                  <thead className="bg-cream-100"><tr>
                    <th className="th">Slab</th><th className="th">L×H</th><th className="th">Thk</th><th className="th">SFT</th><th className="th">Status</th>
                  </tr></thead>
                  <tbody className="divide-y divide-cream-100">
                    {block.slabs.map((s) => (
                      <tr key={s.id}>
                        <td className="td font-mono">{s.slabNo}</td>
                        <td className="td">{s.lengthCm ?? "—"}×{s.heightCm ?? "—"}</td>
                        <td className="td">{formatThickness(s.thicknessMm)}</td>
                        <td className="td">{formatSft(s.sft)}</td>
                        <td className="td"><StatusBadge status={s.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>

        <div className="lg:col-span-1">
          <section className="card p-5">
            <h2 className="mb-4 font-serif text-base font-bold text-brown-800">History</h2>
            <HistoryTimeline logs={block.auditLogs} />
          </section>
        </div>
      </div>
    </div>
  );
}
