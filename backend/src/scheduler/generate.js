const prisma = require("../prisma");

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const key = (a, b, c) => `${a}-${b}-${c}`;

const MAX_ATTEMPTS = 8; // internally retried in a single click — see runGeneration()

/**
 * Generates a conflict-free timetable using randomized greedy placement.
 * Locked entries are preserved and treated as already-occupied slots.
 * Teacher "busy elsewhere" slots (e.g. a class in another department) are
 * treated the same way — that teacher is simply unavailable there.
 *
 * Rules honored:
 * - Lab subjects get consecutive periods, and never span across lunch.
 * - Subjects marked "always last period" (e.g. Library, Sports) are only
 *   ever placed in the single last teaching period of the day.
 * - An assignment can have a primary teacher plus co-teachers — all of them
 *   must be free at that slot and all get marked busy together.
 * - Runs several randomized attempts internally and keeps the best one, so
 *   a single click reliably gives the fullest, most conflict-free result
 *   instead of needing to be re-run manually several times.
 */
async function generateTimetable(triggeredBy) {
  const [days, periods, assignments, classrooms, lockedEntries, sectionDaysOff, teacherBusySlots, appSettings] = await Promise.all([
    prisma.workingDay.findMany({ where: { active: true }, orderBy: { order: "asc" } }),
    prisma.period.findMany({ where: { isLunch: false }, orderBy: { index: "asc" } }),
    prisma.assignment.findMany({ include: { teacher: true, subject: true, section: true } }),
    prisma.classroom.findMany(),
    prisma.timetableEntry.findMany({ where: { locked: true } }),
    prisma.sectionDayOff.findMany(),
    prisma.teacherBusySlot.findMany(),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
  ]);

  // Lab arrangement preferences (Settings page). Default to the classic
  // behavior (side-by-side pairs, no positional preference) if no settings
  // row exists yet.
  const labsSideBySide = appSettings ? appSettings.labsSideBySide : true;
  const preferLastTwoForLabs = appSettings ? appSettings.preferLastTwoPeriodsForLabs : false;

  const sectionOffDays = {};
  for (const row of sectionDaysOff) {
    if (!sectionOffDays[row.sectionId]) sectionOffDays[row.sectionId] = new Set();
    sectionOffDays[row.sectionId].add(row.dayId);
  }

  if (days.length === 0) return { success: false, message: "No working days configured. Add working days first." };
  if (periods.length === 0) return { success: false, message: "No periods configured. Add periods first." };
  if (assignments.length === 0) return { success: false, message: "No teacher-subject-section assignments found. Fill the assignment table first." };

  const teacherMap = {};
  for (const a of assignments) teacherMap[a.teacherId] = a.teacher;
  const extraTeacherIds = new Set();
  assignments.forEach((a) => (a.coTeacherIds || []).forEach((id) => extraTeacherIds.add(id)));
  if (extraTeacherIds.size > 0) {
    const extras = await prisma.teacher.findMany({ where: { id: { in: [...extraTeacherIds] } } });
    extras.forEach((t) => (teacherMap[t.id] = t));
  }

  const labRooms = classrooms.filter((r) => r.type === "LAB");
  const normalRooms = classrooms.filter((r) => r.type === "CLASSROOM");
  const lastPeriod = [...periods].sort((a, b) => b.index - a.index)[0];

  const allSlots = [];
  for (const d of days) {
    for (const p of periods) allSlots.push({ day: d, period: p });
  }

  const consecutivePairs = [];
  for (const d of days) {
    const sorted = [...periods].sort((a, b) => a.index - b.index);
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i + 1].index === sorted[i].index + 1) {
        consecutivePairs.push({ day: d, p1: sorted[i], p2: sorted[i + 1] });
      }
    }
  }

  // Total available slots per section (used for the fill-gap report), same
  // across every attempt since it doesn't depend on placement outcome.
  const uniqueSectionIds = [...new Set(assignments.map((a) => a.sectionId))];
  const sectionLabels = {};
  for (const a of assignments) sectionLabels[a.sectionId] = a.section.name;
  const totalSlotsPerSection = {};
  for (const sectionId of uniqueSectionIds) {
    const offDays = sectionOffDays[sectionId];
    const effectiveDays = days.filter((d) => !offDays || !offDays.has(d.id)).length;
    totalSlotsPerSection[sectionId] = effectiveDays * periods.length;
  }

  function allTeacherIds(assignment) {
    return [assignment.teacherId, ...(assignment.coTeacherIds || [])];
  }

  // Runs one full randomized placement pass in memory only (no DB writes)
  // and returns its outcome so multiple attempts can be compared.
  function runAttempt() {
    const sectionBusy = new Set();
    const teacherBusy = new Set();
    const roomBusy = new Set();
    const teacherDailyCount = {};
    let scatteredLabPeriods = 0; // lab periods that couldn't be paired consecutively — used to pick the best attempt
    const newEntries = [];
    const conflicts = [];

    for (const e of lockedEntries) {
      sectionBusy.add(key(e.sectionId, e.dayId, e.periodId));
      teacherBusy.add(key(e.teacherId, e.dayId, e.periodId));
      (e.coTeacherIds || []).forEach((tid) => teacherBusy.add(key(tid, e.dayId, e.periodId)));
      if (e.classroomId) roomBusy.add(key(e.classroomId, e.dayId, e.periodId));
      const dKey = `${e.teacherId}-${e.dayId}`;
      teacherDailyCount[dKey] = (teacherDailyCount[dKey] || 0) + 1;
      (e.coTeacherIds || []).forEach((tid) => {
        const k = `${tid}-${e.dayId}`;
        teacherDailyCount[k] = (teacherDailyCount[k] || 0) + 1;
      });
    }

    // External commitments (e.g. a class in another branch) — mark the slot
    // unavailable, but don't count it against this teacher's daily cap since
    // it isn't one of their periods in this system.
    for (const b of teacherBusySlots) {
      teacherBusy.add(key(b.teacherId, b.dayId, b.periodId));
    }

    function findRoom(dayId, periodId, isLab) {
      const pool = isLab ? (labRooms.length ? labRooms : normalRooms) : (normalRooms.length ? normalRooms : labRooms);
      for (const room of shuffle(pool)) {
        if (!roomBusy.has(key(room.id, dayId, periodId))) return room;
      }
      return null;
    }

    function teachersFreeAt(teacherIds, dayId, periodId) {
      return teacherIds.every((tid) => {
        if (teacherBusy.has(key(tid, dayId, periodId))) return false;
        const t = teacherMap[tid];
        const cap = t ? t.maxPeriodsDay : 6;
        if ((teacherDailyCount[`${tid}-${dayId}`] || 0) >= cap) return false;
        return true;
      });
    }

    function markTeachersBusy(teacherIds, dayId, periodId) {
      teacherIds.forEach((tid) => {
        teacherBusy.add(key(tid, dayId, periodId));
        teacherDailyCount[`${tid}-${dayId}`] = (teacherDailyCount[`${tid}-${dayId}`] || 0) + 1;
      });
    }

    function tryPlaceSingle(assignment, restrictToPeriodId) {
      const offDays = sectionOffDays[assignment.sectionId];
      const teacherIds = allTeacherIds(assignment);
      const pool = restrictToPeriodId ? allSlots.filter((s) => s.period.id === restrictToPeriodId) : allSlots;
      const candidates = shuffle(pool);
      for (const slot of candidates) {
        const { day, period } = slot;
        if (offDays && offDays.has(day.id)) continue;
        const sKey = key(assignment.sectionId, day.id, period.id);
        if (sectionBusy.has(sKey)) continue;
        if (!teachersFreeAt(teacherIds, day.id, period.id)) continue;

        const room = findRoom(day.id, period.id, assignment.subject.type === "LAB");
        sectionBusy.add(sKey);
        markTeachersBusy(teacherIds, day.id, period.id);
        if (room) roomBusy.add(key(room.id, day.id, period.id));

        newEntries.push({
          sectionId: assignment.sectionId,
          teacherId: assignment.teacherId,
          coTeacherIds: assignment.coTeacherIds || [],
          subjectId: assignment.subjectId,
          dayId: day.id,
          periodId: period.id,
          classroomId: room ? room.id : null,
        });
        return true;
      }
      return false;
    }

    function tryPlaceLabPair(assignment) {
      const offDays = sectionOffDays[assignment.sectionId];
      const teacherIds = allTeacherIds(assignment);

      // When the "prefer last two periods" setting is on, try pairs that end
      // at the day's last period first (e.g. after lunch), but still fall
      // back to any other consecutive pair if none of those work out —
      // this is a preference, not a hard restriction.
      const candidates = preferLastTwoForLabs
        ? [
            ...shuffle(consecutivePairs.filter((p) => p.p2.id === lastPeriod.id)),
            ...shuffle(consecutivePairs.filter((p) => p.p2.id !== lastPeriod.id)),
          ]
        : shuffle(consecutivePairs);

      for (const c of candidates) {
        const { day, p1, p2 } = c;
        if (offDays && offDays.has(day.id)) continue;
        const sKey1 = key(assignment.sectionId, day.id, p1.id);
        const sKey2 = key(assignment.sectionId, day.id, p2.id);
        if (sectionBusy.has(sKey1) || sectionBusy.has(sKey2)) continue;
        if (!teachersFreeAt(teacherIds, day.id, p1.id)) continue;
        if (!teachersFreeAt(teacherIds, day.id, p2.id)) continue;

        const room = findRoom(day.id, p1.id, true);
        if (room && roomBusy.has(key(room.id, day.id, p2.id))) continue;

        sectionBusy.add(sKey1);
        sectionBusy.add(sKey2);
        markTeachersBusy(teacherIds, day.id, p1.id);
        markTeachersBusy(teacherIds, day.id, p2.id);
        if (room) {
          roomBusy.add(key(room.id, day.id, p1.id));
          roomBusy.add(key(room.id, day.id, p2.id));
        }

        newEntries.push({
          sectionId: assignment.sectionId, teacherId: assignment.teacherId, coTeacherIds: assignment.coTeacherIds || [],
          subjectId: assignment.subjectId, dayId: day.id, periodId: p1.id, classroomId: room ? room.id : null,
        });
        newEntries.push({
          sectionId: assignment.sectionId, teacherId: assignment.teacherId, coTeacherIds: assignment.coTeacherIds || [],
          subjectId: assignment.subjectId, dayId: day.id, periodId: p2.id, classroomId: room ? room.id : null,
        });
        return true;
      }
      return false;
    }

    function placeAssignment(assignment) {
      let remaining = assignment.periodsPerWeek;
      const isLab = assignment.subject.type === "LAB";
      const alwaysLast = assignment.subject.alwaysLastPeriod;

      if (alwaysLast) {
        while (remaining > 0) {
          if (tryPlaceSingle(assignment, lastPeriod.id)) remaining -= 1;
          else break;
        }
        return remaining;
      }
      if (isLab && labsSideBySide) {
        while (remaining >= 2) {
          if (tryPlaceLabPair(assignment)) remaining -= 2;
          else break;
        }
        while (remaining > 0) {
          if (tryPlaceSingle(assignment)) {
            remaining -= 1;
            scatteredLabPeriods += 1; // this lab period didn't get paired with another
          } else break;
        }
      } else {
        // Either a theory subject, or labsSideBySide is off — place every
        // period individually instead of as a consecutive pair.
        while (remaining > 0) {
          if (tryPlaceSingle(assignment)) remaining -= 1;
          else break;
        }
      }
      return remaining;
    }

    const alwaysLastAssignments = assignments.filter((a) => a.subject.alwaysLastPeriod);
    const otherAssignments = assignments.filter((a) => !a.subject.alwaysLastPeriod);

    for (const assignment of shuffle(alwaysLastAssignments)) {
      const remaining = placeAssignment(assignment);
      if (remaining > 0) {
        conflicts.push({
          type: "INSUFFICIENT_SLOTS", teacher: assignment.teacher.name, subject: assignment.subject.name, section: assignment.section.name,
          message: `Could only place ${assignment.periodsPerWeek - remaining} of ${assignment.periodsPerWeek} required last-period sessions for ${assignment.subject.name} (${assignment.section.name}). There's only one last-period slot per day — add more working days or reduce this subject's weekly periods.`,
        });
      }
    }
    for (const assignment of shuffle(otherAssignments)) {
      const remaining = placeAssignment(assignment);
      if (remaining > 0) {
        conflicts.push({
          type: "INSUFFICIENT_SLOTS", teacher: assignment.teacher.name, subject: assignment.subject.name, section: assignment.section.name,
          message: `Could only place ${assignment.periodsPerWeek - remaining} of ${assignment.periodsPerWeek} required periods for ${assignment.subject.name} (${assignment.section.name}, ${assignment.teacher.name}). Increase working days/periods or reduce teacher workload conflicts.`,
        });
      }
    }

    // Build per-section fill summary for this attempt.
    const placedPerSection = {};
    for (const e of newEntries) placedPerSection[e.sectionId] = (placedPerSection[e.sectionId] || 0) + 1;
    for (const e of lockedEntries) placedPerSection[e.sectionId] = (placedPerSection[e.sectionId] || 0) + 1;

    const sectionFillSummary = uniqueSectionIds.map((sectionId) => {
      const totalSlots = totalSlotsPerSection[sectionId] || 0;
      const placed = placedPerSection[sectionId] || 0;
      const offDays = sectionOffDays[sectionId];
      const freeSlotDetails = [];
      for (const day of days) {
        if (offDays && offDays.has(day.id)) continue;
        for (const period of periods) {
          if (!sectionBusy.has(key(sectionId, day.id, period.id))) {
            freeSlotDetails.push({ day: day.name, period: period.label });
          }
        }
      }
      return { sectionId, section: sectionLabels[sectionId], totalSlots, placed, freeSlots: totalSlots - placed, freeSlotDetails };
    });

    const totalFreeSlots = sectionFillSummary.reduce((sum, s) => sum + Math.max(s.freeSlots, 0), 0);

    return { newEntries, conflicts, sectionFillSummary, totalFreeSlots, scatteredLabPeriods };
  }

  // Run several attempts internally and keep the best one — this is what
  // saves the admin from having to click Generate several times by hand.
  // Preference order: fewest conflicts, then fewest scattered (unpaired)
  // lab periods, then fewest free slots overall.
  let best = null;
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const attempt = runAttempt();
    if (!best) {
      best = attempt;
    } else {
      const better =
        attempt.conflicts.length < best.conflicts.length ||
        (attempt.conflicts.length === best.conflicts.length &&
          (attempt.scatteredLabPeriods < best.scatteredLabPeriods ||
            (attempt.scatteredLabPeriods === best.scatteredLabPeriods && attempt.totalFreeSlots < best.totalFreeSlots)));
      if (better) best = attempt;
    }
    // Perfect result found — no need to keep trying.
    if (best.conflicts.length === 0 && best.totalFreeSlots === 0 && best.scatteredLabPeriods === 0) break;
  }

  await prisma.timetableEntry.deleteMany({ where: { locked: false } });
  if (best.newEntries.length > 0) {
    await prisma.timetableEntry.createMany({ data: best.newEntries });
  }

  const sectionsWithGaps = best.sectionFillSummary.filter((s) => s.freeSlots > 0);
  const scatteredNote =
    best.scatteredLabPeriods > 0
      ? ` ${best.scatteredLabPeriods} lab period(s) couldn't be paired back-to-back (likely because all required teachers for that lab aren't free together for two consecutive periods) and were placed as single periods instead — consider reducing required co-teachers for that lab, or check for a duplicate row in the Assignment Table.`
      : "";
  const message =
    best.conflicts.length > 0
      ? `Timetable generated with ${best.conflicts.length} unresolved item(s). Review conflicts and adjust manually.${scatteredNote}`
      : sectionsWithGaps.length > 0
      ? `Timetable generated with no conflicts, but ${sectionsWithGaps.length} section(s) have Free periods because their assigned subjects don't add up to a full week yet — see the breakdown below.${scatteredNote}`
      : best.scatteredLabPeriods > 0
      ? `Timetable generated successfully with no conflicts and every period filled.${scatteredNote}`
      : "Timetable generated successfully with no conflicts and every period filled.";

  await prisma.generationLog.create({
    data: {
      entriesCreated: best.newEntries.length,
      conflictsCount: best.conflicts.length,
      freeSlotsCount: best.totalFreeSlots,
      success: true,
      message,
      triggeredBy: triggeredBy || null,
    },
  });

  return {
    success: true,
    entriesCreated: best.newEntries.length,
    conflicts: best.conflicts,
    sectionFillSummary: best.sectionFillSummary,
    scatteredLabPeriods: best.scatteredLabPeriods,
    message,
  };
}

module.exports = { generateTimetable };
