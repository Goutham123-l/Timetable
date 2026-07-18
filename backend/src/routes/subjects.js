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
  try {
    await prisma.subject.delete({ where: { id: Number(req.params.id) } });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ message: "Cannot delete: this subject is used in the Assignment Table. Remove those rows first, then delete it here." });
  }
});

module.exports = router;
