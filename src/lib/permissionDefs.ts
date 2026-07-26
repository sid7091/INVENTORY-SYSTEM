// Capability catalogue + preset roles. No "server-only" here on purpose:
// the seed script (tsx) and the client-side role editor both import these
// definitions. Anything that touches the DB lives in permissions.ts.

export interface CapabilityDef {
  key: string;
  group: string;
  label: string;
  description: string;
}

export const CAPABILITIES: CapabilityDef[] = [
  { key: "inventory.view", group: "Inventory", label: "See inventory", description: "Search and view blocks, photos and details" },
  { key: "blocks.create", group: "Inventory", label: "Add new blocks", description: "Enter a new block into the system" },
  { key: "blocks.edit", group: "Inventory", label: "Edit block details", description: "Change measurements, names and other block data" },
  { key: "blocks.status", group: "Inventory", label: "Change block status", description: "Mark blocks Sold / Hold / Ready to Dispatch" },
  { key: "blocks.delete", group: "Inventory", label: "Delete blocks", description: "Move blocks to the 30-day trash" },
  { key: "photos.add", group: "Photos", label: "Add photos", description: "Take or upload photos for a block" },
  { key: "photoroom.use", group: "Photos", label: "Use the Photo Room", description: "Bulk-upload many photos and review the matches" },
  { key: "needsactions.resolve", group: "Photos", label: "Resolve Needs Actions", description: "Answer Drive sync questions and assign photos to blocks" },
  { key: "drivesync.run", group: "Google Drive", label: "Run a Drive sync", description: "Press Sync Now to pull new photos from Google Drive" },
  { key: "drivesync.configure", group: "Google Drive", label: "Change the Drive folder", description: "Set which Google Drive folder the app syncs from" },
  { key: "import.run", group: "Data", label: "Import spreadsheets", description: "Bulk-import blocks from Excel / CSV files" },
  { key: "export.run", group: "Data", label: "Export data", description: "Download the inventory as an Excel file" },
  { key: "reports.view", group: "Insights", label: "See reports", description: "Stock reports, aged blocks, photo backlog" },
  { key: "audit.view", group: "Insights", label: "See the audit log", description: "Who changed what, and when" },
  { key: "trash.manage", group: "Data", label: "Manage trash", description: "Restore or permanently remove deleted blocks" },
  { key: "admin.users", group: "Administration", label: "Manage users & roles", description: "Create accounts, create roles, decide who can do what" },
  { key: "admin.data", group: "Administration", label: "Danger zone", description: "Clear all data and other destructive resets" },
];

export const ALL_CAPABILITY_KEYS = CAPABILITIES.map((c) => c.key);

export type UiMode = "full" | "simple";

export const PRESET_ROLES: { name: string; uiMode: UiMode; permissions: string[] }[] = [
  {
    // Factory-floor data collection: everything needed to enter blocks,
    // photograph them and move their status — in the simple icon-first UI.
    name: "Worker",
    uiMode: "simple",
    permissions: ["inventory.view", "blocks.create", "blocks.edit", "blocks.status", "photos.add"],
  },
  {
    // Mid management: the full app minus administration.
    name: "Staff",
    uiMode: "full",
    permissions: ALL_CAPABILITY_KEYS.filter((k) => !k.startsWith("admin.") && k !== "drivesync.configure"),
  },
  {
    name: "Admin",
    uiMode: "full",
    permissions: [...ALL_CAPABILITY_KEYS],
  },
];
