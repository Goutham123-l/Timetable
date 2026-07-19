const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../prisma");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();

// LOGIN (all roles)
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({
      where: { email },
      include: { teacher: true, section: { include: { department: true } } },
    });
    if (!user) return res.status(401).json({ message: "Invalid email or password" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: "Invalid email or password" });

    const payload = {
      id: user.id,
      name: user.name,
      role: user.role,
      teacherId: user.teacherId || null,
      sectionId: user.sectionId || null,
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: payload });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Login failed" });
  }
});

// ADMIN creates a new user (admin/teacher-login/student-login)
router.post("/register", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    const { name, email, password, role, teacherId, sectionId } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, password: hashed, role, teacherId: teacherId || null, sectionId: sectionId || null },
    });
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: err.message || "Could not create user" });
  }
});

// current logged-in user info
router.get("/me", authenticate, async (req, res) => {
  res.json(req.user);
});

module.exports = router;
