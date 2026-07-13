import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatNumber, formatSft } from "@/lib/utils";
import { formatThickness } from "@/lib/constants";

export interface BlockRow {
  id: string;
  blockNo: string;
  quarryNo: string | null;
  colour: string;
  exporter: string | null;
  quarry: string | null;
  weightTons: number | null;
  lengthCm: number | null;
  heightCm: number | null;
  pcs: number | null;
  totalSft: number | null;
  thicknessMm: number | null;
  status: string;
  photos?: { url: string }[];
}

function Thumb({ block }: { block: BlockRow }) {
  const url = block.photos?.[0]?.url;
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={block.blockNo} className="h-full w-full object-cover" />;
  }
  return (
    <div className="flex h-full w-full items-center justify-center bg-cream-200 text-3xl text-tan-300">◧</div>
  );
}

export function BlockGrid({ blocks }: { blocks: BlockRow[] }) {
  if (blocks.length === 0) return <EmptyState />;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {blocks.map((b) => (
        <Link key={b.id} href={`/inventory/${b.id}`} className="card overflow-hidden transition-shadow hover:shadow-cardhover">
          <div className="aspect-[4/3] w-full overflow-hidden bg-cream-200">
            <Thumb block={b} />
          </div>
          <div className="p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-sm font-bold text-brown-800">{b.blockNo}</span>
              <StatusBadge status={b.status} />
            </div>
            <div className="mt-1 truncate text-sm font-medium text-brown-700">{b.colour}</div>
            <div className="mt-1 text-xs text-brown-400">{b.exporter ?? "—"}</div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-brown-500">
              <span>{formatThickness(b.thicknessMm)}</span>
              <span>{b.pcs != null ? `${b.pcs} pcs` : "—"}</span>
              <span>{formatSft(b.totalSft)}</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function BlockTable({ blocks }: { blocks: BlockRow[] }) {
  if (blocks.length === 0) return <EmptyState />;
  return (
    <div className="card overflow-x-auto">
      <table className="min-w-full divide-y divide-cream-200">
        <thead className="bg-cream-100">
          <tr>
            <th className="th">Block No</th>
            <th className="th">Colour</th>
            <th className="th">Exporter</th>
            <th className="th">Quarry</th>
            <th className="th">Thickness</th>
            <th className="th">PCS</th>
            <th className="th">Weight</th>
            <th className="th">SFT</th>
            <th className="th">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-cream-100">
          {blocks.map((b) => (
            <tr key={b.id} className="hover:bg-cream-50">
              <td className="td">
                <Link href={`/inventory/${b.id}`} className="font-mono font-semibold text-tan-500 hover:underline">{b.blockNo}</Link>
              </td>
              <td className="td">{b.colour}</td>
              <td className="td text-brown-500">{b.exporter ?? "—"}</td>
              <td className="td text-brown-500">{b.quarry ?? "—"}</td>
              <td className="td">{formatThickness(b.thicknessMm)}</td>
              <td className="td">{b.pcs ?? "—"}</td>
              <td className="td">{b.weightTons != null ? `${formatNumber(b.weightTons)} t` : "—"}</td>
              <td className="td">{formatSft(b.totalSft)}</td>
              <td className="td"><StatusBadge status={b.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card flex flex-col items-center justify-center py-16 text-center">
      <div className="text-4xl text-tan-200">◧</div>
      <p className="mt-3 text-sm font-medium text-brown-600">No blocks match these filters.</p>
      <p className="text-xs text-brown-400">Try clearing filters, or add / import blocks.</p>
    </div>
  );
}
