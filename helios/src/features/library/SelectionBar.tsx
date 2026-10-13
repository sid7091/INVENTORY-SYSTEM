"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useSelection } from "./Selection";
import { PdfDialog } from "@/features/pdf/PdfDialog";

export function SelectionBar() {
  const { ids, clear, pdfOpen, setPdfOpen } = useSelection();
  const pathname = usePathname();
  const n = ids.size;
  // Only on the library: the slab page has its own bottom bar with the same
  // PDF button, and the team/account pages don't need it.
  const showBar = n > 0 && pathname === "/";

  // Lets the floating "Add slab" button move up out of the way.
  useEffect(() => {
    document.body.classList.toggle("has-bar", showBar);
  }, [showBar]);

  return (
    <>
      {showBar && (
        <div className="bottombar">
          <span className="label">
            {n} slab{n === 1 ? "" : "s"} selected
          </span>
          <button className="btn small on-navy" onClick={clear}>
            Clear
          </button>
          <button className="btn small primary" onClick={() => setPdfOpen(true)}>
            Create PDF
          </button>
        </div>
      )}
      {pdfOpen && <PdfDialog ids={[...ids]} onClose={() => setPdfOpen(false)} />}
    </>
  );
}
