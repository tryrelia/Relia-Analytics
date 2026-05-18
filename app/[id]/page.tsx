"use client";

import { useChatContext } from "@/lib/chat-context";
import { ChatInterface } from "@/components/chat-interface";
import { useParams } from "next/navigation";

export default function ConversationPage() {
  const { id } = useParams();
  const { conversations, handleSave } = useChatContext();
  
  const conversationId = id as string;
  const conversation = conversations.find((c) => c.id === conversationId);

  return (
    <ChatInterface
      key={conversationId}
      conversationId={conversationId}
      initialMessages={conversation?.messages ?? []}
      onSave={handleSave}
    />
  );
}
