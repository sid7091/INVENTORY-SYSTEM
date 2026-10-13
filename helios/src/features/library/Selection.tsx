"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { clearSelectionAction, toggleSelectionAction } from "./actions";
import { useToast } from "@/features/ui/Toast";

interface SelectionApi {
  ids: Set<string>;
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  clear: () => void;
  pdfOpen: boolean;
  setPdfOpen: (open: boolean) => void;
}

const Ctx = createContext<SelectionApi | null>(null);

/** The ticked slabs. Saved on the server so they follow you across devices. */
export function SelectionProvider({ initial, children }: { initial: string[]; children: React.ReactNode }) {
  const [ids, setIds] = useState(() => new Set(initial));
  const [pdfOpen, setPdfOpen] = useState(false);
  const toast = useToast();

  const toggle = useCallback(
    (id: string) => {
      let on = false;
      setIds((prev) => {
        const next = new Set(prev);
        on = !next.has(id);
        if (on) next.add(id);
        else next.delete(id);
        return next;
      });
      toggleSelectionAction(id, on).catch(() => toast("Couldn't save your selection. Check your connection."));
    },
    [toast],
  );

  const clear = useCallback(() => {
    setIds(new Set());
    clearSelectionAction().catch(() => toast("Couldn't clear your selection. Check your connection."));
  }, [toast]);

  const api = useMemo(
    () => ({ ids, isSelected: (id: string) => ids.has(id), toggle, clear, pdfOpen, setPdfOpen }),
    [ids, toggle, clear, pdfOpen],
  );
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useSelection(): SelectionApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSelection must be used inside SelectionProvider");
  return v;
}
