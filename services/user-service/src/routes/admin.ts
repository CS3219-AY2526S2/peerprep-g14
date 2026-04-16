import { Router, type Request, type Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import prisma from "../prisma.js";

const router = Router();

// ─── Admin / Super Admin Login ──────────────────────────────────────────────

router.post("/user/admin/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  console.log(`Admin Login Attempt: Email:${email}`);

  try {
    const admin = await prisma.user.findUnique({
      where: { email },
    });

    if (
      !admin ||
      (admin.role !== "ADMIN" && admin.role !== "SUPER_ADMIN") ||
      !admin.password
    ) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const accessToken = jwt.sign(
      { userId: admin.id, role: admin.role },
      process.env.ACCESS_TOKEN_SECRET as string,
      { expiresIn: "15m" },
    );

    const refreshToken = jwt.sign(
      { userId: admin.id, role: admin.role },
      process.env.REFRESH_TOKEN_SECRET as string,
      { expiresIn: "7d" },
    );

    const refreshTokenHash = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    await prisma.user_refresh_token.create({
      data: {
        userId: admin.id,
        token_hash: refreshTokenHash,
        expire_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: false, // MUST be false for plain http
      sameSite: "lax",
      maxAge: 15 * 60 * 1000,
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: false, // MUST be false for plain http
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      message: "Login successful",
      user: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
        name: admin.name,
      },
    });
  } catch (error) {
    console.error("Admin Login Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// ─── User Management (ADMIN + SUPER_ADMIN) ──────────────────────────────────

// GET /admin/users — list all regular users
router.get("/admin/users", async (req: Request, res: Response) => {
  const role = req.headers["x-user-role"];

  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    return res.status(403).json({ message: "Forbidden" });
  }

  try {
    const users = await prisma.user.findMany({
      where: { role: "USER" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        authProvider: true,
        bio: true,
        experienceLevel: true,
        learningPurpose: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json(users);
  } catch (error) {
    console.error("Get Users Error:", error);
    return res.status(500).json({ message: "Failed to fetch users" });
  }
});

// PATCH /admin/users/:id — edit user name/bio/expLevel/learningPurpose
router.patch("/admin/users/:id", async (req: Request, res: Response) => {
  const role = req.headers["x-user-role"];

  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    return res.status(403).json({ message: "Forbidden" });
  }

  const { id } = req.params as { id: string };
  const { name, bio, experienceLevel, learningPurpose } = req.body;

  try {
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target || target.role !== "USER") {
      return res
        .status(404)
        .json({ message: "User not found or not a regular user" });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { name, bio, experienceLevel, learningPurpose },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        bio: true,
        experienceLevel: true,
        learningPurpose: true,
        createdAt: true,
      },
    });

    return res.status(200).json({ message: "User updated", user: updated });
  } catch (error) {
    console.error("Update User Error:", error);
    return res.status(500).json({ message: "Failed to update user" });
  }
});

// ─── Admin/Super Admin Management (SUPER_ADMIN only) ────────────────────────

// GET /admin/admins — list all ADMIN and SUPER_ADMIN accounts
router.get("/admin/admins", async (req: Request, res: Response) => {
  const role = req.headers["x-user-role"];

  if (role !== "SUPER_ADMIN") {
    return res.status(403).json({ message: "Forbidden" });
  }

  try {
    const admins = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json(admins);
  } catch (error) {
    console.error("Get Admins Error:", error);
    return res.status(500).json({ message: "Failed to fetch admins" });
  }
});

// POST /admin/admins — create a new ADMIN or SUPER_ADMIN account
router.post("/admin/admins", async (req: Request, res: Response) => {
  const callerRole = req.headers["x-user-role"];

  if (callerRole !== "SUPER_ADMIN") {
    return res.status(403).json({ message: "Forbidden" });
  }

  const { email, name, password, role } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  const targetRole = role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "ADMIN";

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res
        .status(409)
        .json({ message: "An account with this email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newAdmin = await prisma.user.create({
      data: {
        email,
        name: name || null,
        role: targetRole,
        password: hashedPassword,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    return res
      .status(201)
      .json({ message: "Account created", admin: newAdmin });
  } catch (error) {
    console.error("Create Admin Error:", error);
    return res.status(500).json({ message: "Failed to create admin account" });
  }
});

// PATCH /admin/admins/:id — edit name only (no password)
router.patch("/admin/admins/:id", async (req: Request, res: Response) => {
  const callerRole = req.headers["x-user-role"];

  if (callerRole !== "SUPER_ADMIN") {
    return res.status(403).json({ message: "Forbidden" });
  }

  const { id } = req.params as { id: string };
  const { name } = req.body;

  try {
    const target = await prisma.user.findUnique({ where: { id } });
    if (
      !target ||
      (target.role !== "ADMIN" && target.role !== "SUPER_ADMIN")
    ) {
      return res
        .status(404)
        .json({ message: "Admin account not found" });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { name },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    return res.status(200).json({ message: "Admin updated", admin: updated });
  } catch (error) {
    console.error("Update Admin Error:", error);
    return res.status(500).json({ message: "Failed to update admin" });
  }
});

export default router;
