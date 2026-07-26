import "server-only";
import { cache } from "react";
import { prisma } from "./prisma";
import { PRESET_ROLES, type UiMode } from "./permissionDefs";

export { CAPABILITIES, ALL_CAPABILITY_KEYS, PRESET_ROLES } from "./permissionDefs";

// Accounts created before the Role table existed carry only the legacy
// User.role string — map it onto the matching preset's capabilities.
const LEGACY_ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: PRESET_ROLES.find((r) => r.name === "Admin")!.permissions,
  STAFF: PRESET_ROLES.find((r) => r.name === "Staff")!.permissions,
};

export interface UserAccess {
  permissions: Set<string>;
  uiMode: UiMode;
  roleName: string;
}

// Resolve a user's live access from the DB (never from the JWT), so editing
// a role applies immediately — no waiting for old sessions to expire.
// react`cache` dedupes the lookup within a single request render.
export const getUserAccess = cache(async (userId: string): Promise<UserAccess> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { roleRef: true },
  });
  if (!user || !user.active) return { permissions: new Set(), uiMode: "full", roleName: "None" };
  if (user.roleRef) {
    let perms: string[] = [];
    try {
      perms = JSON.parse(user.roleRef.permissions);
    } catch {
      perms = [];
    }
    return {
      permissions: new Set(perms),
      uiMode: user.roleRef.uiMode === "simple" ? "simple" : "full",
      roleName: user.roleRef.name,
    };
  }
  const legacy = LEGACY_ROLE_PERMISSIONS[user.role] ?? LEGACY_ROLE_PERMISSIONS.STAFF;
  return { permissions: new Set(legacy), uiMode: "full", roleName: user.role === "ADMIN" ? "Admin" : "Staff" };
});

export async function hasPermission(userId: string, capability: string): Promise<boolean> {
  const access = await getUserAccess(userId);
  return access.permissions.has(capability);
}
