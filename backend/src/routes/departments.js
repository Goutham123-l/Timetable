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
  try {
    await prisma.department.delete({ where: { id: Number(req.params.id) } });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ message: "Cannot delete: department is in use" });
  }
});

module.exports = router;
