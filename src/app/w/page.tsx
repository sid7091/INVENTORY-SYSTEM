import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getUserAccess } from "@/lib/permissions";
import { getLang } from "@/lib/i18nServer";
import { t } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { WorkerBlockCard } from "@/components/worker/WorkerBlockCard";

export const dynamic = "force-dynamic";

export default async function WorkerHome() {
  const user = await requireUser();
  const [access, lang] = await Promise.all([getUserAccess(user.userId), getLang()]);

  const needPhotos = await prisma.block.findMany({
    where: { deletedAt: null, status: "NEEDS_PHOTOS" },
    orderBy: { createdAt: "desc" },
    take: 6,
    include: { photos: { where: { isPrimary: true }, take: 1 } },
  });
  const needPhotosCount = await prisma.block.count({ where: { deletedAt: null, status: "NEEDS_PHOTOS" } });

  return (
    <div className="space-y-5">
      {/* Search — the primary task. Giant input, GET form (works without JS). */}
      <form action="/w/search" method="get">
        <div className="flex gap-2">
          <input
            name="q"
            inputMode="search"
            autoComplete="off"
            placeholder={`🔍  ${t(lang, "searchPlaceholder")}`}
            className="input h-16 flex-1 text-2xl font-semibold uppercase placeholder:normal-case placeholder:text-brown-300"
          />
          <button type="submit" className="btn-primary h-16 w-16 shrink-0 text-3xl" aria-label={t(lang, "search")}>
            🔍
          </button>
        </div>
      </form>

      {/* Big task tiles */}
      <div className="grid grid-cols-2 gap-3">
        {access.permissions.has("blocks.create") && (
          <Link href="/w/new" className="card flex flex-col items-center justify-center gap-2 py-8 active:scale-[0.99]">
            <span className="text-5xl">➕</span>
            <span className="text-base font-semibold text-brown-700">{t(lang, "newBlock")}</span>
          </Link>
        )}
        <div className="card flex flex-col items-center justify-center gap-2 py-8">
          <span className="text-5xl">📷</span>
          <span className="text-base font-semibold text-brown-700">
            {t(lang, "needPhotos")}
            {needPhotosCount > 0 && <span className="ml-2 rounded-full bg-amber-200 px-2.5 py-0.5 text-amber-900">{needPhotosCount}</span>}
          </span>
        </div>
      </div>

      {/* Blocks waiting for photos — tap one, camera is right there. */}
      {needPhotos.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {needPhotos.map((b) => (
            <WorkerBlockCard
              key={b.id}
              lang={lang}
              block={{ id: b.id, blockNo: b.blockNo, colour: b.colour, status: b.status, photoUrl: b.photos[0]?.url ?? null }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
