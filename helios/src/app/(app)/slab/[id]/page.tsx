import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSlab } from "@/lib/db";
import { canEdit, canHardDelete, isClient } from "@/lib/roles";
import { SlabDetailView } from "@/features/slab/SlabDetailView";

export default async function SlabPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  const { id } = await params;
  const slab = await getSlab(id, me.role);
  if (!slab) notFound();
  return (
    <SlabDetailView
      key={slab.updatedAt}
      slab={slab}
      canEdit={canEdit(me.role)}
      canDelete={canHardDelete(me.role)}
      isClient={isClient(me.role)}
    />
  );
}
