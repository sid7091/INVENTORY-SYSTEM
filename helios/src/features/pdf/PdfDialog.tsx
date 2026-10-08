"use client";

import { useState } from "react";
import { Dialog } from "@/features/ui/Dialog";
import { pdfSlabsAction } from "@/features/library/actions";
import { canShareFiles, downloadBlob } from "@/features/share/share";
import { useToast } from "@/features/ui/Toast";

export function PdfDialog({ ids, onClose }: { ids: string[]; onClose: () => void }) {
  const toast = useToast();
  const [client, setClient] = useState("");
  const [location, setLocation] = useState("");
  const [renders, setRenders] = useState(true);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  async function create() {
    setError(null);
    setProgress("Getting slab details…");
    try {
      const slabs = await pdfSlabsAction(ids);
      if (!slabs.length) throw new Error("None of the selected slabs are available any more.");
      const { buildStoneForYouPdf } = await import("@/pdf/buildPdf"); // loaded only when needed
      const { blob, fileName } = await buildStoneForYouPdf(slabs, {
        client,
        location,
        includeRenders: renders,
        onProgress: setProgress,
      });
      setFile(new File([blob], fileName, { type: "application/pdf" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't make the PDF. Please try again.");
    } finally {
      setProgress(null);
    }
  }

  async function share(f: File) {
    if (canShareFiles([f])) {
      try {
        await navigator.share({ files: [f] });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    downloadBlob(f, f.name);
    toast("PDF saved to your downloads");
  }

  return (
    <Dialog title="Create PDF" onClose={onClose}>
      {file ? (
        <>
          <p className="notice success">
            Your PDF is ready: <strong>{file.name}</strong> ({(file.size / 1024 / 1024).toFixed(1)} MB)
          </p>
          <div className="actions">
            <button className="btn" onClick={() => (downloadBlob(file, file.name), toast("PDF saved to your downloads"))}>
              Download
            </button>
            <button className="btn primary" onClick={() => share(file)}>
              Share
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="hint" style={{ marginTop: 0 }}>
            {ids.length} slab{ids.length === 1 ? "" : "s"} in the “Stone For You” template.
          </p>
          <div className="field">
            <label htmlFor="pdf-client">Client name (optional)</label>
            <input className="input" id="pdf-client" value={client} onChange={(e) => setClient(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="pdf-location">Location (optional)</label>
            <input className="input" id="pdf-location" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <label className="check">
            <input type="checkbox" checked={renders} onChange={(e) => setRenders(e.target.checked)} />
            Add a renders page after each slab
          </label>
          {error && <p className="notice error">{error}</p>}
          <div className="actions">
            <button className="btn" onClick={onClose} disabled={!!progress}>
              Cancel
            </button>
            <button className="btn primary" onClick={create} disabled={!!progress}>
              {progress ?? "Create PDF"}
            </button>
          </div>
        </>
      )}
    </Dialog>
  );
}
