"use client";
import { useRouter } from "next/navigation";
import { restoreBlock, purgeBlock } from "@/app/actions/blocks";
import { useToast } from "@/components/ui/Toast";

export function TrashActions({ blockId, blockNo, isAdmin }: { blockId: string; blockNo: string; isAdmin: boolean }) {
  const router = useRouter();
  const toast = useToast();

  async function restore() {
    const res = await restoreBlock(blockId);
    if (res.ok) { toast(`${blockNo} restored.`, "success"); router.refresh(); }
    else toast(res.error, "error");
  }

  async function purge() {
    if (!confirm(`Permanently delete ${blockNo}? This cannot be undone.`)) return;
    const res = await purgeBlock(blockId);
    if (res.ok) { toast(`${blockNo} permanently deleted.`, "success"); router.refresh(); }
    else toast(res.error, "error");
  }

  return (
    <div className="flex gap-2">
      <button className="btn-secondary text-xs" onClick={restore}>Restore</button>
      {isAdmin && <button className="btn-ghost text-xs text-status-damaged" onClick={purge}>Delete forever</button>}
    </div>
  );
}
