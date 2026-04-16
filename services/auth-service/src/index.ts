import express from "express";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import axios from "axios";
import { createProxyMiddleware } from "http-proxy-middleware";
import cors from "cors";

dotenv.config();

const app = express();
app.use(cookieParser());

app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost"],
    credentials: true,
  }),
);

// DEBUG: Log every single incoming request
app.use((req: any, res: any, next: any) => {
  console.log(`[REQUEST] ${req.method} ${req.path}`);
  next();
});

const ACCESS_SECRET = process.env.ACCESS_TOKEN_SECRET!;
const PORT = process.env.PORT || 3000;

// Middleware to verify JWT
const verifyGateway = async (req: any, res: any, next: any) => {
  const { accessToken, refreshToken } = req.cookies;

  console.log(req.path);
  console.log("Gateway Middleware Triggered");
  // 1. Valid Access Token exists? Easy path.
  if (accessToken) {
    try {
      const decoded = jwt.verify(accessToken, ACCESS_SECRET) as {
        userId: string;
        role: string;
      };
      req.headers["x-user-id"] = decoded.userId;
      req.headers["x-user-role"] = decoded.role;
      return next();
    } catch (err: any) {
      if (err.name !== "TokenExpiredError") {
        return res.status(401).json({ message: "Invalid token" });
      }
      // If it's just expired, fall through to refresh logic below
    }
  }

  // 2. Refresh Logic
  if (refreshToken) {
    try {
      // Call User Service - It returns JSON, NOT a cookie
      const response = await axios.post(
        "http://user-service:3001/auth/refresh",
        {
          refreshToken,
        },
      );

      const { newAccessToken, userId, role } = response.data;

      // 3. SET THE COOKIE HERE (On the actual response going to user)
      res.cookie("accessToken", newAccessToken, {
        httpOnly: true,
        secure: false, // MUST be false for plain http
        sameSite: "lax",
        maxAge: 15 * 60 * 1000,
      });

      req.headers["x-user-id"] = userId;
      req.headers["x-user-role"] = role;
      return next();
    } catch (refreshErr) {
      return res.status(401).json({ message: "Session expired" });
    }
  }

  return res.status(401).json({ message: "Unauthorized: No tokens provided" });
};

// PROXY LOGIC

// New endpoint for frontend to logout and clear session cookies
app.post("/api/auth/logout", async (req: any, res: any) => {
  console.log("LOGOUT HANDLER HIT");
  console.log("Cookies received:", req.cookies);
  const { refreshToken } = req.cookies;

  if (refreshToken) {
    try {
      await axios.post("http://user-service:3001/auth/logout", {
        refreshToken,
      });
    } catch (err) {
      console.error("Failed to clear token in user-service", err);
    }
  }

  res.clearCookie("accessToken", {
    httpOnly: true,
    secure: false, // MUST be false for plain http
    sameSite: "lax",
  });

  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: false, // MUST be false for plain http
    sameSite: "lax",
  });

  return res.status(200).json({ message: "Logged out successfully" });
});

app.get("/health", async (req: any, res: any) => {
  return res.status(200).send("OK");
});

// New endpoint for frontend to verify session validity
app.get("/api/auth/verify", verifyGateway, (req: any, res: any) => {
  // If we reach here, verifyGateway has already validated the token
  // and attached x-user-id and x-user-role headers.
  return res.status(200).json({
    userId: req.headers["x-user-id"],
    role: req.headers["x-user-role"],
  });
});

app.use(
  "/api/user",
  verifyGateway,
  createProxyMiddleware({
    target: "http://user-service:3001",
    changeOrigin: true,
  }),
);

// Route /api/questions to question-service
app.use(
  "/api/questions",
  verifyGateway,
  createProxyMiddleware({
    target: "http://question-service:3002",
    changeOrigin: true,
    pathRewrite: { "^/api/questions": "/" },
  }),
);

// Route /api/matching → matching-service (same auth + x-user-id injection as other /api routes)
// Express strips the mount path, so the proxy sees `/requests` not `/api/matching/requests`.
// Prepend `/matching` so upstream receives `/matching/requests` (not `/requests`, which 404s).
app.use(
  "/api/matching",
  verifyGateway,
  createProxyMiddleware({
    target: "http://matching-service:3003",
    changeOrigin: true,
    /** SSE streams can stay open for the whole match wait. */
    timeout: 3_600_000,
    proxyTimeout: 3_600_000,
    pathRewrite: (path: string) => {
      const [pathname, search] = path.split("?");
      const nextPath = "/matching" + (pathname || "");
      return search ? `${nextPath}?${search}` : nextPath;
    },
  }),
);

// Route /api/execute to code-execution-service
app.use(
  "/api/execute",
  verifyGateway,
  createProxyMiddleware({
    target: "http://code-execution-service:3006",
    changeOrigin: true,
    pathRewrite: { "^/": "/execute" },
    timeout: 300000, // 5 min — covers first-time image pulls
    proxyTimeout: 300000,
  }),
);

const collabProxy = createProxyMiddleware({
  target: "http://collaboration-service:3004",
  changeOrigin: true,
  ws: true, // for WebSockets
});

// Route /api/collaboration to collaboration-service
app.use("/api/collaboration", verifyGateway, collabProxy);

const server = app.listen(PORT, () =>
  console.log(`Auth Service running on port ${PORT}`),
);

// Handle WebSocket Upgrades
server.on("upgrade", (req: any, socket: any, head: any) => {
  console.log(`[UPGRADE REQUEST] ${req.url}`);
  if (req.url && req.url.startsWith("/api/collaboration")) {
    collabProxy.upgrade(req, socket, head);
  } else {
    socket.destroy();
  }
});

// Route /api/ai to ai-service
app.use(
  "/api/ai",
  verifyGateway,
  createProxyMiddleware({
    target: "http://ai-service:3005",
    changeOrigin: true,
    pathRewrite: { "^/api/ai": "/" },
  }),
);

app.use(
  "/api/chat",
  verifyGateway,
  createProxyMiddleware({
    target: "http://chat-service:3007",
    changeOrigin: true,
    pathRewrite: (path: string) => {
      const [pathname, search] = path.split("?");
      const nextPath = "/chat" + (pathname || "");
      return search ? `${nextPath}?${search}` : nextPath;
    },
  }),
);
