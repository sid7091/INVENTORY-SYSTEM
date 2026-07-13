import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { TrashActions } from "@/components/TrashActions";
import { daysBetween } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TRASH_RETENTION_DAYS = 30;

export default async function TrashPage() {
  const user = await requireUser();
  const now = new Date();
  const blocks = await prisma.block.findMany({
    where: { deletedAt: { not: null } },
    orderBy: { deletedAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="Trash"
        subtitle={`Soft-deleted blocks are recoverable for ${TRASH_RETENTION_DAYS} days, then purged`}
      />
      <div className="p-6">
        {blocks.length === 0 ? (
          <div className="card flex flex-col items-center justify-center py-16 text-center">
            <div className="text-4xl">🗑</div>
            <p className="mt-3 text-sm font-medium text-brown-600">Trash is empty.</p>
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="min-w-full divide-y divide-cream-200">
              <thead className="bg-cream-100"><tr>
                <th className="th">Block No</th><th className="th">Colour</th><th className="th">Deleted</th>
                <th className="th">Auto-purge in</th><th className="th"></th>
              </tr></thead>
              <tbody className="divide-y divide-cream-100">
                {blocks.map((b) => {
                  const daysSince = b.deletedAt ? daysBetween(now, b.deletedAt) : 0;
                  const remaining = Math.max(0, TRASH_RETENTION_DAYS - daysSince);
                  return (
                    <tr key={b.id} className="hover:bg-cream-50">
                      <td className="td font-mono font-semibold">{b.blockNo}</td>
                      <td className="td">{b.colour}</td>
                      <td className="td text-brown-400">{b.deletedAt?.toLocaleDateString()}</td>
                      <td className="td">
                        <span className={`badge ${remaining <= 5 ? "bg-red-100 text-red-700" : "bg-cream-200 text-brown-600"}`}>
                          {remaining} day{remaining === 1 ? "" : "s"}
                        </span>
                      </td>
                      <td className="td"><TrashActions blockId={b.id} blockNo={b.blockNo} isAdmin={user.role === "ADMIN"} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
