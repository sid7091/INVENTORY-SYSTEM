"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  createPhotoBatch,
  updatePhotoItem,
  commitPhotoBatch,
  discardPhotoBatch,
} from "@/app/actions/photos";
import { useToast } from "@/components/ui/Toast";

export interface RoomItem {
  id: string;
  filename: string;
  tempUrl: string;
  guessBlockNo: string | null;
  matchedBlockNo: string | null;
  decision: string;
}

const DECISION_STYLE: Record<string, string> = {
  APPROVE: "border-emerald-400 bg-emerald-50",
  SKIP: "border-gray-300 bg-gray-50 opacity-60",
  REJECT: "border-red-300 bg-red-50 opacity-60",
  PENDING: "border-tan-300 bg-white",
};

function ItemCard({ item, onRefresh }: { item: RoomItem; onRefresh: () => void }) {
  const toast = useToast();
  const [reassign, setReassign] = useState(item.matchedBlockNo ?? item.guessBlockNo ?? "");
  const [busy, setBusy] = useState(false);

  async function decide(decision: "APPROVE" | "SKIP" | "REJECT" | "REASSIGN") {
    setBusy(true);
    const res = await updatePhotoItem(item.id, decision, decision === "REASSIGN" || decision === "APPROVE" ? reassign : undefined);
    if (!res.ok) toast(res.error, "error");
    else onRefresh();
    setBusy(false);
  }

  return (
    <div className={`rounded-lg border-2 p-2 ${DECISION_STYLE[item.decision] ?? DECISION_STYLE.PENDING}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.tempUrl} alt={item.filename} className="mb-2 aspect-[4/3] w-full rounded object-cover" />
      <div className="truncate text-xs font-medium text-brown-700" title={item.filename}>{item.filename}</div>
      <div className="mt-1 flex items-center gap-1 text-[11px]">
        {item.matchedBlockNo ? (
          <span className="badge bg-emerald-100 text-emerald-800">→ {item.matchedBlockNo}</span>
        ) : (
          <span className="badge bg-red-100 text-red-700">unmatched{item.guessBlockNo ? ` (guessed ${item.guessBlockNo})` : ""}</span>
        )}
      </div>

      <div className="mt-2 flex items-center gap-1">
        <input
          className="input px-2 py-1 text-xs"
          placeholder="Block no"
          value={reassign}
          onChange={(e) => setReassign(e.target.value.toUpperCase())}
        />
        <button className="btn-secondary px-2 py-1 text-[11px]" disabled={busy || !reassign} onClick={() => decide("REASSIGN")}>Set</button>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1">
        <button className="rounded bg-emerald-600 px-1 py-1 text-[11px] font-semibold text-white disabled:opacity-40"
          disabled={busy || !(item.matchedBlockNo || reassign)} onClick={() => decide("APPROVE")}>Approve</button>
        <button className="rounded bg-gray-400 px-1 py-1 text-[11px] font-semibold text-white disabled:opacity-40"
          disabled={busy} onClick={() => decide("SKIP")}>Skip</button>
        <button className="rounded bg-red-500 px-1 py-1 text-[11px] font-semibold text-white disabled:opacity-40"
          disabled={busy} onClick={() => decide("REJECT")}>Reject</button>
      </div>
    </div>
  );
}

export function PhotoRoom({ batchId, items }: { batchId: string | null; items: RoomItem[] }) {
  const router = useRouter();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    const fd = new FormData();
    Array.from(files).forEach((f) => { if (f.type.startsWith("image/")) fd.append("photos", f); });
    const res = await createPhotoBatch(fd);
    if (res.ok) { toast(`Staged ${files.length} file(s) for review.`, "success"); router.refresh(); }
    else toast(res.error, "error");
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function commit() {
    if (!batchId) return;
    setCommitting(true);
    const res = await commitPhotoBatch(batchId);
    if (res.ok) {
      toast(`Committed ${res.committed} photo(s); ${res.promoted} block(s) released from the photo gate.`, "success");
      router.refresh();
    } else toast(res.error, "error");
    setCommitting(false);
  }

  async function discard() {
    if (!batchId) return;
    const res = await discardPhotoBatch(batchId);
    if (res.ok) { toast("Batch discarded.", "info"); router.refresh(); }
    else toast(res.error, "error");
  }

  const matched = items.filter((i) => i.matchedBlockNo);
  const unmatched = items.filter((i) => !i.matchedBlockNo);
  const approvedCount = items.filter((i) => i.decision === "APPROVE" && i.matchedBlockNo).length;

  const refresh = () => router.refresh();

  return (
    <div className="space-y-6">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); upload(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed py-10 text-center transition-colors ${dragOver ? "border-brown-500 bg-cream-200" : "border-tan-300 bg-cream-50 hover:bg-cream-100"}`}
      >
        <div className="text-3xl text-tan-400">⬆</div>
        <p className="mt-2 text-sm font-medium text-brown-600">{uploading ? "Uploading…" : "Drop hundreds of photos here, or click to select"}</p>
        <p className="text-xs text-brown-400">Auto-matched by filename — slab numbers are ignored so many photos map to one block
          (ANW-M543, ANW-M543 1, ANW-M543_2 → ANW-M543). A missing prefix still resolves (M543-1, 543 2 → ANW-M543).</p>
        <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
      </div>

      {batchId && items.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-tan-200 bg-cream-50 px-4 py-3">
            <div className="text-sm text-brown-600">
              <span className="font-semibold">{items.length}</span> staged ·{" "}
              <span className="text-emerald-700">{matched.length} matched</span> ·{" "}
              <span className="text-red-600">{unmatched.length} unmatched</span> ·{" "}
              <span className="font-semibold text-brown-800">{approvedCount} approved</span>
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary text-sm" onClick={discard}>Discard batch</button>
              <button className="btn-primary text-sm" onClick={commit} disabled={committing || approvedCount === 0}>
                {committing ? "Committing…" : `Commit ${approvedCount} approved`}
              </button>
            </div>
          </div>

          {matched.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-brown-500">Matched ({matched.length})</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
                {matched.map((i) => <ItemCard key={i.id} item={i} onRefresh={refresh} />)}
              </div>
            </section>
          )}

          {unmatched.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-red-600">Unmatched tray ({unmatched.length}) — assign a block or skip</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
                {unmatched.map((i) => <ItemCard key={i.id} item={i} onRefresh={refresh} />)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
