import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt((Array.isArray(sp.page) ? sp.page[0] : sp.page) || "1", 10) || 1);

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { user: { select: { name: true } }, block: { select: { blockNo: true } } },
    }),
    prisma.auditLog.count(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHeader title="Audit Log" subtitle={`${total} recorded event${total === 1 ? "" : "s"} · who / when / what / why`} />
      <div className="p-6">
        <div className="card overflow-x-auto">
          <table className="min-w-full divide-y divide-cream-200">
            <thead className="bg-cream-100"><tr>
              <th className="th">When</th><th className="th">User</th><th className="th">Action</th><th className="th">Block</th><th className="th">Reason / Detail</th>
            </tr></thead>
            <tbody className="divide-y divide-cream-100">
              {logs.map((log) => (
                <tr key={log.id} className="align-top hover:bg-cream-50">
                  <td className="td text-brown-400">{log.createdAt.toLocaleString()}</td>
                  <td className="td">{log.user?.name ?? "system"}</td>
                  <td className="td"><span className="badge bg-cream-200 text-brown-700">{log.action.replace(/_/g, " ")}</span></td>
                  <td className="td">{log.block ? <Link href={`/inventory/${log.blockId}`} className="font-mono text-tan-500 hover:underline">{log.block.blockNo}</Link> : "—"}</td>
                  <td className="td whitespace-normal text-brown-600">{log.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            {page > 1 && <Link href={`/audit?page=${page - 1}`} className="btn-secondary text-sm">← Prev</Link>}
            <span className="text-sm text-brown-500">Page {page} of {totalPages}</span>
            {page < totalPages && <Link href={`/audit?page=${page + 1}`} className="btn-secondary text-sm">Next →</Link>}
          </div>
        )}
      </div>
    </div>
  );
}
