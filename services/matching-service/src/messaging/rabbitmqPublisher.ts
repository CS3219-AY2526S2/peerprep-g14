/**
 * Minimal RabbitMQ topic publisher for domain events.
 * No connection on module load — first publish connects lazily.
 * If `RABBITMQ_URL` is unset, publishing is a no-op (no throw).
 * Uses a confirm channel and `waitForConfirms()` so broker nacks are surfaced as errors.
 */
import amqplib, { type ChannelModel, type ConfirmChannel } from "amqplib";

export const MATCHING_EVENTS_EXCHANGE = "matching.events";

let connection: ChannelModel | null = null;
let channel: ConfirmChannel | null = null;

function resetConnection(): void {
  channel = null;
  connection = null;
}

async function ensureChannel(url: string): Promise<ConfirmChannel | null> {
  if (!connection) {
    const conn = await amqplib.connect(url);
    connection = conn;
    conn.on("error", (err: Error) => {
      console.error("[rabbitmq] connection error:", err.message);
      resetConnection();
    });
    conn.on("close", () => {
      resetConnection();
    });
  }
  const conn = connection;
  if (!channel) {
    channel = await conn.createConfirmChannel();
    channel.on("error", (err: Error) => {
      console.error("[rabbitmq] channel error:", err.message);
      channel = null;
    });
    await channel.assertExchange(MATCHING_EVENTS_EXCHANGE, "topic", {
      durable: true,
    });

  }
  return channel;
}

/**
 * Publish JSON to `matching.events` with the given routing key.
 * - Missing `RABBITMQ_URL`: resolves without doing anything.
 * - Broker errors: throws (caller should catch and log; do not fail user flows).
 */
export async function publishToMatchingExchange(
  routingKey: string,
  body: Record<string, unknown>,
): Promise<void> {
  const url = process.env.RABBITMQ_URL?.trim();
  if (!url) {
    return;
  }

  try {
    const ch = await ensureChannel(url);
    if (!ch) {
      return;
    }
    ch.publish(
      MATCHING_EVENTS_EXCHANGE,
      routingKey,
      Buffer.from(JSON.stringify(body)),
      {
        persistent: true,
        contentType: "application/json",
      },
    );
    await ch.waitForConfirms();
  } catch (err) {
    resetConnection();
    throw err;
  }
}

/**
 * Close confirm channel and connection if they were opened (graceful shutdown).
 * Safe to call when RabbitMQ was never used or `RABBITMQ_URL` is unset.
 */
export async function closeRabbitMq(): Promise<void> {
  const ch = channel;
  const conn = connection;
  channel = null;
  connection = null;
  try {
    if (ch) {
      await ch.close();
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[rabbitmq] channel close:", msg);
  }
  try {
    if (conn) {
      await conn.close();
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[rabbitmq] connection close:", msg);
  }
}
