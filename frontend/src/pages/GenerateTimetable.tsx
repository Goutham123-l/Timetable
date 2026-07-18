import React, { useState } from "react";
import { api } from "../api";

export default function GenerateTimetable() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function generate() {
    setLoading(true);
    setResult(null);
    try {
      const res = await api.post("/timetable/generate");
      setResult(res);
    } catch (e: any) {
      setResult({ success: false, message: e.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-4">Generate Timetable</h2>
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm max-w-2xl">
        <p className="text-sm text-slate-600 mb-4">
          This runs the scheduler over your Assignment Table and randomly places every subject into a free,
          conflict-free slot — no teacher double-booked, no section double-booked, lab sessions kept consecutive.
          Locked cells (set in "View & Edit") are never touched. Re-run any time to reshuffle unlocked cells.
        </p>
        <button
          onClick={generate}
          disabled={loading}
          className="bg-brand-500 hover:bg-brand-600 text-white font-medium px-6 py-2.5 rounded-lg disabled:opacity-50"
        >
          {loading ? "Generating..." : "Generate Timetable"}
        </button>

        {result && (
          <div className={`mt-5 p-4 rounded-lg text-sm ${result.success ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>
            <p className="font-medium">{result.message}</p>
            {result.entriesCreated !== undefined && <p className="mt-1">Periods placed: {result.entriesCreated}</p>}
            {result.conflicts && result.conflicts.length > 0 && (
              <div className="mt-3">
                <p className="font-semibold">Unresolved items:</p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  {result.conflicts.map((c: any, i: number) => (
                    <li key={i}>{c.message}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
