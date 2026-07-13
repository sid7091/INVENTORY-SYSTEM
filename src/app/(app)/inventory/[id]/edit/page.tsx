import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { BlockForm } from "@/components/BlockForm";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function EditBlockPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const block = await prisma.block.findUnique({ where: { id } });
  if (!block || block.deletedAt) notFound();

  return (
    <div>
      <PageHeader title={`Edit ${block.blockNo}`} subtitle={`Version ${block.version} · concurrency-protected`} />
      <div className="mx-auto max-w-4xl p-6">
        <BlockForm
          initial={{
            id: block.id, version: block.version, blockNo: block.blockNo, quarryNo: block.quarryNo,
            colour: block.colour, exporter: block.exporter, quarry: block.quarry, warehouse: block.warehouse,
            weightTons: block.weightTons, lengthCm: block.lengthCm, heightCm: block.heightCm,
            pcs: block.pcs, endPcs: block.endPcs, totalSft: block.totalSft,
            thicknessMm: block.thicknessMm, category: block.category,
          }}
        />
      </div>
    </div>
  );
}
