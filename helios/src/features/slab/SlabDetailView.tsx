"use client";

import Link from "next/link";
import { useState } from "react";
import { brand } from "@/config/brand";
import { imageUrl } from "@/lib/imageUrl";
import type { SlabDetail } from "@/lib/types";
import { useSelection } from "@/features/library/Selection";
import { slabCaption } from "@/features/share/caption";
import { copyText, downloadBlob, isIOS, shareFiles } from "@/features/share/share";
import { useToast } from "@/features/ui/Toast";
import { RemoveDialog } from "./RemoveDialog";
import { useBrandedFiles } from "./useBrandedFiles";

const NOT_READY = "Preparing the photos… try again in a moment.";

export function SlabDetailView({
  slab,
  canEdit,
  canDelete,
  isClient,
}: {
  slab: SlabDetail;
  canEdit: boolean;
  canDelete: boolean;
  isClient: boolean;
}) {
  const toast = useToast();
  const { isSelected, toggle, ids, setPdfOpen } = useSelection();
  const { files, all, ready, failed } = useBrandedFiles(slab);
  const [removing, setRemoving] = useState(false);
  const caption = slabCaption(slab);
  const sold = slab.status === "sold";
  const selected = isSelected(slab.id);
  const ios = typeof window !== "undefined" && isIOS();

  async function share(list: File[]) {
    if (!list.length) return toast(failed ? "Some photos couldn't be prepared. Reload the page." : NOT_READY);
    const out = await shareFiles(list, caption);
    if (out === "downloaded") toast("Saved to your downloads — send them from your gallery. Details copied.");
  }

  function save(list: File[]) {
    if (!list.length) return toast(NOT_READY);
    // On iPhone the share sheet's "Save Image" puts photos in the Photos app.
    if (ios) return share(list);
    list.forEach((f, i) => setTimeout(() => downloadBlob(f, f.name), i * 400));
    toast(list.length > 1 ? `Saving ${list.length} photos…` : "Photo saved");
  }

  const facts: [string, string | null][] = [
    ["Material", slab.material],
    ["Colour", slab.color],
    ["Size", slab.size],
    ["Quantity", slab.quantity],
    ["Block no.", slab.block],
  ];

  const enquire = brand.whatsappNumber
    ? `https://wa.me/${brand.whatsappNumber}?text=${encodeURIComponent(`Hello Helios, I'm interested in this slab:\n\n${caption}`)}`
    : null;

  return (
    <main className="page detail">
      <div className="detail-top">
        <Link href="/" className="btn small ghost">
          ← Library
        </Link>
        {canEdit && (
          <div style={{ display: "flex", gap: 8 }}>
            <Link className="btn small" href={`/slab/${slab.id}/edit`}>
              Edit
            </Link>
            <button className="btn small" onClick={() => setRemoving(true)}>
              Sold · Remove
            </button>
          </div>
        )}
      </div>

      <h1>
        {slab.name} {sold && <span className="badge sold">Sold</span>}
      </h1>
      <dl className="facts">
        {facts
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} style={{ display: "contents" }}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
      </dl>
      <button
        className="linkbtn"
        onClick={async () => toast((await copyText(caption)) ? "Details copied" : "Couldn't copy — long-press to select instead")}
      >
        Copy details
      </button>
      {isClient && enquire && (
        <a className="btn primary" href={enquire} target="_blank" rel="noreferrer" style={{ marginLeft: 12 }}>
          Enquire on WhatsApp
        </a>
      )}

      {slab.images.length === 0 && <p className="empty-state">No photos yet.</p>}
      <div className="photos">
        {slab.images.map((img, i) => {
          const f = files[img.id];
          return (
            <figure className="photo" key={img.id} style={{ margin: 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl(img.id)}
                alt={img.label || slab.name}
                width={img.width ?? undefined}
                height={img.height ?? undefined}
                loading={i < 2 ? "eager" : "lazy"}
              />
              <figcaption className="row">
                <span className="lbl">
                  <span className="badge">{img.label || (i === 0 ? "Slab" : `Photo ${i + 1}`)}</span>
                </span>
                <button className="btn small" onClick={() => save(f ? [f] : [])}>
                  ⤓ Save
                </button>
                <button className="btn small" onClick={() => share(f ? [f] : [])}>
                  ↗ Share
                </button>
              </figcaption>
            </figure>
          );
        })}
      </div>

      <div className="bottombar compact">
        {slab.images.length > 0 && (
          <>
            <button className="btn small on-navy" onClick={() => save(all)} disabled={!ready}>
              Save all
            </button>
            <button className="btn small on-navy" onClick={() => share(all)} disabled={!ready}>
              {ready ? "Share all" : "Preparing…"}
            </button>
          </>
        )}
        {!sold && (
          <button className={`btn small ${selected ? "on-navy" : "primary"}`} onClick={() => toggle(slab.id)}>
            {selected ? "✓ In PDF" : "Add to PDF"}
          </button>
        )}
        {ids.size > 0 && (
          <button className="btn small primary" onClick={() => setPdfOpen(true)}>
            PDF ({ids.size})
          </button>
        )}
      </div>

      {removing && <RemoveDialog slab={slab} canDelete={canDelete} onClose={() => setRemoving(false)} />}
    </main>
  );
}
