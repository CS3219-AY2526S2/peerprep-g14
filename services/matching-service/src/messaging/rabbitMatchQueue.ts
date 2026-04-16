/**
 * Work queue for running `tryMatchQueue` off the HTTP thread when RabbitMQ is available.
 * Queue: `matching.match.work` (durable). One consumer per process; competing consumers across replicas.
 */
import amqplib, { type Channel, type ChannelModel } from "amqplib";

export const MATCHING_WORK_QUEUE = "matching.match.work";

let workConn: ChannelModel | null = null;
let workPubCh: Channel | null = null;

let consumerConn: ChannelModel | null = null;
let consumerCh: Channel | null = null;
let consumerTag: string | null = null;

export function rabbitMatchQueueEnabled(): boolean {
  return Boolean(process.env.RABBITMQ_URL?.trim());
}

async function ensureWorkPublisher(): Promise<Channel | null> {
  const url = process.env.RABBITMQ_URL?.trim();
  if (!url) {
    return null;
  }
  if (!workConn) {
    workConn = await amqplib.connect(url);
    workConn.on("error", (err: Error) => {
      console.error("[rabbit-match-queue] publish connection error:", err.message);
      workConn = null;
      workPubCh = null;
    });
    workConn.on("close", () => {
      workConn = null;
      workPubCh = null;
    });
  }
  if (!workPubCh && workConn) {
    workPubCh = await workConn.createChannel();
    await workPubCh.assertQueue(MATCHING_WORK_QUEUE, { durable: true });
  }
  return workPubCh;
}

/**
 * Enqueue a matcher run (reason is for logs / future metrics only).
 */
export async function publishMatchQueueWork(reason: string): Promise<void> {
  const ch = await ensureWorkPublisher();
  if (!ch) {
    return;
  }
  const body = JSON.stringify({
    reason,
    at: new Date().toISOString(),
  });
  ch.sendToQueue(MATCHING_WORK_QUEUE, Buffer.from(body), {
    persistent: true,
    contentType: "application/json",
  });
}

export type MatchQueueRunner = () => Promise<void>;

/**
 * Subscribe to `matching.match.work` and invoke `run` for each message (prefetch 1).
 */
export async function startMatchQueueConsumer(run: MatchQueueRunner): Promise<void> {
  const url = process.env.RABBITMQ_URL?.trim();
  if (!url) {
    return;
  }
  await stopMatchQueueConsumer();

  consumerConn = await amqplib.connect(url);
  consumerConn.on("error", (err: Error) => {
    console.error("[rabbit-match-queue] consumer connection error:", err.message);
  });
  const ch = await consumerConn.createChannel();
  await ch.assertQueue(MATCHING_WORK_QUEUE, { durable: true });
  ch.prefetch(1);

  const { consumerTag: tag } = await ch.consume(
    MATCHING_WORK_QUEUE,
    async (msg) => {
      if (!msg) {
        return;
      }
      try {
        await run();
        ch.ack(msg);
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        console.error("[rabbit-match-queue] run failed:", m);
        ch.nack(msg, false, true);
      }
    },
    { noAck: false },
  );
  consumerTag = tag;
  consumerCh = ch;
}

export async function stopMatchQueueConsumer(): Promise<void> {
  const ch = consumerCh;
  const tag = consumerTag;
  consumerCh = null;
  consumerTag = null;
  try {
    if (ch && tag) {
      await ch.cancel(tag);
      await ch.close();
    }
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[rabbit-match-queue] consumer channel close:", m);
  }
  const cconn = consumerConn;
  consumerConn = null;
  try {
    if (cconn) {
      await cconn.close();
    }
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[rabbit-match-queue] consumer connection close:", m);
  }
}

/** Close publisher connection used for work-queue sends (graceful shutdown). */
export async function closeMatchQueuePublisher(): Promise<void> {
  const ch = workPubCh;
  const conn = workConn;
  workPubCh = null;
  workConn = null;
  try {
    if (ch) {
      await ch.close();
    }
  } catch {
    /* ignore */
  }
  try {
    if (conn) {
      await conn.close();
    }
  } catch {
    /* ignore */
  }
}
