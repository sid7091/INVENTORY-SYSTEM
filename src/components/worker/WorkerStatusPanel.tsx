"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { changeStatus } from "@/app/actions/blocks";
import { useToast } from "@/components/ui/Toast";
import { t, statusLabel, STATUS_VISUALS, WORKER_REASONS, type Lang } from "@/lib/i18n";

// Two-tap status change: pick the new status (icon buttons), then tap WHY
// (preset reasons shown in the worker's language, stored in English so the
// audit log stays consistent for management). No free-text typing anywhere.
const WORKER_STATUSES = ["IN_STOCK", "READY_TO_DISPATCH", "HOLD", "SOLD"] as const;

export function WorkerStatusPanel({
  blockId,
  version,
  currentStatus,
  lang,
}: {
  blockId: string;
  version: number;
  currentStatus: string;
  lang: Lang;
}) {
  const router = useRouter();
  const toast = useToast();
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(reasonEn: string) {
    if (!picked) return;
    setBusy(true);
    const res = await changeStatus(blockId, version, { status: picked, reason: reasonEn, pieces: "" });
    setBusy(false);
    if (res.ok) {
      toast(t(lang, "saved"), "success");
      setPicked(null);
      router.refresh();
    } else {
      toast(res.error, "error");
      if (res.stale) router.refresh();
    }
  }

  return (
    <div className="card p-4">
      <h2 className="mb-3 text-lg font-bold text-brown-800">🔄 {t(lang, "changeStatus")}</h2>
      <div className="grid grid-cols-2 gap-2">
        {WORKER_STATUSES.map((s) => {
          const v = STATUS_VISUALS[s];
          const isCurrent = s === currentStatus;
          return (
            <button
              key={s}
              disabled={busy || isCurrent}
              onClick={() => setPicked(picked === s ? null : s)}
              className={`flex h-20 flex-col items-center justify-center gap-1 rounded-lg border-2 text-sm font-bold transition-all ${
                picked === s ? "scale-[1.02] ring-2 ring-brown-700 " + v.className : v.className
              } ${isCurrent ? "opacity-35" : "active:scale-95"}`}
            >
              <span className="text-2xl">{v.icon}</span>
              {statusLabel(lang, s)}
            </button>
          );
        })}
      </div>

      {picked && (
        <div className="mt-4">
          <div className="mb-2 text-base font-semibold text-brown-700">❓ {t(lang, "whyQuestion")}</div>
          <div className="flex flex-wrap gap-2">
            {WORKER_REASONS.map((r) => (
              <button
                key={r.en}
                disabled={busy}
                onClick={() => submit(r.en)}
                className="rounded-full border border-tan-300 bg-cream-50 px-4 py-2.5 text-base font-medium text-brown-700 active:scale-95"
              >
                {r[lang]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
