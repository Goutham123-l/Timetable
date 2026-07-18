require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const departmentRoutes = require("./routes/departments");
const sectionRoutes = require("./routes/sections");
const subjectRoutes = require("./routes/subjects");
const teacherRoutes = require("./routes/teachers");
const classroomRoutes = require("./routes/classrooms");
const settingsRoutes = require("./routes/settings");
const assignmentRoutes = require("./routes/assignments");
const timetableRoutes = require("./routes/timetable");
const exportRoutes = require("./routes/export");

const app = express();

// In local dev, allow everything. In production, set FRONTEND_URL to your
// deployed frontend's exact URL (e.g. https://your-app.vercel.app) so only
// your site can call this API.
const allowedOrigin = process.env.FRONTEND_URL;
app.use(
  cors(
    allowedOrigin
      ? { origin: allowedOrigin }
      : {}
  )
);
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/sections", sectionRoutes);
app.use("/api/subjects", subjectRoutes);
app.use("/api/teachers", teacherRoutes);
app.use("/api/classrooms", classroomRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/timetable", timetableRoutes);
app.use("/api/export", exportRoutes);

app.use((req, res) => res.status(404).json({ message: "Route not found" }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Timetable API running on http://localhost:${PORT}`));
