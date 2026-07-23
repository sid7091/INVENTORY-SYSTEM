"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { resolveActionItemsBulk, dismissActionItemsBulk } from "@/app/actions/actionItems";
import { useToast } from "@/components/ui/Toast";
import { driveThumbnailUrl } from "@/lib/driveThumb";

type Image = { fileId: string; name: string };
export interface DriveActionItem {
  id: string;
  message: string;
  driveFolderName: string | null;
  images: Image[];
}

export function DriveActionItemsList({ items }: { items: DriveActionItem[] }) {
  const router = useRouter();
  const toast = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [blockNos, setBlockNos] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === items.length ? new Set() : new Set(items.map((i) => i.id))));
  }

  async function approveSelected() {
    const toApprove = items.filter((i) => selected.has(i.id) && (blockNos[i.id] ?? "").trim());
    if (toApprove.length === 0) {
      toast("Type a block number for at least one selected item first.", "error");
      return;
    }
    setBusy(true);
    const res = await resolveActionItemsBulk(toApprove.map((i) => ({ itemId: i.id, blockNo: blockNos[i.id] })));
    setBusy(false);
    if (res.resolved > 0) toast(`${res.resolved} item(s) assigned and photos imported.`, "success");
    if (res.failed.length > 0) toast(`${res.failed.length} item(s) failed — check the block numbers and try again.`, "error");
    setSelected(new Set());
    router.refresh();
  }

  async function dismissSelected() {
    if (selected.size === 0) return;
    setBusy(true);
    const res = await dismissActionItemsBulk([...selected]);
    setBusy(false);
    toast(`${res.dismissed} item(s) dismissed.`, "success");
    setSelected(new Set());
    router.refresh();
  }

  async function assignOne(id: string) {
    const blockNo = blockNos[id];
    if (!blockNo?.trim()) return;
    setBusy(true);
    const res = await resolveActionItemsBulk([{ itemId: id, blockNo }]);
    setBusy(false);
    if (res.resolved > 0) toast("Assigned — photos imported.", "success");
    else toast(res.failed[0]?.error ?? "Failed to assign.", "error");
    router.refresh();
  }

  async function dismissOne(id: string) {
    setBusy(true);
    await dismissActionItemsBulk([id]);
    setBusy(false);
    toast("Dismissed.", "success");
    router.refresh();
  }

  if (items.length === 0) {
    return <p className="text-sm text-brown-400">Nothing here — every Drive folder matched cleanly.</p>;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-brown-600">
          <input type="checkbox" checked={selected.size === items.length} onChange={toggleAll} disabled={busy} />
          Select all ({items.length})
        </label>
        {selected.size > 0 && (
          <>
            <span className="text-sm text-brown-500">{selected.size} selected</span>
            <button className="btn-primary text-sm" onClick={approveSelected} disabled={busy}>
              Approve selected
            </button>
            <button className="btn-ghost text-sm" onClick={dismissSelected} disabled={busy}>
              Dismiss selected
            </button>
          </>
        )}
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="card p-4">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1"
                checked={selected.has(item.id)}
                onChange={() => toggle(item.id)}
                disabled={busy}
              />
              <div className="min-w-0 flex-1">
                {item.driveFolderName && (
                  <div className="font-mono text-xs text-brown-400">Drive folder: {item.driveFolderName}</div>
                )}
                <p className="mt-0.5 text-sm text-brown-700">{item.message}</p>

                {item.images.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.images.map((img) => (
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

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    className="input w-40 text-sm"
                    placeholder="Block number"
                    value={blockNos[item.id] ?? ""}
                    onChange={(e) => setBlockNos((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    disabled={busy}
                  />
                  <button
                    className="btn-secondary text-sm"
                    onClick={() => assignOne(item.id)}
                    disabled={busy || !(blockNos[item.id] ?? "").trim()}
                  >
                    Assign
                  </button>
                  <button className="btn-ghost text-sm" onClick={() => dismissOne(item.id)} disabled={busy}>
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
