import React, { useEffect, useState } from "react";
import { api } from "../api";

export default function Settings() {
  const [form, setForm] = useState({
    institutionName: "",
    accountName: "",
    contactEmail: "",
    labsSideBySide: true,
    preferLastTwoPeriodsForLabs: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get("/settings/app").then((s) => {
      setForm({
        institutionName: s.institutionName || "",
        accountName: s.accountName || "",
        contactEmail: s.contactEmail || "",
        labsSideBySide: s.labsSideBySide,
        preferLastTwoPeriodsForLabs: s.preferLastTwoPeriodsForLabs,
      });
      setLoading(false);
    });
  }, []);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      await api.put("/settings/app", form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
    return (
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${checked ? "bg-brand-500" : "bg-slate-300"}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    );
  }

  if (loading) return <p className="text-slate-400 text-sm">Loading settings...</p>;

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold text-slate-800 mb-4">Settings</h2>

      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm mb-6">
        <h3 className="font-semibold text-slate-800 mb-1">Institution / Account Details</h3>
        <p className="text-xs text-slate-500 mb-4">Shown on exported PDFs/Excel and used for your own reference.</p>

        <label className="block text-sm font-medium text-slate-700 mb-1">Institution Name</label>
        <input
          className="w-full border rounded-lg px-3 py-2 text-sm mb-3"
          placeholder="e.g. Anil Neerukonda Institute of Technology & Sciences"
          value={form.institutionName}
          onChange={(e) => setForm({ ...form, institutionName: e.target.value })}
        />

        <label className="block text-sm font-medium text-slate-700 mb-1">Account / Admin Name</label>
        <input
          className="w-full border rounded-lg px-3 py-2 text-sm mb-3"
          placeholder="e.g. Principal Office"
          value={form.accountName}
          onChange={(e) => setForm({ ...form, accountName: e.target.value })}
        />

        <label className="block text-sm font-medium text-slate-700 mb-1">Contact Email</label>
        <input
          className="w-full border rounded-lg px-3 py-2 text-sm"
          placeholder="e.g. principal@college.edu"
          value={form.contactEmail}
          onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm mb-6">
        <h3 className="font-semibold text-slate-800 mb-1">Lab Arrangement</h3>
        <p className="text-xs text-slate-500 mb-4">
          Controls how the generator places Lab-type subjects. Changes apply the next time you click Generate.
        </p>

        <div className="flex items-start justify-between gap-4 py-3 border-t border-slate-100">
          <div>
            <p className="text-sm font-medium text-slate-800">Labs side-by-side</p>
            <p className="text-xs text-slate-500 mt-0.5">
              When on (default), a Lab subject's periods are placed as two consecutive periods back-to-back — the
              usual way labs run. Turn this off if your college prefers labs scheduled as separate single periods
              instead of a double block.
            </p>
          </div>
          <Toggle checked={form.labsSideBySide} onChange={(v) => setForm({ ...form, labsSideBySide: v })} />
        </div>

        <div className="flex items-start justify-between gap-4 py-3 border-t border-slate-100">
          <div>
            <p className="text-sm font-medium text-slate-800">Prefer last two periods for labs</p>
            <p className="text-xs text-slate-500 mt-0.5">
              When on, the generator first tries to fit each lab's consecutive pair into the day's last two periods
              (e.g. the two periods right after lunch). If that's not free, it still falls back to any other
              available consecutive pair — this is a preference, not a strict rule, so labs won't go unplaced just
              because the last two periods are already taken. Only applies when "Labs side-by-side" is on.
            </p>
          </div>
          <Toggle checked={form.preferLastTwoPeriodsForLabs} onChange={(v) => setForm({ ...form, preferLastTwoPeriodsForLabs: v })} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="bg-brand-500 hover:bg-brand-600 text-white font-medium px-6 py-2.5 rounded-lg disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
        {saved && <span className="text-sm text-green-600">Saved.</span>}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm mt-6">
        <h3 className="font-semibold text-slate-800 mb-3">About</h3>
        <p className="text-sm text-slate-600 mb-1">
          Developed by <strong>Goutham Pothuraju</strong>
        </p>
        <p className="text-sm text-slate-500">
          Email:{" "}
          <a href="mailto:pothurajugoutham06@gmail.com" className="text-brand-600 underline">
            pothurajugoutham06@gmail.com
          </a>
        </p>
        <p className="text-sm text-slate-500">
          LinkedIn:{" "}
          <a
            href="https://www.linkedin.com/in/goutham-pothuraju-223142322/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-600 underline"
          >
            linkedin.com/in/goutham-pothuraju-223142322
          </a>
        </p>
      </div>
    </div>
  );
}
