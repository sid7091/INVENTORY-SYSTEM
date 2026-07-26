import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getUserAccess } from "@/lib/permissions";
import { getLang } from "@/lib/i18nServer";
import { t, statusLabel, STATUS_VISUALS } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { WorkerPhotoButton } from "@/components/worker/WorkerPhotoButton";
import { WorkerStatusPanel } from "@/components/worker/WorkerStatusPanel";

export const dynamic = "force-dynamic";

export default async function WorkerBlockPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const [access, lang, block] = await Promise.all([
    getUserAccess(user.userId),
    getLang(),
    prisma.block.findUnique({
      where: { id },
      include: { photos: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] } },
    }),
  ]);
  if (!block || block.deletedAt) notFound();

  const visual = STATUS_VISUALS[block.status] ?? STATUS_VISUALS.IN_STOCK;

  const facts: { icon: string; label: string; value: string | null }[] = [
    { icon: "🎨", label: t(lang, "colour"), value: block.colour },
    { icon: "⚖️", label: t(lang, "weightTons"), value: block.weightTons != null ? String(block.weightTons) : null },
    { icon: "📏", label: t(lang, "lengthCm"), value: block.lengthCm != null ? String(block.lengthCm) : null },
    { icon: "↕️", label: t(lang, "heightCm"), value: block.heightCm != null ? String(block.heightCm) : null },
    { icon: "🧱", label: t(lang, "thicknessMm"), value: block.thicknessMm != null ? String(block.thicknessMm) : null },
    { icon: "🔢", label: t(lang, "slabs"), value: block.pcs != null ? String(block.pcs) : null },
    { icon: "📐", label: t(lang, "totalSft"), value: block.totalSft != null ? String(block.totalSft) : null },
  ];

  return (
    <div className="space-y-4">
      {/* Header: back, number, status */}
      <div className="flex items-center gap-3">
        <Link href="/w" className="btn-secondary flex h-12 w-12 shrink-0 items-center justify-center text-xl" aria-label={t(lang, "back")}>
          ←
        </Link>
        <h1 className="min-w-0 flex-1 truncate font-mono text-2xl font-bold text-brown-800">{block.blockNo}</h1>
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-bold ${visual.className}`}>
          <span className="text-lg">{visual.icon}</span>
          {statusLabel(lang, block.status)}
        </span>
      </div>

      {/* Photos */}
      {block.photos.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {block.photos.map((p) => (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img key={p.id} src={p.url} alt={block.blockNo} className="h-40 w-full rounded-lg border border-tan-200 object-cover" />
          ))}
        </div>
      ) : (
        <div className="card flex flex-col items-center gap-2 py-10 text-center">
          <span className="text-6xl opacity-40">📷</span>
          <p className="text-lg font-medium text-brown-600">{t(lang, "needPhotos")}</p>
        </div>
      )}

      {access.permissions.has("photos.add") && <WorkerPhotoButton blockId={block.id} lang={lang} />}

      {/* Details */}
      <div className="card divide-y divide-cream-100">
        {facts.filter((f) => f.value != null).map((f) => (
          <div key={f.label} className="flex items-center gap-3 px-4 py-3">
            <span className="text-2xl">{f.icon}</span>
            <span className="flex-1 text-sm text-brown-500">{f.label}</span>
            <span className="text-xl font-bold text-brown-800">{f.value}</span>
          </div>
        ))}
        {access.permissions.has("blocks.edit") && (
          <div className="px-4 py-3">
            <Link href={`/w/block/${block.id}/edit`} className="btn-secondary flex h-12 items-center justify-center gap-2 text-base font-semibold">
              ✏️ {t(lang, "edit")}
            </Link>
          </div>
        )}
      </div>

      {/* Status change — only meaningful once the block has photos (the photo
          gate would reject it anyway); hiding it avoids a dead-end error. */}
      {access.permissions.has("blocks.status") && block.photos.length > 0 && (
        <WorkerStatusPanel blockId={block.id} version={block.version} currentStatus={block.status} lang={lang} />
      )}
    </div>
  );
}
