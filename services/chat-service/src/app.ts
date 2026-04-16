import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { streamServerClient } from "./stream";
import axios from "axios";

dotenv.config();

const app = express();
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost"],
    credentials: true,
  }),
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "chat-service" });
});

// User onboarding
app.post("/chat/users/sync", async (req, res) => {
  try {
    const { userId, name, image } = req.body;

    if (!userId || !name) {
      return res.status(400).json({ error: "userId and name are required" });
    }

    await streamServerClient.upsertUser({
      id: String(userId),
      name,
      image: image || undefined,
    });

    return res.json({ ok: true });
  } catch (error: any) {
    console.error("sync user error:", error?.response?.data || error);
    return res.status(500).json({
      error: "failed to sync user",
      details: error?.response?.data || error?.message,
    });
  }
});

app.get("/chat/token", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];
    const userRole = req.headers["x-user-role"];

    if (!userId || typeof userId !== "string") {
      return res.status(401).json({ error: "Missing x-user-id header" });
    }

    const profileRes = await axios.get("http://user-service:3001/profile/me", {
      headers: {
        "x-user-id": userId,
        "x-user-role": typeof userRole === "string" ? userRole : "",
      },
    });

    const profile = profileRes.data;
    const safeName = profile?.name || "User";

    await streamServerClient.upsertUser({
      id: userId,
      name: safeName,
      image: profile?.profileImageUrl || undefined,
    });

    const token = streamServerClient.createToken(userId);

    return res.json({
      apiKey: process.env.STREAM_API_KEY,
      token,
      user: {
        id: userId,
        name: safeName,
        image: profile?.profileImageUrl || undefined,
      },
    });
  } catch (error: any) {
    console.error("chat token error:", error?.response?.data || error);
    return res.status(500).json({
      error: "Failed to create chat token",
      details: error?.response?.data || error?.message,
    });
  }
});

app.post("/chat/channel", async (req, res) => {
  const { channelId, memberIds, createdById } = req.body;

  if (!channelId || !memberIds?.length || !createdById) {
    return res.status(400).json({
      error: "channelId, memberIds, createdById are required",
    });
  }

  const channel = streamServerClient.channel("messaging", channelId, {
    members: memberIds,
    created_by_id: createdById,
  });

  await channel.create();

  res.json({
    channelId,
    type: "messaging",
  });
});

app.delete("/chat/channel/:channelId", async (req, res) => {
  try {
    const { channelId } = req.params;

    const channel = streamServerClient.channel("messaging", channelId);
    await channel.delete();

    return res.json({ ok: true });
  } catch (error: any) {
    console.error("delete channel error:", error?.response?.data || error);
    return res.status(500).json({
      error: "Failed to delete channel",
      details: error?.response?.data || error?.message,
    });
  }
});

export default app;
