import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@college.edu");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100">
      <form onSubmit={handleSubmit} className="bg-white/90 backdrop-blur p-8 rounded-2xl shadow-xl w-full max-w-sm border border-slate-200">
        <h1 className="text-xl font-bold text-brand-700 mb-1">AI College Timetable</h1>
        <p className="text-slate-500 text-sm mb-6">Sign in to continue</p>

        {error && <div className="bg-red-50 text-red-600 text-sm p-2 rounded mb-4">{error}</div>}

        <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
        <input
          className="w-full border border-slate-300 rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-brand-500"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          required
        />

        <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
        <input
          className="w-full border border-slate-300 rounded-lg px-3 py-2 mb-6 focus:outline-none focus:ring-2 focus:ring-brand-500"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          required
        />

        <button
          disabled={loading}
          className="w-full bg-brand-500 hover:bg-brand-600 text-white font-medium py-2 rounded-lg transition disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>

        <div className="mt-5 text-xs text-slate-500 bg-slate-50 p-3 rounded-lg leading-relaxed">
          <strong>Seeded demo accounts</strong> (password: password123)
          <br />
          Admin: admin@college.edu
          <br />
          Teacher: kumar@college.edu
          <br />
          Student: student@college.edu
        </div>
      </form>
    </div>
  );
}
