import { StreamChat } from "stream-chat";

const apiKey = process.env.STREAM_API_KEY;
const apiSecret = process.env.STREAM_API_SECRET;

if (!apiKey || !apiSecret) {
  throw new Error("Missing STREAM_API_KEY or STREAM_API_SECRET");
}

export const streamServerClient = StreamChat.getInstance(apiKey, apiSecret);
