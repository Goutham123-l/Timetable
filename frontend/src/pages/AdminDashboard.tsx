import React, { useEffect, useState } from "react";
import { api } from "../api";
import { Users, Building2, BookOpen, School, ClipboardList } from "lucide-react";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    teachers: 0,
    departments: 0,
    subjects: 0,
    sections: 0,
    assignments: 0,
  });
  const [workload, setWorkload] = useState<{ name: string; periods: number }[]>([]);
  const [recentSubs, setRecentSubs] = useState<any[]>([]);
  const [lastGeneration, setLastGeneration] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const [teachers, departments, subjects, sections, assignments, subs, history] = await Promise.all([
        api.get("/teachers"),
        api.get("/departments"),
        api.get("/subjects"),
        api.get("/sections"),
        api.get("/assignments"),
        api.get("/substitutions").catch(() => []),
        api.get("/timetable/generate/history").catch(() => []),
      ]);
      setStats({
        teachers: teachers.length,
        departments: departments.length,
        subjects: subjects.length,
        sections: sections.length,
        assignments: assignments.length,
      });

      // Teacher workload analytics: total periods/week per teacher, from the
      // assignment table (includes co-teacher load too).
      const loadMap: Record<string, number> = {};
      assignments.forEach((a: any) => {
        const name = a.teacher?.name || "Unknown";
        loadMap[name] = (loadMap[name] || 0) + (a.periodsPerWeek || 0);
        (a.coTeacherIds || []).forEach((id: number) => {
          const co = teachers.find((t: any) => t.id === id);
          if (co) loadMap[co.name] = (loadMap[co.name] || 0) + (a.periodsPerWeek || 0);
        });
      });
      const workloadArr = Object.entries(loadMap)
        .map(([name, periods]) => ({ name, periods }))
        .sort((a, b) => b.periods - a.periods)
        .slice(0, 8);
      setWorkload(workloadArr);

      setRecentSubs(subs.slice(0, 5));
      setLastGeneration(history[0] || null);
    })();
  }, []);

  const cards = [
    { label: "Total Teachers", value: stats.teachers, Icon: Users, color: "from-blue-500 to-blue-600", iconBg: "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400" },
    { label: "Total Departments", value: stats.departments, Icon: Building2, color: "from-purple-500 to-purple-600", iconBg: "bg-purple-50 text-purple-600 dark:bg-purple-500/15 dark:text-purple-400" },
    { label: "Total Subjects", value: stats.subjects, Icon: BookOpen, color: "from-emerald-500 to-emerald-600", iconBg: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" },
    { label: "Total Sections", value: stats.sections, Icon: School, color: "from-amber-500 to-amber-600", iconBg: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400" },
    { label: "Assignments Configured", value: stats.assignments, Icon: ClipboardList, color: "from-rose-500 to-rose-600", iconBg: "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400" },
  ];

  const maxWorkload = Math.max(...workload.map((w) => w.periods), 1);

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6">Dashboard</h2>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white dark:bg-slate-800 dark:border-slate-700 rounded-xl border border-slate-200 p-5 shadow-sm relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${c.color}`} />
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-brand-600 dark:text-brand-400">{c.value}</div>
              <span className={`w-10 h-10 rounded-full flex items-center justify-center ${c.iconBg}`}>
                <c.Icon size={18} />
              </span>
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="bg-white dark:bg-slate-800 dark:border-slate-700 rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">Teacher Workload</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Total periods/week assigned, per teacher (top 8).</p>
          {workload.length === 0 ? (
            <p className="text-sm text-slate-400">No assignments yet.</p>
          ) : (
            <div className="space-y-2.5">
              {workload.map((w) => (
                <div key={w.name}>
                  <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300 mb-1">
                    <span>{w.name}</span>
                    <span>{w.periods}/wk</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-500 rounded-full transition-all"
                      style={{ width: `${(w.periods / maxWorkload) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 dark:border-slate-700 rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">Latest Generation</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Most recent "Generate Timetable" run.</p>
          {!lastGeneration ? (
            <p className="text-sm text-slate-400">No timetable generated yet.</p>
          ) : (
            <div className="text-sm space-y-1.5">
              <p className="text-slate-700 dark:text-slate-200">{new Date(lastGeneration.createdAt).toLocaleString()}</p>
              <p className="text-slate-500 dark:text-slate-400">By {lastGeneration.triggeredBy || "—"}</p>
              <div className="flex gap-4 mt-2">
                <span>Periods placed: <strong>{lastGeneration.entriesCreated}</strong></span>
                <span className={lastGeneration.conflictsCount > 0 ? "text-red-600" : "text-green-600"}>
                  Conflicts: <strong>{lastGeneration.conflictsCount}</strong>
                </span>
                <span className={lastGeneration.freeSlotsCount > 0 ? "text-amber-600" : "text-green-600"}>
                  Free slots: <strong>{lastGeneration.freeSlotsCount}</strong>
                </span>
              </div>
            </div>
          )}

          <h3 className="font-semibold text-slate-800 dark:text-slate-100 mt-6 mb-1">Recent Emergency Substitutions</h3>
          {recentSubs.length === 0 ? (
            <p className="text-sm text-slate-400">None recorded.</p>
          ) : (
            <ul className="text-sm space-y-1.5 mt-2">
              {recentSubs.map((s) => (
                <li key={s.id} className="text-slate-600 dark:text-slate-300">
                  {new Date(s.date).toLocaleDateString()} — {s.originalTeacher?.name} → {s.substituteTeacher?.name} ({s.subject?.name})
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-6 bg-white dark:bg-slate-800 dark:border-slate-700 rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-2">Getting started</h3>
        <ol className="list-decimal list-inside text-sm text-slate-600 dark:text-slate-300 space-y-1">
          <li>Go to <strong>Departments / Sections / Subjects / Teachers / Rooms</strong> and add your college's data.</li>
          <li>Go to <strong>Teacher-Subject Assignment Table</strong> and fill Teacher, Subject, Section, Periods/Week for each class.</li>
          <li>Click <strong>Generate Timetable</strong> to auto-place everything conflict-free.</li>
          <li>Go to <strong>View & Edit Timetables</strong> to manually fix anything, lock cells, and export to Excel/PDF.</li>
          <li>If a teacher is absent one day, use <strong>Emergency Scheduler</strong> to log a substitute.</li>
        </ol>
      </div>
    </div>
  );
}
