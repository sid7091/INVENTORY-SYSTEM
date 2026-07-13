"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { addBlockPhotos, deletePhoto } from "@/app/actions/photos";
import { useToast } from "@/components/ui/Toast";

export function PhotoUploader({
  blockId,
  photos,
  gated,
}: {
  blockId: string;
  photos: { id: string; url: string; filename: string; isPrimary: boolean }[];
  gated: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append("photos", f));
    const res = await addBlockPhotos(blockId, fd);
    if (res.ok) {
      toast(gated ? "Photo added — block released from the photo gate into In Stock." : "Photo added.", "success");
      router.refresh();
    } else {
      toast(res.error, "error");
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function remove(id: string) {
    const res = await deletePhoto(id);
    if (res.ok) { toast("Photo removed.", "success"); router.refresh(); }
    else toast(res.error, "error");
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-serif text-base font-bold text-brown-800">Photos ({photos.length})</h2>
        <button className="btn-secondary text-sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? "Uploading…" : "+ Add photos"}
        </button>
        <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
      </div>

      {gated && (
        <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          This block is in the <strong>photo gate</strong>. Adding the first photo will move it into live inventory automatically.
        </div>
      )}

      {photos.length === 0 ? (
        <div
          onClick={() => inputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-tan-300 bg-cream-50 py-10 text-center hover:bg-cream-100"
        >
          <div className="text-3xl text-tan-300">◧</div>
          <p className="mt-2 text-sm text-brown-500">No photos yet — click to add</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((p) => (
            <div key={p.id} className="group relative overflow-hidden rounded-lg border border-tan-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={p.filename} className="aspect-[4/3] w-full object-cover" />
              {p.isPrimary && <span className="badge absolute left-1.5 top-1.5 bg-brown-700 text-cream-50">Primary</span>}
              <button
                onClick={() => remove(p.id)}
                className="absolute right-1.5 top-1.5 rounded bg-black/50 px-2 py-0.5 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
