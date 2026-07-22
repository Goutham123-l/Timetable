import React, { useEffect, useState } from "react";
import { api } from "../api";
import { useToast } from "../components/Toast";
import UndoDeleteButton from "../components/UndoDeleteButton";

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
  const [history, setHistory] = useState<any[]>([]);
  const [prefs, setPrefs] = useState({ labsSideBySide: true, preferLastTwoPeriodsForLabs: false });
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [lastPeriodSubjectCount, setLastPeriodSubjectCount] = useState<number | null>(null);
  const toast = useToast();

  const loadReadiness = () => {
    setReadinessLoading(true);
    api.get("/timetable/readiness").then((r) => {
      setReadiness(r);
      setReadinessLoading(false);
    });
  };

  const loadHistory = () => {
    api.get("/timetable/generate/history").then(setHistory);
  };

  const loadPrefs = () => {
    setPrefsLoading(true);
    api.get("/settings/app").then((s) => {
      setPrefs({ labsSideBySide: s.labsSideBySide, preferLastTwoPeriodsForLabs: s.preferLastTwoPeriodsForLabs });
      setPrefsLoading(false);
    });
    api.get("/subjects").then((subs: any[]) => {
      setLastPeriodSubjectCount(subs.filter((s) => s.alwaysLastPeriod).length);
    });
  };

  useEffect(() => {
    loadReadiness();
    loadHistory();
    loadPrefs();
  }, []);

  async function updatePref(patch: Partial<typeof prefs>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    try {
      await api.put("/settings/app", next);
      toast.success("Preference saved.");
    } catch (e: any) {
      toast.error("Could not save preference: " + e.message);
    }
  }

  async function deleteHistoryRow(id: number) {
    await api.delete(`/timetable/generate/history/${id}`);
    loadHistory();
  }

  async function clearAllHistory() {
    await api.delete("/timetable/generate/history");
    loadHistory();
    toast.success("Generation history cleared.");
  }

  async function generate() {
    setLoading(true);
    setResult(null);
    // Keep the friendly loading state visible for at least 3 seconds even if
    // the server responds faster — avoids an abrupt flash for a process
    // that's doing real work (several internal scheduling attempts).
    const minWait = new Promise((resolve) => setTimeout(resolve, 3000));
    try {
      const [res] = await Promise.all([api.post("/timetable/generate"), minWait]);
      setResult(res);
      toast.success("Timetable generated — see details below.");
      loadReadiness();
      loadHistory();
    } catch (e: any) {
      await minWait;
      setResult({ success: false, message: e.message });
      toast.error("Generation failed — see details below.");
    } finally {
      setLoading(false);
    }
  }

  const shortSections = readiness.filter((r) => r.gap > 0);
  const overSections = readiness.filter((r) => r.gap < 0);
  const readySections = readiness.filter((r) => r.gap === 0);

  function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
    return (
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${checked ? "bg-brand-500" : "bg-slate-300 dark:bg-slate-600"}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-4">Generate Timetable</h2>

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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {readiness.map((r) => {
              const ok = r.gap === 0;
              const pct = r.totalSlots > 0 ? Math.min((r.totalAssigned / r.totalSlots) * 100, 100) : 0;
              return (
                <div
                  key={r.sectionId}
                  className={`rounded-lg border-l-4 p-4 ${
                    ok
                      ? "border-l-green-500 bg-green-50/60 dark:bg-green-500/10"
                      : r.gap > 0
                      ? "border-l-amber-500 bg-amber-50/60 dark:bg-amber-500/10"
                      : "border-l-red-500 bg-red-50/60 dark:bg-red-500/10"
                  } border border-slate-100 dark:border-slate-700`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{r.label}</span>
                    <span className={`text-xs ${ok ? "text-green-600" : r.gap > 0 ? "text-amber-600" : "text-red-600"}`}>
                      {ok ? "✓" : "⚠"}
                    </span>
                  </div>
                  <p className={`text-lg font-bold ${ok ? "text-green-700 dark:text-green-400" : r.gap > 0 ? "text-amber-700 dark:text-amber-400" : "text-red-700 dark:text-red-400"}`}>
                    {ok ? "Fully Assigned" : r.gap > 0 ? `${r.gap} period(s) short` : `${-r.gap} period(s) over`}
                  </p>
                  <div className="w-full h-1.5 bg-white/70 dark:bg-slate-800 rounded-full overflow-hidden mt-2 mb-1">
                    <div
                      className={`h-full rounded-full ${ok ? "bg-green-500" : r.gap > 0 ? "bg-amber-500" : "bg-red-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {r.totalAssigned} of {r.totalSlots} periods/week assigned
                  </p>
                </div>
              );
            })}
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

      <div className="bg-white dark:bg-slate-800 dark:border-slate-700 rounded-xl border border-slate-200 p-6 shadow-sm max-w-3xl mb-6">
        <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">Scheduling Preferences</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Same settings as Settings → Lab Arrangement — change them here right before generating, if needed.
        </p>
        {prefsLoading ? (
          <p className="text-sm text-slate-400">Loading preferences...</p>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4 py-2.5 border-t border-slate-100 dark:border-slate-700">
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Labs come together (side-by-side)</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  When on, each Lab's periods are placed as one consecutive back-to-back block. Off = separate single periods.
                </p>
              </div>
              <Toggle checked={prefs.labsSideBySide} onChange={(v) => updatePref({ labsSideBySide: v })} />
            </div>
            <div className="flex items-start justify-between gap-4 py-2.5 border-t border-slate-100 dark:border-slate-700">
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Prefer labs in the last two periods</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Tries fitting each lab into the day's last two periods (e.g. right after lunch) first — falls back
                  elsewhere if that's not free, so labs never go unplaced because of this. Only applies when the
                  toggle above is on.
                </p>
              </div>
              <Toggle checked={prefs.preferLastTwoPeriodsForLabs} onChange={(v) => updatePref({ preferLastTwoPeriodsForLabs: v })} />
            </div>
            <div className="flex items-start justify-between gap-4 py-2.5 border-t border-slate-100 dark:border-slate-700">
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Sports/Library always last period</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {lastPeriodSubjectCount === null
                    ? "Checking..."
                    : lastPeriodSubjectCount === 0
                    ? "No subjects currently marked this way."
                    : `${lastPeriodSubjectCount} subject${lastPeriodSubjectCount === 1 ? " is" : "s are"} currently marked "Always last period."`}
                  {" "}This is set per-subject on the Subjects tab (tick "Always last period" on Library, Sports, etc.), not a single on/off switch here.
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm max-w-3xl">
        <p className="text-sm text-slate-600 mb-4">
          This runs the scheduler over your Assignment Table and randomly places every subject into a free,
          conflict-free slot — no teacher double-booked, no section double-booked, lab sessions kept consecutive,
          Library/Sports-type subjects always in the day's last period, and any teacher's "busy elsewhere" slots
          (set on the Teachers tab) always skipped. It automatically tries several arrangements internally on every
          click and keeps the best one — so one click is usually enough instead of needing to re-run it by hand.
          Locked cells (set in "View & Edit") are never touched.
        </p>
        <button
          onClick={generate}
          disabled={loading}
          className="bg-brand-500 hover:bg-brand-600 text-white font-medium px-6 py-2.5 rounded-lg disabled:opacity-70 flex items-center gap-2"
        >
          {loading && (
            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          )}
          {loading ? "Generating..." : "Generate Timetable"}
        </button>

        {loading && (
          <div className="mt-4 flex items-center gap-3 bg-brand-50 dark:bg-slate-700 border border-brand-100 dark:border-slate-600 rounded-lg p-4">
            <span className="w-8 h-8 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">We're preparing your timetable...</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Trying several arrangements and keeping the best one — just a few seconds.</p>
            </div>
          </div>
        )}

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

      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm max-w-3xl mt-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-800">Generation History</h3>
          {history.length > 0 && (
            <UndoDeleteButton label="all generation history" onConfirm={clearAllHistory} size="sm" />
          )}
        </div>
        {history.length === 0 ? (
          <p className="text-sm text-slate-400">No generations recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/40">
                  <th className="text-left p-2 text-xs font-semibold text-slate-500 uppercase">#</th>
                  <th className="text-left p-2 text-xs font-semibold text-slate-500 uppercase">Date &amp; Time</th>
                  <th className="text-left p-2 text-xs font-semibold text-slate-500 uppercase">By</th>
                  <th className="text-left p-2 text-xs font-semibold text-slate-500 uppercase">Periods Placed</th>
                  <th className="text-left p-2 text-xs font-semibold text-slate-500 uppercase">Conflicts</th>
                  <th className="text-left p-2 text-xs font-semibold text-slate-500 uppercase">Free Slots</th>
                  <th className="text-left p-2 text-xs font-semibold text-slate-500 uppercase">Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={h.id} className={`border-t border-slate-100 dark:border-slate-700 ${i === 0 ? "bg-brand-50/50 dark:bg-brand-500/5" : ""}`}>
                    <td className="p-2 text-slate-400">{history.length - i}</td>
                    <td className="p-2">{new Date(h.createdAt).toLocaleString()}</td>
                    <td className="p-2">{h.triggeredBy || "—"}</td>
                    <td className="p-2">{h.entriesCreated}</td>
                    <td className="p-2">
                      {h.conflictsCount > 0 ? (
                        <span className="text-red-600">{h.conflictsCount}</span>
                      ) : (
                        <span className="text-green-600">0</span>
                      )}
                    </td>
                    <td className="p-2">
                      {h.freeSlotsCount > 0 ? (
                        <span className="text-amber-600">{h.freeSlotsCount}</span>
                      ) : (
                        <span className="text-green-600">0</span>
                      )}
                    </td>
                    <td className="p-2">
                      {i === 0 && (
                        <span className="text-[10px] font-semibold bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300 px-2 py-0.5 rounded-full mr-2">
                          CURRENT
                        </span>
                      )}
                    </td>
                    <td className="p-2">
                      <button onClick={() => deleteHistoryRow(h.id)} className="text-red-500 text-xs font-medium">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
