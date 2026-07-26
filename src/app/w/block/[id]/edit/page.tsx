import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getUserAccess } from "@/lib/permissions";
import { getLang } from "@/lib/i18nServer";
import { t } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { WorkerBlockForm } from "@/components/worker/WorkerBlockForm";

export const dynamic = "force-dynamic";

export default async function WorkerEditBlock({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const [access, lang, block] = await Promise.all([
    getUserAccess(user.userId),
    getLang(),
    prisma.block.findUnique({ where: { id } }),
  ]);
  if (!access.permissions.has("blocks.edit")) redirect("/w");
  if (!block || block.deletedAt) notFound();

  const colours = (
    await prisma.block.findMany({ where: { deletedAt: null }, select: { colour: true }, distinct: ["colour"], orderBy: { colour: "asc" } })
  ).map((c) => c.colour);

  const s = (v: number | null) => (v == null ? "" : String(v));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href={`/w/block/${block.id}`} className="btn-secondary flex h-12 w-12 shrink-0 items-center justify-center text-xl" aria-label={t(lang, "back")}>
          ←
        </Link>
        <h1 className="font-mono text-2xl font-bold text-brown-800">✏️ {block.blockNo}</h1>
      </div>
      <WorkerBlockForm
        lang={lang}
        colours={colours}
        initial={{
          id: block.id,
          version: block.version,
          blockNo: block.blockNo,
          colour: block.colour,
          weightTons: s(block.weightTons),
          lengthCm: s(block.lengthCm),
          heightCm: s(block.heightCm),
          thicknessMm: s(block.thicknessMm),
          pcs: s(block.pcs),
          totalSft: s(block.totalSft),
        }}
      />
    </div>
  );
}
