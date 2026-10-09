"use client";

import { preparePhoto, type PreparedPhoto } from "@/lib/images";

export interface EditorPhoto {
  key: string;
  id?: string; // set once uploaded (or for photos the slab already has)
  prepared?: PreparedPhoto;
  preview: string;
  label: string;
}

const LABELS = ["Slab", "Kitchen", "Bathroom", "Bar", "Living room", "Lobby", "Exterior", "Bookmatch", "Close-up"];

let n = 0;
const newKey = () => `p${Date.now()}-${n++}`;

export function PhotoList({
  photos,
  onChange,
  onError,
  busy,
}: {
  photos: EditorPhoto[];
  onChange: (next: EditorPhoto[] | ((prev: EditorPhoto[]) => EditorPhoto[])) => void;
  onError: (msg: string) => void;
  busy: boolean;
}) {
  async function addFiles(list: FileList | null) {
    if (!list) return;
    for (const file of Array.from(list)) {
      try {
        const prepared = await preparePhoto(file);
        const photo: EditorPhoto = { key: newKey(), prepared, preview: URL.createObjectURL(prepared.thumb), label: "" };
        onChange((prev) => [...prev, { ...photo, label: prev.length === 0 ? "Slab" : "" }]);
      } catch (e) {
        onError(e instanceof Error ? e.message : "This photo couldn't be read.");
      }
    }
  }

  const update = (key: string, patch: Partial<EditorPhoto>) =>
    onChange((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  const makeCover = (key: string) =>
    onChange((prev) => [...prev.filter((p) => p.key === key), ...prev.filter((p) => p.key !== key)]);
  const remove = (key: string) => onChange((prev) => prev.filter((p) => p.key !== key));

  return (
    <div>
      <div className="dropzone">
        <div>
          <strong>Add photos</strong>
          <br />
          Tap to choose from your gallery or camera. The first photo is the cover — use the plain slab photo.
        </div>
        <input
          type="file"
          accept="image/*"
          multiple
          disabled={busy}
          aria-label="Add photos"
          onChange={(e) => {
            void addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      <datalist id="photo-labels">
        {LABELS.map((l) => (
          <option key={l} value={l} />
        ))}
      </datalist>
      <div className="thumbs">
        {photos.map((p, i) => (
          <div className="thumb" key={p.key}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.preview} alt="" />
            <div>
              {i === 0 && <div className="cover-tag">COVER</div>}
              <input
                className="input"
                style={{ minHeight: 40 }}
                list="photo-labels"
                placeholder={i === 0 ? "Slab" : "Label, e.g. Kitchen"}
                value={p.label}
                onChange={(e) => update(p.key, { label: e.target.value })}
                aria-label={`Label for photo ${i + 1}`}
              />
              <div className="tools">
                {i > 0 && (
                  <button type="button" className="btn small" onClick={() => makeCover(p.key)} disabled={busy}>
                    ↑ Make cover
                  </button>
                )}
                <button type="button" className="btn small" onClick={() => remove(p.key)} disabled={busy}>
                  ✕ Remove
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
