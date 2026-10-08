"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { blockKeysOf } from "@/lib/blockKeys";
import { imageUrl } from "@/lib/imageUrl";
import type { SlabDetail, SlabFields } from "@/lib/types";
import { checkBlockAction, discardUploadsAction, saveSlabAction } from "./actions";
import { PhotoList, type EditorPhoto } from "./PhotoList";

type Conflict = { id: string; name: string; block: string } | null;

async function upload(p: EditorPhoto): Promise<string> {
  const body = new FormData();
  body.append("full", p.prepared!.full, "full.jpg");
  body.append("thumb", p.prepared!.thumb, "thumb.jpg");
  body.append("width", String(p.prepared!.width));
  body.append("height", String(p.prepared!.height));
  const res = await fetch("/api/upload", { method: "POST", body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.id) throw new Error(json.error || "A photo didn't upload. Check your connection and try again.");
  return json.id;
}

export function SlabEditor({ slab, materials }: { slab?: SlabDetail; materials: string[] }) {
  const router = useRouter();
  const [f, setF] = useState<SlabFields>({
    name: slab?.name ?? "",
    material: slab?.material ?? "",
    color: slab?.color ?? "",
    size: slab?.size ?? "",
    quantity: slab?.quantity ?? "",
    block: slab?.block ?? "",
  });
  const [photos, setPhotos] = useState<EditorPhoto[]>(
    () =>
      slab?.images.map((img) => ({ key: img.id, id: img.id, preview: imageUrl(img.id, "thumb"), label: img.label ?? "" })) ??
      [],
  );
  const [conflict, setConflict] = useState<Conflict>(null);
  const [checking, setChecking] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Live duplicate warning as the block no. is typed.
  useEffect(() => {
    if (!blockKeysOf(f.block).length) return setConflict(null);
    setChecking(true);
    const t = setTimeout(async () => {
      try {
        setConflict(await checkBlockAction(f.block, slab?.id));
      } finally {
        setChecking(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [f.block, slab?.id]);

  const set = (k: keyof SlabFields) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const missing = [!f.name.trim() && "name", !f.size.trim() && "size", !f.block.trim() && "block no."].filter(Boolean);
  const busy = progress !== null;
  const canSave = !missing.length && !conflict && !checking && !busy;

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setError(null);
    const fresh = photos.filter((p) => !p.id);
    const uploaded: string[] = [];
    try {
      const ids = new Map<string, string>();
      for (const [i, p] of fresh.entries()) {
        setProgress(`Uploading image ${i + 1} of ${fresh.length}…`);
        const id = await upload(p);
        uploaded.push(id);
        ids.set(p.key, id);
      }
      setProgress("Saving…");
      const res = await saveSlabAction({
        ...f,
        id: slab?.id,
        images: photos.map((p) => ({ id: p.id ?? ids.get(p.key)!, label: p.label })),
      });
      if (!res.ok) throw new Error(res.error);
      router.push(`/slab/${res.data.id}`);
      router.refresh();
    } catch (err) {
      if (uploaded.length) void discardUploadsAction(uploaded);
      setError(err instanceof Error ? err.message : "Couldn't save. Please try again.");
      setProgress(null);
    }
  }

  return (
    <main className="page narrow">
      <div className="detail-top">
        <Link href={slab ? `/slab/${slab.id}` : "/"} className="btn small ghost">
          ← Cancel
        </Link>
      </div>
      <h1 style={{ fontSize: 28, margin: "12px 0 16px" }}>{slab ? `Edit ${slab.name}` : "Add slab"}</h1>
      <form onSubmit={onSave}>
        <div className="field">
          <label htmlFor="name">Name *</label>
          <input className="input" id="name" value={f.name} onChange={set("name")} autoCapitalize="words" required />
        </div>
        <div className="field">
          <label htmlFor="material">Material</label>
          <input className="input" id="material" list="materials" value={f.material ?? ""} onChange={set("material")} placeholder="e.g. Quartzite" />
          <datalist id="materials">
            {materials.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>
        <div className="field">
          <label htmlFor="size">Size *</label>
          <input className="input" id="size" value={f.size} onChange={set("size")} placeholder="e.g. 119 x 74" required />
        </div>
        <div className="field">
          <label htmlFor="color">Colour</label>
          <input className="input" id="color" value={f.color ?? ""} onChange={set("color")} placeholder="e.g. Gold, blue, rust" />
        </div>
        <div className="field">
          <label htmlFor="quantity">Quantity</label>
          <input className="input" id="quantity" value={f.quantity ?? ""} onChange={set("quantity")} placeholder="e.g. 6 slabs" />
        </div>
        <div className="field">
          <label htmlFor="block">Block no. *</label>
          <input className="input" id="block" value={f.block} onChange={set("block")} placeholder="e.g. 29596 / HCS 593" autoCapitalize="characters" required />
          {conflict ? (
            <span className="warn" role="alert">
              Already in the library:{" "}
              <Link href={`/slab/${conflict.id}`}>
                {conflict.name} (Block {conflict.block})
              </Link>
              .
            </span>
          ) : (
            <span className="hint">Several numbers? Separate them with “/”. Each one is checked for duplicates.</span>
          )}
        </div>

        <h2 style={{ fontSize: 20, margin: "22px 0 10px" }}>Photos</h2>
        <PhotoList photos={photos} onChange={setPhotos} onError={setError} busy={busy} />

        {error && (
          <p className="notice error" role="alert" style={{ marginTop: 16 }}>
            {error}
          </p>
        )}
        <div style={{ marginTop: 20, display: "grid", gap: 8 }}>
          <button className="btn primary block" disabled={!canSave}>
            {progress ?? (slab ? "Save changes" : "Add to library")}
          </button>
          {missing.length > 0 && <span className="hint" style={{ textAlign: "center" }}>Still needed: {missing.join(", ")}</span>}
        </div>
      </form>
    </main>
  );
}
