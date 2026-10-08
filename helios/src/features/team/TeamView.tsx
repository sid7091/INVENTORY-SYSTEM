"use client";

import { useState } from "react";
import { isClient } from "@/lib/roles";
import type { UserRow } from "@/lib/types";
import { AddPerson } from "./AddPerson";
import { CredentialsDialog, type Creds } from "./Credentials";
import { PersonCard } from "./PersonCard";

export function TeamView({ users, meId }: { users: UserRow[]; meId: string }) {
  const [creds, setCreds] = useState<Creds | null>(null);
  const [q, setQ] = useState("");
  const match = (u: UserRow) =>
    !q.trim() || [u.name, u.email, u.company, u.city, u.phone].some((v) => v?.toLowerCase().includes(q.trim().toLowerCase()));

  const groups: [string, UserRow[], string][] = [
    ["Waiting for approval", users.filter((u) => u.status === "pending"), "Architects and customers who asked for access."],
    ["Helios team", users.filter((u) => u.status === "active" && !isClient(u.role)), ""],
    ["Architects & customers", users.filter((u) => u.status === "active" && isClient(u.role)), "They see available slabs only."],
    ["Switched off", users.filter((u) => u.status === "disabled"), "These people can't sign in."],
  ];

  return (
    <main className="page narrow">
      <div className="lib-head">
        <h1>Team &amp; clients</h1>
        <span className="count">{users.length} people</span>
      </div>
      <AddPerson onCreated={setCreds} />
      {users.length > 8 && (
        <input className="input" style={{ marginTop: 14 }} type="search" placeholder="Find a person" value={q} onChange={(e) => setQ(e.target.value)} />
      )}
      {groups.map(([title, list, help]) =>
        list.length ? (
          <section key={title}>
            <h2 className="section-title">
              {title} <span className="count">({list.length})</span>
            </h2>
            {help && <p className="hint" style={{ marginTop: -6 }}>{help}</p>}
            <div className="people">
              {list.filter(match).map((u) => (
                <PersonCard key={u.id} u={u} isMe={u.id === meId} onCreds={setCreds} />
              ))}
            </div>
          </section>
        ) : null,
      )}
      {creds && <CredentialsDialog creds={creds} onClose={() => setCreds(null)} />}
    </main>
  );
}
