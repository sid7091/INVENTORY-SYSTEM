import { STATUS_LABELS, type Status } from "@/lib/constants";

const COLORS: Record<Status, string> = {
  NEEDS_PHOTOS: "bg-amber-100 text-amber-800 border border-amber-300",
  IN_STOCK: "bg-emerald-100 text-emerald-800 border border-emerald-300",
  RESERVED: "bg-yellow-100 text-yellow-800 border border-yellow-300",
  SOLD: "bg-purple-100 text-purple-800 border border-purple-300",
  DAMAGED: "bg-red-100 text-red-800 border border-red-300",
  RETURNED: "bg-gray-100 text-gray-700 border border-gray-300",
};

export function StatusBadge({ status }: { status: string }) {
  const s = status as Status;
  return (
    <span className={`badge ${COLORS[s] ?? "bg-gray-100 text-gray-700"}`}>
      {STATUS_LABELS[s] ?? status}
    </span>
  );
}
