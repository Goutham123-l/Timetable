const express = require("express");
const prisma = require("../prisma");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();

router.get("/", authenticate, async (req, res) => {
  const departments = await prisma.department.findMany({ orderBy: { name: "asc" } });
  res.json(departments);
});

router.post("/", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    const { name, code } = req.body;
    const dept = await prisma.department.create({ data: { name, code } });
    res.json(dept);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put("/:id", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    const { name, code } = req.body;
    const dept = await prisma.department.update({
      where: { id: Number(req.params.id) },
      data: { name, code },
    });
    res.json(dept);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/:id", authenticate, authorize("ADMIN"), async (req, res) => {
  const departmentId = Number(req.params.id);
  const [teacherCount, sectionCount] = await Promise.all([
    prisma.teacher.count({ where: { departmentId } }),
    prisma.section.count({ where: { departmentId } }),
  ]);
  if (teacherCount > 0 || sectionCount > 0) {
    return res.status(400).json({
      message: `Cannot delete: this department has ${teacherCount} teacher(s) and ${sectionCount} section(s). Delete or move those first — department deletion isn't cascaded since it would remove too much at once.`,
    });
  }
  try {
    await prisma.department.delete({ where: { id: departmentId } });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ message: "Could not delete this department: " + err.message });
  }
});

module.exports = router;
