const express = require("express");
const prisma = require("../prisma");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();

// All entries scheduled on a given working day (by weekday, e.g. "Monday")
// — used to check who's already teaching at a given period before picking
// a substitute.
router.get("/by-day/:dayId", authenticate, async (req, res) => {
  const dayId = Number(req.params.dayId);
  const entries = await prisma.timetableEntry.findMany({
    where: { dayId },
    include: { teacher: true, section: { include: { department: true } } },
  });
  res.json(entries);
});

router.get("/", authenticate, async (req, res) => {
  const { from, to } = req.query;
  const where = {};
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(from);
    if (to) where.date.lte = new Date(to);
  }
  const rows = await prisma.emergencySubstitution.findMany({
    where,
    include: {
      section: { include: { department: true } },
      period: true,
      originalTeacher: true,
      substituteTeacher: true,
    },
    orderBy: { date: "desc" },
    take: 100,
  });
  const subjectIds = [...new Set(rows.map((r) => r.subjectId))];
  const subjects = await prisma.subject.findMany({ where: { id: { in: subjectIds } } });
  const subjectMap = Object.fromEntries(subjects.map((s) => [s.id, s]));
  res.json(rows.map((r) => ({ ...r, subject: subjectMap[r.subjectId] })));
});

router.post("/", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    const { date, dayOfWeek, sectionId, periodId, subjectId, originalTeacherId, substituteTeacherId, note } = req.body;
    if (Number(originalTeacherId) === Number(substituteTeacherId)) {
      return res.status(400).json({ message: "Substitute teacher must be different from the absent teacher." });
    }
    const row = await prisma.emergencySubstitution.create({
      data: {
        date: new Date(date),
        dayOfWeek,
        sectionId: Number(sectionId),
        periodId: Number(periodId),
        subjectId: Number(subjectId),
        originalTeacherId: Number(originalTeacherId),
        substituteTeacherId: Number(substituteTeacherId),
        note: note || null,
        createdBy: req.user.name,
      },
      include: { section: true, period: true, originalTeacher: true, substituteTeacher: true },
    });
    res.json(row);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/:id", authenticate, authorize("ADMIN"), async (req, res) => {
  await prisma.emergencySubstitution.delete({ where: { id: Number(req.params.id) } });
  res.json({ success: true });
});

module.exports = router;
