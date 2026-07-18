import React from "react";

interface Period {
  id: number;
  label: string;
  startTime: string;
  endTime: string;
  isLunch: boolean;
}
interface Day {
  id: number;
  name: string;
}
interface Entry {
  id: number;
  dayId: number;
  periodId: number;
  subject?: { name: string };
  teacher?: { name: string };
  coTeachers?: { name: string }[];
  section?: { name: string; year?: number; department?: { code: string } };
  classroom?: { roomNumber: string } | null;
}

export default function TimetableGrid({
  days,
  periods,
  entries,
  mode = "section",
  editable = false,
  selectedId,
  onCellClick,
}: {
  days: Day[];
  periods: Period[];
  entries: Entry[];
  // "section": admin viewing a section's timetable (shows teacher name)
  // "student": student-facing view (subject only, no teacher shown)
  // "teacher": teacher's own timetable (shows class + section)
  mode?: "section" | "student" | "teacher";
  editable?: boolean;
  selectedId?: number | null;
  onCellClick?: (entry: Entry | null, dayId: number, periodId: number) => void;
}) {
  const grid: Record<string, Entry> = {};
  entries.forEach((e) => (grid[`${e.dayId}-${e.periodId}`] = e));

  function classLabel(entry: Entry) {
    const dept = entry.section?.department?.code;
    const name = entry.section?.name;
    const year = entry.section?.year;
    if (!name) return "";
    return `${dept ? dept + " " : ""}${name}${year ? ` (Yr ${year})` : ""}`;
  }

  function teacherLabel(entry: Entry) {
    const names = [entry.teacher?.name, ...(entry.coTeachers?.map((t) => t.name) || [])].filter(Boolean);
    return names.join(" + ");
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-full text-sm border-collapse">
        <thead>
          <tr className="bg-brand-500 text-white">
            <th className="p-2 sticky left-0 bg-brand-500 text-left">Day / Period</th>
            {periods.map((p) => (
              <th key={p.id} className="p-2 text-center whitespace-nowrap">
                {p.isLunch ? "LUNCH" : p.label}
                <div className="text-[10px] font-normal opacity-80">
                  {p.startTime}-{p.endTime}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.id} className="border-t border-slate-200">
              <td className="p-2 font-medium sticky left-0 bg-white">{d.name}</td>
              {periods.map((p) => {
                if (p.isLunch) {
                  return (
                    <td key={p.id} className="p-2 text-center bg-slate-100 text-slate-400">
                      —
                    </td>
                  );
                }
                const entry = grid[`${d.id}-${p.id}`];
                const isSelected = entry && selectedId === entry.id;
                return (
                  <td
                    key={p.id}
                    onClick={() => editable && onCellClick && onCellClick(entry || null, d.id, p.id)}
                    className={`p-2 text-center align-top min-w-[120px] ${
                      editable ? "cursor-pointer hover:bg-brand-50" : ""
                    } ${isSelected ? "ring-2 ring-brand-500 bg-brand-50" : ""}`}
                  >
                    {entry ? (
                      <div>
                        <div className="font-semibold text-slate-800">{entry.subject?.name}</div>
                        {mode === "section" && (
                          <div className="text-xs text-slate-500">{teacherLabel(entry)}</div>
                        )}
                        {mode === "teacher" && (
                          <div className="text-xs text-slate-500">{classLabel(entry)}</div>
                        )}
                        {entry.classroom && (
                          <div className="text-[10px] text-brand-600 mt-0.5">{entry.classroom.roomNumber}</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-300">Free</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
