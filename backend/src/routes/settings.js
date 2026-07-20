const express = require("express");
const prisma = require("../prisma");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();

// ---- App Settings (institution details + scheduler preferences) ----
// Single row, id always 1 — created with defaults on first read if missing.
router.get("/app", authenticate, async (req, res) => {
  let settings = await prisma.appSettings.findUnique({ where: { id: 1 } });
  if (!settings) {
    settings = await prisma.appSettings.create({ data: { id: 1 } });
  }
  res.json(settings);
});

router.put("/app", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    const { institutionName, accountName, contactEmail, labsSideBySide, preferLastTwoPeriodsForLabs } = req.body;
    const settings = await prisma.appSettings.upsert({
      where: { id: 1 },
      update: {
        institutionName: institutionName ?? undefined,
        accountName: accountName ?? undefined,
        contactEmail: contactEmail ?? undefined,
        labsSideBySide: labsSideBySide !== undefined ? !!labsSideBySide : undefined,
        preferLastTwoPeriodsForLabs: preferLastTwoPeriodsForLabs !== undefined ? !!preferLastTwoPeriodsForLabs : undefined,
      },
      create: {
        id: 1,
        institutionName: institutionName || null,
        accountName: accountName || null,
        contactEmail: contactEmail || null,
        labsSideBySide: labsSideBySide !== undefined ? !!labsSideBySide : true,
        preferLastTwoPeriodsForLabs: !!preferLastTwoPeriodsForLabs,
      },
    });
    res.json(settings);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

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
  const dayId = Number(req.params.id);
  const force = req.query.force === "true";
  const entryCount = await prisma.timetableEntry.count({ where: { dayId } });

  if (!force && entryCount > 0) {
    return res.status(409).json({
      inUse: true,
      message: `This day has ${entryCount} scheduled period(s) on it.`,
      entries: entryCount,
    });
  }
  try {
    if (force) {
      await prisma.timetableEntry.deleteMany({ where: { dayId } });
      await prisma.sectionDayOff.deleteMany({ where: { dayId } });
    }
    await prisma.workingDay.delete({ where: { id: dayId } });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ message: "Could not delete this day: " + err.message });
  }
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
  const periodId = Number(req.params.id);
  const force = req.query.force === "true";
  const entryCount = await prisma.timetableEntry.count({ where: { periodId } });

  if (!force && entryCount > 0) {
    return res.status(409).json({
      inUse: true,
      message: `This period has ${entryCount} scheduled class(es) in it.`,
      entries: entryCount,
    });
  }
  try {
    if (force) {
      await prisma.timetableEntry.deleteMany({ where: { periodId } });
    }
    await prisma.period.delete({ where: { id: periodId } });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ message: "Could not delete this period: " + err.message });
  }
});

module.exports = router;
