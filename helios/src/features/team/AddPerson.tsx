"use client";

import { useState } from "react";
import { ALL_ROLES, ROLE_HELP, ROLE_LABELS, type Role } from "@/lib/roles";
import { createPersonAction } from "./actions";
import type { Creds } from "./Credentials";

export function AddPerson({ onCreated }: { onCreated: (c: Creds) => void }) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role>("architect");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button className="btn primary" onClick={() => setOpen(true)}>
        + Add a person
      </button>
    );
  }

  async function submit(form: FormData) {
    setBusy(true);
    setError(null);
    const res = await createPersonAction({
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      phone: String(form.get("phone") ?? ""),
      company: String(form.get("company") ?? ""),
      city: String(form.get("city") ?? ""),
      role,
    });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setOpen(false);
    onCreated(res.data);
  }

  return (
    <form action={submit} className="card-panel">
      <h3 style={{ marginBottom: 12 }}>Add a person</h3>
      <div className="field">
        <label htmlFor="ap-role">Role</label>
        <select className="input" id="ap-role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {ALL_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <span className="hint">{ROLE_HELP[role]}</span>
      </div>
      <div className="field">
        <label htmlFor="ap-name">Name</label>
        <input className="input" id="ap-name" name="name" required />
      </div>
      <div className="field">
        <label htmlFor="ap-email">Email</label>
        <input className="input" id="ap-email" name="email" type="email" required />
      </div>
      <div className="field">
        <label htmlFor="ap-phone">Phone / WhatsApp (optional)</label>
        <input className="input" id="ap-phone" name="phone" type="tel" placeholder="e.g. 919876543210" />
      </div>
      <div className="field">
        <label htmlFor="ap-company">Firm or company (optional)</label>
        <input className="input" id="ap-company" name="company" />
      </div>
      <div className="field">
        <label htmlFor="ap-city">City (optional)</label>
        <input className="input" id="ap-city" name="city" />
      </div>
      {error && <p className="notice error">{error}</p>}
      <div className="actions" style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" className="btn" onClick={() => setOpen(false)}>
          Cancel
        </button>
        <button className="btn primary" disabled={busy}>
          {busy ? "Creating…" : "Create login"}
        </button>
      </div>
    </form>
  );
}
