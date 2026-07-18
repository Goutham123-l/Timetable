const express = require("express");
const prisma = require("../prisma");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();

// ---- Working Days ----
router.get("/days", authenticate, async (req, res) => {
  const days = await prisma.workingDay.findMany({ orderBy: { order: "asc" } });
  res.json(days);
});

router.post("/days", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    const { name, order, active } = req.body;
    const day = await prisma.workingDay.create({
      data: { name, order: Number(order), active: active !== false },
    });
    res.json(day);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put("/days/:id", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    const { name, order, active } = req.body;
    const day = await prisma.workingDay.update({
      where: { id: Number(req.params.id) },
      data: { name, order: Number(order), active },
    });
    res.json(day);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/days/:id", authenticate, authorize("ADMIN"), async (req, res) => {
  await prisma.workingDay.delete({ where: { id: Number(req.params.id) } });
  res.json({ success: true });
});

// ---- Periods ----
router.get("/periods", authenticate, async (req, res) => {
  const periods = await prisma.period.findMany({ orderBy: { index: "asc" } });
  res.json(periods);
});

router.post("/periods", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    const { index, label, startTime, endTime, isLunch } = req.body;
    const period = await prisma.period.create({
      data: { index: Number(index), label, startTime, endTime, isLunch: !!isLunch },
    });
    res.json(period);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put("/periods/:id", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    const { index, label, startTime, endTime, isLunch } = req.body;
    const period = await prisma.period.update({
      where: { id: Number(req.params.id) },
      data: { index: Number(index), label, startTime, endTime, isLunch: !!isLunch },
    });
    res.json(period);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/periods/:id", authenticate, authorize("ADMIN"), async (req, res) => {
  await prisma.period.delete({ where: { id: Number(req.params.id) } });
  res.json({ success: true });
});

module.exports = router;
