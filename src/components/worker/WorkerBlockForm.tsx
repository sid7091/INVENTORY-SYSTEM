"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBlock, updateBlock, type ActionResult } from "@/app/actions/blocks";
import { useToast } from "@/components/ui/Toast";
import { t, type Lang, type I18nKey } from "@/lib/i18n";

// Icon-labelled data entry. Every numeric field opens the number keypad
// (inputMode) and shows a pictogram + a label in the worker's language.
interface FormState {
  blockNo: string;
  colour: string;
  weightTons: string;
  lengthCm: string;
  heightCm: string;
  thicknessMm: string;
  pcs: string;
  totalSft: string;
}

const NUMERIC_FIELDS: { key: keyof FormState; icon: string; labelKey: I18nKey; intOnly?: boolean }[] = [
  { key: "weightTons", icon: "⚖️", labelKey: "weightTons" },
  { key: "lengthCm", icon: "📏", labelKey: "lengthCm" },
  { key: "heightCm", icon: "↕️", labelKey: "heightCm" },
  { key: "thicknessMm", icon: "🧱", labelKey: "thicknessMm" },
  { key: "pcs", icon: "🔢", labelKey: "slabs", intOnly: true },
  { key: "totalSft", icon: "📐", labelKey: "totalSft" },
];

export function WorkerBlockForm({
  lang,
  colours,
  initial,
}: {
  lang: Lang;
  colours: string[];
  initial?: FormState & { id: string; version: number };
}) {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState<FormState>(
    initial ?? { blockNo: "", colour: "", weightTons: "", lengthCm: "", heightCm: "", thicknessMm: "", pcs: "", totalSft: "" },
  );
  const [saving, setSaving] = useState(false);
  const isEdit = !!initial;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      blockNo: f.blockNo, quarryNo: "", colour: f.colour, exporter: "", quarry: "", warehouse: "",
      weightTons: f.weightTons, lengthCm: f.lengthCm, heightCm: f.heightCm,
      pcs: f.pcs, endPcs: "", totalSft: f.totalSft, thicknessMm: f.thicknessMm,
      category: "HELIOS_LISTED",
    };
    let res: ActionResult;
    if (isEdit) res = await updateBlock(initial.id, initial.version, payload);
    else res = await createBlock(payload);
    if (res.ok) {
      toast(t(lang, "saved"), "success");
      router.push(`/w/block/${res.id ?? initial?.id}`);
      router.refresh();
    } else {
      setSaving(false);
      toast(res.error, "error");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="card space-y-4 p-4">
        <label className="block">
          <span className="mb-1 flex items-center gap-2 text-base font-semibold text-brown-700">
            <span className="text-xl">🔢</span> {t(lang, "blockNo")} *
          </span>
          <input
            className="input h-14 text-xl font-bold uppercase"
            value={f.blockNo}
            onChange={(e) => setF({ ...f, blockNo: e.target.value.toUpperCase() })}
            placeholder="ANW-M543"
            required
            disabled={saving || isEdit}
          />
        </label>

        <label className="block">
          <span className="mb-1 flex items-center gap-2 text-base font-semibold text-brown-700">
            <span className="text-xl">🎨</span> {t(lang, "colour")} *
          </span>
          <input
            className="input h-14 text-xl uppercase"
            value={f.colour}
            onChange={(e) => setF({ ...f, colour: e.target.value.toUpperCase() })}
            list="worker-colours"
            required
            disabled={saving}
          />
          <datalist id="worker-colours">
            {colours.map((c) => <option key={c} value={c} />)}
          </datalist>
        </label>

        <div className="grid grid-cols-2 gap-3">
          {NUMERIC_FIELDS.map((field) => (
            <label key={field.key} className="block">
              <span className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-brown-700">
                <span className="text-lg">{field.icon}</span> {t(lang, field.labelKey)}
              </span>
              <input
                className="input h-14 text-xl"
                inputMode={field.intOnly ? "numeric" : "decimal"}
                value={f[field.key]}
                onChange={(e) => setF({ ...f, [field.key]: e.target.value.replace(field.intOnly ? /[^\d]/g : /[^\d.]/g, "") })}
                disabled={saving}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="btn-primary h-16 flex-1 text-xl font-bold">
          {saving ? "…" : `💾 ${t(lang, "save")}`}
        </button>
        <button type="button" className="btn-secondary h-16 px-6 text-xl" onClick={() => router.back()} disabled={saving}>
          ✕
        </button>
      </div>
    </form>
  );
}
