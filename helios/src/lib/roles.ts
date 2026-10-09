// Who can do what. Shared by server (enforcement) and client (hiding buttons).
// The server is the real gate: every action re-checks the role from the DB.

export const TEAM_ROLES = ["admin", "editor", "viewer"] as const;
export const CLIENT_ROLES = ["architect", "customer"] as const;
export const ALL_ROLES = [...TEAM_ROLES, ...CLIENT_ROLES] as const;
export type Role = (typeof ALL_ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
  architect: "Architect",
  customer: "Customer",
};

export const ROLE_HELP: Record<Role, string> = {
  admin: "Everything, plus the Team page and permanent removal",
  editor: "Add and edit slabs, mark them sold",
  viewer: "Search, share photos and make PDFs",
  architect: "Client: sees available slabs, shares photos, makes PDFs",
  customer: "Client: sees available slabs, shares photos, makes PDFs",
};

export function isRole(v: unknown): v is Role {
  return typeof v === "string" && (ALL_ROLES as readonly string[]).includes(v);
}

export const isClient = (r: string) => (CLIENT_ROLES as readonly string[]).includes(r);
export const canEdit = (r: string) => r === "admin" || r === "editor";
export const canHardDelete = (r: string) => r === "admin";
export const canManageTeam = (r: string) => r === "admin";
/** Clients only ever see slabs that are still available. */
export const canSeeSold = (r: string) => !isClient(r);
