import React, { useEffect, useState } from "react";
import { api, downloadFile } from "../api";
import TimetableGrid from "../components/TimetableGrid";
import { useAuth } from "../context/AuthContext";

export default function StudentView() {
  const { user } = useAuth();
  const [days, setDays] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [sectionId, setSectionId] = useState<number | "">(user?.sectionId || "");
  const [departments, setDepartments] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [departmentId, setDepartmentId] = useState<number | "">("");
  const [year, setYear] = useState<number | "">("");

  useEffect(() => {
    api.get("/settings/days").then((d) => setDays(d.filter((x: any) => x.active)));
    api.get("/settings/periods").then(setPeriods);
    api.get("/departments").then(setDepartments);
  }, []);

  useEffect(() => {
    if (departmentId && year) {
      api.get(`/sections?departmentId=${departmentId}&year=${year}`).then(setSections);
    }
  }, [departmentId, year]);

  useEffect(() => {
    if (sectionId) api.get(`/timetable/section/${sectionId}`).then(setEntries);
  }, [sectionId]);

  const lockedToOwnSection = !!user?.sectionId;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-slate-800">Class Timetable</h2>
        {sectionId && (
          <div className="flex gap-2">
            <button onClick={() => downloadFile(`/export/pdf/section/${sectionId}?studentView=true`, "class_timetable.pdf")} className="bg-brand-500 text-white text-sm px-4 py-2 rounded-lg">
              Download PDF
            </button>
            <button onClick={() => downloadFile(`/export/excel/section/${sectionId}?studentView=true`, "class_timetable.xlsx")} className="bg-slate-800 text-white text-sm px-4 py-2 rounded-lg">
              Download Excel
            </button>
            <button onClick={() => window.print()} className="bg-white border border-slate-300 text-sm px-4 py-2 rounded-lg">
              Print
            </button>
          </div>
        )}
      </div>

      {!lockedToOwnSection && (
        <div className="flex gap-2 mb-5 flex-wrap">
          <select className="border rounded-lg px-3 py-2 text-sm" value={departmentId} onChange={(e) => setDepartmentId(Number(e.target.value))}>
            <option value="">Department</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select className="border rounded-lg px-3 py-2 text-sm" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            <option value="">Year</option>
            {[1, 2, 3, 4].map((y) => <option key={y} value={y}>Year {y}</option>)}
          </select>
          <select className="border rounded-lg px-3 py-2 text-sm" value={sectionId} onChange={(e) => setSectionId(Number(e.target.value))}>
            <option value="">Section</option>
            {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}

      {sectionId ? (
        <TimetableGrid days={days} periods={periods} entries={entries} mode="student" />
      ) : (
        <p className="text-slate-400 text-sm">Select your department, year, and section to view your timetable.</p>
      )}
    </div>
  );
}
