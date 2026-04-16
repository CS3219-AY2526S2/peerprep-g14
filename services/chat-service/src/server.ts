import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import { startMatchFoundConsumer } from "./messaging/matchFoundConsumer";

const port = Number(process.env.PORT) || 3007;

app.listen(port, async () => {
  console.log(`chat-service running on port ${port}`);

  try {
    await startMatchFoundConsumer();
  } catch (error) {
    console.error("[chat] failed to start match.found consumer:", error);
  }
});
