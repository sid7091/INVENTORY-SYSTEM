import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getUserAccess } from "@/lib/permissions";
import { getUiPref } from "@/lib/uiPrefServer";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/AppShell";

// Which capability unlocks each nav destination. Anything the user can't do
// simply doesn't appear — fewer choices, less confusion, and the server
// actions behind each page enforce the same checks anyway.
const NAV_CAPABILITIES: Record<string, string> = {
  "/": "inventory.view",
  "/inventory": "inventory.view",
  "/needs-actions": "needsactions.resolve",
  "/photo-room": "photoroom.use",
  "/drive-sync": "drivesync.run",
  "/import": "import.run",
  "/reports": "reports.view",
  "/audit": "audit.view",
  "/trash": "trash.manage",
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [access, uiPref] = await Promise.all([getUserAccess(user.userId), getUiPref()]);

  // Factory-floor roles live in the simple app; anyone else lands here unless
  // they've chosen the simple view for themselves from the burger menu.
  if (access.uiMode === "simple" || uiPref === "simple") redirect("/w");

  const [needsPhotos, openActionItems] = await Promise.all([
    prisma.block.count({ where: { deletedAt: null, status: "NEEDS_PHOTOS" } }),
    prisma.actionItem.count({ where: { status: "OPEN" } }),
  ]);

  const allowedHrefs = Object.entries(NAV_CAPABILITIES)
    .filter(([, cap]) => access.permissions.has(cap))
    .map(([href]) => href);
  if (access.permissions.has("admin.users") || access.permissions.has("admin.data")) {
    allowedHrefs.push("/admin");
  }

  return (
    <AppShell
      user={{ name: user.name, email: user.email, role: access.roleName }}
      counts={{ needsActions: needsPhotos + openActionItems }}
      allowedHrefs={allowedHrefs}
    >
      {children}
    </AppShell>
  );
}
