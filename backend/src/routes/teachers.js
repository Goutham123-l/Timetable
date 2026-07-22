const express = require("express");
const prisma = require("../prisma");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();

// Generous, non-restrictive defaults — admins no longer set these manually.
// High enough that they never become an artificial blocker, while still
// preventing a literal data-entry accident (e.g. 500 periods/week).
const DEFAULT_MAX_PER_DAY = 8;
const DEFAULT_MAX_PER_WEEK = 40;

router.get("/", authenticate, async (req, res) => {
  const teachers = await prisma.teacher.findMany({
    include: { department: true },
    orderBy: { name: "asc" },
  });
  res.json(teachers);
});

router.post("/", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    const { name, departmentId, designation } = req.body;
    const teacher = await prisma.teacher.create({
      data: {
        name,
        departmentId: Number(departmentId),
        designation: designation || null,
        maxPeriodsDay: DEFAULT_MAX_PER_DAY,
        maxPeriodsWeek: DEFAULT_MAX_PER_WEEK,
      },
    });
    res.json(teacher);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put("/:id", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    const { name, departmentId, designation } = req.body;
    const teacher = await prisma.teacher.update({
      where: { id: Number(req.params.id) },
      data: {
        name,
        departmentId: Number(departmentId),
        designation: designation || null,
        // Self-heal any older teacher record that still has a low legacy cap.
        maxPeriodsDay: DEFAULT_MAX_PER_DAY,
        maxPeriodsWeek: DEFAULT_MAX_PER_WEEK,
      },
    });
    res.json(teacher);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Check how many assignments/timetable entries reference this teacher,
// either as the primary teacher or as a co-teacher.
async function usageCounts(teacherId) {
  const [primaryAssignments, coAssignments, primaryEntries, coEntries] = await Promise.all([
    prisma.assignment.count({ where: { teacherId } }),
    prisma.assignment.count({ where: { coTeacherIds: { has: teacherId } } }),
    prisma.timetableEntry.count({ where: { teacherId } }),
    prisma.timetableEntry.count({ where: { coTeacherIds: { has: teacherId } } }),
  ]);
  return { assignments: primaryAssignments + coAssignments, entries: primaryEntries + coEntries };
}

router.delete("/:id", authenticate, authorize("ADMIN"), async (req, res) => {
  const teacherId = Number(req.params.id);
  const force = req.query.force === "true";

  const usage = await usageCounts(teacherId);

  if (!force && (usage.assignments > 0 || usage.entries > 0)) {
    return res.status(409).json({
      inUse: true,
      message: `This teacher is used in ${usage.assignments} assignment(s) and ${usage.entries} scheduled period(s).`,
      assignments: usage.assignments,
      entries: usage.entries,
    });
  }

  try {
    if (force) {
      // Remove them as primary from assignments/entries entirely.
      await prisma.assignment.deleteMany({ where: { teacherId } });
      await prisma.timetableEntry.deleteMany({ where: { teacherId } });

      // Where they're only a co-teacher, strip them from the array instead
      // of deleting the whole session (someone else is still primary there).
      const coAssignments = await prisma.assignment.findMany({ where: { coTeacherIds: { has: teacherId } } });
      for (const a of coAssignments) {
        await prisma.assignment.update({
          where: { id: a.id },
          data: { coTeacherIds: a.coTeacherIds.filter((id) => id !== teacherId) },
        });
      }
      const coEntries = await prisma.timetableEntry.findMany({ where: { coTeacherIds: { has: teacherId } } });
      for (const e of coEntries) {
        await prisma.timetableEntry.update({
          where: { id: e.id },
          data: { coTeacherIds: e.coTeacherIds.filter((id) => id !== teacherId) },
        });
      }
    }
    await prisma.teacher.delete({ where: { id: teacherId } });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ message: "Could not delete this teacher: " + err.message });
  }
});

// ---- Busy-elsewhere slots (e.g. a class in another branch/department) ----
// The generator treats these exactly like a hard conflict: never places
// anything for this teacher in that day+period.

router.get("/:id/busy-slots", authenticate, async (req, res) => {
  const rows = await prisma.teacherBusySlot.findMany({
    where: { teacherId: Number(req.params.id) },
    include: { day: true, period: true },
    orderBy: [{ day: { order: "asc" } }, { period: { index: "asc" } }],
  });
  res.json(rows);
});

router.post("/:id/busy-slots", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    const { dayId, periodId, note } = req.body;
    const row = await prisma.teacherBusySlot.create({
      data: { teacherId: Number(req.params.id), dayId: Number(dayId), periodId: Number(periodId), note: note || null },
      include: { day: true, period: true },
    });
    res.json(row);
  } catch (err) {
    if (err.code === "P2002") return res.status(400).json({ message: "This teacher already has a busy slot marked for that day and period." });
    res.status(400).json({ message: err.message });
  }
});

router.delete("/:id/busy-slots/:slotId", authenticate, authorize("ADMIN"), async (req, res) => {
  await prisma.teacherBusySlot.delete({ where: { id: Number(req.params.slotId) } });
  res.json({ success: true });
});

// Deletes every teacher. Since this removes every teacher, every assignment
// and generated period necessarily becomes invalid too, so those are wiped
// along with it — there's nothing meaningful left to keep.
router.delete("/", authenticate, authorize("ADMIN"), async (req, res) => {
  await prisma.timetableEntry.deleteMany({});
  await prisma.assignment.deleteMany({});
  await prisma.teacherBusySlot.deleteMany({});
  await prisma.emergencySubstitution.deleteMany({});
  await prisma.teacher.deleteMany({});
  res.json({ success: true });
});

module.exports = router;
