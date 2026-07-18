import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const adminLinks = [
  { to: "/", label: "Dashboard" },
  { to: "/masters", label: "Departments / Sections / Subjects / Teachers / Rooms" },
  { to: "/assignments", label: "Teacher-Subject Assignment Table" },
  { to: "/generate", label: "Generate Timetable" },
  { to: "/view", label: "View & Edit Timetables" },
];

const teacherLinks = [{ to: "/", label: "My Timetable" }];
const studentLinks = [{ to: "/", label: "Class Timetable" }];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const links = user?.role === "ADMIN" ? adminLinks : user?.role === "TEACHER" ? teacherLinks : studentLinks;

  return (
    <div className="w-72 bg-white border-r border-slate-200 min-h-screen flex flex-col">
      <div className="p-5 border-b border-slate-200">
        <h1 className="font-bold text-brand-600 text-lg leading-tight">Timely Campus</h1>
        <p className="text-xs text-slate-500 mt-1">
          {user?.name} · <span className="uppercase">{user?.role}</span>
        </p>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === "/"}
            className={({ isActive }) =>
              `block px-3 py-2 rounded-lg text-sm ${
                isActive ? "bg-brand-500 text-white" : "text-slate-700 hover:bg-slate-100"
              }`
            }
          >
            {l.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-slate-200">
        <button
          onClick={() => {
            logout();
            navigate("/login");
          }}
          className="w-full px-3 py-2 rounded-lg text-sm bg-slate-100 hover:bg-slate-200 text-slate-700"
        >
          Log out
        </button>
      </div>
    </div>
  );
}
