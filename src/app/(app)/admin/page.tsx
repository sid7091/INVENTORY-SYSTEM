import { PageHeader } from "@/components/PageHeader";
import { DangerZone } from "@/components/DangerZone";
import { UsersRolesManager } from "@/components/UsersRolesManager";
import { requireUser } from "@/lib/auth";
import { getUserAccess } from "@/lib/permissions";
import { getDataCounts } from "@/app/actions/admin";
import { getUsersAndRoles } from "@/app/actions/roles";
import { BRAND } from "@/lib/brand";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireUser();
  const access = await getUserAccess(user.userId);
  const canUsers = access.permissions.has("admin.users");
  const canData = access.permissions.has("admin.data");

  if (!canUsers && !canData) {
    return (
      <div>
        <PageHeader title="Admin" />
        <div className="p-4 sm:p-6">
          <div className="card p-6 text-sm text-brown-600">
            This page is restricted to admins. Ask an {BRAND.name} admin for access if you need it.
          </div>
        </div>
      </div>
    );
  }

  const [counts, usersRoles] = await Promise.all([
    canData ? getDataCounts() : null,
    canUsers ? getUsersAndRoles() : null,
  ]);

  return (
    <div>
      <PageHeader title="Admin" subtitle="Accounts, roles and data management" />
      <div className="space-y-6 p-4 sm:p-6">
        {usersRoles && <UsersRolesManager users={usersRoles.users} roles={usersRoles.roles} selfId={user.userId} />}
        {counts && <DangerZone counts={counts} />}
      </div>
    </div>
  );
}
