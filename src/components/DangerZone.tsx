"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { clearAllData, type DataCounts } from "@/app/actions/admin";
import { CLEAR_DATA_CONFIRM_PHRASE } from "@/lib/constants";
import { useToast } from "@/components/ui/Toast";

function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

export function DangerZone({ counts }: { counts: DataCounts }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [done, setDone] = useState(false);

  const isEmpty = counts.blocks === 0 && counts.photos === 0 && counts.auditLogs === 0;
  const matches = confirmText.trim() === CLEAR_DATA_CONFIRM_PHRASE;

  async function submit() {
    setClearing(true);
    setError(null);
    const res = await clearAllData(confirmText);
    if (res.ok) {
      setDone(true);
      setOpen(false);
      toast("All data cleared. Starting fresh.", "success");
      router.refresh();
    } else {
      setError(res.error);
      setClearing(false);
    }
  }

  return (
    <section className="card border-status-damaged/30 p-5">
      <h2 className="mb-1 font-serif text-base font-bold text-status-damaged">Danger Zone</h2>
      <p className="mb-4 text-sm text-brown-500">
        Permanently deletes every block, photo, and audit log entry so the app starts completely
        empty — for wiping out test data before going live. Your staff logins are kept.
      </p>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Blocks", value: counts.blocks },
          { label: "Photos", value: counts.photos },
          { label: "Photo batches", value: counts.photoBatches },
          { label: "Audit entries", value: counts.auditLogs },
        ].map((s) => (
          <div key={s.label} className="rounded-md bg-cream-100 p-3 text-center">
            <div className="text-lg font-bold text-brown-800">{s.value}</div>
            <div className="text-xs text-brown-500">{s.label}</div>
          </div>
        ))}
      </div>

      {done || isEmpty ? (
        <p className="text-sm text-brown-400">There is no data to clear right now.</p>
      ) : (
        <button className="btn-danger" onClick={() => setOpen(true)}>Clear all data</button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brown-900/40 p-4" onClick={() => !clearing && setOpen(false)}>
          <div className="w-full max-w-md card border-status-damaged/40 p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-serif text-lg font-bold text-status-damaged">Clear all data?</h2>
            <p className="mt-2 text-sm text-brown-600">
              This will permanently delete <strong>{plural(counts.blocks, "block")}</strong>, <strong>{plural(counts.photos, "photo")}</strong>,
              and <strong>{plural(counts.auditLogs, "audit log entry", "audit log entries")}</strong>. This cannot be undone — it is not
              recoverable from Trash. Staff accounts are not affected.
            </p>
            <div className="mt-4">
              <label className="label">
                Type <span className="font-mono text-status-damaged">{CLEAR_DATA_CONFIRM_PHRASE}</span> to confirm
              </label>
              <input
                className="input"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={CLEAR_DATA_CONFIRM_PHRASE}
                autoComplete="off"
              />
            </div>
            {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setOpen(false)} disabled={clearing}>Cancel</button>
              <button className="btn-danger" onClick={submit} disabled={clearing || !matches}>
                {clearing ? "Clearing…" : "Permanently clear everything"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
