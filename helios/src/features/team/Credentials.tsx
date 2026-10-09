"use client";

import { useState } from "react";
import { brand } from "@/config/brand";
import { Dialog } from "@/features/ui/Dialog";
import { copyText } from "@/features/share/share";

export interface Creds {
  name: string;
  email: string;
  phone: string | null;
  password: string;
}

/** Shows a new password once, with a ready-to-send message. */
export function CredentialsDialog({ creds, onClose }: { creds: Creds; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const site = typeof window !== "undefined" ? window.location.origin : "";
  const message = [
    `Hello ${creds.name}, here is your login for the ${brand.name} ${brand.appTitle.toLowerCase()}:`,
    ``,
    `Website: ${site}`,
    `Email: ${creds.email}`,
    `Password: ${creds.password}`,
    ``,
    `You can change the password under Menu → My account after signing in.`,
  ].join("\n");
  const phone = creds.phone?.replace(/\D/g, "");

  return (
    <Dialog title="Login details" onClose={onClose}>
      <p className="hint" style={{ marginTop: 0 }}>
        This password is shown only once. Send it now.
      </p>
      <div className="copybox">{message}</div>
      <div className="actions">
        <button className="btn" onClick={async () => setCopied(await copyText(message))}>
          {copied ? "Copied ✓" : "Copy message"}
        </button>
        <a
          className="btn primary"
          target="_blank"
          rel="noreferrer"
          href={`https://wa.me/${phone ?? ""}?text=${encodeURIComponent(message)}`}
        >
          Send on WhatsApp
        </a>
        <button className="btn ghost" onClick={onClose}>
          Done
        </button>
      </div>
    </Dialog>
  );
}
