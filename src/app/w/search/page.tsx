import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getLang } from "@/lib/i18nServer";
import { t } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { WorkerBlockCard } from "@/components/worker/WorkerBlockCard";

export const dynamic = "force-dynamic";

export default async function WorkerSearch({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireUser();
  const lang = await getLang();
  const { q = "" } = await searchParams;
  // Block numbers and colours are stored uppercase; normalise the query so
  // "m543" finds ANW-M543 (contains is case-sensitive on both DB providers).
  const query = q.trim().toUpperCase();

  const blocks = query
    ? await prisma.block.findMany({
        where: {
          deletedAt: null,
          OR: [
            { blockNo: { contains: query } },
            { colour: { contains: query } },
          ],
        },
        orderBy: { blockNo: "asc" },
        take: 30,
        include: { photos: { where: { isPrimary: true }, take: 1 } },
      })
    : [];

  return (
    <div className="space-y-4">
      <form action="/w/search" method="get">
        <div className="flex gap-2">
          <Link href="/w" className="btn-secondary flex h-16 w-16 shrink-0 items-center justify-center text-2xl" aria-label={t(lang, "back")}>
            ←
          </Link>
          <input
            name="q"
            defaultValue={q}
            inputMode="search"
            autoComplete="off"
            autoFocus
            placeholder={`🔍  ${t(lang, "searchPlaceholder")}`}
            className="input h-16 flex-1 text-2xl font-semibold uppercase placeholder:normal-case placeholder:text-brown-300"
          />
          <button type="submit" className="btn-primary h-16 w-16 shrink-0 text-3xl" aria-label={t(lang, "search")}>
            🔍
          </button>
        </div>
      </form>

      {query && blocks.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 py-14 text-center">
          <span className="text-5xl opacity-40">🔍</span>
          <p className="text-lg font-medium text-brown-600">{t(lang, "noResults")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {blocks.map((b) => (
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
