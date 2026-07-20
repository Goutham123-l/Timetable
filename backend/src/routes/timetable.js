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
    const result = await generateTimetable(req.user.name);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Timetable generation failed: " + err.message });
  }
});

// History of every past "Generate" run — most recent first.
router.get("/generate/history", authenticate, authorize("ADMIN"), async (req, res) => {
  const logs = await prisma.generationLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  res.json(logs);
});

router.delete("/generate/history/:id", authenticate, authorize("ADMIN"), async (req, res) => {
  await prisma.generationLog.delete({ where: { id: Number(req.params.id) } });
  res.json({ success: true });
});

router.delete("/generate/history", authenticate, authorize("ADMIN"), async (req, res) => {
  await prisma.generationLog.deleteMany({});
  res.json({ success: true });
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
// For a selected entry, works out — for every (day, period) slot in that
// section's week — whether moving/swapping the entry there is actually
// valid, and why not if it isn't. This is what powers the "click a period,
// see green = OK to move/swap here" experience in View & Edit.
router.get("/swap-options/:entryId", authenticate, authorize("ADMIN"), async (req, res) => {
  const entryId = Number(req.params.entryId);
  const entry = await prisma.timetableEntry.findUnique({ where: { id: entryId } });
  if (!entry) return res.status(404).json({ message: "Entry not found" });

  if (entry.locked) {
    return res.json({ locked: true, options: [], message: "This period is locked — unlock it first to move or swap it." });
  }

  const [days, periods, sectionDaysOff, allEntries, teacherBusySlots, subjects] = await Promise.all([
    prisma.workingDay.findMany({ where: { active: true }, orderBy: { order: "asc" } }),
    prisma.period.findMany({ where: { isLunch: false }, orderBy: { index: "asc" } }),
    prisma.sectionDayOff.findMany({ where: { sectionId: entry.sectionId } }),
    prisma.timetableEntry.findMany({ where: { id: { not: entryId } }, include: { teacher: true, section: true } }),
    prisma.teacherBusySlot.findMany(),
    prisma.subject.findMany(),
  ]);
  const subjectMap = Object.fromEntries(subjects.map((s) => [s.id, s]));

  const offDayIds = new Set(sectionDaysOff.map((r) => r.dayId));
  const entryTeacherIds = [entry.teacherId, ...(entry.coTeacherIds || [])];

  // Index other entries by exact slot for quick lookup.
  const bySlot = {};
  for (const e of allEntries) {
    const k = `${e.dayId}-${e.periodId}`;
    if (!bySlot[k]) bySlot[k] = [];
    bySlot[k].push(e);
  }
  const teacherBusyElsewhere = new Set(teacherBusySlots.map((b) => `${b.teacherId}-${b.dayId}-${b.periodId}`));

  // Is a given set of teachers free at (dayId, periodId), ignoring the entry
  // occupying `ignoreEntryId` (used when simulating a swap)?
  function teachersFreeAt(teacherIds, dayId, periodId, ignoreEntryId) {
    const slotEntries = bySlot[`${dayId}-${periodId}`] || [];
    for (const tid of teacherIds) {
      if (teacherBusyElsewhere.has(`${tid}-${dayId}-${periodId}`)) {
        return { free: false, reason: "busy elsewhere at that time" };
      }
      for (const e of slotEntries) {
        if (e.id === ignoreEntryId) continue;
        const eTeacherIds = [e.teacherId, ...(e.coTeacherIds || [])];
        if (eTeacherIds.includes(tid)) {
          return {
            free: false,
            reason: `${e.teacher.name} already teaches ${e.section.name} then`,
          };
        }
      }
    }
    return { free: true };
  }

  const options = [];
  for (const day of days) {
    if (offDayIds.has(day.id)) continue;
    for (const period of periods) {
      if (day.id === entry.dayId && period.id === entry.periodId) continue; // this is the entry's current slot

      const occupant = (bySlot[`${day.id}-${period.id}`] || []).find((e) => e.sectionId === entry.sectionId);

      if (!occupant) {
        const check = teachersFreeAt(entryTeacherIds, day.id, period.id, entryId);
        options.push({
          dayId: day.id,
          periodId: period.id,
          type: "move",
          valid: check.free,
          reason: check.free ? null : `Can't move here — ${check.reason}.`,
        });
      } else {
        if (occupant.locked) {
          options.push({ dayId: day.id, periodId: period.id, type: "swap", valid: false, reason: "That period is locked." });
          continue;
        }
        const occupantTeacherIds = [occupant.teacherId, ...(occupant.coTeacherIds || [])];
        const checkEntryAtOccupantSlot = teachersFreeAt(entryTeacherIds, day.id, period.id, occupant.id);
        const checkOccupantAtEntrySlot = teachersFreeAt(occupantTeacherIds, entry.dayId, entry.periodId, entryId);
        const valid = checkEntryAtOccupantSlot.free && checkOccupantAtEntrySlot.free;
        options.push({
          dayId: day.id,
          periodId: period.id,
          type: "swap",
          valid,
          occupantSubject: subjectMap[occupant.subjectId]?.name,
          reason: valid
            ? null
            : !checkEntryAtOccupantSlot.free
            ? `Can't swap — ${checkEntryAtOccupantSlot.reason}.`
            : `Can't swap — the other class's teacher is ${checkOccupantAtEntrySlot.reason} in this slot.`,
        });
      }
    }
  }

  res.json({ locked: false, options, entrySubject: subjectMap[entry.subjectId]?.name });
});

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

    const busyElsewhere = await prisma.teacherBusySlot.findFirst({
      where: { teacherId: targetTeacher, dayId: targetDay, periodId: targetPeriod },
    });
    if (busyElsewhere) {
      return res.status(409).json({
        message: `Conflict: this teacher is marked busy elsewhere at that time${busyElsewhere.note ? ` (${busyElsewhere.note})` : ""}.`,
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
    if (a.locked || b.locked) return res.status(400).json({ message: "Swap failed: one of these periods is locked. Unlock it first." });

    // Deleting both first (instead of updating in place) avoids ever having
    // two rows with the same section+day+period at once mid-transaction —
    // which is what happens, and fails, when swapping two periods that
    // belong to the same section (the normal case in "View & Edit").
    await prisma.$transaction([
      prisma.timetableEntry.delete({ where: { id: a.id } }),
      prisma.timetableEntry.delete({ where: { id: b.id } }),
      prisma.timetableEntry.create({
        data: {
          sectionId: a.sectionId,
          teacherId: a.teacherId,
          coTeacherIds: a.coTeacherIds,
          subjectId: a.subjectId,
          dayId: b.dayId,
          periodId: b.periodId,
          classroomId: a.classroomId,
          locked: false,
        },
      }),
      prisma.timetableEntry.create({
        data: {
          sectionId: b.sectionId,
          teacherId: b.teacherId,
          coTeacherIds: b.coTeacherIds,
          subjectId: b.subjectId,
          dayId: a.dayId,
          periodId: a.periodId,
          classroomId: b.classroomId,
          locked: false,
        },
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
