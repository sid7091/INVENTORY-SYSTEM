"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addBlockPhotos } from "@/app/actions/photos";
import { useToast } from "@/components/ui/Toast";
import { t, type Lang } from "@/lib/i18n";

// One giant camera button. On phones `capture` opens the camera directly;
// the same control accepts gallery files everywhere else.
export function WorkerPhotoButton({ blockId, lang }: { blockId: string; lang: Lang }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    const fd = new FormData();
    for (const f of Array.from(files)) fd.append("photos", f);
    const res = await addBlockPhotos(blockId, fd);
    setBusy(false);
    if (res.ok) {
      toast(t(lang, "photoAdded"), "success");
      router.refresh();
    } else {
      toast(res.error, "error");
    }
  }

  return (
    <>
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="btn-primary flex h-20 w-full items-center justify-center gap-3 text-2xl font-bold"
      >
        <span className="text-3xl">📷</span>
        {busy ? "…" : t(lang, "addPhoto")}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        hidden
        onChange={(e) => onFiles(e.target.files)}
      />
    </>
  );
}
