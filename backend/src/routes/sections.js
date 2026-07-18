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
  try {
    await prisma.section.delete({ where: { id: Number(req.params.id) } });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ message: "Cannot delete: section is in use" });
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
