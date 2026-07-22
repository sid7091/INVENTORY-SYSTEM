import { PageHeader } from "@/components/PageHeader";
import { DangerZone } from "@/components/DangerZone";
import { DriveSyncSettings } from "@/components/DriveSyncSettings";
import { requireUser } from "@/lib/auth";
import { getDataCounts } from "@/app/actions/admin";
import { getDriveSettings } from "@/app/actions/driveSettings";
import { BRAND } from "@/lib/brand";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireUser();

  if (user.role !== "ADMIN") {
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

  const [counts, driveSettings] = await Promise.all([getDataCounts(), getDriveSettings()]);

  return (
    <div>
      <PageHeader title="Admin" subtitle="Account and data management" />
      <div className="space-y-6 p-4 sm:p-6">
        <DriveSyncSettings settings={driveSettings} />
        <DangerZone counts={counts} />
      </div>
    </div>
  );
}
