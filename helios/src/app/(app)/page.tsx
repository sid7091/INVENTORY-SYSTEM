import { requireUser } from "@/lib/auth";
import { listSlabs } from "@/lib/db";
import { canEdit, canSeeSold } from "@/lib/roles";
import { LibraryView } from "@/features/library/LibraryView";

export default async function LibraryPage() {
  const me = await requireUser();
  const slabs = await listSlabs(me.role);
  return <LibraryView slabs={slabs} canEdit={canEdit(me.role)} showStatusFilter={canSeeSold(me.role)} />;
}
