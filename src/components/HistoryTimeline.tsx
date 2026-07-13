import { CATEGORY_LABELS, STATUS_LABELS } from "@/lib/constants";

interface Log {
  id: string;
  action: string;
  reason: string | null;
  changes: string | null;
  createdAt: Date;
  user: { name: string } | null;
}

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Created",
  UPDATE: "Edited",
  STATUS_CHANGE: "Status changed",
  DELETE: "Deleted",
  RESTORE: "Restored",
  PHOTO_ADD: "Photo added",
  PHOTO_DELETE: "Photo removed",
  IMPORT_CREATE: "Imported (new)",
  IMPORT_UPDATE: "Imported (updated)",
};

function pretty(field: string, value: unknown): string {
  if (value == null || value === "") return "—";
  if (field === "status") return STATUS_LABELS[value as keyof typeof STATUS_LABELS] ?? String(value);
  if (field === "category") return CATEGORY_LABELS[value as keyof typeof CATEGORY_LABELS] ?? String(value);
  return String(value);
}

export function HistoryTimeline({ logs }: { logs: Log[] }) {
  if (logs.length === 0) return <p className="text-sm text-brown-400">No history yet.</p>;
  return (
    <ol className="relative space-y-4 border-l border-tan-200 pl-5">
      {logs.map((log) => {
        let changes: Record<string, { from: unknown; to: unknown }> | null = null;
        try { changes = log.changes ? JSON.parse(log.changes) : null; } catch { changes = null; }
        return (
          <li key={log.id} className="relative">
            <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-cream-50 bg-tan-400" />
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="text-sm font-semibold text-brown-800">{ACTION_LABELS[log.action] ?? log.action.replace(/_/g, " ")}</span>
              <span className="text-xs text-brown-400">
                {log.user?.name ?? "system"} · {log.createdAt.toLocaleString()}
              </span>
            </div>
            {log.reason && <p className="mt-0.5 text-sm text-brown-600">{log.reason}</p>}
            {changes && Object.keys(changes).length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {Object.entries(changes).map(([field, { from, to }]) => (
                  <li key={field} className="text-xs text-brown-500">
                    <span className="font-medium">{field}</span>: <span className="text-brown-400 line-through">{pretty(field, from)}</span> → <span className="text-brown-700">{pretty(field, to)}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}
