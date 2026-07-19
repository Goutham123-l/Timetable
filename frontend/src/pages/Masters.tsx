import React, { useEffect, useState } from "react";
import { api } from "../api";

type Tab = "departments" | "sections" | "subjects" | "teachers" | "classrooms" | "days" | "periods";

export default function Masters() {
  const [tab, setTab] = useState<Tab>("departments");

  const tabs: { key: Tab; label: string }[] = [
    { key: "departments", label: "Departments" },
    { key: "sections", label: "Sections" },
    { key: "subjects", label: "Subjects" },
    { key: "teachers", label: "Teachers" },
    { key: "classrooms", label: "Classrooms" },
    { key: "days", label: "Working Days" },
    { key: "periods", label: "Periods" },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-4">Master Data</h2>
      <div className="flex gap-2 mb-5 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium ${
              tab === t.key ? "bg-brand-500 text-white" : "bg-white border border-slate-200 text-slate-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "departments" && <Departments />}
      {tab === "sections" && <Sections />}
      {tab === "subjects" && <Subjects />}
      {tab === "teachers" && <Teachers />}
      {tab === "classrooms" && <Classrooms />}
      {tab === "days" && <WorkingDays />}
      {tab === "periods" && <Periods />}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">{children}</div>;
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="text-left p-2 text-xs font-semibold text-slate-500 uppercase">{children}</th>;
}
function Td({ children }: { children?: React.ReactNode }) {
  return <td className="p-2 border-t border-slate-100 text-sm">{children}</td>;
}
function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex gap-3">
      <button onClick={onEdit} className="text-brand-600 text-xs font-medium">Edit</button>
      <button onClick={onDelete} className="text-red-500 text-xs font-medium">Delete</button>
    </div>
  );
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative mb-3">
      <input
        className="border rounded-lg px-3 py-2 pl-8 text-sm w-full max-w-xs"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="absolute left-2.5 top-2.5 text-slate-400 text-sm">🔍</span>
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-sm"
        >
          ×
        </button>
      )}
    </div>
  );
}

// Tries a normal delete. If the backend reports the item is in use (409),
// offers to force-delete (which also removes/unlinks the dependent records)
// instead of just showing a dead-end error.
async function smartDelete(path: string, confirmMessage: string) {
  if (!confirm(confirmMessage)) return false;
  try {
    await api.delete(path);
    return true;
  } catch (e: any) {
    if (e.inUse) {
      const proceed = confirm(
        `${e.message}\n\nDelete anyway? This will also remove those related records.`
      );
      if (proceed) {
        await api.delete(`${path}?force=true`);
        return true;
      }
      return false;
    }
    alert(e.message || "Delete failed");
    return false;
  }
}

