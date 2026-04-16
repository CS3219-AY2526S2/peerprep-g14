import amqp from "amqplib";
import { streamServerClient } from "../stream";
import crypto from "crypto";

type MatchFoundEventPayload = {
  eventType: "match.found";
  matchId: string;
  requestAId: string;
  requestBId: string;
  userAId: string;
  userBId: string;
  topic: string;
  programmingLanguage: string;
  matchedDifficulty: string;
  requesterDifficulty: string;
  partnerDifficulty: string;
  matchingType: "same_difficulty" | "downward";
  matchedTimeAvailableMinutes: number | null;
  occurredAt: string;
  version: number;
};

const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://rabbitmq:5672";
const MATCHING_EXCHANGE = process.env.MATCHING_EXCHANGE || "matching.events";
const CHAT_QUEUE = process.env.CHAT_MATCH_FOUND_QUEUE || "chat.match.found";

export async function startMatchFoundConsumer(): Promise<void> {
  const conn = await amqp.connect(RABBITMQ_URL);
  const channel = await conn.createChannel();

  await channel.assertExchange(MATCHING_EXCHANGE, "topic", { durable: true });
  await channel.assertQueue(CHAT_QUEUE, { durable: true });
  await channel.bindQueue(CHAT_QUEUE, MATCHING_EXCHANGE, "match.found");

  channel.consume(CHAT_QUEUE, async (msg) => {
    if (!msg) return;

    try {
      const payload = JSON.parse(
        msg.content.toString(),
      ) as MatchFoundEventPayload;

      if (payload.eventType !== "match.found") {
        channel.ack(msg);
        return;
      }

      const channelId =
        "match_" +
        crypto
          .createHash("sha256")
          .update(payload.matchId)
          .digest("hex")
          .slice(0, 24);

      await streamServerClient.upsertUsers([
        { id: payload.userAId },
        { id: payload.userBId },
      ]);

      const streamChannel = streamServerClient.channel("messaging", channelId, {
        members: [payload.userAId, payload.userBId],
        created_by_id: payload.userAId,
      });

      try {
        await streamChannel.create();
      } catch (err: any) {
        const msg = String(err?.message || "");
        if (!msg.toLowerCase().includes("exist")) {
          throw err;
        }
      }

      console.log("[chat] created channel from match.found", {
        channelId,
        members: [payload.userAId, payload.userBId],
      });

      channel.ack(msg);
    } catch (error: any) {
      console.error(
        "[chat] match.found consumer error:",
        error?.message || error,
      );
      channel.nack(msg, false, false);
    }
  });

  console.log("[chat] match.found consumer started");
}
