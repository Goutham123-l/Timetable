import React, { useEffect, useState } from "react";
import { api } from "../api";
import { useToast } from "../components/Toast";

export default function EmergencyScheduler() {
  const [teachers, setTeachers] = useState<any[]>([]);
  const [days, setDays] = useState<any[]>([]);
  const [date, setDate] = useState("");
  const [absentTeacherId, setAbsentTeacherId] = useState<number | "">("");
  const [affectedPeriods, setAffectedPeriods] = useState<any[]>([]);
  const [dayBusy, setDayBusy] = useState<any[]>([]);
  const [substitutes, setSubstitutes] = useState<Record<number, { teacherId: string; note: string }>>({});
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api.get("/teachers").then(setTeachers);
    api.get("/settings/days").then(setDays);
    loadHistory();
  }, []);

  const loadHistory = () => api.get("/substitutions").then(setHistory);

  const matchedDay = days.find((d) => {
    if (!date) return false;
    const weekday = new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" });
    return d.name === weekday;
  });

  async function findAffectedPeriods() {
    if (!date || !absentTeacherId) {
      toast.error("Please pick a date and the absent teacher first.");
      return;
    }
    if (!matchedDay) {
      toast.error("That date's weekday isn't a working day in this system.");
      return;
    }
    if (!matchedDay.active) {
      toast.error(`${matchedDay.name} is marked inactive college-wide — no classes are scheduled that day.`);
      return;
    }
    setLoading(true);
    try {
      const [teacherWeek, dayEntries] = await Promise.all([
        api.get(`/timetable/teacher/${absentTeacherId}`),
        api.get(`/substitutions/by-day/${matchedDay.id}`),
      ]);
      const forThatDay = teacherWeek.filter((e: any) => e.dayId === matchedDay.id);
      setAffectedPeriods(forThatDay);
      setDayBusy(dayEntries);
      setSubstitutes({});
      if (forThatDay.length === 0) {
        toast.info(`This teacher has no classes on ${matchedDay.name}s.`);
      }
    } finally {
      setLoading(false);
    }
  }

  function isTeacherBusyAt(teacherId: number, periodId: number) {
    return dayBusy.some((e: any) => e.teacherId === teacherId && e.periodId === periodId && e.teacherId !== Number(absentTeacherId));
  }

  async function saveSubstitution(entry: any) {
    const sub = substitutes[entry.id];
    if (!sub?.teacherId) {
      toast.error("Pick a substitute teacher for this period first.");
      return;
    }
    try {
      await api.post("/substitutions", {
        date,
        dayOfWeek: matchedDay.name,
        sectionId: entry.section.id,
        periodId: entry.period.id,
        subjectId: entry.subjectId,
        originalTeacherId: absentTeacherId,
        substituteTeacherId: sub.teacherId,
        note: sub.note || "",
      });
      toast.success("Substitution recorded.");
      loadHistory();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function deleteHistoryRow(id: number) {
    await api.delete(`/substitutions/${id}`);
    loadHistory();
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-1">Emergency Scheduler</h2>
      <p className="text-sm text-slate-500 mb-4">
        For when a teacher is absent on a specific day. This doesn't change your regular weekly timetable — it just
        logs who covered each of their classes on that date, so there's a clear record.
      </p>

      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm mb-6">
        <div className="flex gap-2 flex-wrap items-end">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
            <input type="date" className="border rounded-lg px-3 py-2 text-sm" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Absent Teacher</label>
            <select className="border rounded-lg px-3 py-2 text-sm" value={absentTeacherId} onChange={(e) => setAbsentTeacherId(Number(e.target.value))}>
              <option value="">Select teacher</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <button onClick={findAffectedPeriods} disabled={loading} className="bg-brand-500 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">
            {loading ? "Checking..." : "Find Their Classes"}
          </button>
        </div>
        {date && matchedDay && (
          <p className="text-xs text-slate-500 mt-2">
            {new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })} is a <strong>{matchedDay.name}</strong>.
          </p>
        )}
      </div>

      {affectedPeriods.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-6 overflow-x-auto">
          <div className="p-4 border-b border-slate-100 bg-slate-50">
            <h3 className="font-semibold text-slate-800">Classes to cover</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">Period</th>
                <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">Section</th>
                <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">Subject</th>
                <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">Substitute Teacher</th>
                <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase"></th>
              </tr>
            </thead>
            <tbody>
              {affectedPeriods.map((entry) => {
                const sub = substitutes[entry.id] || { teacherId: "", note: "" };
                return (
                  <tr key={entry.id} className="border-t border-slate-100">
                    <td className="p-3 text-sm">{entry.period?.label}</td>
                    <td className="p-3 text-sm">{entry.section?.department?.code} {entry.section?.name}</td>
                    <td className="p-3 text-sm">{entry.subject?.name}</td>
                    <td className="p-3">
                      <select
                        className="border rounded-lg px-2 py-1.5 text-sm"
                        value={sub.teacherId}
                        onChange={(e) => setSubstitutes((prev) => ({ ...prev, [entry.id]: { ...sub, teacherId: e.target.value } }))}
                      >
                        <option value="">Select substitute</option>
                        {teachers
                          .filter((t) => t.id !== Number(absentTeacherId))
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}{isTeacherBusyAt(t.id, entry.period.id) ? " (already teaching then)" : ""}
                            </option>
                          ))}
                      </select>
                      <input
                        className="border rounded-lg px-2 py-1 text-xs mt-1 w-full"
                        placeholder="Note (optional)"
                        value={sub.note}
                        onChange={(e) => setSubstitutes((prev) => ({ ...prev, [entry.id]: { ...sub, note: e.target.value } }))}
                      />
                    </td>
                    <td className="p-3">
                      <button onClick={() => saveSubstitution(entry)} className="bg-brand-500 text-white text-xs px-3 py-1.5 rounded-lg">
                        Save
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h3 className="font-semibold text-slate-800 mb-3">Substitution Log</h3>
        {history.length === 0 ? (
          <p className="text-sm text-slate-400">No substitutions recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left p-2 text-xs font-semibold text-slate-500 uppercase">Date</th>
                  <th className="text-left p-2 text-xs font-semibold text-slate-500 uppercase">Section</th>
                  <th className="text-left p-2 text-xs font-semibold text-slate-500 uppercase">Period</th>
                  <th className="text-left p-2 text-xs font-semibold text-slate-500 uppercase">Subject</th>
                  <th className="text-left p-2 text-xs font-semibold text-slate-500 uppercase">Absent</th>
                  <th className="text-left p-2 text-xs font-semibold text-slate-500 uppercase">Covered By</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-t border-slate-100">
                    <td className="p-2">{new Date(h.date).toLocaleDateString()} ({h.dayOfWeek})</td>
                    <td className="p-2">{h.section?.department?.code} {h.section?.name}</td>
                    <td className="p-2">{h.period?.label}</td>
                    <td className="p-2">{h.subject?.name}</td>
                    <td className="p-2">{h.originalTeacher?.name}</td>
                    <td className="p-2">{h.substituteTeacher?.name}</td>
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
