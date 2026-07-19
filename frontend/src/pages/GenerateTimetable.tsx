import React, { useEffect, useState } from "react";
import { api } from "../api";

interface Readiness {
  sectionId: number;
  label: string;
  totalSlots: number;
  totalAssigned: number;
  gap: number; // > 0 = short (will have Free periods), < 0 = over-assigned
}

export default function GenerateTimetable() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [readiness, setReadiness] = useState<Readiness[]>([]);
  const [readinessLoading, setReadinessLoading] = useState(true);

  const loadReadiness = () => {
    setReadinessLoading(true);
    api.get("/timetable/readiness").then((r) => {
      setReadiness(r);
      setReadinessLoading(false);
    });
  };

  useEffect(() => {
    loadReadiness();
  }, []);

  async function generate() {
    setLoading(true);
    setResult(null);
    try {
      const res = await api.post("/timetable/generate");
      setResult(res);
      loadReadiness();
    } catch (e: any) {
      setResult({ success: false, message: e.message });
    } finally {
      setLoading(false);
    }
  }

  const shortSections = readiness.filter((r) => r.gap > 0);
  const overSections = readiness.filter((r) => r.gap < 0);
  const readySections = readiness.filter((r) => r.gap === 0);

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-4">Generate Timetable</h2>

      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm max-w-3xl mb-6">
        <h3 className="font-semibold text-slate-800 mb-1">Before you generate: is every section's week fully covered?</h3>
        <p className="text-sm text-slate-500 mb-4">
          For a student timetable to come out completely filled (no "Free" periods), each section's assigned
          subjects on the Assignment Table need to add up to exactly its number of available teaching slots per
          week. This checks that automatically.
        </p>

        {readinessLoading ? (
          <p className="text-sm text-slate-400">Checking...</p>
        ) : readiness.length === 0 ? (
          <p className="text-sm text-slate-400">No sections found yet — add sections and assignments first.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left p-2 text-xs font-semibold text-slate-500 uppercase">Section</th>
                  <th className="text-left p-2 text-xs font-semibold text-slate-500 uppercase">Available Slots/Week</th>
                  <th className="text-left p-2 text-xs font-semibold text-slate-500 uppercase">Assigned/Week</th>
                  <th className="text-left p-2 text-xs font-semibold text-slate-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {readiness.map((r) => (
                  <tr key={r.sectionId} className="border-t border-slate-100">
                    <td className="p-2">{r.label}</td>
                    <td className="p-2">{r.totalSlots}</td>
                    <td className="p-2">{r.totalAssigned}</td>
                    <td className="p-2">
                      {r.gap === 0 && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Complete — will fill every period</span>}
                      {r.gap > 0 && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{r.gap} period(s) short — will have Free slots</span>}
                      {r.gap < 0 && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{-r.gap} period(s) over — reduce something</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!readinessLoading && (shortSections.length > 0 || overSections.length > 0) && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            {shortSections.length > 0 && (
              <p>
                <strong>{shortSections.length} section(s) are short on assigned periods.</strong> Go to the
                Assignment Table and add more subjects, or increase weekly hours, until "Assigned/Week" matches
                "Available Slots/Week" for each one.
              </p>
            )}
            {overSections.length > 0 && (
              <p className="mt-1">
                <strong>{overSections.length} section(s) are assigned more periods than they have slots for.</strong>{" "}
                Reduce some subjects' weekly hours or remove an assignment — this will otherwise show as unresolved
                conflicts after generating.
              </p>
            )}
          </div>
        )}
        {!readinessLoading && shortSections.length === 0 && overSections.length === 0 && readySections.length > 0 && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
            Every section's week is fully accounted for — generating now should fill every period with no gaps.
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm max-w-3xl">
        <p className="text-sm text-slate-600 mb-4">
          This runs the scheduler over your Assignment Table and randomly places every subject into a free,
          conflict-free slot — no teacher double-booked, no section double-booked, lab sessions kept consecutive,
          Library/Sports-type subjects always in the day's last period. Locked cells (set in "View & Edit") are
          never touched. Re-run any time to reshuffle unlocked cells.
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

            {result.sectionFillSummary && result.sectionFillSummary.some((s: any) => s.freeSlots > 0) && (
              <div className="mt-3">
                <p className="font-semibold">Sections with Free periods remaining:</p>
                <div className="mt-1 space-y-2">
                  {result.sectionFillSummary
                    .filter((s: any) => s.freeSlots > 0)
                    .map((s: any) => (
                      <div key={s.sectionId} className="bg-white border border-amber-200 rounded-lg p-2">
                        <p>
                          <strong>{s.section}</strong>: {s.placed} of {s.totalSlots} periods filled ({s.freeSlots} Free).
                          Add more assignments for this section, or fill these exact slots manually in "View & Edit":
                        </p>
                        {s.freeSlotDetails && s.freeSlotDetails.length > 0 && (
                          <ul className="list-disc list-inside mt-1 text-xs text-amber-800">
                            {s.freeSlotDetails.map((f: any, i: number) => (
                              <li key={i}>{f.day} — {f.period}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
