import React, { useEffect, useState } from "react";
import { api } from "../api";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    teachers: 0,
    departments: 0,
    subjects: 0,
    sections: 0,
    assignments: 0,
    entries: 0,
  });

  useEffect(() => {
    (async () => {
      const [teachers, departments, subjects, sections, assignments] = await Promise.all([
        api.get("/teachers"),
        api.get("/departments"),
        api.get("/subjects"),
        api.get("/sections"),
        api.get("/assignments"),
      ]);
      let entries = 0;
      try {
        // count generated entries via first section (best effort, no dedicated endpoint)
      } catch {}
      setStats({
        teachers: teachers.length,
        departments: departments.length,
        subjects: subjects.length,
        sections: sections.length,
        assignments: assignments.length,
        entries,
      });
    })();
  }, []);

  const cards = [
    { label: "Total Teachers", value: stats.teachers },
    { label: "Total Departments", value: stats.departments },
    { label: "Total Subjects", value: stats.subjects },
    { label: "Total Sections", value: stats.sections },
    { label: "Assignments Configured", value: stats.assignments },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Dashboard</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="text-3xl font-bold text-brand-600">{c.value}</div>
            <div className="text-sm text-slate-500 mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-8 bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-800 mb-2">Getting started</h3>
        <ol className="list-decimal list-inside text-sm text-slate-600 space-y-1">
          <li>Go to <strong>Departments / Sections / Subjects / Teachers / Rooms</strong> and add your college's data.</li>
          <li>Go to <strong>Teacher-Subject Assignment Table</strong> and fill Teacher, Subject, Section, Periods/Week for each class — manually, like your current sheet.</li>
          <li>Click <strong>Generate Timetable</strong> to auto-place everything conflict-free.</li>
          <li>Go to <strong>View & Edit Timetables</strong> to manually fix anything, lock cells, and export to Excel.</li>
        </ol>
      </div>
    </div>
  );
}
