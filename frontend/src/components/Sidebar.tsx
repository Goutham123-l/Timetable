import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import {
  LayoutDashboard,
  Building2,
  ClipboardList,
  Sparkles,
  CalendarDays,
  AlertTriangle,
  Settings as SettingsIcon,
  LogOut,
  Moon,
  Sun,
} from "lucide-react";

const adminLinks = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/masters", label: "Departments / Sections / Subjects / Teachers / Rooms", icon: Building2 },
  { to: "/assignments", label: "Teacher-Subject Assignment Table", icon: ClipboardList },
  { to: "/generate", label: "Generate Timetable", icon: Sparkles },
  { to: "/view", label: "View & Edit Timetables", icon: CalendarDays },
  { to: "/emergency", label: "Emergency Scheduler", icon: AlertTriangle },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

const teacherLinks = [{ to: "/", label: "My Timetable", icon: CalendarDays }];
const studentLinks = [{ to: "/", label: "Class Timetable", icon: CalendarDays }];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const links = user?.role === "ADMIN" ? adminLinks : user?.role === "TEACHER" ? teacherLinks : studentLinks;
  const initial = (user?.name || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="w-72 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 min-h-screen flex flex-col transition-colors">
      <div className="p-5 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-brand-500 text-white flex items-center justify-center font-bold text-base flex-shrink-0">
            AI
          </div>
          <div>
            <h1 className="font-bold text-slate-800 dark:text-slate-100 text-sm leading-tight">AI College Timetable</h1>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">Administration Panel</p>
          </div>
        </div>
        <div className="flex items-center justify-between mt-4 bg-slate-50 dark:bg-slate-900/60 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-500/20 text-brand-600 dark:text-brand-300 flex items-center justify-center text-xs font-semibold flex-shrink-0">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">{user?.name}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
            className="w-7 h-7 flex-shrink-0 rounded-full flex items-center justify-center bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600"
          >
            {theme === "light" ? <Moon size={14} /> : <Sun size={14} />}
          </button>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-0.5">
        {links.map((l) => {
          const Icon = l.icon;
          return (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm ${
                  isActive
                    ? "bg-brand-500 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                }`
              }
            >
              <Icon size={17} className="flex-shrink-0" />
              <span className="leading-tight">{l.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="p-3 border-t border-slate-200 dark:border-slate-700">
        <button
          onClick={() => {
            logout();
            navigate("/login");
          }}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200"
        >
          <LogOut size={15} />
          Log out
        </button>
      </div>
    </div>
  );
}
