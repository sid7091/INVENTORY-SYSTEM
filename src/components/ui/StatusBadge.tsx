import { STATUS_LABELS, type Status } from "@/lib/constants";
import { STATUS_VISUALS } from "@/lib/i18n";

// Icon + colour carry the meaning (consistent with the worker app); the
// English label reinforces it for readers.
export function StatusBadge({ status }: { status: string }) {
  const s = status as Status;
  const visual = STATUS_VISUALS[s];
  return (
    <span className={`badge inline-flex items-center gap-1 border ${visual?.className ?? "bg-gray-100 text-gray-700"}`}>
      {visual && <span aria-hidden>{visual.icon}</span>}
      {STATUS_LABELS[s] ?? status}
    </span>
  );
}
