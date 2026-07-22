import React, { useEffect, useState } from "react";
import { api, downloadFile } from "../api";
import TimetableGrid from "../components/TimetableGrid";
import { useToast } from "../components/Toast";

export default function TimetableView() {
  const [viewType, setViewType] = useState<"section" | "teacher">("section");
  const [sections, setSections] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<number | "">("");
  const [days, setDays] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [cellStatus, setCellStatus] = useState<Record<string, { valid: boolean; type: "move" | "swap"; reason?: string | null }>>({});
  const [pickerMessage, setPickerMessage] = useState("");
  const [loadingOptions, setLoadingOptions] = useState(false);
  const toast = useToast();

  // Manual placement into an empty cell — only meaningful in section view.
  const [sectionAssignments, setSectionAssignments] = useState<any[]>([]);
  const [placingSlot, setPlacingSlot] = useState<{ dayId: number; periodId: number } | null>(null);
  const [lockNewPlacement, setLockNewPlacement] = useState(true);

  // Smart Arrange (Generate), embedded right here so manual placement and
  // auto-generation live on the same page.
  const [generating, setGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<any>(null);

  useEffect(() => {
    api.get("/sections").then(setSections);
    api.get("/teachers").then(setTeachers);
    api.get("/settings/days").then((d) => setDays(d.filter((x: any) => x.active)));
    api.get("/settings/periods").then(setPeriods);
  }, []);

  async function loadEntries(id: number | "", type: "section" | "teacher") {
    if (!id) return;
    const data = await api.get(`/timetable/${type}/${id}`);
    setEntries(data);
    setSelectedEntry(null);
    setCellStatus({});
    setPickerMessage("");
    setPlacingSlot(null);
    if (type === "section") {
      api.get(`/assignments?sectionId=${id}`).then(setSectionAssignments);
    }
  }

  useEffect(() => {
    if (selectedId) loadEntries(selectedId, viewType);
  }, [selectedId, viewType]);

  function clearSelection() {
    setSelectedEntry(null);
    setCellStatus({});
    setPickerMessage("");
    setPlacingSlot(null);
  }

  async function selectEntry(entry: any) {
    setPlacingSlot(null);
    if (viewType !== "section") {
      // Teacher view stays as simple select-then-click (spans multiple
      // sections, so the rich preview doesn't apply there).
      setSelectedEntry(entry);
      return;
    }
    setSelectedEntry(entry);
    setPickerMessage("");
    setLoadingOptions(true);
    try {
      const res = await api.get(`/timetable/swap-options/${entry.id}`);
      if (res.locked) {
        setPickerMessage(res.message);
        setCellStatus({});
      } else {
        const map: Record<string, any> = {};
        res.options.forEach((o: any) => {
          map[`${o.dayId}-${o.periodId}`] = { valid: o.valid, type: o.type, reason: o.reason };
        });
        setCellStatus(map);
      }
    } finally {
      setLoadingOptions(false);
    }
  }

  async function handleCellClick(entry: any, dayId: number, periodId: number) {
    // Nothing selected yet, and this is an empty cell → offer manual
    // placement instead of doing nothing.
    if (!selectedEntry && !entry) {
      if (viewType === "section") {
        setPlacingSlot({ dayId, periodId });
      }
      return;
    }
    if (!selectedEntry) {
      if (entry) selectEntry(entry);
      return;
    }
    if (entry && entry.id === selectedEntry.id) {
      clearSelection();
      return;
    }

    if (viewType === "section") {
      const status = cellStatus[`${dayId}-${periodId}`];
      if (!status) return; // shouldn't happen for a real target cell
      if (!status.valid) {
        setPickerMessage(status.reason || "That period isn't available.");
        return; // keep selection active so they can pick another green cell
      }
    }

    if (entry) {
      try {
        await api.post("/timetable/swap", { entryIdA: selectedEntry.id, entryIdB: entry.id });
        toast.success("Swapped successfully.");
      } catch (e: any) {
        toast.error(e.message);
      }
    } else {
      try {
        await api.put(`/timetable/entry/${selectedEntry.id}`, { dayId, periodId });
        toast.success("Moved successfully.");
      } catch (e: any) {
        toast.error(e.message);
      }
    }
    clearSelection();
    loadEntries(selectedId, viewType);
  }

  async function placeManualEntry(assignmentId: number) {
    if (!placingSlot) return;
    try {
      await api.post("/timetable/entry", {
        assignmentId,
        dayId: placingSlot.dayId,
        periodId: placingSlot.periodId,
        locked: lockNewPlacement,
      });
      toast.success(lockNewPlacement ? "Placed and locked — Smart Arrange will build around it." : "Placed.");
      setPlacingSlot(null);
      loadEntries(selectedId, viewType);
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function toggleLock() {
    if (!selectedEntry) return;
    await api.put(`/timetable/entry/${selectedEntry.id}`, { locked: !selectedEntry.locked });
    toast.success(selectedEntry.locked ? "Unlocked." : "Locked — this period will be skipped by future regenerations.");
    clearSelection();
    loadEntries(selectedId, viewType);
  }

  async function removeEntry() {
    if (!selectedEntry) return;
    await api.delete(`/timetable/entry/${selectedEntry.id}`);
    toast.success("Period removed.");
    clearSelection();
    loadEntries(selectedId, viewType);
  }

  async function generate() {
    setGenerating(true);
    setGenerateResult(null);
    const minWait = new Promise((resolve) => setTimeout(resolve, 3000));
    try {
      const [res] = await Promise.all([api.post("/timetable/generate"), minWait]);
      setGenerateResult(res);
      toast.success("Smart Arrange complete.");
      loadEntries(selectedId, viewType);
    } catch (e: any) {
      await minWait;
      setGenerateResult({ success: false, message: e.message });
      toast.error("Smart Arrange failed.");
    } finally {
      setGenerating(false);
    }
  }

  const validCount = Object.values(cellStatus).filter((s) => s.valid).length;

  // Remaining periods/week still needed for each assignment in this
  // section, based on what's already placed — shown as a hint in the
  // manual-placement picker so it's clear what's still left to fill.
  function remainingFor(a: any) {
    const placed = entries.filter((e) => e.subjectId === a.subjectId && e.teacherId === a.teacherId).length;
    return a.periodsPerWeek - placed;
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-1">View & Edit Timetables</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Manual arranging and Smart Arrange live together here: click an empty period to hand-place a specific class,
        lock the ones you want fixed, then click <strong>Smart Arrange</strong> below to automatically fill
        everything else — it builds around whatever you've already placed and locked, and randomizes the rest.
      </p>

      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <select
          className="border rounded-lg px-3 py-2 text-sm"
          value={viewType}
          onChange={(e) => {
            setViewType(e.target.value as any);
            setSelectedId("");
            setEntries([]);
          }}
        >
          <option value="section">By Section (Student view)</option>
          <option value="teacher">By Teacher</option>
        </select>

        <select className="border rounded-lg px-3 py-2 text-sm" value={selectedId} onChange={(e) => setSelectedId(Number(e.target.value))}>
          <option value="">Select {viewType === "section" ? "Section" : "Teacher"}</option>
          {viewType === "section"
            ? sections.map((s) => <option key={s.id} value={s.id}>{s.department?.code} {s.name} (Yr {s.year})</option>)
            : teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>

        {selectedId && viewType === "section" && (
          <>
            <button onClick={() => downloadFile(`/export/pdf/section/${selectedId}`, "timetable.pdf")} className="bg-brand-500 text-white text-sm px-4 py-2 rounded-lg">
              Export PDF
            </button>
            <button onClick={() => downloadFile(`/export/excel/section/${selectedId}`, "timetable.xlsx")} className="bg-slate-800 text-white text-sm px-4 py-2 rounded-lg">
              Export Excel
            </button>
          </>
        )}
        {selectedId && viewType === "teacher" && (
          <>
            <button onClick={() => downloadFile(`/export/pdf/teacher/${selectedId}`, "teacher_timetable.pdf")} className="bg-brand-500 text-white text-sm px-4 py-2 rounded-lg">
              Export PDF
            </button>
            <button onClick={() => downloadFile(`/export/excel/teacher/${selectedId}`, "teacher_timetable.xlsx")} className="bg-slate-800 text-white text-sm px-4 py-2 rounded-lg">
              Export Excel
            </button>
          </>
        )}
      </div>

      {!selectedEntry && !placingSlot && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          Click a <strong>filled</strong> period to move/swap it — available targets light up green. Click an{" "}
          <strong>empty</strong> period to hand-place a class there.
        </p>
      )}

      {selectedEntry && (
        <div className="bg-brand-50 dark:bg-slate-800 border border-brand-200 dark:border-slate-700 rounded-lg p-3 mb-4 text-sm">
          <div className="flex items-center gap-3 flex-wrap mb-2">
            <span className="dark:text-slate-100">
              Selected: <strong>{selectedEntry.subject?.name}</strong>
            </span>
            <button onClick={toggleLock} className="bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 dark:text-slate-100 px-3 py-1 rounded text-xs">
              {selectedEntry.locked ? "Unlock" : "Lock"} cell
            </button>
            <button onClick={removeEntry} className="bg-white dark:bg-slate-700 border border-red-300 text-red-600 px-3 py-1 rounded text-xs">
              Remove period
            </button>
            <button onClick={clearSelection} className="text-slate-500 dark:text-slate-400 text-xs underline">
              Cancel selection
            </button>
          </div>

          {viewType === "section" && (
            <>
              {loadingOptions ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">Checking available periods…</p>
              ) : (
                <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-300 flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded ring-2 ring-green-500 bg-green-50 inline-block" />
                    Available — click to move/swap here ({validCount} option{validCount === 1 ? "" : "s"})
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-slate-200 opacity-50 inline-block" />
                    Not available — click to see why
                  </span>
                </div>
              )}
              {pickerMessage && (
                <div className="mt-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs rounded px-2 py-1.5">
                  {pickerMessage}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {placingSlot && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 mb-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-sm text-slate-800 dark:text-slate-100">Place a class in this empty period</h4>
            <button onClick={() => setPlacingSlot(null)} className="text-slate-500 dark:text-slate-400 text-xs underline">
              Cancel
            </button>
          </div>
          {sectionAssignments.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              This section has no rows on the Assignment Table yet — add some there first.
            </p>
          ) : (
            <>
              <div className="max-h-56 overflow-y-auto space-y-1.5">
                {sectionAssignments
                  .slice()
                  .sort((a, b) => remainingFor(b) - remainingFor(a))
                  .map((a) => {
                    const remaining = remainingFor(a);
                    return (
                      <button
                        key={a.id}
                        onClick={() => placeManualEntry(a.id)}
                        className="w-full flex items-center justify-between text-left text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 hover:bg-brand-50 dark:hover:bg-slate-700"
                      >
                        <span className="text-slate-800 dark:text-slate-100">
                          {a.subject?.name} <span className="text-slate-400">— {a.teacher?.name}</span>
                        </span>
                        <span className={`text-xs ${remaining > 0 ? "text-slate-500" : "text-amber-600"}`}>
                          {remaining > 0 ? `${remaining} left this week` : "already fully placed"}
                        </span>
                      </button>
                    );
                  })}
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 mt-3">
                <input type="checkbox" checked={lockNewPlacement} onChange={(e) => setLockNewPlacement(e.target.checked)} />
                Lock this placement (recommended — keeps Smart Arrange from moving it)
              </label>
            </>
          )}
        </div>
      )}

      {selectedId ? (
        <TimetableGrid
          days={days}
          periods={periods}
          entries={entries}
          mode={viewType}
          editable={true}
          selectedId={selectedEntry?.id}
          onCellClick={handleCellClick}
          cellStatus={viewType === "section" ? cellStatus : undefined}
        />
      ) : (
        <p className="text-slate-400 text-sm">Select a section or teacher above to view their timetable.</p>
      )}

      <div className="bg-white dark:bg-slate-800 dark:border-slate-700 rounded-xl border border-slate-200 p-5 shadow-sm mt-6">
        <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">Smart Arrange</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
          Runs the same generator as the Generate Timetable page — tries several randomized arrangements and keeps
          the best one, filling every period it can while never touching anything you've locked above. Safe to run
          any time, for every section at once.
        </p>
        <button
          onClick={generate}
          disabled={generating}
          className="bg-brand-500 hover:bg-brand-600 text-white font-medium px-5 py-2 rounded-lg disabled:opacity-70 flex items-center gap-2"
        >
          {generating && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
          {generating ? "Arranging..." : "Smart Arrange"}
        </button>

        {generating && (
          <div className="mt-4 flex items-center gap-3 bg-brand-50 dark:bg-slate-700 border border-brand-100 dark:border-slate-600 rounded-lg p-4">
            <span className="w-8 h-8 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Building around your manual placements...</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Just a few seconds.</p>
            </div>
          </div>
        )}

        {generateResult && (
          <div className={`mt-4 p-3 rounded-lg text-sm ${generateResult.success ? "bg-green-50 dark:bg-green-500/10 text-green-800 dark:text-green-300" : "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300"}`}>
            {generateResult.message}
          </div>
        )}
      </div>
    </div>
  );
}
