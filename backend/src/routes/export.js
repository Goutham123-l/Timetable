const express = require("express");
const ExcelJS = require("exceljs");
const prisma = require("../prisma");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

async function buildGrid(where) {
  const [days, periods, entries] = await Promise.all([
    prisma.workingDay.findMany({ where: { active: true }, orderBy: { order: "asc" } }),
    prisma.period.findMany({ orderBy: { index: "asc" } }),
    prisma.timetableEntry.findMany({
      where,
      include: { section: true, teacher: true, classroom: true },
    }),
  ]);
  const subjectIds = [...new Set(entries.map((e) => e.subjectId))];
  const subjects = await prisma.subject.findMany({ where: { id: { in: subjectIds } } });
  const subjectMap = Object.fromEntries(subjects.map((s) => [s.id, s]));

  const grid = {};
  for (const e of entries) {
    grid[`${e.dayId}-${e.periodId}`] = e;
  }
  return { days, periods, grid, subjectMap };
}

async function writeSheet(sheet, days, periods, grid, subjectMap, cellText) {
  sheet.getRow(1).values = ["Day / Period", ...periods.map((p) => `${p.label}\n${p.startTime}-${p.endTime}`)];
  sheet.getRow(1).font = { bold: true };
  sheet.columns.forEach((col) => (col.width = 20));

  days.forEach((d, rowIdx) => {
    const row = sheet.getRow(rowIdx + 2);
    row.getCell(1).value = d.name;
    row.getCell(1).font = { bold: true };
    periods.forEach((p, colIdx) => {
      if (p.isLunch) {
        row.getCell(colIdx + 2).value = "LUNCH";
        return;
      }
      const entry = grid[`${d.id}-${p.id}`];
      row.getCell(colIdx + 2).value = entry ? cellText(entry, subjectMap) : "";
    });
  });
}

// Export a single section timetable
router.get("/excel/section/:sectionId", authenticate, async (req, res) => {
  const sectionId = Number(req.params.sectionId);
  const { days, periods, grid, subjectMap } = await buildGrid({ sectionId });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Timetable");
  await writeSheet(sheet, days, periods, grid, subjectMap, (e, subjectMap) => {
    const subj = subjectMap[e.subjectId];
    return `${subj ? subj.name : ""}\n${e.teacher.name}${e.classroom ? " | " + e.classroom.roomNumber : ""}`;
  });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename=timetable_section_${sectionId}.xlsx`);
  await workbook.xlsx.write(res);
  res.end();
});

// Export a single teacher timetable
router.get("/excel/teacher/:teacherId", authenticate, async (req, res) => {
  const teacherId = Number(req.params.teacherId);
  const { days, periods, grid, subjectMap } = await buildGrid({ teacherId });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Teacher Timetable");
  await writeSheet(sheet, days, periods, grid, subjectMap, (e, subjectMap) => {
    const subj = subjectMap[e.subjectId];
    return `${e.section.name}\n${subj ? subj.name : ""}`;
  });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename=timetable_teacher_${teacherId}.xlsx`);
  await workbook.xlsx.write(res);
  res.end();
});

// Export the raw assignments table (Teacher / Subject / Section / Periods per week)
router.get("/excel/assignments", authenticate, async (req, res) => {
  const assignments = await prisma.assignment.findMany({
    include: { teacher: true, subject: true, section: { include: { department: true } } },
    orderBy: { id: "asc" },
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Assignments");
  sheet.columns = [
    { header: "Teacher", key: "teacher", width: 25 },
    { header: "Subject", key: "subject", width: 25 },
    { header: "Department", key: "dept", width: 15 },
    { header: "Section", key: "section", width: 15 },
    { header: "Periods/Week", key: "periods", width: 15 },
  ];
  sheet.getRow(1).font = { bold: true };
  assignments.forEach((a) => {
    sheet.addRow({
      teacher: a.teacher.name,
      subject: a.subject.name,
      dept: a.section.department.name,
      section: `${a.section.name} (Year ${a.section.year})`,
      periods: a.periodsPerWeek,
    });
  });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=assignments.xlsx");
  await workbook.xlsx.write(res);
  res.end();
});

module.exports = router;
