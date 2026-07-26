import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getUserAccess } from "@/lib/permissions";
import { getLang } from "@/lib/i18nServer";
import { t } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { WorkerBlockForm } from "@/components/worker/WorkerBlockForm";

export const dynamic = "force-dynamic";

export default async function WorkerNewBlock() {
  const user = await requireUser();
  const [access, lang] = await Promise.all([getUserAccess(user.userId), getLang()]);
  if (!access.permissions.has("blocks.create")) redirect("/w");

  const colours = (
    await prisma.block.findMany({ where: { deletedAt: null }, select: { colour: true }, distinct: ["colour"], orderBy: { colour: "asc" } })
  ).map((c) => c.colour);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/w" className="btn-secondary flex h-12 w-12 shrink-0 items-center justify-center text-xl" aria-label={t(lang, "back")}>
          ←
        </Link>
        <h1 className="text-2xl font-bold text-brown-800">➕ {t(lang, "newBlock")}</h1>
      </div>
      <WorkerBlockForm lang={lang} colours={colours} />
    </div>
  );
}
