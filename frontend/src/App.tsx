import React from "react";
import { Routes, Route } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Sidebar from "./components/Sidebar";
import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import Masters from "./pages/Masters";
import Assignments from "./pages/Assignments";
import GenerateTimetable from "./pages/GenerateTimetable";
import TimetableView from "./pages/TimetableView";
import TeacherView from "./pages/TeacherView";
import StudentView from "./pages/StudentView";
import Settings from "./pages/Settings";

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/"
        element={
          user?.role === "ADMIN" ? (
            <ProtectedRoute allow={["ADMIN"]}>
              <Layout><AdminDashboard /></Layout>
            </ProtectedRoute>
          ) : user?.role === "TEACHER" ? (
            <ProtectedRoute allow={["TEACHER"]}>
              <Layout><TeacherView /></Layout>
            </ProtectedRoute>
          ) : (
            <ProtectedRoute allow={["STUDENT"]}>
              <Layout><StudentView /></Layout>
            </ProtectedRoute>
          )
        }
      />

      <Route
        path="/masters"
        element={<ProtectedRoute allow={["ADMIN"]}><Layout><Masters /></Layout></ProtectedRoute>}
      />
      <Route
        path="/assignments"
        element={<ProtectedRoute allow={["ADMIN"]}><Layout><Assignments /></Layout></ProtectedRoute>}
      />
      <Route
        path="/generate"
        element={<ProtectedRoute allow={["ADMIN"]}><Layout><GenerateTimetable /></Layout></ProtectedRoute>}
      />
      <Route
        path="/view"
        element={<ProtectedRoute allow={["ADMIN"]}><Layout><TimetableView /></Layout></ProtectedRoute>}
      />
      <Route
        path="/settings"
        element={<ProtectedRoute allow={["ADMIN"]}><Layout><Settings /></Layout></ProtectedRoute>}
      />
    </Routes>
  );
}
