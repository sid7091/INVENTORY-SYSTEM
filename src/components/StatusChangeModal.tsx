"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { changeStatus } from "@/app/actions/blocks";
import { ASSIGNABLE_STATUSES, STATUS_LABELS, type Status } from "@/lib/constants";
import { useToast } from "@/components/ui/Toast";

export function StatusChangeModal({
  blockId,
  version,
  current,
  pcs,
  availableLabel,
}: {
  blockId: string;
  version: number;
  current: string;
  pcs: number | null;
  availableLabel: string; // e.g. "1–19, 31–46"
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>(ASSIGNABLE_STATUSES.find((s) => s !== current) ?? "IN_STOCK");
  const [reason, setReason] = useState("");
  const [pieces, setPieces] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const gated = current === "NEEDS_PHOTOS";
  const hasPieces = (pcs ?? 0) > 0;
  const wantsPieces = status === "PARTIALLY_SOLD" || (status === "HOLD" && hasPieces);
  const piecesRequired = status === "PARTIALLY_SOLD";

  async function submit() {
    setSaving(true);
    setError(null);
    const res = await changeStatus(blockId, version, { status, reason, pieces: wantsPieces ? pieces : undefined });
    if (res.ok) {
      toast(`Status changed to ${STATUS_LABELS[status]}.`, "success");
      setOpen(false);
      setReason("");
      setPieces("");
      router.refresh();
    } else {
      setError(res.error);
      setSaving(false);
    }
  }

  return (
    <>
      <button className="btn-primary text-sm" onClick={() => setOpen(true)} disabled={gated}
        title={gated ? "Add a photo first to release this block from the photo gate" : undefined}>
        Change status
      </button>
      {gated && <p className="mt-1 text-xs text-status-needsphotos">Add a photo to release from the photo gate before changing status.</p>}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brown-900/40 p-4" onClick={() => !saving && setOpen(false)}>
          <div className="w-full max-w-md card p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-serif text-lg font-bold text-brown-800">Change status</h2>
            <p className="mt-1 text-sm text-brown-500">Currently <span className="font-semibold">{STATUS_LABELS[current as Status] ?? current}</span>. A reason is mandatory and recorded in the audit log.</p>

            <div className="mt-4 space-y-4">
              <div>
                <label className="label">New status</label>
                <select className="input" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
                  {ASSIGNABLE_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
              </div>

              {wantsPieces && (
                <div>
                  <label className="label">
                    Slab pieces {piecesRequired ? "sold" : "to hold"} {piecesRequired && <span className="text-status-damaged">*</span>}
                  </label>
                  <input className="input" value={pieces} onChange={(e) => setPieces(e.target.value)}
                    placeholder="e.g. 20-30 or 1-5, 31-40" />
                  <p className="mt-1 text-xs text-brown-400">
                    {hasPieces ? <>Total pieces 1–{pcs}. Currently available: <span className="font-medium">{availableLabel}</span>.</> : "This block has no slab count set."}
                    {status === "HOLD" && " Leave blank to hold the whole remaining block."}
                  </p>
                </div>
              )}

              {status === "SOLD" && hasPieces && (
                <p className="rounded-md bg-purple-50 px-3 py-2 text-xs text-purple-800">Marks all {pcs} pieces as sold.</p>
              )}
              {(status === "IN_STOCK" || status === "READY_TO_DISPATCH") && (
                <p className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Frees any sold/hold pieces — the whole block becomes available again.</p>
              )}

              <div>
                <label className="label">Reason <span className="text-status-damaged">*</span></label>
                <textarea className="input min-h-[70px]" value={reason} onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Sold pieces 20–30 to GALATA, order #1043" />
              </div>
              {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setOpen(false)} disabled={saving}>Cancel</button>
              <button className="btn-primary" onClick={submit}
                disabled={saving || reason.trim().length < 3 || (piecesRequired && !pieces.trim())}>
                {saving ? "Saving…" : "Confirm change"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
