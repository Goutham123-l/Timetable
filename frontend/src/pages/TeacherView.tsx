import React, { useEffect, useState } from "react";
import { api, downloadFile } from "../api";
import TimetableGrid from "../components/TimetableGrid";
import { useAuth } from "../context/AuthContext";

export default function TeacherView() {
  const { user } = useAuth();
  const [days, setDays] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);

  useEffect(() => {
    if (!user?.teacherId) return;
    api.get("/settings/days").then((d) => setDays(d.filter((x: any) => x.active)));
    api.get("/settings/periods").then(setPeriods);
    api.get(`/timetable/teacher/${user.teacherId}`).then(setEntries);
  }, [user]);

  if (!user?.teacherId) {
    return <p className="text-slate-500">No teacher profile linked to your account. Contact the administrator.</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-slate-800">My Timetable</h2>
        <div className="flex gap-2">
          <button onClick={() => downloadFile(`/export/pdf/teacher/${user.teacherId}`, "my_timetable.pdf")} className="bg-brand-500 text-white text-sm px-4 py-2 rounded-lg">
            Download PDF
          </button>
          <button onClick={() => downloadFile(`/export/excel/teacher/${user.teacherId}`, "my_timetable.xlsx")} className="bg-slate-800 text-white text-sm px-4 py-2 rounded-lg">
            Download Excel
          </button>
          <button onClick={() => window.print()} className="bg-white border border-slate-300 text-sm px-4 py-2 rounded-lg">
            Print
          </button>
        </div>
      </div>
      <TimetableGrid days={days} periods={periods} entries={entries} mode="teacher" />
    </div>
  );
}
