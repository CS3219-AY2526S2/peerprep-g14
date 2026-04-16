import { Router, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import prisma from "../prisma.js";

const router = Router();

router.post("/auth/refresh", async (req: Request, res: Response) => {
  const rawRefreshToken = req.body?.refreshToken;

  if (!rawRefreshToken) {
    return res.status(401).json({ message: "Refresh token missing" });
  }

  try {
    const incomingHash = crypto
      .createHash("sha256")
      .update(rawRefreshToken)
      .digest("hex");

    const storedToken = await prisma.user_refresh_token.findUnique({
      where: { token_hash: incomingHash },
    });

    if (!storedToken || storedToken.expire_at < new Date()) {
      return res.status(403).json({ message: "Token revoked or expired" });
    }

    const payload = jwt.verify(
      rawRefreshToken,
      process.env.REFRESH_TOKEN_SECRET as string,
    ) as { userId: string; role: string };

    if (payload.userId !== storedToken.userId) {
      return res.status(403).json({ message: "Token user mismatch" });
    }

    const accessToken = jwt.sign(
      { userId: payload.userId, role: payload.role },
      process.env.ACCESS_TOKEN_SECRET as string,
      { expiresIn: "15m" },
    );

    return res.json({
      newAccessToken: accessToken,
      userId: payload.userId,
    });
  } catch (error) {
    console.error("Refresh Error:", error);
    return res.status(403).json({ message: "Invalid refresh token" });
  }
});

router.post("/auth/logout", async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ message: "Refresh token missing" });
  }

  try {
    const incomingHash = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    await prisma.user_refresh_token.deleteMany({
      where: { token_hash: incomingHash },
    });

    return res.status(200).json({ message: "Token removed from database" });
  } catch (error) {
    console.error("Logout DB Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
