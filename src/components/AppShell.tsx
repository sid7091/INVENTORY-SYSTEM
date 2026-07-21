"use client";
import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { MobileTopBar } from "./MobileTopBar";

export function AppShell({
  user,
  counts,
  children,
}: {
  user: { name: string; email: string; role: string };
  counts: { needsPhotos: number };
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-cream-100">
      <Sidebar user={user} counts={counts} open={open} onClose={() => setOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar onOpenMenu={() => setOpen(true)} needsPhotos={counts.needsPhotos} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
