import Link from "next/link";
import { STATUS_VISUALS, statusLabel, type Lang } from "@/lib/i18n";

export interface WorkerBlockCardData {
  id: string;
  blockNo: string;
  colour: string;
  status: string;
  photoUrl: string | null;
}

// Photo-first card: the picture and the block number are the identity; the
// status is an icon + colour chip. One tap anywhere opens the block.
export function WorkerBlockCard({ block, lang }: { block: WorkerBlockCardData; lang: Lang }) {
  const visual = STATUS_VISUALS[block.status] ?? STATUS_VISUALS.IN_STOCK;
  return (
    <Link href={`/w/block/${block.id}`} className="card block overflow-hidden active:scale-[0.99]">
      <div className="flex h-36 items-center justify-center bg-cream-200">
        {block.photoUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={block.photoUrl} alt={block.blockNo} className="h-full w-full object-cover" />
        ) : (
          <span className="text-5xl opacity-40">📷</span>
        )}
      </div>
      <div className="p-3">
        <div className="font-mono text-lg font-bold text-brown-800">{block.blockNo}</div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="truncate text-sm text-brown-500">{block.colour}</span>
          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${visual.className}`}>
            <span>{visual.icon}</span>
            {statusLabel(lang, block.status)}
          </span>
        </div>
      </div>
    </Link>
  );
}
