"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { softDeleteBlock } from "@/app/actions/blocks";
import { useToast } from "@/components/ui/Toast";

export function DeleteBlockButton({ blockId, blockNo }: { blockId: string; blockNo: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    const res = await softDeleteBlock(blockId, reason);
    if (res.ok) {
      toast(`${blockNo} moved to trash (recoverable for 30 days).`, "success");
      router.push("/inventory");
      router.refresh();
    } else {
      toast(res.error, "error");
      setSaving(false);
    }
  }

  return (
    <>
      <button className="btn-ghost text-sm text-status-damaged" onClick={() => setOpen(true)}>Delete</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brown-900/40 p-4" onClick={() => !saving && setOpen(false)}>
          <div className="w-full max-w-md card p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-serif text-lg font-bold text-brown-800">Delete {blockNo}?</h2>
            <p className="mt-1 text-sm text-brown-500">Soft delete — the block moves to Trash and can be restored within 30 days. A reason is required.</p>
            <textarea className="input mt-4 min-h-[70px]" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for deletion" />
            <div className="mt-6 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setOpen(false)} disabled={saving}>Cancel</button>
              <button className="btn-danger" onClick={submit} disabled={saving || reason.trim().length < 3}>
                {saving ? "Deleting…" : "Move to trash"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
