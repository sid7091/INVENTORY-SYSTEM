"use client";

import Link from "next/link";
import { useState } from "react";
import { ALL_ROLES, isClient, ROLE_LABELS } from "@/lib/roles";
import type { UserRow } from "@/lib/types";
import { useToast } from "@/features/ui/Toast";
import { approveAction, deletePersonAction, resetPasswordAction, selectionOfAction, setActiveAction, setRoleAction } from "./actions";
import type { Creds } from "./Credentials";

type Picks = { id: string; name: string; block: string; status: string }[];

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "never");

export function PersonCard({ u, isMe, onCreds }: { u: UserRow; isMe: boolean; onCreds: (c: Creds) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [picks, setPicks] = useState<Picks | null>(null);

  async function run<T>(p: Promise<{ ok: true; data: T } | { ok: false; error: string }>, done?: string): Promise<T | undefined> {
    setBusy(true);
    const res = await p;
    setBusy(false);
    if (!res.ok) {
      toast(res.error);
      return undefined;
    }
    if (done) toast(done);
    return res.data;
  }

  const pending = u.status === "pending";
  return (
    <div className="person">
      <div className="top">
        <div>
          <div className="nm">
            {u.name} {isMe && <span className="badge">You</span>}{" "}
            {pending && <span className="badge pending">Waiting</span>}
            {u.status === "disabled" && <span className="badge sold">Switched off</span>}
          </div>
          <div className="sub">
            {u.email}
            {u.phone && ` · ${u.phone}`}
          </div>
          {(u.company || u.city) && <div className="sub">{[u.company, u.city].filter(Boolean).join(", ")}</div>}
          {u.note && <div className="sub">“{u.note}”</div>}
          <div className="sub">
            {pending ? `Asked ${fmt(u.createdAt)}` : `Last signed in ${fmt(u.lastLoginAt)}`}
          </div>
        </div>
      </div>
      <div className="tools">
        <select
          className="input"
          value={u.role}
          disabled={busy || isMe}
          aria-label={`Role for ${u.name}`}
          onChange={(e) => run(setRoleAction(u.id, e.target.value), "Role updated")}
        >
          {ALL_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        {pending ? (
          <>
            <button className="btn small primary" disabled={busy} onClick={() => run(approveAction(u.id), `${u.name} can now sign in`)}>
              Approve
            </button>
            <button
              className="btn small"
              disabled={busy}
              onClick={() => confirm(`Decline ${u.name}'s request?`) && run(deletePersonAction(u.id), "Request declined")}
            >
              Decline
            </button>
          </>
        ) : (
          !isMe && (
            <>
              <button
                className="btn small"
                disabled={busy}
                onClick={async () => {
                  if (!confirm(`Make a new password for ${u.name}? The old one stops working.`)) return;
                  const c = await run(resetPasswordAction(u.id));
                  if (c) onCreds(c);
                }}
              >
                New password
              </button>
              <button
                className="btn small"
                disabled={busy}
                onClick={() =>
                  run(setActiveAction(u.id, u.status !== "active"), u.status === "active" ? "Switched off" : "Switched back on")
                }
              >
                {u.status === "active" ? "Switch off" : "Switch on"}
              </button>
            </>
          )
        )}
        {isClient(u.role) && u.selectionCount > 0 && (
          <button
            className="btn small ghost"
            onClick={async () => setPicks(picks ? null : ((await run(selectionOfAction(u.id))) ?? null))}
          >
            {picks ? "Hide picks" : `${u.selectionCount} picked`}
          </button>
        )}
      </div>
      {picks && (
        <ul className="sub" style={{ margin: 0, paddingLeft: 18 }}>
          {picks.map((p) => (
            <li key={p.id}>
              <Link href={`/slab/${p.id}`}>{p.name}</Link> · Block {p.block}
              {p.status === "sold" && " · sold"}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
