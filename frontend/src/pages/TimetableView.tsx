import React, { useEffect, useState } from "react";
import { api, downloadFile } from "../api";
import TimetableGrid from "../components/TimetableGrid";
import { useToast } from "../components/Toast";
import UndoDeleteButton from "../components/UndoDeleteButton";

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
  }

  useEffect(() => {
    if (selectedId) loadEntries(selectedId, viewType);
  }, [selectedId, viewType]);

  function clearSelection() {
    setSelectedEntry(null);
    setCellStatus({});
    setPickerMessage("");
  }

  async function selectEntry(entry: any) {
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

  const validCount = Object.values(cellStatus).filter((s) => s.valid).length;

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-4">View & Edit Timetables</h2>

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

      {!selectedEntry && (
        <p className="text-xs text-slate-500 mb-3">
          Click any period below to select it — available periods to move or swap it into will light up in green.
        </p>
      )}

      {selectedEntry && (
        <div className="bg-brand-50 border border-brand-200 rounded-lg p-3 mb-4 text-sm">
          <div className="flex items-center gap-3 flex-wrap mb-2">
            <span>
              Selected: <strong>{selectedEntry.subject?.name}</strong>
            </span>
            <button onClick={toggleLock} className="bg-white border border-slate-300 px-3 py-1 rounded text-xs">
              {selectedEntry.locked ? "Unlock" : "Lock"} cell
            </button>
            <UndoDeleteButton label="this period" onConfirm={removeEntry} size="sm" />
            <button onClick={clearSelection} className="text-slate-500 text-xs underline">
              Cancel selection
            </button>
          </div>

          {viewType === "section" && (
            <>
              {loadingOptions ? (
                <p className="text-xs text-slate-500">Checking available periods…</p>
              ) : (
                <div className="flex items-center gap-4 text-xs text-slate-600 flex-wrap">
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
                <div className="mt-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded px-2 py-1.5">
                  {pickerMessage}
                </div>
              )}
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
    </div>
  );
}
