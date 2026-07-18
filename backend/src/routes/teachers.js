const express = require("express");
const prisma = require("../prisma");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();

router.get("/", authenticate, async (req, res) => {
  const teachers = await prisma.teacher.findMany({
    include: { department: true },
    orderBy: { name: "asc" },
  });
  res.json(teachers);
});

router.post("/", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    const { name, departmentId, designation, maxPeriodsDay, maxPeriodsWeek } = req.body;
    const teacher = await prisma.teacher.create({
      data: {
        name,
        departmentId: Number(departmentId),
        designation: designation || null,
        maxPeriodsDay: Number(maxPeriodsDay) || 6,
        maxPeriodsWeek: Number(maxPeriodsWeek) || 24,
      },
    });
    res.json(teacher);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put("/:id", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    const { name, departmentId, designation, maxPeriodsDay, maxPeriodsWeek } = req.body;
    const teacher = await prisma.teacher.update({
      where: { id: Number(req.params.id) },
      data: {
        name,
        departmentId: Number(departmentId),
        designation: designation || null,
        maxPeriodsDay: Number(maxPeriodsDay),
        maxPeriodsWeek: Number(maxPeriodsWeek),
      },
    });
    res.json(teacher);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/:id", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    await prisma.teacher.delete({ where: { id: Number(req.params.id) } });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ message: "Cannot delete: teacher is in use" });
  }
});

module.exports = router;
