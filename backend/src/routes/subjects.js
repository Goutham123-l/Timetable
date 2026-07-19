const express = require("express");
const prisma = require("../prisma");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();

router.get("/", authenticate, async (req, res) => {
  const { year } = req.query;
  const where = {};
  if (year) where.OR = [{ year: Number(year) }, { year: null }];
  const subjects = await prisma.subject.findMany({ where, orderBy: [{ year: "asc" }, { name: "asc" }] });
  res.json(subjects);
});

router.post("/", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    const { name, code, type, weeklyHours, year, alwaysLastPeriod } = req.body;
    const subject = await prisma.subject.create({
      data: {
        name,
        code,
        type: type === "LAB" ? "LAB" : "THEORY",
        weeklyHours: Number(weeklyHours) || 3,
        year: year ? Number(year) : null,
        alwaysLastPeriod: !!alwaysLastPeriod,
      },
    });
    res.json(subject);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put("/:id", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    const { name, code, type, weeklyHours, year, alwaysLastPeriod } = req.body;
    const subject = await prisma.subject.update({
      where: { id: Number(req.params.id) },
      data: {
        name,
        code,
        type: type === "LAB" ? "LAB" : "THEORY",
        weeklyHours: Number(weeklyHours),
        year: year ? Number(year) : null,
        alwaysLastPeriod: !!alwaysLastPeriod,
      },
    });
    res.json(subject);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/:id", authenticate, authorize("ADMIN"), async (req, res) => {
  const subjectId = Number(req.params.id);
  const force = req.query.force === "true";

  const [assignmentCount, entryCount] = await Promise.all([
    prisma.assignment.count({ where: { subjectId } }),
    prisma.timetableEntry.count({ where: { subjectId } }),
  ]);

  if (!force && (assignmentCount > 0 || entryCount > 0)) {
    return res.status(409).json({
      inUse: true,
      message: `This subject is used in ${assignmentCount} assignment(s) and ${entryCount} scheduled period(s).`,
      assignments: assignmentCount,
      entries: entryCount,
    });
  }

  try {
    if (force) {
      await prisma.timetableEntry.deleteMany({ where: { subjectId } });
      await prisma.assignment.deleteMany({ where: { subjectId } });
    }
    await prisma.subject.delete({ where: { id: subjectId } });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ message: "Could not delete this subject: " + err.message });
  }
});

module.exports = router;
