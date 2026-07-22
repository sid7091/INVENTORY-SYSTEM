"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { resolveActionItem, dismissActionItem } from "@/app/actions/actionItems";
import { useToast } from "@/components/ui/Toast";
import { driveThumbnailUrl } from "@/lib/driveThumb";

type Image = { fileId: string; name: string };

export function ActionItemCard({
  id,
  message,
  driveFolderName,
  images,
}: {
  id: string;
  message: string;
  driveFolderName: string | null;
  images: Image[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [blockNo, setBlockNo] = useState("");
  const [busy, setBusy] = useState(false);

  async function assign() {
    if (!blockNo.trim()) return;
    setBusy(true);
    const res = await resolveActionItem(id, blockNo);
    setBusy(false);
    if (res.ok) {
      toast(`Assigned to ${blockNo.toUpperCase()} — photos imported.`, "success");
      router.refresh();
    } else {
      toast(res.error, "error");
    }
  }

  async function dismiss() {
    setBusy(true);
    const res = await dismissActionItem(id);
    setBusy(false);
    if (res.ok) {
      toast("Dismissed.", "success");
      router.refresh();
    } else {
      toast(res.error, "error");
    }
  }

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          {driveFolderName && <div className="font-mono text-xs text-brown-400">Drive folder: {driveFolderName}</div>}
          <p className="mt-0.5 text-sm text-brown-700">{message}</p>
        </div>
      </div>

      {images.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {images.map((img) => (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              key={img.fileId}
              src={driveThumbnailUrl(img.fileId)}
              alt={img.name}
              title={img.name}
              className="h-20 w-20 rounded-md border border-tan-200 object-cover"
              loading="lazy"
            />
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          className="input w-40 text-sm"
          placeholder="Block number"
          value={blockNo}
          onChange={(e) => setBlockNo(e.target.value)}
          disabled={busy}
        />
        <button className="btn-primary text-sm" onClick={assign} disabled={busy || !blockNo.trim()}>
          Assign
        </button>
        <button className="btn-ghost text-sm" onClick={dismiss} disabled={busy}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
