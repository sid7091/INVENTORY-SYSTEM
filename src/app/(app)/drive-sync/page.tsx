import { PageHeader } from "@/components/PageHeader";
import { DriveSyncSettings } from "@/components/DriveSyncSettings";
import { getDriveSettings } from "@/app/actions/driveSettings";

export const dynamic = "force-dynamic";
// A full Drive tree walk can take a while — push past the platform default
// so "Sync now" (a Server Action, which inherits this page's config) isn't
// cut off mid-sync on a large tree.
export const maxDuration = 300;

export default async function DriveSyncPage() {
  const settings = await getDriveSettings();

  return (
    <div>
      <PageHeader title="Drive Sync" subtitle="Import photos straight from your shared Google Drive folder" />
      <div className="space-y-6 p-4 sm:p-6">
        <DriveSyncSettings settings={settings} />
      </div>
    </div>
  );
}
