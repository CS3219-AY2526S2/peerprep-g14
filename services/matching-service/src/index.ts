import "dotenv/config";
import express, { type Application } from "express";
import type { Server } from "node:http";
import cors, { type CorsOptions } from "cors";
import matchingRouter from "./routes/matchingRoutes.js";
import { runMatchQueueTick } from "./services/matchRequestService.js";
import { runReadinessChecks } from "./health/readiness.js";
import { disconnectDatabase } from "./prisma.js";
import { closeRabbitMq } from "./messaging/rabbitmqPublisher.js";
import {
  closeMatchQueuePublisher,
  publishMatchQueueWork,
  rabbitMatchQueueEnabled,
  startMatchQueueConsumer,
  stopMatchQueueConsumer,
} from "./messaging/rabbitMatchQueue.js";

const app: Application = express();
const PORT = Number.parseInt(process.env.PORT ?? "3003", 10);

/** Allow Vite dev (localhost / 127.0.0.1) and optional extra origin from env. */
const defaultOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  // Add your exact ALB DNS name here:
  "http://peerprep-1486465808.ap-southeast-1.elb.amazonaws.com"
] as const;
const extra = process.env.FRONTEND_ORIGIN?.trim();
const allowList = extra
  ? [...defaultOrigins, extra]
  : [...defaultOrigins];

const corsOptions: CorsOptions = {
  origin: allowList,
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json());

/** Liveness: process is up (no dependency checks). */
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", liveness: true });
});

/**
 * Readiness: Postgres (required); RabbitMQ when `RABBITMQ_URL` is set.
 * Use for orchestration (e.g. Docker/K8s) to restart or stop routing when dependencies fail.
 */
app.get("/ready", async (_req, res) => {
  try {
    const result = await runReadinessChecks();
    if (result.ok) {
      res.status(200).json({
        status: "ready",
        checks: result.checks,
      });
      return;
    }
    res.status(503).json({
      status: "not_ready",
      checks: result.checks,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[readiness]", e);
    res.status(503).json({
      status: "not_ready",
      error: message,
    });
  }
});

app.use("/matching", matchingRouter);

const SHUTDOWN_HTTP_MS = Number.parseInt(
  process.env.SHUTDOWN_HTTP_MS ?? "25000",
  10,
);

let server: Server | null = null;
let isShuttingDown = false;
let consumerStartRetryTimer: ReturnType<typeof setTimeout> | null = null;

const MATCH_QUEUE_CONSUMER_RETRY_MS = Number.parseInt(
  process.env.MATCH_QUEUE_CONSUMER_RETRY_MS ?? "5000",
  10,
);

function scheduleMatchQueueConsumerStartRetry(): void {
  if (isShuttingDown || !rabbitMatchQueueEnabled()) {
    return;
  }
  if (consumerStartRetryTimer !== null) {
    clearTimeout(consumerStartRetryTimer);
  }
  const retryMs =
    Number.isFinite(MATCH_QUEUE_CONSUMER_RETRY_MS) &&
    MATCH_QUEUE_CONSUMER_RETRY_MS > 0
      ? MATCH_QUEUE_CONSUMER_RETRY_MS
      : 5000;
  consumerStartRetryTimer = setTimeout(() => {
    consumerStartRetryTimer = null;
    void startMatchQueueConsumerWithRetry();
  }, retryMs);
}

async function startMatchQueueConsumerWithRetry(): Promise<void> {
  if (isShuttingDown || !rabbitMatchQueueEnabled()) {
    return;
  }
  try {
    await startMatchQueueConsumer(runMatchQueueTick);
    console.log("[matching] match queue consumer connected");
  } catch (e) {
    console.error("[matching] startMatchQueueConsumer failed:", e);
    scheduleMatchQueueConsumerStartRetry();
  }
}

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;
  if (consumerStartRetryTimer !== null) {
    clearTimeout(consumerStartRetryTimer);
    consumerStartRetryTimer = null;
  }
  console.log(`[shutdown] ${signal} received, draining HTTP connections...`);

  const httpServer = server;
  if (!httpServer) {
    try {
      await stopMatchQueueConsumer();
    } catch (e) {
      console.error("[shutdown] match queue consumer:", e);
    }
    try {
      await closeMatchQueuePublisher();
    } catch (e) {
      console.error("[shutdown] match queue publisher:", e);
    }
    try {
      await closeRabbitMq();
    } catch (e) {
      console.error("[shutdown] RabbitMQ:", e);
    }
    await disconnectDatabase();
    process.exit(0);
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => {
      console.warn(
        `[shutdown] HTTP drain exceeded ${SHUTDOWN_HTTP_MS}ms; closing open connections`,
      );
      if (typeof httpServer.closeAllConnections === "function") {
        httpServer.closeAllConnections();
      }
    }, SHUTDOWN_HTTP_MS);

    httpServer.close((err) => {
      clearTimeout(t);
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  }).catch((e) => {
    console.error("[shutdown] server.close error:", e);
  });

  console.log(
    "[shutdown] HTTP server closed; stopping match queue consumer and closing RabbitMQ...",
  );
  try {
    await stopMatchQueueConsumer();
  } catch (e) {
    console.error("[shutdown] match queue consumer:", e);
  }
  try {
    await closeMatchQueuePublisher();
  } catch (e) {
    console.error("[shutdown] match queue publisher:", e);
  }
  try {
    await closeRabbitMq();
  } catch (e) {
    console.error("[shutdown] RabbitMQ close:", e);
  }
  try {
    await disconnectDatabase();
  } catch (e) {
    console.error("[shutdown] database disconnect:", e);
  }

  console.log("[shutdown] cleanup complete");
  process.exit(0);
}

process.once("SIGTERM", () => {
  void gracefulShutdown("SIGTERM");
});
process.once("SIGINT", () => {
  void gracefulShutdown("SIGINT");
});

server = app.listen(PORT, () => {
  console.log(`matching-service listening on http://localhost:${PORT}`);
});

if (rabbitMatchQueueEnabled()) {
  void startMatchQueueConsumerWithRetry();
}

/** Lets matches resolve while users only hold an SSE connection (no GET polling). */
const matchQueueTickMs = Number.parseInt(
  process.env.MATCH_QUEUE_TICK_MS ?? "4000",
  10,
);
if (Number.isFinite(matchQueueTickMs) && matchQueueTickMs > 0) {
  setInterval(() => {
    if (rabbitMatchQueueEnabled()) {
      void publishMatchQueueWork("tick").catch((e) => {
        const m = e instanceof Error ? e.message : String(e);
        console.error(`[matching] publishMatchQueueWork(tick) failed: ${m}; running inline`);
        void runMatchQueueTick();
      });
      return;
    }
    void runMatchQueueTick();
  }, matchQueueTickMs);
}
