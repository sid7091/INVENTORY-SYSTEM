"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Dialog } from "@/features/ui/Dialog";
import { useToast } from "@/features/ui/Toast";
import { deleteSlabAction, setStatusAction } from "@/features/editor/actions";
import type { SlabDetail } from "@/lib/types";

export function RemoveDialog({ slab, canDelete, onClose }: { slab: SlabDetail; canDelete: boolean; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sold = slab.status === "sold";

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, done: string, goHome: boolean) {
    setBusy(true);
    setError(null);
    const res = await fn();
    setBusy(false);
    if (!res.ok) return setError(res.error ?? "Something went wrong.");
    toast(done);
    onClose();
    if (goHome) router.push("/");
    router.refresh();
  }

  return (
    <Dialog title={sold ? "Sold slab" : "Sold · Remove"} onClose={onClose}>
      {sold ? (
        <p>
          {slab.name} (Block {slab.block}) is marked as sold. It&apos;s hidden from the library and from PDFs.
        </p>
      ) : (
        <p>
          <strong>Mark as sold</strong> hides {slab.name} (Block {slab.block}) from the library and PDFs, but keeps it on
          record.
        </p>
      )}
      {canDelete && (
        <p className="warn">
          <strong>Remove listing:</strong> {slab.name} (Block {slab.block}) and its photos will be removed from the library
          for everyone. This can&apos;t be undone.
        </p>
      )}
      {error && <p className="notice error">{error}</p>}
      <div className="actions">
        <button className="btn" onClick={onClose} disabled={busy}>
          Keep it
        </button>
        {sold ? (
          <button
            className="btn"
            disabled={busy}
            onClick={() => run(() => setStatusAction(slab.id, "available"), "Back in the library", false)}
          >
            Mark as available
          </button>
        ) : (
          <button
            className="btn primary"
            disabled={busy}
            onClick={() => run(() => setStatusAction(slab.id, "sold"), "Marked as sold", true)}
          >
            Mark as sold
          </button>
        )}
        {canDelete && (
          <button className="btn danger" disabled={busy} onClick={() => run(() => deleteSlabAction(slab.id), "Listing removed", true)}>
            Remove listing
          </button>
        )}
      </div>
    </Dialog>
  );
}
