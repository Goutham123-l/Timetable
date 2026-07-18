require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding sample data...");

  // Departments
  const cse = await prisma.department.upsert({
    where: { code: "CSE" },
    update: {},
    create: { name: "Computer Science Engineering", code: "CSE" },
  });
  const it = await prisma.department.upsert({
    where: { code: "IT" },
    update: {},
    create: { name: "Information Technology", code: "IT" },
  });

  // Working days
  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const days = [];
  for (let i = 0; i < dayNames.length; i++) {
    const d = await prisma.workingDay.upsert({
      where: { name: dayNames[i] },
      update: {},
      create: { name: dayNames[i], order: i + 1, active: i < 5 }, // Sat off by default
    });
    days.push(d);
  }

  // Periods (1-4, lunch, 5-7)
  const periodDefs = [
    { index: 1, label: "P1", startTime: "08:50", endTime: "09:40", isLunch: false },
    { index: 2, label: "P2", startTime: "09:40", endTime: "10:30", isLunch: false },
    { index: 3, label: "P3", startTime: "10:30", endTime: "11:20", isLunch: false },
    { index: 4, label: "P4", startTime: "11:20", endTime: "12:10", isLunch: false },
    { index: 5, label: "Lunch", startTime: "12:10", endTime: "13:00", isLunch: true },
    { index: 6, label: "P5", startTime: "13:00", endTime: "13:50", isLunch: false },
    { index: 7, label: "P6", startTime: "13:50", endTime: "14:40", isLunch: false },
    { index: 8, label: "P7", startTime: "14:40", endTime: "15:30", isLunch: false },
  ];
  for (const p of periodDefs) {
    await prisma.period.upsert({ where: { index: p.index }, update: {}, create: p });
  }

  // Sections
  const cseA = await prisma.section.upsert({
    where: { name_year_departmentId: { name: "A", year: 3, departmentId: cse.id } },
    update: {},
    create: { name: "A", year: 3, departmentId: cse.id },
  });
  const cseB = await prisma.section.upsert({
    where: { name_year_departmentId: { name: "B", year: 3, departmentId: cse.id } },
    update: {},
    create: { name: "B", year: 3, departmentId: cse.id },
  });
  const itA = await prisma.section.upsert({
    where: { name_year_departmentId: { name: "A", year: 3, departmentId: it.id } },
    update: {},
    create: { name: "A", year: 3, departmentId: it.id },
  });

  // Classrooms
  await prisma.classroom.upsert({ where: { roomNumber: "C-306" }, update: {}, create: { roomNumber: "C-306", capacity: 65, type: "CLASSROOM" } });
  await prisma.classroom.upsert({ where: { roomNumber: "C-307" }, update: {}, create: { roomNumber: "C-307", capacity: 65, type: "CLASSROOM" } });
  await prisma.classroom.upsert({ where: { roomNumber: "LAB-1" }, update: {}, create: { roomNumber: "LAB-1", capacity: 30, type: "LAB" } });

  // Teachers
  const kumar = await prisma.teacher.create({
    data: { name: "Mr. Kumar", departmentId: cse.id, designation: "Assistant Professor", maxPeriodsDay: 6, maxPeriodsWeek: 24 },
  });
  const bhavani = await prisma.teacher.create({
    data: { name: "Dr. S.A. Bhavani", departmentId: cse.id, designation: "Professor", maxPeriodsDay: 5, maxPeriodsWeek: 20 },
  });
  const anusha = await prisma.teacher.create({
    data: { name: "Mrs. S. Anusha", departmentId: it.id, designation: "Assistant Professor", maxPeriodsDay: 6, maxPeriodsWeek: 24 },
  });

  // Subjects
  const ds = await prisma.subject.create({ data: { name: "Data Structures", code: "23CS4111", type: "THEORY", weeklyHours: 4, year: 3 } });
  const dm = await prisma.subject.create({ data: { name: "Data Mining", code: "23DP6111", type: "THEORY", weeklyHours: 3, year: 3 } });
  const ai = await prisma.subject.create({ data: { name: "Artificial Intelligence", code: "23CS5111", type: "THEORY", weeklyHours: 3, year: 3 } });
  const seLab = await prisma.subject.create({ data: { name: "Software Engineering Lab", code: "23CS4221", type: "LAB", weeklyHours: 2, year: 3 } });

  // Assignments (Teacher + Subject + Section + Periods/Week) - the manual table
  await prisma.assignment.createMany({
    data: [
      { teacherId: kumar.id, subjectId: ds.id, sectionId: cseA.id, periodsPerWeek: 4 },
      { teacherId: kumar.id, subjectId: ds.id, sectionId: cseB.id, periodsPerWeek: 4 },
      { teacherId: bhavani.id, subjectId: dm.id, sectionId: cseA.id, periodsPerWeek: 3 },
      { teacherId: anusha.id, subjectId: ai.id, sectionId: itA.id, periodsPerWeek: 3 },
      { teacherId: kumar.id, subjectId: seLab.id, sectionId: cseA.id, periodsPerWeek: 2 },
    ],
    skipDuplicates: true,
  });

  // Users: 1 admin, 1 teacher login, 1 student login
  const password = await bcrypt.hash("password123", 10);

  await prisma.user.upsert({
    where: { email: "admin@college.edu" },
    update: {},
    create: { name: "Admin", email: "admin@college.edu", password, role: "ADMIN" },
  });

  await prisma.user.upsert({
    where: { email: "kumar@college.edu" },
    update: {},
    create: { name: "Mr. Kumar", email: "kumar@college.edu", password, role: "TEACHER", teacherId: kumar.id },
  });

  await prisma.user.upsert({
    where: { email: "student@college.edu" },
    update: {},
    create: { name: "Student (CSE-A)", email: "student@college.edu", password, role: "STUDENT", sectionId: cseA.id },
  });

  console.log("Seed complete.");
  console.log("Login accounts (password for all: password123):");
  console.log("  Admin:   admin@college.edu");
  console.log("  Teacher: kumar@college.edu");
  console.log("  Student: student@college.edu");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
