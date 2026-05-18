"use client";

import { createContext, useContext } from "react";
import type { UIMessage } from "ai";
import type { StoredConversation } from "@/lib/db";

export interface ChatSettings {
  apiKey: string;
  projectId: string;
  aiProvider: "openai" | "anthropic" | "google" | "openrouter";
  aiApiKey: string;
}

interface ChatContextType {
  conversations: StoredConversation[];
  handleSave: (id: string, title: string, messages: UIMessage[]) => void;
  handleDelete: (id: string) => Promise<void>;
  settings: ChatSettings;
  updateSettings: (settings: ChatSettings) => void;
}

export const ChatContext = createContext<ChatContextType | null>(null);

export function useChatContext() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChatContext must be used within a ChatProvider");
  }
  return context;
}
