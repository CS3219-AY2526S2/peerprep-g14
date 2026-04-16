import amqplib, { type Connection, type Channel } from "amqplib";
import { SessionService } from "../services/SessionService.js";

const MATCHING_EVENTS_EXCHANGE = "matching.events";
const MATCH_FOUND_ROUTING_KEY = "match.found";
const QUEUE_NAME = "collaboration.match_found";

let connection: Connection | null = null;
let channel: Channel | null = null;

// initialize the RabbitMQ consumer for session initialization
// subscribes to match.found events from the matching-servic
export async function initMatchConsumer() {
  const url = process.env.RABBITMQ_URL;
  if (!url) {
    console.warn("[rabbitmq] RABBITMQ_URL not set. Consumer skipped.");
    return;
  }

  try {
    connection = await amqplib.connect(url);
    channel = await connection.createChannel();

    // 1. Assert Exchange
    await channel.assertExchange(MATCHING_EVENTS_EXCHANGE, "topic", {
      durable: true,
    });

    // 2. Assert Queue with retry potential
    await channel.assertQueue(QUEUE_NAME, { durable: true });

    // 3. Bind Queue to Exchange
    await channel.bindQueue(
      QUEUE_NAME,
      MATCHING_EVENTS_EXCHANGE,
      MATCH_FOUND_ROUTING_KEY,
    );

    console.log(
      `[rabbitmq] Subscribed to ${MATCH_FOUND_ROUTING_KEY} on ${MATCHING_EVENTS_EXCHANGE}`,
    );

    // 4. Consume Messages
    await channel.consume(
      QUEUE_NAME,
      async (msg: amqplib.ConsumeMessage | null) => {
        if (!msg) return;

        try {
          const content = JSON.parse(msg.content.toString());
          const {
            matchId,
            userAId,
            userBId,
            topic,
            matchedDifficulty,
            programmingLanguage,
          } = content;

          console.log(
            `[rabbitmq] Received match.found: matchId=${matchId}, topic=${topic}, diff=${matchedDifficulty}`,
          );

          // Idempotent creation
          await SessionService.createSession({
            matchId,
            user1Id: userAId,
            user2Id: userBId,
            topic,
            difficulty: matchedDifficulty,
            language: programmingLanguage || "javascript",
          });

          channel?.ack(msg);
        } catch (err) {
          console.error(
            `[rabbitmq] Error processing match.found message:`,
            err,
          );
          channel?.nack(msg, false, false);
        }
      },
    );

    connection.on("error", (err: any) => {
      console.error("[rabbitmq] Connection error:", err);
      reconnect();
    });

    connection.on("close", () => {
      console.warn("[rabbitmq] Connection closed.");
      reconnect();
    });
  } catch (err) {
    console.error("[rabbitmq] Initialization failed:", err);
    reconnect();
  }
}

function reconnect() {
  setTimeout(initMatchConsumer, 500);
}
