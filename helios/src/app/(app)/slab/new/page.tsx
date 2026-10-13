import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { listMaterials } from "@/lib/db";
import { canEdit } from "@/lib/roles";
import { SlabEditor } from "@/features/editor/SlabEditor";

export default async function NewSlabPage() {
  const me = await requireUser();
  if (!canEdit(me.role)) redirect("/");
  return <SlabEditor materials={await listMaterials()} />;
}
