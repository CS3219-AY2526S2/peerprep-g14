import { useEffect, useState } from "react";
import { StreamChat, type Channel as StreamChannel } from "stream-chat";
import {
  Chat,
  Channel,
  MessageInput,
  MessageList,
  Window,
} from "stream-chat-react";
import "stream-chat-react/dist/css/v2/index.css";

type Props = {
  channelId: string;
};

type ChatTokenResponse = {
  apiKey: string;
  token: string;
  user: {
    id: string;
    name: string;
    image?: string;
  };
};

export default function SessionChat({ channelId }: Props) {
  const [client, setClient] = useState<StreamChat | null>(null);
  const [channel, setChannel] = useState<StreamChannel | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let chatClient: StreamChat | null = null;

    const init = async () => {
      try {
        const tokenRes = await fetch("http://localhost:3000/api/chat/token", {
          method: "GET",
          credentials: "include",
        });

        if (!tokenRes.ok) {
          throw new Error(`Token request failed: ${tokenRes.status}`);
        }

        const tokenData: ChatTokenResponse = await tokenRes.json();

        chatClient = StreamChat.getInstance(tokenData.apiKey);

        if (chatClient.userID !== tokenData.user.id) {
          if (chatClient.userID) {
            await chatClient.disconnectUser();
          }

          await chatClient.connectUser(tokenData.user, tokenData.token);
        }

        const ch = chatClient.channel("messaging", channelId);
        await ch.watch();

        if (mounted) {
          setClient(chatClient);
          setChannel(ch);
        }
      } catch (err) {
        console.error("SessionChat init error:", err);
        if (mounted) {
          setError("Failed to load chat");
        }
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, [channelId]);

  if (error) return <div>{error}</div>;
  if (!client || !channel) return <div>Loading chat...</div>;

  return (
    <Chat client={client}>
      <Channel channel={channel}>
        <Window>
          <MessageList />
          <MessageInput />
        </Window>
      </Channel>
    </Chat>
  );
}