// ---------------- Departments ----------------
function Departments() {
  const [items, setItems] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const load = () => api.get("/departments").then(setItems);
  useEffect(() => {
    load();
  }, []);

  function startEdit(d: any) {
    setEditingId(d.id);
    setName(d.name);
    setCode(d.code);
  }
  function resetForm() {
    setEditingId(null);
    setName("");
    setCode("");
  }

  async function save() {
    if (!name || !code) return;
    if (editingId) {
      await api.put(`/departments/${editingId}`, { name, code });
    } else {
      await api.post("/departments", { name, code });
    }
    resetForm();
    load();
  }
  async function remove(id: number) {
    const ok = await smartDelete(`/departments/${id}`, "Delete this department?");
    if (ok) load();
  }

  const filtered = items.filter(
    (d) => d.name.toLowerCase().includes(search.toLowerCase()) || d.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card>
      <SearchBox value={search} onChange={setSearch} placeholder="Search departments by name or code..." />
      <div className="flex gap-2 mb-4 items-center">
        <input className="border rounded-lg px-3 py-2 text-sm flex-1" placeholder="Department name (e.g. Computer Science)" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="border rounded-lg px-3 py-2 text-sm w-32" placeholder="Code (CSE)" value={code} onChange={(e) => setCode(e.target.value)} />
        <button onClick={save} className="bg-brand-500 text-white px-4 py-2 rounded-lg text-sm">{editingId ? "Update" : "Add"}</button>
        {editingId && <button onClick={resetForm} className="text-slate-500 text-xs underline">Cancel</button>}
      </div>
      <table className="w-full">
        <thead><tr><Th>Name</Th><Th>Code</Th><Th></Th></tr></thead>
        <tbody>
          {filtered.map((d) => (
            <tr key={d.id}>
              <Td>{d.name}</Td>
              <Td>{d.code}</Td>
              <Td><RowActions onEdit={() => startEdit(d)} onDelete={() => remove(d.id)} /></Td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr><td colSpan={3} className="p-4 text-center text-slate-400 text-sm">No departments match "{search}".</td></tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}

// ---------------- Sections ----------------
function Sections() {
  const [items, setItems] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [allDays, setAllDays] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [year, setYear] = useState(1);
  const [departmentId, setDepartmentId] = useState<number | "">("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [daysOffMap, setDaysOffMap] = useState<Record<number, Set<number>>>({});
  const [expandedSection, setExpandedSection] = useState<number | null>(null);

  const load = () => api.get("/sections").then(setItems);
  useEffect(() => {
    load();
    api.get("/departments").then(setDepartments);
    api.get("/settings/days").then(setAllDays);
  }, []);

  function startEdit(s: any) {
    setEditingId(s.id);
    setName(s.name);
    setYear(s.year);
    setDepartmentId(s.departmentId);
  }
  function resetForm() {
    setEditingId(null);
    setName("");
    setYear(1);
    setDepartmentId("");
  }

  async function save() {
    if (!name || !departmentId) return;
    if (editingId) {
      await api.put(`/sections/${editingId}`, { name, year, departmentId });
    } else {
      await api.post("/sections", { name, year, departmentId });
    }
    resetForm();
    load();
  }
  async function remove(id: number) {
    const ok = await smartDelete(`/sections/${id}`, "Delete this section?");
    if (ok) load();
  }

  async function loadDaysOff(sectionId: number) {
    const rows = await api.get(`/sections/${sectionId}/days-off`);
    setDaysOffMap((prev) => ({ ...prev, [sectionId]: new Set(rows.map((r: any) => r.dayId)) }));
  }

  async function toggleExpand(sectionId: number) {
    if (expandedSection === sectionId) {
      setExpandedSection(null);
      return;
    }
    setExpandedSection(sectionId);
    if (!daysOffMap[sectionId]) await loadDaysOff(sectionId);
  }

  async function toggleDayOff(sectionId: number, dayId: number, isOff: boolean) {
    if (isOff) {
      await api.delete(`/sections/${sectionId}/days-off/${dayId}`);
    } else {
      await api.post(`/sections/${sectionId}/days-off`, { dayId });
    }
    loadDaysOff(sectionId);
  }

  return (
    <Card>
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <select className="border rounded-lg px-3 py-2 text-sm" value={departmentId} onChange={(e) => setDepartmentId(Number(e.target.value))}>
          <option value="">Department</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.code}</option>)}
        </select>
        <input className="border rounded-lg px-3 py-2 text-sm w-24" placeholder="Section (A)" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="border rounded-lg px-3 py-2 text-sm w-24" type="number" min={1} max={4} placeholder="Year" value={year} onChange={(e) => setYear(Number(e.target.value))} />
        <button onClick={save} className="bg-brand-500 text-white px-4 py-2 rounded-lg text-sm">{editingId ? "Update" : "Add"}</button>
        {editingId && <button onClick={resetForm} className="text-slate-500 text-xs underline">Cancel</button>}
      </div>

      <p className="text-xs text-slate-500 mb-3">
        Click <strong>Off-days</strong> on any section to mark days it doesn't have classes (e.g. CSE 3rd Year skips Saturday
        while other sections still have it) — the generator will never place anything for that section on marked days.
      </p>

      <table className="w-full">
        <thead><tr><Th>Section</Th><Th>Year</Th><Th>Department</Th><Th></Th></tr></thead>
        <tbody>
          {items.map((s) => (
            <React.Fragment key={s.id}>
              <tr>
                <Td>{s.name}</Td>
                <Td>{s.year}</Td>
                <Td>{s.department?.code}</Td>
                <Td>
                  <div className="flex gap-3 items-center">
                    <button onClick={() => toggleExpand(s.id)} className="text-slate-600 text-xs font-medium underline">
                      {expandedSection === s.id ? "Hide off-days" : "Off-days"}
                    </button>
                    <RowActions onEdit={() => startEdit(s)} onDelete={() => remove(s.id)} />
                  </div>
                </Td>
              </tr>
              {expandedSection === s.id && (
                <tr>
                  <td colSpan={4} className="p-3 bg-slate-50 border-t border-slate-100">
                    <div className="flex gap-2 flex-wrap">
                      {allDays.map((d) => {
                        const isOff = daysOffMap[s.id]?.has(d.id) || false;
                        return (
                          <button
                            key={d.id}
                            onClick={() => toggleDayOff(s.id, d.id, isOff)}
                            className={`text-xs px-3 py-1.5 rounded-full border ${
                              isOff ? "bg-red-100 border-red-300 text-red-700" : "bg-white border-slate-300 text-slate-600"
                            }`}
                          >
                            {d.name} {isOff ? "(Off)" : ""}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

// ---------------- Subjects ----------------
function Subjects() {
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", code: "", type: "THEORY", weeklyHours: 3, year: "" as number | "", alwaysLastPeriod: false });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const load = () => api.get("/subjects").then(setItems);
  useEffect(() => {
    load();
  }, []);

  function startEdit(s: any) {
    setEditingId(s.id);
    setForm({ name: s.name, code: s.code, type: s.type, weeklyHours: s.weeklyHours, year: s.year || "", alwaysLastPeriod: !!s.alwaysLastPeriod });
  }
  function resetForm() {
    setEditingId(null);
    setForm({ name: "", code: "", type: "THEORY", weeklyHours: 3, year: "", alwaysLastPeriod: false });
  }

  async function save() {
    if (!form.name || !form.code) return;
    if (editingId) {
      await api.put(`/subjects/${editingId}`, form);
    } else {
      await api.post("/subjects", form);
    }
    resetForm();
    load();
  }
  async function remove(id: number) {
    const ok = await smartDelete(`/subjects/${id}`, "Delete this subject?");
    if (ok) load();
  }

  // Group subjects by year so 1st/2nd/3rd/4th year curricula are clearly separated
  const filteredItems = items.filter(
    (s) => s.name.toLowerCase().includes(search.toLowerCase()) || s.code.toLowerCase().includes(search.toLowerCase())
  );
  const groups: Record<string, any[]> = { "1": [], "2": [], "3": [], "4": [], common: [] };
  for (const s of filteredItems) {
    const key = s.year ? String(s.year) : "common";
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  }
  const groupLabels: Record<string, string> = { "1": "1st Year", "2": "2nd Year", "3": "3rd Year", "4": "4th Year", common: "Common / Any Year" };

  return (
    <Card>
      <p className="text-xs text-slate-500 mb-3">
        Tick <strong>"Always last period"</strong> for subjects like Library or Sports — every one of its weekly
        sessions (set via Weekly Hrs, or per-section on the Assignment page) will land in the single last teaching
        period of a day, spread across different days as needed. It never appears anywhere else in the timetable.
      </p>
      <SearchBox value={search} onChange={setSearch} placeholder="Search subjects by name or code..." />
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Subject name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="border rounded-lg px-3 py-2 text-sm w-32" placeholder="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
        <select className="border rounded-lg px-3 py-2 text-sm" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value ? Number(e.target.value) : "" })}>
          <option value="">Year (any)</option>
          <option value="1">1st Year</option>
          <option value="2">2nd Year</option>
          <option value="3">3rd Year</option>
          <option value="4">4th Year</option>
        </select>
        <select className="border rounded-lg px-3 py-2 text-sm" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
          <option value="THEORY">Theory</option>
          <option value="LAB">Lab</option>
        </select>
        <input className="border rounded-lg px-3 py-2 text-sm w-28" type="number" placeholder="Weekly hrs" value={form.weeklyHours} onChange={(e) => setForm({ ...form, weeklyHours: Number(e.target.value) })} />
        <label className="text-xs flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          <input type="checkbox" checked={form.alwaysLastPeriod} onChange={(e) => setForm({ ...form, alwaysLastPeriod: e.target.checked })} />
          Always last period (e.g. Library, Sports)
        </label>
        <button onClick={save} className="bg-brand-500 text-white px-4 py-2 rounded-lg text-sm">{editingId ? "Update" : "Add"}</button>
        {editingId && <button onClick={resetForm} className="text-slate-500 text-xs underline">Cancel</button>}
      </div>

      {Object.keys(groupLabels).map((key) =>
        groups[key].length > 0 ? (
          <div key={key} className="mb-5">
            <h4 className="text-xs font-semibold text-slate-500 uppercase mb-1.5">{groupLabels[key]}</h4>
            <table className="w-full">
              <thead><tr><Th>Name</Th><Th>Code</Th><Th>Type</Th><Th>Weekly Hrs</Th><Th></Th></tr></thead>
              <tbody>
                {groups[key].map((s) => (
                  <tr key={s.id}>
                    <Td>
                      {s.name}
                      {s.alwaysLastPeriod && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded ml-1">Last period</span>
                      )}
                    </Td>
                    <Td>{s.code}</Td>
                    <Td>{s.type}</Td>
                    <Td>{s.weeklyHours}</Td>
                    <Td><RowActions onEdit={() => startEdit(s)} onDelete={() => remove(s.id)} /></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null
      )}
      {filteredItems.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-4">No subjects match "{search}".</p>
      )}
    </Card>
  );
}

// ---------------- Teachers ----------------
function Teachers() {
  const [items, setItems] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", departmentId: "", designation: "" });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [expandedTeacher, setExpandedTeacher] = useState<number | null>(null);
  const [assignmentsMap, setAssignmentsMap] = useState<Record<number, any[]>>({});
  const [busySlotsMap, setBusySlotsMap] = useState<Record<number, any[]>>({});
  const [busyForm, setBusyForm] = useState({ dayId: "", periodId: "", note: "" });
  const [allDays, setAllDays] = useState<any[]>([]);
  const [allPeriods, setAllPeriods] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");

  const load = () => api.get("/teachers").then(setItems);
  useEffect(() => {
    load();
    api.get("/departments").then(setDepartments);
    api.get("/settings/days").then((d) => setAllDays(d.filter((x: any) => x.active)));
    api.get("/settings/periods").then((p) => setAllPeriods(p.filter((x: any) => !x.isLunch)));
  }, []);

  function startEdit(t: any) {
    setEditingId(t.id);
    setForm({
      name: t.name,
      departmentId: String(t.departmentId),
      designation: t.designation || "",
    });
  }
  function resetForm() {
    setEditingId(null);
    setForm({ name: "", departmentId: "", designation: "" });
  }

  async function save() {
    if (!form.name || !form.departmentId) return;
    if (editingId) {
      await api.put(`/teachers/${editingId}`, form);
    } else {
      await api.post("/teachers", form);
    }
    resetForm();
    load();
  }
  async function remove(id: number) {
    const ok = await smartDelete(`/teachers/${id}`, "Delete this teacher?");
    if (ok) load();
  }

  async function toggleExpand(teacherId: number) {
    if (expandedTeacher === teacherId) {
      setExpandedTeacher(null);
      return;
    }
    setExpandedTeacher(teacherId);
    if (!assignmentsMap[teacherId]) {
      const rows = await api.get(`/assignments?teacherId=${teacherId}`);
      setAssignmentsMap((prev) => ({ ...prev, [teacherId]: rows }));
    }
    if (!busySlotsMap[teacherId]) {
      const rows = await api.get(`/teachers/${teacherId}/busy-slots`);
      setBusySlotsMap((prev) => ({ ...prev, [teacherId]: rows }));
    }
  }

  async function addBusySlot(teacherId: number) {
    if (!busyForm.dayId || !busyForm.periodId) return;
    try {
      await api.post(`/teachers/${teacherId}/busy-slots`, busyForm);
      const rows = await api.get(`/teachers/${teacherId}/busy-slots`);
      setBusySlotsMap((prev) => ({ ...prev, [teacherId]: rows }));
      setBusyForm({ dayId: "", periodId: "", note: "" });
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function removeBusySlot(teacherId: number, slotId: number) {
    await api.delete(`/teachers/${teacherId}/busy-slots/${slotId}`);
    const rows = await api.get(`/teachers/${teacherId}/busy-slots`);
    setBusySlotsMap((prev) => ({ ...prev, [teacherId]: rows }));
  }

  const filtered = items.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.designation || "").toLowerCase().includes(search.toLowerCase());
    const matchesDept = !filterDept || String(t.departmentId) === filterDept;
    return matchesSearch && matchesDept;
  });

  return (
    <Card>
      <div className="flex gap-2 mb-3 flex-wrap items-center">
        <SearchBox value={search} onChange={setSearch} placeholder="Search teachers by name or designation..." />
        <select className="border rounded-lg px-3 py-2 text-sm h-fit" value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
          <option value="">Filter: All Departments</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.code}</option>)}
        </select>
      </div>
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Teacher name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <select className="border rounded-lg px-3 py-2 text-sm" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
          <option value="">Department</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.code}</option>)}
        </select>
        <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Designation" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
        <button onClick={save} className="bg-brand-500 text-white px-4 py-2 rounded-lg text-sm">{editingId ? "Update" : "Add"}</button>
        {editingId && <button onClick={resetForm} className="text-slate-500 text-xs underline">Cancel</button>}
      </div>
      <table className="w-full">
        <thead><tr><Th>Name</Th><Th>Dept</Th><Th>Designation</Th><Th></Th></tr></thead>
        <tbody>
          {filtered.map((t) => (
            <React.Fragment key={t.id}>
              <tr>
                <Td>{t.name}</Td>
                <Td>{t.department?.code}</Td>
                <Td>{t.designation}</Td>
                <Td>
                  <div className="flex gap-3 items-center">
                    <button onClick={() => toggleExpand(t.id)} className="text-slate-600 text-xs font-medium underline">
                      {expandedTeacher === t.id ? "Hide details" : "Subjects / Busy Elsewhere"}
                    </button>
                    <RowActions onEdit={() => startEdit(t)} onDelete={() => remove(t.id)} />
                  </div>
                </Td>
              </tr>
              {expandedTeacher === t.id && (
                <tr>
                  <td colSpan={4} className="p-3 bg-slate-50 border-t border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Assigned Subjects</p>
                    {!assignmentsMap[t.id] ? (
                      <span className="text-xs text-slate-400">Loading...</span>
                    ) : assignmentsMap[t.id].length === 0 ? (
                      <span className="text-xs text-slate-400">
                        No subjects assigned yet — add rows for this teacher on the "Teacher-Subject Assignment Table" page.
                      </span>
                    ) : (
                      <table className="w-full mb-4">
                        <thead>
                          <tr>
                            <Th>Subject</Th><Th>Section</Th><Th>Periods/Week</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {assignmentsMap[t.id].map((a: any) => (
                            <tr key={a.id}>
                              <Td>{a.subject?.name}</Td>
                              <Td>{a.section?.department?.code} {a.section?.name} (Yr {a.section?.year})</Td>
                              <Td>{a.periodsPerWeek}</Td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    <p className="text-xs font-semibold text-slate-500 uppercase mb-1 mt-4">
                      Busy Elsewhere (e.g. class in another branch)
                    </p>
                    <p className="text-xs text-slate-500 mb-2">
                      Mark exact day+period slots where this teacher already has a commitment outside this system —
                      the generator will never schedule anything for them here.
                    </p>
                    {busySlotsMap[t.id] && busySlotsMap[t.id].length > 0 && (
                      <ul className="mb-2 space-y-1">
                        {busySlotsMap[t.id].map((b: any) => (
                          <li key={b.id} className="text-xs flex items-center gap-2 bg-white border border-slate-200 rounded px-2 py-1 w-fit">
                            <span>{b.day?.name} — {b.period?.label}{b.note ? ` (${b.note})` : ""}</span>
                            <button onClick={() => removeBusySlot(t.id, b.id)} className="text-red-500">×</button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="flex gap-2 flex-wrap items-center">
                      <select className="border rounded-lg px-2 py-1.5 text-xs" value={busyForm.dayId} onChange={(e) => setBusyForm({ ...busyForm, dayId: e.target.value })}>
                        <option value="">Day</option>
                        {allDays.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                      <select className="border rounded-lg px-2 py-1.5 text-xs" value={busyForm.periodId} onChange={(e) => setBusyForm({ ...busyForm, periodId: e.target.value })}>
                        <option value="">Period</option>
                        {allPeriods.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                      </select>
                      <input
                        className="border rounded-lg px-2 py-1.5 text-xs"
                        placeholder="Note (e.g. Class in ECE)"
                        value={busyForm.note}
                        onChange={(e) => setBusyForm({ ...busyForm, note: e.target.value })}
                      />
                      <button onClick={() => addBusySlot(t.id)} className="bg-slate-700 text-white text-xs px-3 py-1.5 rounded-lg">
                        Mark Busy
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
          {filtered.length === 0 && (
            <tr><td colSpan={4} className="p-4 text-center text-slate-400 text-sm">No teachers match your search/filter.</td></tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}

// ---------------- Classrooms ----------------
function Classrooms() {
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState({ roomNumber: "", capacity: 60, type: "CLASSROOM" });
  const [editingId, setEditingId] = useState<number | null>(null);

  const load = () => api.get("/classrooms").then(setItems);
  useEffect(() => {
    load();
  }, []);

  function startEdit(r: any) {
    setEditingId(r.id);
    setForm({ roomNumber: r.roomNumber, capacity: r.capacity, type: r.type });
  }
  function resetForm() {
    setEditingId(null);
    setForm({ roomNumber: "", capacity: 60, type: "CLASSROOM" });
  }

  async function save() {
    if (!form.roomNumber) return;
    if (editingId) {
      await api.put(`/classrooms/${editingId}`, form);
    } else {
      await api.post("/classrooms", form);
    }
    resetForm();
    load();
  }
  async function remove(id: number) {
    const ok = await smartDelete(`/classrooms/${id}`, "Delete this room?");
    if (ok) load();
  }

  return (
    <Card>
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Room number" value={form.roomNumber} onChange={(e) => setForm({ ...form, roomNumber: e.target.value })} />
        <input className="border rounded-lg px-3 py-2 text-sm w-28" type="number" placeholder="Capacity" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} />
        <select className="border rounded-lg px-3 py-2 text-sm" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
          <option value="CLASSROOM">Classroom</option>
          <option value="LAB">Lab</option>
        </select>
        <button onClick={save} className="bg-brand-500 text-white px-4 py-2 rounded-lg text-sm">{editingId ? "Update" : "Add"}</button>
        {editingId && <button onClick={resetForm} className="text-slate-500 text-xs underline">Cancel</button>}
      </div>
      <table className="w-full">
        <thead><tr><Th>Room</Th><Th>Capacity</Th><Th>Type</Th><Th></Th></tr></thead>
        <tbody>
          {items.map((r) => (
            <tr key={r.id}>
              <Td>{r.roomNumber}</Td>
              <Td>{r.capacity}</Td>
              <Td>{r.type}</Td>
              <Td><RowActions onEdit={() => startEdit(r)} onDelete={() => remove(r.id)} /></Td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

// ---------------- Working Days ----------------
function WorkingDays() {
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", order: 1 });
  const [editingId, setEditingId] = useState<number | null>(null);

  const load = () => api.get("/settings/days").then(setItems);
  useEffect(() => {
    load();
  }, []);

  function startEdit(d: any) {
    setEditingId(d.id);
    setForm({ name: d.name, order: d.order });
  }
  function resetForm() {
    setEditingId(null);
    setForm({ name: "", order: items.length + 1 });
  }

  async function save() {
    if (!form.name) return;
    if (editingId) {
      const current = items.find((i) => i.id === editingId);
      await api.put(`/settings/days/${editingId}`, { ...form, active: current?.active ?? true });
    } else {
      await api.post("/settings/days", { ...form, active: true });
    }
    resetForm();
    load();
  }
  async function toggle(d: any) {
    await api.put(`/settings/days/${d.id}`, { name: d.name, order: d.order, active: !d.active });
    load();
  }
  async function remove(id: number) {
    const ok = await smartDelete(`/settings/days/${id}`, "Delete this working day?");
    if (ok) load();
  }

  return (
    <Card>
      <p className="text-xs text-slate-500 mb-3">
        This "Active" toggle applies college-wide. To exclude just one specific section from a day that's still active
        overall (e.g. no Saturday for CSE 3rd Year only), use the "Off-days" option on that section under the
        <strong> Sections</strong> tab instead.
      </p>
      <div className="flex gap-2 mb-4 items-center">
        <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Day name (e.g. Sunday)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="border rounded-lg px-3 py-2 text-sm w-24" type="number" placeholder="Order" value={form.order} onChange={(e) => setForm({ ...form, order: Number(e.target.value) })} />
        <button onClick={save} className="bg-brand-500 text-white px-4 py-2 rounded-lg text-sm">{editingId ? "Update" : "Add"}</button>
        {editingId && <button onClick={resetForm} className="text-slate-500 text-xs underline">Cancel</button>}
      </div>
      <table className="w-full">
        <thead><tr><Th>Day</Th><Th>Order</Th><Th>Active college-wide</Th><Th></Th></tr></thead>
        <tbody>
          {items.map((d) => (
            <tr key={d.id}>
              <Td>{d.name}</Td>
              <Td>{d.order}</Td>
              <Td>
                <button onClick={() => toggle(d)} className={`text-xs px-2 py-1 rounded ${d.active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                  {d.active ? "Active" : "Off"}
                </button>
              </Td>
              <Td><RowActions onEdit={() => startEdit(d)} onDelete={() => remove(d.id)} /></Td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

// ---------------- Periods ----------------
function Periods() {
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState({ index: 1, label: "", startTime: "", endTime: "", isLunch: false });
  const [editingId, setEditingId] = useState<number | null>(null);

  const load = () => api.get("/settings/periods").then(setItems);
  useEffect(() => {
    load();
  }, []);

  function startEdit(p: any) {
    setEditingId(p.id);
    setForm({ index: p.index, label: p.label, startTime: p.startTime, endTime: p.endTime, isLunch: p.isLunch });
  }
  function resetForm() {
    setEditingId(null);
    setForm({ index: items.length + 1, label: "", startTime: "", endTime: "", isLunch: false });
  }

  async function save() {
    if (!form.label) return;
    if (editingId) {
      await api.put(`/settings/periods/${editingId}`, form);
    } else {
      await api.post("/settings/periods", form);
    }
    resetForm();
    load();
  }
  async function remove(id: number) {
    const ok = await smartDelete(`/settings/periods/${id}`, "Delete this period?");
    if (ok) load();
  }

  return (
    <Card>
      <p className="text-xs text-slate-500 mb-3">
        Every period's label and timing is editable — click Edit on any row, change the values, and Update.
      </p>
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <input className="border rounded-lg px-3 py-2 text-sm w-20" type="number" placeholder="Order" value={form.index} onChange={(e) => setForm({ ...form, index: Number(e.target.value) })} />
        <input className="border rounded-lg px-3 py-2 text-sm w-24" placeholder="Label (P1)" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
        <input className="border rounded-lg px-3 py-2 text-sm w-28" placeholder="Start (08:50)" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
        <input className="border rounded-lg px-3 py-2 text-sm w-28" placeholder="End (09:40)" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
        <label className="text-sm flex items-center gap-1">
          <input type="checkbox" checked={form.isLunch} onChange={(e) => setForm({ ...form, isLunch: e.target.checked })} /> Lunch
        </label>
        <button onClick={save} className="bg-brand-500 text-white px-4 py-2 rounded-lg text-sm">{editingId ? "Update" : "Add"}</button>
        {editingId && <button onClick={resetForm} className="text-slate-500 text-xs underline">Cancel</button>}
      </div>
      <table className="w-full">
        <thead><tr><Th>Order</Th><Th>Label</Th><Th>Start</Th><Th>End</Th><Th>Lunch</Th><Th></Th></tr></thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id}>
              <Td>{p.index}</Td>
              <Td>{p.label}</Td>
              <Td>{p.startTime}</Td>
              <Td>{p.endTime}</Td>
              <Td>{p.isLunch ? "Yes" : ""}</Td>
              <Td><RowActions onEdit={() => startEdit(p)} onDelete={() => remove(p.id)} /></Td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
