import { PageHeader } from "@/components/PageHeader";
import { PhotoRoom, type RoomItem } from "@/components/PhotoRoom";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function PhotoRoomPage() {
  // Show the most recent batch still under review.
  const batch = await prisma.photoBatch.findFirst({
    where: { status: "REVIEW" },
    orderBy: { createdAt: "desc" },
    include: { items: { orderBy: { createdAt: "asc" } } },
  });

  // Resolve matched block numbers for display.
  const matchedIds = [...new Set((batch?.items ?? []).map((i) => i.matchedBlockId).filter((v): v is string => !!v))];
  const blocks = matchedIds.length
    ? await prisma.block.findMany({ where: { id: { in: matchedIds } }, select: { id: true, blockNo: true } })
    : [];
  const blockNoById = new Map(blocks.map((b) => [b.id, b.blockNo]));

  const items: RoomItem[] = (batch?.items ?? []).map((i) => ({
    id: i.id,
    filename: i.filename,
    tempUrl: i.tempUrl,
    guessBlockNo: i.guessBlockNo,
    matchedBlockNo: i.matchedBlockId ? blockNoById.get(i.matchedBlockId) ?? null : null,
    decision: i.decision,
  }));

  return (
    <div>
      <PageHeader
        title="Bulk Photo Room"
        subtitle="Drop files → auto-match → review & approve. Nothing touches inventory until you commit."
      />
      <div className="p-4 sm:p-6">
        <PhotoRoom batchId={batch?.id ?? null} items={items} />
      </div>
    </div>
  );
}
