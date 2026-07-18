import React, { useEffect, useState } from "react";
import { api, downloadFile } from "../api";
import TimetableGrid from "../components/TimetableGrid";

export default function TimetableView() {
  const [viewType, setViewType] = useState<"section" | "teacher">("section");
  const [sections, setSections] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<number | "">("");
  const [days, setDays] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [message, setMessage] = useState("");

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
  }

  useEffect(() => {
    if (selectedId) loadEntries(selectedId, viewType);
  }, [selectedId, viewType]);

  async function handleCellClick(entry: any, dayId: number, periodId: number) {
    setMessage("");
    if (!selectedEntry) {
      if (entry) setSelectedEntry(entry);
      return;
    }
    if (entry && entry.id === selectedEntry.id) {
      setSelectedEntry(null);
      return;
    }
    if (entry) {
      // swap two occupied cells
      try {
        await api.post("/timetable/swap", { entryIdA: selectedEntry.id, entryIdB: entry.id });
        setMessage("Swapped successfully.");
      } catch (e: any) {
        setMessage(e.message);
      }
    } else {
      // move selected entry into empty cell
      try {
        await api.put(`/timetable/entry/${selectedEntry.id}`, { dayId, periodId });
        setMessage("Moved successfully.");
      } catch (e: any) {
        setMessage(e.message);
      }
    }
    setSelectedEntry(null);
    loadEntries(selectedId, viewType);
  }

  async function toggleLock() {
    if (!selectedEntry) return;
    await api.put(`/timetable/entry/${selectedEntry.id}`, { locked: !selectedEntry.locked });
    setSelectedEntry(null);
    loadEntries(selectedId, viewType);
  }

  async function removeEntry() {
    if (!selectedEntry) return;
    if (!confirm("Remove this period from the timetable?")) return;
    await api.delete(`/timetable/entry/${selectedEntry.id}`);
    setSelectedEntry(null);
    loadEntries(selectedId, viewType);
  }

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
          <button onClick={() => downloadFile(`/export/excel/section/${selectedId}`, "timetable.xlsx")} className="bg-slate-800 text-white text-sm px-4 py-2 rounded-lg">
            Export Excel
          </button>
        )}
        {selectedId && viewType === "teacher" && (
          <button onClick={() => downloadFile(`/export/excel/teacher/${selectedId}`, "teacher_timetable.xlsx")} className="bg-slate-800 text-white text-sm px-4 py-2 rounded-lg">
            Export Excel
          </button>
        )}
      </div>

      {message && <div className="bg-amber-50 text-amber-800 text-sm p-2 rounded mb-3">{message}</div>}

      {selectedEntry && (
        <div className="bg-brand-50 border border-brand-200 rounded-lg p-3 mb-4 text-sm flex items-center gap-3 flex-wrap">
          <span>
            Selected: <strong>{selectedEntry.subject?.name}</strong> — click another cell to move/swap it.
          </span>
          <button onClick={toggleLock} className="bg-white border border-slate-300 px-3 py-1 rounded text-xs">
            {selectedEntry.locked ? "Unlock" : "Lock"} cell
          </button>
          <button onClick={removeEntry} className="bg-white border border-red-300 text-red-600 px-3 py-1 rounded text-xs">
            Remove period
          </button>
          <button onClick={() => setSelectedEntry(null)} className="text-slate-500 text-xs underline">
            Cancel selection
          </button>
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
        />
      ) : (
        <p className="text-slate-400 text-sm">Select a section or teacher above to view their timetable.</p>
      )}
    </div>
  );
}
