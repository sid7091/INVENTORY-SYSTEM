import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSlab, listMaterials } from "@/lib/db";
import { canEdit } from "@/lib/roles";
import { SlabEditor } from "@/features/editor/SlabEditor";

export default async function EditSlabPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  if (!canEdit(me.role)) redirect("/");
  const { id } = await params;
  const [slab, materials] = await Promise.all([getSlab(id, me.role), listMaterials()]);
  if (!slab) notFound();
  return <SlabEditor slab={slab} materials={materials} />;
}
