const express = require("express");
const prisma = require("../prisma");
const { authenticate, authorize } = require("../middleware/auth");
const { generateTimetable } = require("../scheduler/generate");

const router = express.Router();

const entryInclude = {
  section: { include: { department: true } },
  teacher: true,
  day: true,
  period: true,
  classroom: true,
};

// Resolves each entry's coTeacherIds into full teacher objects for display.
async function withCoTeachers(entries) {
  const allCoIds = [...new Set(entries.flatMap((e) => e.coTeacherIds || []))];
  if (allCoIds.length === 0) return entries.map((e) => ({ ...e, coTeachers: [] }));
  const teachers = await prisma.teacher.findMany({ where: { id: { in: allCoIds } } });
  const teacherMap = Object.fromEntries(teachers.map((t) => [t.id, t]));
  return entries.map((e) => ({
    ...e,
    coTeachers: (e.coTeacherIds || []).map((id) => teacherMap[id]).filter(Boolean),
  }));
}

// Pre-generation check: for every section, compares how many periods/week
// are actually assigned (via the Assignment Table) against how many teaching
// slots exist for it (working days × non-lunch periods, minus that section's
// own off-days). This is what determines whether a student's timetable can
// come out fully packed with no "Free" periods, or short/over.
router.get("/readiness", authenticate, async (req, res) => {
  const [sections, activeDays, periods, assignments, sectionDaysOff] = await Promise.all([
    prisma.section.findMany({ include: { department: true } }),
    prisma.workingDay.findMany({ where: { active: true } }),
    prisma.period.findMany({ where: { isLunch: false } }),
    prisma.assignment.findMany(),
    prisma.sectionDayOff.findMany(),
  ]);

  const offDaysBySection = {};
  for (const row of sectionDaysOff) {
    if (!offDaysBySection[row.sectionId]) offDaysBySection[row.sectionId] = new Set();
    offDaysBySection[row.sectionId].add(row.dayId);
  }
  const assignedBySection = {};
  for (const a of assignments) {
    assignedBySection[a.sectionId] = (assignedBySection[a.sectionId] || 0) + a.periodsPerWeek;
  }

  const results = sections.map((s) => {
    const offCount = offDaysBySection[s.id]?.size || 0;
    const effectiveDays = Math.max(activeDays.length - offCount, 0);
    const totalSlots = effectiveDays * periods.length;
    const totalAssigned = assignedBySection[s.id] || 0;
    return {
      sectionId: s.id,
      label: `${s.department?.code || ""} ${s.name} (Yr ${s.year})`,
      totalSlots,
      totalAssigned,
      gap: totalSlots - totalAssigned, // > 0 = short (will have Free periods), < 0 = over-assigned
    };
  });

  res.json(results);
});

// ADMIN triggers generation
router.post("/generate", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    const result = await generateTimetable();
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Timetable generation failed: " + err.message });
  }
});

// Section (student) timetable
router.get("/section/:sectionId", authenticate, async (req, res) => {
  const entries = await prisma.timetableEntry.findMany({
    where: { sectionId: Number(req.params.sectionId) },
    include: entryInclude,
    orderBy: [{ dayId: "asc" }, { periodId: "asc" }],
  });
  const subjectIds = [...new Set(entries.map((e) => e.subjectId))];
  const subjects = await prisma.subject.findMany({ where: { id: { in: subjectIds } } });
  const subjectMap = Object.fromEntries(subjects.map((s) => [s.id, s]));
  const withSubjects = entries.map((e) => ({ ...e, subject: subjectMap[e.subjectId] }));
  res.json(await withCoTeachers(withSubjects));
});

// Teacher timetable (includes sessions where this teacher is a co-teacher too)
router.get("/teacher/:teacherId", authenticate, async (req, res) => {
  const teacherId = Number(req.params.teacherId);
  const entries = await prisma.timetableEntry.findMany({
    where: { OR: [{ teacherId }, { coTeacherIds: { has: teacherId } }] },
    include: entryInclude,
    orderBy: [{ dayId: "asc" }, { periodId: "asc" }],
  });
  const subjectIds = [...new Set(entries.map((e) => e.subjectId))];
  const subjects = await prisma.subject.findMany({ where: { id: { in: subjectIds } } });
  const subjectMap = Object.fromEntries(subjects.map((s) => [s.id, s]));
  const withSubjects = entries.map((e) => ({ ...e, subject: subjectMap[e.subjectId] }));
  res.json(await withCoTeachers(withSubjects));
});

// Room timetable
router.get("/room/:roomId", authenticate, async (req, res) => {
  const entries = await prisma.timetableEntry.findMany({
    where: { classroomId: Number(req.params.roomId) },
    include: entryInclude,
    orderBy: [{ dayId: "asc" }, { periodId: "asc" }],
  });
  res.json(entries);
});

// Manual edit: move/swap subject-teacher-classroom for one entry
router.put("/entry/:id", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    const { dayId, periodId, teacherId, classroomId, locked } = req.body;
    const id = Number(req.params.id);
    const current = await prisma.timetableEntry.findUnique({ where: { id } });
    if (!current) return res.status(404).json({ message: "Entry not found" });

    const targetDay = dayId !== undefined ? Number(dayId) : current.dayId;
    const targetPeriod = periodId !== undefined ? Number(periodId) : current.periodId;
    const targetTeacher = teacherId !== undefined ? Number(teacherId) : current.teacherId;

    // conflict check against every other entry (excluding itself)
    const clashes = await prisma.timetableEntry.findMany({
      where: {
        id: { not: id },
        dayId: targetDay,
        periodId: targetPeriod,
        OR: [{ sectionId: current.sectionId }, { teacherId: targetTeacher }],
      },
      include: entryInclude,
    });

    if (clashes.length > 0) {
      return res.status(409).json({
        message: "Conflict: teacher or section already has a class in that slot.",
        clashes: clashes.map((c) => ({
          section: c.section.name,
          teacher: c.teacher.name,
          day: c.day.name,
          period: c.period.label,
        })),
      });
    }

    const updated = await prisma.timetableEntry.update({
      where: { id },
      data: {
        dayId: targetDay,
        periodId: targetPeriod,
        teacherId: targetTeacher,
        classroomId: classroomId !== undefined ? (classroomId ? Number(classroomId) : null) : current.classroomId,
        locked: locked !== undefined ? !!locked : current.locked,
      },
      include: entryInclude,
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: err.message });
  }
});

// Swap two entries directly (drag-and-drop swap)
router.post("/swap", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    const { entryIdA, entryIdB } = req.body;
    const [a, b] = await Promise.all([
      prisma.timetableEntry.findUnique({ where: { id: Number(entryIdA) } }),
      prisma.timetableEntry.findUnique({ where: { id: Number(entryIdB) } }),
    ]);
    if (!a || !b) return res.status(404).json({ message: "Entry not found" });

    await prisma.$transaction([
      prisma.timetableEntry.update({
        where: { id: a.id },
        data: { dayId: b.dayId, periodId: b.periodId },
      }),
      prisma.timetableEntry.update({
        where: { id: b.id },
        data: { dayId: a.dayId, periodId: a.periodId },
      }),
    ]);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ message: "Swap failed: " + err.message });
  }
});

router.delete("/entry/:id", authenticate, authorize("ADMIN"), async (req, res) => {
  await prisma.timetableEntry.delete({ where: { id: Number(req.params.id) } });
  res.json({ success: true });
});

module.exports = router;
