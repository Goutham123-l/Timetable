const express = require("express");
const prisma = require("../prisma");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();

router.get("/", authenticate, async (req, res) => {
  const { sectionId, teacherId } = req.query;
  const where = {};
  if (sectionId) where.sectionId = Number(sectionId);
  if (teacherId) where.teacherId = Number(teacherId);

  const assignments = await prisma.assignment.findMany({
    where,
    include: {
      teacher: true,
      subject: true,
      section: { include: { department: true } },
    },
    orderBy: { id: "asc" },
  });
  res.json(assignments);
});

router.post("/", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    const { teacherId, subjectId, sectionId, periodsPerWeek, coTeacherIds } = req.body;
    const assignment = await prisma.assignment.create({
      data: {
        teacherId: Number(teacherId),
        subjectId: Number(subjectId),
        sectionId: Number(sectionId),
        periodsPerWeek: Number(periodsPerWeek),
        coTeacherIds: Array.isArray(coTeacherIds) ? coTeacherIds.map(Number) : [],
      },
      include: { teacher: true, subject: true, section: true },
    });
    res.json(assignment);
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(400).json({ message: "This teacher+subject+section combination already exists" });
    }
    res.status(400).json({ message: err.message });
  }
});

router.put("/:id", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    const { teacherId, subjectId, sectionId, periodsPerWeek, coTeacherIds } = req.body;
    const assignment = await prisma.assignment.update({
      where: { id: Number(req.params.id) },
      data: {
        teacherId: Number(teacherId),
        subjectId: Number(subjectId),
        sectionId: Number(sectionId),
        periodsPerWeek: Number(periodsPerWeek),
        coTeacherIds: Array.isArray(coTeacherIds) ? coTeacherIds.map(Number) : [],
      },
      include: { teacher: true, subject: true, section: true },
    });
    res.json(assignment);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/:id", authenticate, authorize("ADMIN"), async (req, res) => {
  await prisma.assignment.delete({ where: { id: Number(req.params.id) } });
  res.json({ success: true });
});

// Clear the entire assignment table (every section, every teacher).
router.delete("/", authenticate, authorize("ADMIN"), async (req, res) => {
  await prisma.assignment.deleteMany({});
  res.json({ success: true });
});

module.exports = router;
