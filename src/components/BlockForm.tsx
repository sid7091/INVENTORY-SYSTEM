"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBlock, updateBlock, type ActionResult } from "@/app/actions/blocks";
import { CATEGORY_LABELS, type Category } from "@/lib/constants";
import { useToast } from "@/components/ui/Toast";

export interface BlockFormData {
  id?: string;
  version?: number;
  blockNo: string;
  quarryNo: string | null;
  colour: string;
  exporter: string | null;
  quarry: string | null;
  warehouse: string | null;
  weightTons: number | null;
  lengthCm: number | null;
  heightCm: number | null;
  pcs: number | null;
  endPcs: number | null;
  totalSft: number | null;
  thicknessMm: number | null;
  category: string;
}

const empty: BlockFormData = {
  blockNo: "", quarryNo: "", colour: "", exporter: "", quarry: "", warehouse: "",
  weightTons: null, lengthCm: null, heightCm: null, pcs: null, endPcs: null,
  totalSft: null, thicknessMm: null, category: "HELIOS_LISTED",
};

function Field({ label, name, value, onChange, type = "text", error, required, placeholder }: {
  label: string; name: string; value: string; onChange: (v: string) => void;
  type?: string; error?: string; required?: boolean; placeholder?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}{required && <span className="text-status-damaged"> *</span>}</label>
      <input id={name} name={name} type={type} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`input ${error ? "border-status-damaged" : ""}`} step={type === "number" ? "any" : undefined} />
      {error && <p className="mt-1 text-xs text-status-damaged">{error}</p>}
    </div>
  );
}

export function BlockForm({ initial }: { initial?: BlockFormData }) {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState<BlockFormData>(initial ?? empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const isEdit = !!initial?.id;

  const set = (k: keyof BlockFormData) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const numStr = (n: number | null) => (n == null ? "" : String(n));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    const payload = {
      blockNo: f.blockNo, quarryNo: f.quarryNo || "", colour: f.colour,
      exporter: f.exporter || "", quarry: f.quarry || "", warehouse: f.warehouse || "",
      weightTons: f.weightTons ?? "", lengthCm: f.lengthCm ?? "", heightCm: f.heightCm ?? "",
      pcs: f.pcs ?? "", endPcs: f.endPcs ?? "", totalSft: f.totalSft ?? "",
      thicknessMm: f.thicknessMm ?? "", category: f.category,
    };
    let res: ActionResult;
    if (isEdit) res = await updateBlock(initial!.id!, initial!.version!, payload);
    else res = await createBlock(payload);

    if (res.ok) {
      toast(isEdit ? "Block updated." : "Block created — it's in the Needs Actions queue.", "success");
      router.push(res.id ? `/inventory/${res.id}` : "/inventory");
      router.refresh();
    } else {
      setSaving(false);
      if (res.fieldErrors) setErrors(res.fieldErrors);
      toast(res.error, "error");
      if (res.stale) toast("Reload the page to get the latest values.", "info");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <section className="card p-5">
        <h2 className="mb-4 font-serif text-base font-bold text-brown-800">Identity</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Block No" name="blockNo" value={f.blockNo} onChange={set("blockNo")} required error={errors.blockNo} placeholder="ANW-M543" />
          <Field label="Quarry No" name="quarryNo" value={f.quarryNo ?? ""} onChange={set("quarryNo")} error={errors.quarryNo} placeholder="HSS-105" />
          <Field label="Colour / Variety" name="colour" value={f.colour} onChange={set("colour")} required error={errors.colour} placeholder="AQUA GREY" />
          <Field label="Exporter Name" name="exporter" value={f.exporter ?? ""} onChange={set("exporter")} error={errors.exporter} />
          <Field label="Quarry Name" name="quarry" value={f.quarry ?? ""} onChange={set("quarry")} error={errors.quarry} />
          <Field label="Warehouse / Yard" name="warehouse" value={f.warehouse ?? ""} onChange={set("warehouse")} error={errors.warehouse} />
          <div>
            <label className="label" htmlFor="category">Category</label>
            <select id="category" className="input" value={f.category} onChange={(e) => set("category")(e.target.value)}>
              {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>
          </div>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-4 font-serif text-base font-bold text-brown-800">Measurements</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <Field label="Weight (Tons)" name="weightTons" type="number" value={numStr(f.weightTons)} onChange={(v) => setF((p) => ({ ...p, weightTons: v === "" ? null : Number(v) }))} error={errors.weightTons} />
          <Field label="Length (CM)" name="lengthCm" type="number" value={numStr(f.lengthCm)} onChange={(v) => setF((p) => ({ ...p, lengthCm: v === "" ? null : Number(v) }))} error={errors.lengthCm} />
          <Field label="Height (CM)" name="heightCm" type="number" value={numStr(f.heightCm)} onChange={(v) => setF((p) => ({ ...p, heightCm: v === "" ? null : Number(v) }))} error={errors.heightCm} />
          <Field label="Thickness (MM)" name="thicknessMm" type="number" value={numStr(f.thicknessMm)} onChange={(v) => setF((p) => ({ ...p, thicknessMm: v === "" ? null : Number(v) }))} error={errors.thicknessMm} />
          <Field label="No. of slabs" name="pcs" type="number" value={numStr(f.pcs)} onChange={(v) => setF((p) => ({ ...p, pcs: v === "" ? null : Number(v) }))} error={errors.pcs} />
          <Field label="End PCS" name="endPcs" type="number" value={numStr(f.endPcs)} onChange={(v) => setF((p) => ({ ...p, endPcs: v === "" ? null : Number(v) }))} error={errors.endPcs} />
          <Field label="Total SFT" name="totalSft" type="number" value={numStr(f.totalSft)} onChange={(v) => setF((p) => ({ ...p, totalSft: v === "" ? null : Number(v) }))} error={errors.totalSft} />
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className="btn-primary">{saving ? "Saving…" : isEdit ? "Save changes" : "Create block"}</button>
        <button type="button" className="btn-secondary" onClick={() => router.back()}>Cancel</button>
        {!isEdit && <span className="text-xs text-brown-400">New blocks start in the Needs Actions queue.</span>}
      </div>
    </form>
  );
}
