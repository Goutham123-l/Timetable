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
  const classroomId = Number(req.params.id);
  const force = req.query.force === "true";

  const entryCount = await prisma.timetableEntry.count({ where: { classroomId } });

  if (!force && entryCount > 0) {
    return res.status(409).json({
      inUse: true,
      message: `This room is used in ${entryCount} scheduled period(s).`,
      entries: entryCount,
    });
  }

  try {
    if (force) {
      // Free the room from those periods rather than deleting the periods themselves.
      await prisma.timetableEntry.updateMany({ where: { classroomId }, data: { classroomId: null } });
    }
    await prisma.classroom.delete({ where: { id: classroomId } });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ message: "Could not delete this room: " + err.message });
  }
});

module.exports = router;
