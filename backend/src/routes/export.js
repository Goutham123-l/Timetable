const express = require("express");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
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

  const coTeacherIds = [...new Set(entries.flatMap((e) => e.coTeacherIds || []))];
  const coTeachers = coTeacherIds.length
    ? await prisma.teacher.findMany({ where: { id: { in: coTeacherIds } } })
    : [];
  const coTeacherMap = Object.fromEntries(coTeachers.map((t) => [t.id, t]));

  const grid = {};
  for (const e of entries) {
    grid[`${e.dayId}-${e.periodId}`] = {
      ...e,
      coTeachers: (e.coTeacherIds || []).map((id) => coTeacherMap[id]).filter(Boolean),
    };
  }
  return { days, periods, grid, subjectMap };
}

function cellLines(entry, subjectMap, hideTeacher) {
  const subj = subjectMap[entry.subjectId];
  const lines = [subj ? subj.name : ""];
  if (!hideTeacher) {
    const teacherNames = [entry.teacher?.name, ...(entry.coTeachers || []).map((t) => t.name)].filter(Boolean);
    if (teacherNames.length) lines.push(teacherNames.join(" + "));
  }
  if (entry.classroom) lines.push(entry.classroom.roomNumber);
  return lines;
}

function teacherCellLines(entry, subjectMap) {
  const subj = subjectMap[entry.subjectId];
  const cls = entry.section ? `${entry.section.name}${entry.section.year ? ` (Yr ${entry.section.year})` : ""}` : "";
  return [subj ? subj.name : "", cls].filter(Boolean);
}

async function writeSheet(sheet, days, periods, grid, subjectMap, lineBuilder) {
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
      row.getCell(colIdx + 2).value = entry ? lineBuilder(entry, subjectMap).join("\n") : "";
    });
  });
}

// Draws a simple bordered grid timetable onto a landscape PDF document.
function drawPdfGrid(doc, title, days, periods, grid, subjectMap, lineBuilder) {
  doc.fontSize(16).text(title, { align: "center" });
  doc.moveDown(0.5);

  const teachingPeriods = periods; // includes lunch marker cells too, drawn as "LUNCH"
  const marginX = 30;
  const startY = doc.y;
  const usableWidth = doc.page.width - marginX * 2;
  const dayColWidth = 70;
  const colWidth = (usableWidth - dayColWidth) / teachingPeriods.length;
  const headerHeight = 30;
  const rowHeight = 46;

  doc.fontSize(8);

  // Header row
  doc.rect(marginX, startY, dayColWidth, headerHeight).stroke();
  doc.text("Day", marginX + 2, startY + 10, { width: dayColWidth - 4, align: "center" });
  teachingPeriods.forEach((p, i) => {
    const x = marginX + dayColWidth + i * colWidth;
    doc.rect(x, startY, colWidth, headerHeight).stroke();
    const label = p.isLunch ? "LUNCH" : `${p.label} (${p.startTime}-${p.endTime})`;
    doc.text(label, x + 2, startY + 4, { width: colWidth - 4, align: "center" });
  });

  // Body rows
  let y = startY + headerHeight;
  days.forEach((d) => {
    doc.rect(marginX, y, dayColWidth, rowHeight).stroke();
    doc.text(d.name, marginX + 2, y + rowHeight / 2 - 5, { width: dayColWidth - 4, align: "center" });

    teachingPeriods.forEach((p, i) => {
      const x = marginX + dayColWidth + i * colWidth;
      doc.rect(x, y, colWidth, rowHeight).stroke();
      if (p.isLunch) {
        doc.text("—", x + 2, y + rowHeight / 2 - 5, { width: colWidth - 4, align: "center" });
        return;
      }
      const entry = grid[`${d.id}-${p.id}`];
      if (entry) {
        const lines = lineBuilder(entry, subjectMap);
        doc.text(lines.join("\n"), x + 2, y + 4, { width: colWidth - 4, align: "center" });
      }
    });
    y += rowHeight;
  });
}

// ---- Excel exports ----

router.get("/excel/section/:sectionId", authenticate, async (req, res) => {
  const sectionId = Number(req.params.sectionId);
  const hideTeacher = req.query.studentView === "true";
  const { days, periods, grid, subjectMap } = await buildGrid({ sectionId });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Timetable");
  await writeSheet(sheet, days, periods, grid, subjectMap, (e, sm) => cellLines(e, sm, hideTeacher));

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename=timetable_section_${sectionId}.xlsx`);
  await workbook.xlsx.write(res);
  res.end();
});

router.get("/excel/teacher/:teacherId", authenticate, async (req, res) => {
  const teacherId = Number(req.params.teacherId);
  const { days, periods, grid, subjectMap } = await buildGrid({
    OR: [{ teacherId }, { coTeacherIds: { has: teacherId } }],
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Teacher Timetable");
  await writeSheet(sheet, days, periods, grid, subjectMap, teacherCellLines);

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename=timetable_teacher_${teacherId}.xlsx`);
  await workbook.xlsx.write(res);
  res.end();
});

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

// ---- PDF exports ----

router.get("/pdf/section/:sectionId", authenticate, async (req, res) => {
  const sectionId = Number(req.params.sectionId);
  const hideTeacher = req.query.studentView === "true";
  const section = await prisma.section.findUnique({ where: { id: sectionId }, include: { department: true } });
  const { days, periods, grid, subjectMap } = await buildGrid({ sectionId });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=timetable_section_${sectionId}.pdf`);

  const doc = new PDFDocument({ layout: "landscape", size: "A4", margin: 30 });
  doc.pipe(res);
  const title = section ? `${section.department?.code || ""} ${section.name} (Year ${section.year}) — Timetable` : "Timetable";
  drawPdfGrid(doc, title, days, periods, grid, subjectMap, (e, sm) => cellLines(e, sm, hideTeacher));
  doc.end();
});

router.get("/pdf/teacher/:teacherId", authenticate, async (req, res) => {
  const teacherId = Number(req.params.teacherId);
  const teacher = await prisma.teacher.findUnique({ where: { id: teacherId } });
  const { days, periods, grid, subjectMap } = await buildGrid({
    OR: [{ teacherId }, { coTeacherIds: { has: teacherId } }],
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=timetable_teacher_${teacherId}.pdf`);

  const doc = new PDFDocument({ layout: "landscape", size: "A4", margin: 30 });
  doc.pipe(res);
  drawPdfGrid(doc, `${teacher ? teacher.name : "Teacher"} — Timetable`, days, periods, grid, subjectMap, teacherCellLines);
  doc.end();
});

module.exports = router;
