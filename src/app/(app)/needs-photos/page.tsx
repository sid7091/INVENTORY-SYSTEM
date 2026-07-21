import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { formatThickness } from "@/lib/constants";
import { formatSft } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function NeedsPhotosPage() {
  const blocks = await prisma.block.findMany({
    where: { deletedAt: null, status: "NEEDS_PHOTOS" },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div>
      <PageHeader
        title="Needs Photos"
        subtitle={`${blocks.length} block${blocks.length === 1 ? "" : "s"} waiting for photos · hidden from main inventory until released`}
        actions={<Link href="/photo-room" className="btn-primary text-sm">Open Photo Room →</Link>}
      />
      <div className="p-4 sm:p-6">
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
      </div>
    </div>
  );
}
