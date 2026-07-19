import React, { useEffect, useState } from "react";
import { api, downloadFile } from "../api";

interface Draft {
  teacherId: string;
  periodsPerWeek: number;
  coTeacherIds: number[];
}

export default function Assignments() {
  const [departments, setDepartments] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [allSubjects, setAllSubjects] = useState<any[]>([]);
  const [allAssignments, setAllAssignments] = useState<any[]>([]);

  const [departmentId, setDepartmentId] = useState<number | "">("");
  const [year, setYear] = useState<number | "">("");
  const [sectionId, setSectionId] = useState<number | "">("");

  const [sectionAssignments, setSectionAssignments] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [customizing, setCustomizing] = useState<Record<number, boolean>>({});
  const [error, setError] = useState("");
  const [allSearch, setAllSearch] = useState("");

  const loadAll = () => api.get("/assignments").then(setAllAssignments);

  useEffect(() => {
    api.get("/departments").then(setDepartments);
    api.get("/teachers").then(setTeachers);
    api.get("/subjects").then(setAllSubjects);
    loadAll();
  }, []);

  useEffect(() => {
    if (departmentId && year) {
      api.get(`/sections?departmentId=${departmentId}&year=${year}`).then(setSections);
      setSectionId("");
    } else {
      setSections([]);
    }
  }, [departmentId, year]);

  useEffect(() => {
    if (sectionId) {
      api.get(`/assignments?sectionId=${sectionId}`).then((rows) => {
        setSectionAssignments(rows);
        const d: Record<number, Draft> = {};
        const custom: Record<number, boolean> = {};
        rows.forEach((r: any) => {
          d[r.subjectId] = {
            teacherId: String(r.teacherId),
            periodsPerWeek: r.periodsPerWeek,
            coTeacherIds: r.coTeacherIds || [],
          };
          if (r.subject && r.periodsPerWeek !== r.subject.weeklyHours) {
            custom[r.subjectId] = true;
          }
        });
        setDrafts(d);
        setCustomizing(custom);
      });
    } else {
      setSectionAssignments([]);
      setDrafts({});
      setCustomizing({});
    }
  }, [sectionId]);

  // Subjects relevant to the selected year (year-specific + "any year" common ones)
  const relevantSubjects = allSubjects.filter((s) => !year || !s.year || s.year === Number(year));

  function existingFor(subjectId: number) {
    return sectionAssignments.find((a) => a.subjectId === subjectId);
  }

  function updateDraft(subjectId: number, patch: Partial<Draft>) {
    setDrafts((prev) => ({
      ...prev,
      [subjectId]: {
        teacherId: prev[subjectId]?.teacherId || "",
        periodsPerWeek: prev[subjectId]?.periodsPerWeek || 3,
        coTeacherIds: prev[subjectId]?.coTeacherIds || [],
        ...patch,
      },
    }));
  }

  function toggleCoTeacher(subjectId: number, teacherId: number) {
    const current = drafts[subjectId]?.coTeacherIds || [];
    const next = current.includes(teacherId) ? current.filter((id) => id !== teacherId) : [...current, teacherId];
    updateDraft(subjectId, { coTeacherIds: next });
  }

  async function saveRow(s: any) {
    setError("");
    const draft = drafts[s.id];
    if (!draft?.teacherId) {
      setError("Pick a teacher for this subject before saving.");
      return;
    }
    const existing = existingFor(s.id);
    const periodsPerWeek = customizing[s.id] ? draft.periodsPerWeek || 1 : s.weeklyHours || 3;
    const payload = {
      teacherId: draft.teacherId,
      subjectId: s.id,
      sectionId,
      periodsPerWeek,
      coTeacherIds: (draft.coTeacherIds || []).filter((id) => String(id) !== draft.teacherId),
    };
    try {
      if (existing) {
        await api.put(`/assignments/${existing.id}`, payload);
      } else {
        await api.post("/assignments", payload);
      }
      const rows = await api.get(`/assignments?sectionId=${sectionId}`);
      setSectionAssignments(rows);
      loadAll();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function clearRow(subjectId: number) {
    const existing = existingFor(subjectId);
    if (!existing) return;
    if (!confirm("Remove this subject's assignment for this section?")) return;
    await api.delete(`/assignments/${existing.id}`);
    const rows = await api.get(`/assignments?sectionId=${sectionId}`);
    setSectionAssignments(rows);
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[subjectId];
      return next;
    });
    setCustomizing((prev) => {
      const next = { ...prev };
      delete next[subjectId];
      return next;
    });
    loadAll();
  }

  const selectedSection = sections.find((s) => s.id === sectionId);

  const filteredAllAssignments = allAssignments.filter((a) => {
    if (!allSearch) return true;
    const q = allSearch.toLowerCase();
    const coNames = (a.coTeacherIds || []).map((id: number) => teachers.find((t) => t.id === id)?.name || "").join(" ");
    const haystack = [
      a.teacher?.name,
      coNames,
      a.subject?.name,
      a.section?.name,
      a.section?.department?.code,
      String(a.section?.year || ""),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-2xl font-bold text-slate-800">Teacher–Subject Assignment</h2>
        <button
          onClick={() => downloadFile("/export/excel/assignments", "assignments.xlsx")}
          className="bg-slate-800 text-white text-sm px-4 py-2 rounded-lg"
        >
          Export All to Excel
        </button>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Pick a class below, then assign one teacher to each of its subjects. Periods/Week is pulled automatically
        from each subject's Weekly Hrs (set on the Subjects tab) — click "Customize for this section" only if this
        particular section needs a different amount. A subject already assigned shows who's teaching it — pick a
        different teacher and Save to change it. For Lab subjects that need multiple teachers present together, use
        "+ Add co-teacher".
      </p>

      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm mb-6">
        <div className="flex gap-2 flex-wrap items-center">
          <select className="border rounded-lg px-3 py-2 text-sm" value={departmentId} onChange={(e) => setDepartmentId(Number(e.target.value))}>
            <option value="">Department</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.code}</option>)}
          </select>
          <select className="border rounded-lg px-3 py-2 text-sm" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            <option value="">Year</option>
            {[1, 2, 3, 4].map((y) => <option key={y} value={y}>Year {y}</option>)}
          </select>
          <select className="border rounded-lg px-3 py-2 text-sm" value={sectionId} onChange={(e) => setSectionId(Number(e.target.value))} disabled={!sections.length}>
            <option value="">Section</option>
            {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-600 text-sm p-2 rounded mb-4">{error}</div>}

      {!sectionId ? (
        <p className="text-slate-400 text-sm">Select Department → Year → Section above to assign its subjects.</p>
      ) : relevantSubjects.length === 0 ? (
        <p className="text-slate-400 text-sm">
          No subjects found for Year {year}. Add subjects for this year on the <strong>Subjects</strong> tab first.
        </p>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <div className="p-4 border-b border-slate-100 bg-slate-50">
            <h3 className="font-semibold text-slate-800">
              {selectedSection?.department?.code} {selectedSection?.name} — Year {year}
            </h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">Subject</th>
                <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">Teacher</th>
                <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">Periods/Week</th>
                <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase"></th>
              </tr>
            </thead>
            <tbody>
              {relevantSubjects.map((s) => {
                const existing = existingFor(s.id);
                const draft = drafts[s.id] || { teacherId: "", periodsPerWeek: s.weeklyHours || 3, coTeacherIds: [] };
                const isLab = s.type === "LAB";
                const coTeacherOptions = teachers.filter((t) => String(t.id) !== draft.teacherId);

                return (
                  <tr key={s.id} className="border-t border-slate-100 align-top">
                    <td className="p-3 text-sm">
                      {s.name}
                      {isLab && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded ml-1">LAB</span>}
                      {s.alwaysLastPeriod && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded ml-1">Last period</span>}
                      {existing && (
                        <div className="text-xs text-green-600 mt-0.5">
                          Currently: {existing.teacher?.name}
                          {existing.coTeacherIds?.length > 0 && (
                            <> + {existing.coTeacherIds.length} co-teacher{existing.coTeacherIds.length > 1 ? "s" : ""}</>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <select
                        className="border rounded-lg px-2 py-1.5 text-sm"
                        value={draft.teacherId}
                        onChange={(e) => updateDraft(s.id, { teacherId: e.target.value })}
                      >
                        <option value="">Select teacher</option>
                        {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>

                      {isLab && (
                        <div className="mt-2">
                          {draft.coTeacherIds.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-1.5">
                              {draft.coTeacherIds.map((tid) => {
                                const t = teachers.find((x) => x.id === tid);
                                return (
                                  <span key={tid} className="text-xs bg-slate-100 border border-slate-300 rounded-full px-2 py-0.5 flex items-center gap-1">
                                    {t?.name || tid}
                                    <button onClick={() => toggleCoTeacher(s.id, tid)} className="text-slate-400 hover:text-red-500">×</button>
                                  </span>
                                );
                              })}
                            </div>
                          )}
                          <select
                            className="border rounded-lg px-2 py-1 text-xs text-slate-500"
                            value=""
                            onChange={(e) => e.target.value && toggleCoTeacher(s.id, Number(e.target.value))}
                          >
                            <option value="">+ Add co-teacher (for labs with 2-3 teachers)</option>
                            {coTeacherOptions.map((t) => (
                              <option key={t.id} value={t.id} disabled={draft.coTeacherIds.includes(t.id)}>
                                {t.name}{draft.coTeacherIds.includes(t.id) ? " (added)" : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      {customizing[s.id] ? (
                        <div>
                          <input
                            className="border rounded-lg px-2 py-1.5 text-sm w-20"
                            type="number"
                            min={1}
                            value={draft.periodsPerWeek}
                            onChange={(e) => updateDraft(s.id, { periodsPerWeek: Number(e.target.value) })}
                          />
                          <button
                            onClick={() => {
                              setCustomizing((prev) => ({ ...prev, [s.id]: false }));
                              updateDraft(s.id, { periodsPerWeek: s.weeklyHours || 3 });
                            }}
                            className="text-xs text-slate-400 underline block mt-1"
                          >
                            Use subject default ({s.weeklyHours})
                          </button>
                        </div>
                      ) : (
                        <div>
                          <span className="text-sm">{s.weeklyHours}</span>
                          <button
                            onClick={() => setCustomizing((prev) => ({ ...prev, [s.id]: true }))}
                            className="text-xs text-brand-600 underline block mt-0.5"
                          >
                            Customize for this section
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-3">
                        <button onClick={() => saveRow(s)} className="bg-brand-500 text-white text-xs px-3 py-1.5 rounded-lg h-fit">
                          {existing ? "Update" : "Save"}
                        </button>
                        {existing && (
                          <button onClick={() => clearRow(s.id)} className="text-red-500 text-xs font-medium">
                            Unassign
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8">
        <h3 className="font-semibold text-slate-700 mb-3">All Assignments (every section)</h3>
        <div className="relative mb-3">
          <input
            className="border rounded-lg px-3 py-2 pl-8 text-sm w-full max-w-xs"
            placeholder="Search by teacher, subject, or section..."
            value={allSearch}
            onChange={(e) => setAllSearch(e.target.value)}
          />
          <span className="absolute left-2.5 top-2.5 text-slate-400 text-sm">🔍</span>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">Teacher(s)</th>
                <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">Subject</th>
                <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">Section</th>
                <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">Periods/Week</th>
              </tr>
            </thead>
            <tbody>
              {filteredAllAssignments.map((a) => {
                const coNames = (a.coTeacherIds || [])
                  .map((id: number) => teachers.find((t) => t.id === id)?.name)
                  .filter(Boolean);
                return (
                  <tr key={a.id} className="border-t border-slate-100">
                    <td className="p-3 text-sm">{[a.teacher?.name, ...coNames].join(" + ")}</td>
                    <td className="p-3 text-sm">{a.subject?.name}</td>
                    <td className="p-3 text-sm">{a.section?.department?.code} {a.section?.name} (Yr {a.section?.year})</td>
                    <td className="p-3 text-sm">{a.periodsPerWeek}</td>
                  </tr>
                );
              })}
              {filteredAllAssignments.length === 0 && (
                <tr><td colSpan={4} className="p-6 text-center text-slate-400 text-sm">{allAssignments.length === 0 ? "No assignments yet." : `No assignments match "${allSearch}".`}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
