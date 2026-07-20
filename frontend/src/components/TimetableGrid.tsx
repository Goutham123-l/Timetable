import React from "react";
import { subjectColor } from "./subjectColor";

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
  subjectId?: number;
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
  showLegend = true,
  cellStatus,
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
  showLegend?: boolean;
  // When set (while a cell is selected for moving/swapping), highlights each
  // slot green if it's a valid destination, or dims it if not.
  cellStatus?: Record<string, { valid: boolean; type: "move" | "swap"; reason?: string | null }>;
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

  // Build a legend of every distinct subject currently shown, each with its
  // consistent color, so it's easy to spot a subject at a glance across the
  // whole week.
  const legendMap = new Map<string, string>();
  entries.forEach((e) => {
    const name = e.subject?.name;
    if (name && !legendMap.has(name)) legendMap.set(name, String(e.subjectId ?? name));
  });

  return (
    <div>
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
                  const color = entry ? subjectColor(entry.subjectId ?? entry.subject?.name) : null;
                  const status = cellStatus?.[`${d.id}-${p.id}`];
                  return (
                    <td
                      key={p.id}
                      onClick={() => editable && onCellClick && onCellClick(entry || null, d.id, p.id)}
                      className={`p-2 text-center align-top min-w-[120px] border-l-4 ${
                        color ? `${color.bg} ${color.border}` : "border-l-transparent"
                      } ${editable ? "cursor-pointer hover:brightness-95" : ""} ${
                        isSelected ? "ring-2 ring-brand-500" : ""
                      } ${
                        status
                          ? status.valid
                            ? "ring-2 ring-green-500 bg-green-50"
                            : "opacity-50"
                          : ""
                      }`}
                    >
                      {entry ? (
                        <div>
                          <div className={`font-semibold ${color?.text || "text-slate-800"}`}>{entry.subject?.name}</div>
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

      {showLegend && legendMap.size > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 px-1">
          {[...legendMap.entries()].map(([name, key]) => {
            const color = subjectColor(key);
            return (
              <div key={name} className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className={`w-2.5 h-2.5 rounded-full ${color.dot}`} />
                {name}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
