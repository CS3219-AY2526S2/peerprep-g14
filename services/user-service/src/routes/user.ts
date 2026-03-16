import { Router, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import prisma from "../prisma.js";

const router = Router();

// Sample route
router.get("/user/hello", (req: Request, res: Response) => {
  res.send("TypeScript Backend is running! 🚀");
});

// 1. Initial trigger: Redirects user to GitHub
router.get("/user/auth/github", (req: Request, res: Response) => {
  const rootUrl = "https://github.com/login/oauth/authorize";
  const options = {
    client_id: process.env.GITHUB_CLIENT_ID!,
    redirect_uri: "http://localhost/user/user/login",
    scope: "user:email",
  };

  const queryString = new URLSearchParams(options).toString();
  res.redirect(`${rootUrl}?${queryString}`);
});

// 2. GitHub OAuth callback/login
router.get("/user/user/login", async (req: Request, res: Response) => {
  const { code } = req.query;

  try {
    const tokenResponse = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
        }),
      },
    );

    const { access_token } = await tokenResponse.json();

    const userResponse = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const userData = await userResponse.json();

    const emailResponse = await fetch("https://api.github.com/user/emails", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const emails = await emailResponse.json();

    const primaryEmail =
      emails.find(
        (e: { primary: boolean; verified: boolean }) => e.primary && e.verified,
      )?.email || emails[0]?.email;

    const name = userData.name || userData.login;
    const email = primaryEmail;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    let user;
    let isNewUser = false;

    if (!existingUser) {
      user = await prisma.user.create({
        data: {
          email,
          name,
          authProvider: "github",
          providerId: userData.id.toString(),
        },
      });
      isNewUser = true;
    } else {
      user = existingUser;
    }

    const accessToken = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.ACCESS_TOKEN_SECRET as string,
      { expiresIn: "15m" },
    );

    const refreshToken = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.REFRESH_TOKEN_SECRET as string,
      { expiresIn: "7d" },
    );

    const tokenHash = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    await prisma.user_refresh_token.create({
      data: {
        userId: user.id,
        token_hash: tokenHash,
        expire_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    console.log(
      `Authenticated: Userid:${user.id} Name:${user.name} Email:${user.email} IsNewUser:${isNewUser}`,
    );

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 15 * 60 * 1000,
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    if (isNewUser) {
      res.redirect(`http://localhost/profile-setup?userId=${user.id}`);
    } else {
      res.redirect(`http://localhost/dashboard`);
    }
  } catch (err) {
    console.error("GitHub OAuth Login Error:", err);
    res.status(500).json({
      error: `Failed to retrieve user data: ${(err as Error).message}`,
      details: err,
    });
  }
});

// Profile retrival
router.get("/profile/me", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];
    const role = req.headers["x-user-role"];

    if (!userId || typeof userId !== "string") {
      return res.status(401).json({ message: "Unauthorized: missing user id" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        experienceLevel: true,
        learningPurpose: true,
        bio: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json(user);
  } catch (error) {
    console.error("Get current user profile error:", error);
    return res
      .status(500)
      .json({ message: "Failed to get current user profile" });
  }
});

// Profile update
router.patch("/profile", async (req: Request, res: Response) => {
  const { userId, name, experienceLevel, learningPurpose, bio } = req.body;

  if (!userId) {
    return res.status(400).json({ message: "userId is required" });
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name,
        experienceLevel,
        learningPurpose,
        bio,
      },
    });

    return res
      .status(200)
      .json({ message: "Profile updated successfully", user: updatedUser });
  } catch (error) {
    console.error("Profile Setup Error:", error);
    return res.status(500).json({ message: "Failed to update profile", error });
  }
});

export default router;
