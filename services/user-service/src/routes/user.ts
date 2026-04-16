import { Router, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import prisma from "../prisma.js";
import multer from "multer";
import { supabaseAdmin } from "../lib/supabase.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

async function syncUserToStream(user: {
  id: string;
  name: string | null;
  image?: string;
}) {
  try {
    await fetch("http://chat-service:3007/chat/users/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: user.id,
        name: user.name || "User",
        image: user.image,
      }),
    });
  } catch (err) {
    console.error("Failed to sync user to Stream:", err);
  }
}

// Sample route
router.get("/user/hello", (req: Request, res: Response) => {
  res.send("TypeScript Backend is running! 🚀");
});

// 1. Initial trigger: Redirects user to GitHub
router.get("/user/auth/github", (req: Request, res: Response) => {
  const rootUrl = "https://github.com/login/oauth/authorize";
  const baseUrl = process.env.BASE_URL || "http://localhost:3000";
  const options = {
    client_id: process.env.GITHUB_CLIENT_ID!,
    redirect_uri: `${baseUrl}/user/user/login`,
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

      await syncUserToStream({
        id: user.id,
        name: user.name,
        image: user.profileImagePath ?? undefined,
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

    if (isNewUser) {
      res.redirect(`/#/profile-setup?userId=${user.id}`);
    } else {
      res.redirect(`/#/dashboard`);
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
        profileImagePath: true,
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

    await syncUserToStream({
      id: userId,
      name: name,
    });

    return res
      .status(200)
      .json({ message: "Profile updated successfully", user: updatedUser });
  } catch (error) {
    console.error("Profile Setup Error:", error);
    return res.status(500).json({ message: "Failed to update profile", error });
  }
});

// Profile-picture update
router.post(
  "/profile/picture",
  upload.single("image"),
  async (req: Request, res: Response) => {
    try {
      const userId = req.body.userId;
      const file = req.file;

      if (!userId) {
        return res.status(400).json({ message: "userId is required" });
      }

      if (!file) {
        return res.status(400).json({ message: "Image file is required" });
      }

      if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        return res.status(400).json({ message: "Invalid image type" });
      }

      const existingUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, profileImagePath: true },
      });

      if (!existingUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const ext =
        file.mimetype === "image/png"
          ? "png"
          : file.mimetype === "image/webp"
            ? "webp"
            : "jpg";

      const newPath = `users/${userId}/avatar-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from("profile-pictures")
        .upload(newPath, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });

      if (uploadError) {
        console.error("Supabase upload error:", uploadError);
        return res.status(500).json({
          message: "Failed to upload image",
          error: uploadError.message,
        });
      }

      if (existingUser.profileImagePath) {
        const { error: deleteError } = await supabaseAdmin.storage
          .from("profile-pictures")
          .remove([existingUser.profileImagePath]);

        if (deleteError) {
          console.error("Old image delete warning:", deleteError);
        }
      }

      await prisma.user.update({
        where: { id: userId },
        data: { profileImagePath: newPath },
      });

      await syncUserToStream({
        id: existingUser.id,
        name: existingUser.name,
        image: existingUser.profileImagePath ?? undefined,
      });

      return res.status(200).json({
        message: "Profile picture uploaded successfully",
        path: newPath,
      });
    } catch (error) {
      console.error("Upload profile picture error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
);

export default router;
