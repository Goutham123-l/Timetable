const express = require("express");
const prisma = require("../prisma");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();

router.get("/", authenticate, async (req, res) => {
  const rooms = await prisma.classroom.findMany({ orderBy: { roomNumber: "asc" } });
  res.json(rooms);
});

router.post("/", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    const { roomNumber, capacity, type } = req.body;
    const room = await prisma.classroom.create({
      data: { roomNumber, capacity: Number(capacity) || 60, type: type === "LAB" ? "LAB" : "CLASSROOM" },
    });
    res.json(room);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put("/:id", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    const { roomNumber, capacity, type } = req.body;
    const room = await prisma.classroom.update({
      where: { id: Number(req.params.id) },
      data: { roomNumber, capacity: Number(capacity), type: type === "LAB" ? "LAB" : "CLASSROOM" },
    });
    res.json(room);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/:id", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    await prisma.classroom.delete({ where: { id: Number(req.params.id) } });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ message: "Cannot delete: room is in use" });
  }
});

module.exports = router;
