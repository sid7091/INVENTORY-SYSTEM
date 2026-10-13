"use client";

import Link from "next/link";
import { imageUrl } from "@/lib/imageUrl";
import type { SlabSummary } from "@/lib/types";
import { useSelection } from "./Selection";

export function SlabCard({ slab }: { slab: SlabSummary }) {
  const { isSelected, toggle } = useSelection();
  const selected = isSelected(slab.id);
  const sold = slab.status === "sold";
  return (
    <article className={`slab-card${selected ? " selected" : ""}`}>
      <Link href={`/slab/${slab.id}`}>
        {slab.coverId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="ph" src={imageUrl(slab.coverId, "thumb")} alt="" loading="lazy" decoding="async" />
        ) : (
          <div className="ph empty">No photo yet</div>
        )}
        <div className="meta">
          <div className="nm">{slab.name}</div>
          <div className="sub">{[slab.material, `Block ${slab.block}`].filter(Boolean).join(" · ")}</div>
        </div>
      </Link>
      {sold && <span className="sold-tag">Sold</span>}
      {!sold && (
        <button
          className="tick"
          aria-pressed={selected}
          aria-label={selected ? `Remove ${slab.name} from PDF` : `Add ${slab.name} to PDF`}
          onClick={() => toggle(slab.id)}
        >
          <span>{selected ? "✓" : ""}</span>
        </button>
      )}
    </article>
  );
}
