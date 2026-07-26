"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createUser, updateUser, createRole, updateRole, deleteRole, type RoleView, type UserView } from "@/app/actions/roles";
import { CAPABILITIES } from "@/lib/permissionDefs";
import { useToast } from "@/components/ui/Toast";

// ---------------------------------------------------------------------------
// Role editor — a checkbox grid grouped by area, plus the full/simple UI
// choice. Used for both "new role" and editing an existing one.
// ---------------------------------------------------------------------------

function RoleEditor({
  initial,
  onSave,
  onCancel,
  busy,
  nameLocked,
}: {
  initial: { name: string; permissions: string[]; uiMode: "full" | "simple" };
  onSave: (v: { name: string; permissions: string[]; uiMode: "full" | "simple" }) => void;
  onCancel: () => void;
  busy: boolean;
  nameLocked?: boolean;
}) {
  const [name, setName] = useState(initial.name);
  const [perms, setPerms] = useState<Set<string>>(new Set(initial.permissions));
  const [uiMode, setUiMode] = useState<"full" | "simple">(initial.uiMode);

  const groups = [...new Set(CAPABILITIES.map((c) => c.group))];

  function toggle(key: string) {
    setPerms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="mt-3 space-y-4 rounded-md border border-tan-200 bg-cream-50 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          className="input w-56"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Role name"
          disabled={busy || nameLocked}
        />
        <div className="flex items-center gap-3 text-sm text-brown-700">
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={uiMode === "simple"} onChange={() => setUiMode("simple")} disabled={busy} />
            📱 Simple app (factory floor)
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={uiMode === "full"} onChange={() => setUiMode("full")} disabled={busy} />
            🖥 Full app (management)
          </label>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((group) => (
          <div key={group}>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-brown-400">{group}</div>
            <div className="space-y-1.5">
              {CAPABILITIES.filter((c) => c.group === group).map((cap) => (
                <label key={cap.key} className="flex items-start gap-2 text-sm text-brown-700">
                  <input type="checkbox" className="mt-0.5" checked={perms.has(cap.key)} onChange={() => toggle(cap.key)} disabled={busy} />
                  <span>
                    {cap.label}
                    <span className="block text-xs text-brown-400">{cap.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button className="btn-primary text-sm" onClick={() => onSave({ name, permissions: [...perms], uiMode })} disabled={busy}>
          {busy ? "Saving…" : "Save role"}
        </button>
        <button className="btn-secondary text-sm" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main manager
// ---------------------------------------------------------------------------

export function UsersRolesManager({ users, roles, selfId }: { users: UserView[]; roles: RoleView[]; selfId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  // New-user form state
  const [showNewUser, setShowNewUser] = useState(false);
  const [nu, setNu] = useState({ name: "", email: "", password: "", roleId: roles.find((r) => r.name === "Worker")?.id ?? roles[0]?.id ?? "" });

  // Role editing state
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [showNewRole, setShowNewRole] = useState(false);

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, successMsg: string) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (res.ok) {
      toast(successMsg, "success");
      router.refresh();
      return true;
    }
    toast(res.error ?? "Something went wrong.", "error");
    return false;
  }

  return (
    <section className="card p-5">
      <h2 className="mb-1 font-serif text-base font-bold text-brown-800">Users & Roles</h2>
      <p className="mb-4 text-sm text-brown-500">
        Create accounts for your team and decide exactly what each role can do. Roles marked 📱 use the
        simple icon-first app for factory staff; 🖥 roles get the full management app.
      </p>

      {/* Users */}
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-brown-700">Users ({users.length})</h3>
        <button className="btn-secondary text-xs" onClick={() => setShowNewUser((v) => !v)} disabled={busy}>
          {showNewUser ? "Close" : "+ Add user"}
        </button>
      </div>

      {showNewUser && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-tan-200 bg-cream-50 p-3">
          <input className="input w-40 text-sm" placeholder="Name" value={nu.name} onChange={(e) => setNu({ ...nu, name: e.target.value })} disabled={busy} />
          <input className="input w-52 text-sm" placeholder="Email" value={nu.email} onChange={(e) => setNu({ ...nu, email: e.target.value })} disabled={busy} />
          <input className="input w-36 text-sm" placeholder="Password" type="text" value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} disabled={busy} />
          <select className="input w-36 text-sm" value={nu.roleId} onChange={(e) => setNu({ ...nu, roleId: e.target.value })} disabled={busy}>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.uiMode === "simple" ? "📱" : "🖥"} {r.name}</option>
            ))}
          </select>
          <button
            className="btn-primary text-sm"
            disabled={busy}
            onClick={async () => {
              const ok = await run(() => createUser(nu), `User ${nu.name} created.`);
              if (ok) {
                setShowNewUser(false);
                setNu({ ...nu, name: "", email: "", password: "" });
              }
            }}
          >
            Create
          </button>
        </div>
      )}

      <div className="mb-6 overflow-x-auto">
        <table className="min-w-full divide-y divide-cream-200">
          <thead className="bg-cream-100"><tr>
            <th className="th">Name</th><th className="th">Email</th><th className="th">Role</th><th className="th">Active</th><th className="th"></th>
          </tr></thead>
          <tbody className="divide-y divide-cream-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-cream-50">
                <td className="td font-medium">{u.name}{u.id === selfId && <span className="ml-1 text-xs text-brown-400">(you)</span>}</td>
                <td className="td text-brown-500">{u.email}</td>
                <td className="td">
                  <select
                    className="input w-36 text-sm"
                    value={u.roleId ?? ""}
                    disabled={busy}
                    onChange={(e) => run(() => updateUser(u.id, { roleId: e.target.value }), `${u.name}'s role updated.`)}
                  >
                    {u.roleId === null && <option value="">({u.roleName})</option>}
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>{r.uiMode === "simple" ? "📱" : "🖥"} {r.name}</option>
                    ))}
                  </select>
                </td>
                <td className="td">
                  <input
                    type="checkbox"
                    checked={u.active}
                    disabled={busy || u.id === selfId}
                    onChange={(e) => run(() => updateUser(u.id, { active: e.target.checked }), e.target.checked ? `${u.name} activated.` : `${u.name} deactivated.`)}
                  />
                </td>
                <td className="td">
                  <button
                    className="btn-ghost text-xs"
                    disabled={busy}
                    onClick={() => {
                      const pw = window.prompt(`New password for ${u.name} (min 6 characters):`);
                      if (pw) run(() => updateUser(u.id, { newPassword: pw }), `Password reset for ${u.name}.`);
                    }}
                  >
                    Reset password
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Roles */}
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-brown-700">Roles ({roles.length})</h3>
        <button className="btn-secondary text-xs" onClick={() => { setShowNewRole((v) => !v); setEditingRoleId(null); }} disabled={busy}>
          {showNewRole ? "Close" : "+ New role"}
        </button>
      </div>

      {showNewRole && (
        <RoleEditor
          initial={{ name: "", permissions: ["inventory.view"], uiMode: "simple" }}
          busy={busy}
          onCancel={() => setShowNewRole(false)}
          onSave={async (v) => {
            const ok = await run(() => createRole(v), `Role ${v.name} created.`);
            if (ok) setShowNewRole(false);
          }}
        />
      )}

      <ul className="divide-y divide-cream-100">
        {roles.map((r) => (
          <li key={r.id} className="py-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base">{r.uiMode === "simple" ? "📱" : "🖥"}</span>
              <span className="font-medium text-brown-800">{r.name}</span>
              {r.isPreset && <span className="badge bg-cream-200 text-brown-500">preset</span>}
              <span className="text-xs text-brown-400">{r.permissions.length} permission(s) · {r.userCount} user(s)</span>
              <span className="ml-auto flex gap-1">
                {!(r.isPreset && r.name === "Admin") && (
                  <button className="btn-ghost text-xs" disabled={busy} onClick={() => { setEditingRoleId(editingRoleId === r.id ? null : r.id); setShowNewRole(false); }}>
                    {editingRoleId === r.id ? "Close" : "Edit"}
                  </button>
                )}
                {!r.isPreset && r.userCount === 0 && (
                  <button className="btn-ghost text-xs text-status-damaged" disabled={busy} onClick={() => run(() => deleteRole(r.id), `Role ${r.name} deleted.`)}>
                    Delete
                  </button>
                )}
              </span>
            </div>
            {editingRoleId === r.id && (
              <RoleEditor
                initial={{ name: r.name, permissions: r.permissions, uiMode: r.uiMode }}
                nameLocked={r.isPreset}
                busy={busy}
                onCancel={() => setEditingRoleId(null)}
                onSave={async (v) => {
                  const ok = await run(() => updateRole(r.id, v), `Role ${v.name} updated.`);
                  if (ok) setEditingRoleId(null);
                }}
              />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
