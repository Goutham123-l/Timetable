const express = require("express");
const prisma = require("../prisma");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();

router.get("/", authenticate, async (req, res) => {
  const { departmentId, year } = req.query;
  const where = {};
  if (departmentId) where.departmentId = Number(departmentId);
  if (year) where.year = Number(year);
  const sections = await prisma.section.findMany({
    where,
    include: { department: true },
    orderBy: [{ year: "asc" }, { name: "asc" }],
  });
  res.json(sections);
});

router.post("/", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    const { name, year, departmentId } = req.body;
    const section = await prisma.section.create({
      data: { name, year: Number(year), departmentId: Number(departmentId) },
    });
    res.json(section);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put("/:id", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    const { name, year, departmentId } = req.body;
    const section = await prisma.section.update({
      where: { id: Number(req.params.id) },
      data: { name, year: Number(year), departmentId: Number(departmentId) },
    });
    res.json(section);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/:id", authenticate, authorize("ADMIN"), async (req, res) => {
  const sectionId = Number(req.params.id);
  const force = req.query.force === "true";

  const [assignmentCount, entryCount, userCount] = await Promise.all([
    prisma.assignment.count({ where: { sectionId } }),
    prisma.timetableEntry.count({ where: { sectionId } }),
    prisma.user.count({ where: { sectionId } }),
  ]);

  if (!force && (assignmentCount > 0 || entryCount > 0 || userCount > 0)) {
    return res.status(409).json({
      inUse: true,
      message: `This section is used in ${assignmentCount} assignment(s), ${entryCount} scheduled period(s), and ${userCount} student login(s).`,
      assignments: assignmentCount,
      entries: entryCount,
      users: userCount,
    });
  }

  try {
    if (force) {
      await prisma.timetableEntry.deleteMany({ where: { sectionId } });
      await prisma.assignment.deleteMany({ where: { sectionId } });
      await prisma.sectionDayOff.deleteMany({ where: { sectionId } });
      // Unlink student accounts rather than deleting the accounts themselves.
      await prisma.user.updateMany({ where: { sectionId }, data: { sectionId: null } });
    }
    await prisma.section.delete({ where: { id: sectionId } });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ message: "Could not delete this section: " + err.message });
  }
});

// ---- Per-section day-off exceptions ----
// e.g. CSE 3rd Year has no Saturday classes even though Saturday is a
// generally active working day for the rest of the college.

router.get("/:id/days-off", authenticate, async (req, res) => {
  const rows = await prisma.sectionDayOff.findMany({
    where: { sectionId: Number(req.params.id) },
    include: { day: true },
  });
  res.json(rows);
});

router.post("/:id/days-off", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    const { dayId } = req.body;
    const row = await prisma.sectionDayOff.create({
      data: { sectionId: Number(req.params.id), dayId: Number(dayId) },
      include: { day: true },
    });
    res.json(row);
  } catch (err) {
    if (err.code === "P2002") return res.status(400).json({ message: "That day is already marked off for this section" });
    res.status(400).json({ message: err.message });
  }
});

router.delete("/:id/days-off/:dayId", authenticate, authorize("ADMIN"), async (req, res) => {
  await prisma.sectionDayOff.deleteMany({
    where: { sectionId: Number(req.params.id), dayId: Number(req.params.dayId) },
  });
  res.json({ success: true });
});

module.exports = router;
