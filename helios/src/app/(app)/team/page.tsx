import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { listUsers } from "@/lib/db";
import { canManageTeam } from "@/lib/roles";
import { TeamView } from "@/features/team/TeamView";

export default async function TeamPage() {
  const me = await requireUser();
  if (!canManageTeam(me.role)) redirect("/");
  return <TeamView users={await listUsers()} meId={me.id} />;
}
