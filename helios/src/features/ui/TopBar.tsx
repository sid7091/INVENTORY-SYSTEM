"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { brand } from "@/config/brand";
import { canManageTeam, ROLE_LABELS, type Role } from "@/lib/roles";
import { logoutAction } from "@/features/auth/actions";

export function TopBar({ name, role }: { name: string; role: Role }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  return (
    <header className="topbar">
      <Link href="/" className="brandmark">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={brand.assets.logoMain} alt="" />
        <span>{brand.shortName.toUpperCase()}</span>
      </Link>
      <div className="spacer" />
      <span className="who">{name}</span>
      <div className="menu" ref={ref}>
        <button className="btn small on-navy" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          Menu
        </button>
        {open && (
          <nav className="menu-panel" onClick={() => setOpen(false)}>
            <Link href="/">Slab library</Link>
            {canManageTeam(role) && <Link href="/team">Team &amp; clients</Link>}
            <Link href="/account">My account · {ROLE_LABELS[role]}</Link>
            <form action={logoutAction}>
              <button type="submit" style={{ width: "100%" }}>
                Sign out
              </button>
            </form>
          </nav>
        )}
      </div>
    </header>
  );
}
