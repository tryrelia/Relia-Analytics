"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import type { ChatStatus, UIMessage } from "ai";
import { nanoid } from "nanoid";
import { useTheme } from "next-themes";
import {
  CheckIcon,
  CopyIcon,
  LaptopIcon,
  MoonIcon,
  PlusIcon,
  SunIcon,
  Trash2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
  MessageToolbar,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  getAllConversations,
  removeConversation,
  upsertConversation,
  type StoredConversation,
} from "@/lib/db";

function getTitle(messages: UIMessage[]): string {
  const first = messages.find((m) => m.role === "user");
  const text = first?.parts.find((p) => p.type === "text")?.text ?? "";
  return text.slice(0, 60) || "New Conversation";
}

// ── ThemeToggle ────────────────────────────────────────────────────────────────

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="size-9" />;

  const cycle = () =>
    setTheme(theme === "light" ? "dark" : theme === "dark" ? "system" : "light");

  return (
    <Button variant="ghost" size="icon" onClick={cycle} title={`Theme: ${theme}`}>
      {theme === "dark" ? (
        <MoonIcon className="size-4" />
      ) : theme === "light" ? (
        <SunIcon className="size-4" />
      ) : (
        <LaptopIcon className="size-4" />
      )}
    </Button>
  );
}

// ── CopyButton ─────────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }, [text]);

  return (
    <MessageAction tooltip="Copy" onClick={copy}>
      {copied ? (
        <CheckIcon className="size-3.5" />
      ) : (
        <CopyIcon className="size-3.5" />
      )}
    </MessageAction>
  );
}

// ── Suggestion chips ───────────────────────────────────────────────────────────

const SUGGESTIONS = [
  "Explain quantum entanglement simply",
  "Write a haiku about debugging",
  "Best way to learn Rust?",
  "Summarize the history of the internet",
] as const;

// ── ChatInterface ──────────────────────────────────────────────────────────────

interface ChatInterfaceProps {
  conversationId: string;
  initialMessages: UIMessage[];
  onSave: (id: string, title: string, messages: UIMessage[]) => void;
}

function ChatInterface({
  conversationId,
  initialMessages,
  onSave,
}: ChatInterfaceProps) {
  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  const { messages, sendMessage, status, stop } = useChat({
    messages: initialMessages,
  });

  const prevStatusRef = useRef<ChatStatus>("ready");
  useEffect(() => {
    const wasActive =
      prevStatusRef.current === "streaming" ||
      prevStatusRef.current === "submitted";
    if (wasActive && status === "ready" && messages.length > 0) {
      onSaveRef.current(conversationId, getTitle(messages), [...messages]);
    }
    prevStatusRef.current = status;
  }, [status, messages, conversationId]);

  const handleSubmit = useCallback(
    (msg: PromptInputMessage) => {
      if (!msg.text.trim() && !msg.files?.length) return;
      sendMessage({ text: msg.text, files: msg.files });
    },
    [sendMessage]
  );

  const isGenerating = status === "submitted" || status === "streaming";

  const promptInput = (
    <div className="border-t bg-background p-4">
      <PromptInput onSubmit={handleSubmit} className="mx-auto max-w-5xl px-9">
        <PromptInputBody>
          <PromptInputTextarea placeholder="Message…" />
        </PromptInputBody>
        <PromptInputFooter>
          <div />
          <PromptInputSubmit status={status} onStop={stop} />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );

  // Show empty state with suggestions when no messages and not generating
  if (messages.length === 0 && !isGenerating) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4">
          <div className="space-y-2 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">
              How can I help?
            </h2>
            <p className="text-sm text-muted-foreground">
              Ask me anything, or start with a suggestion.
            </p>
          </div>
          <div className="grid w-full max-w-lg grid-cols-2 gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => sendMessage({ text: s })}
                className="rounded-lg border bg-muted/40 px-4 py-3 text-left text-sm transition-colors hover:bg-accent"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        {promptInput}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <Conversation className="flex-1 w-full max-w-5xl mx-auto">
        <ConversationContent>
          {messages.map((msg, msgIndex) => {
            const isLast = msgIndex === messages.length - 1;
            const isAssistant = msg.role === "assistant";
            const messageText = msg.parts
              .filter((p) => p.type === "text")
              .map((p) => (p as { type: "text"; text: string }).text)
              .join("");

            return (
              <Message from={msg.role} key={msg.id}>
                <MessageContent>
                  {msg.parts.map((part, i) => {
                    const key = `${msg.id}-${i}`;

                    if (part.type === "reasoning") {
                      const rp = part as { type: "reasoning"; text: string };
                      return (
                        <Reasoning
                          key={key}
                          isStreaming={isLast && status === "streaming"}
                        >
                          <ReasoningTrigger />
                          <ReasoningContent>{rp.text}</ReasoningContent>
                        </Reasoning>
                      );
                    }

                    if (part.type === "text") {
                      const tp = part as { type: "text"; text: string };
                      return (
                        <MessageResponse
                          key={key}
                          isAnimating={isLast && status === "streaming"}
                        >
                          {tp.text}
                        </MessageResponse>
                      );
                    }

                    return null;
                  })}
                </MessageContent>

                {isAssistant && !isGenerating && messageText && (
                  <MessageToolbar>
                    <MessageActions className="opacity-0 transition-opacity group-hover:opacity-100">
                      <CopyButton text={messageText} />
                    </MessageActions>
                  </MessageToolbar>
                )}
              </Message>
            );
          })}

          {/* Thinking indicator while waiting for first token */}
          {status === "submitted" && (
            <Message from="assistant">
              <MessageContent>
                <Shimmer duration={1.5}>Thinking…</Shimmer>
              </MessageContent>
            </Message>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      {promptInput}
    </div>
  );
}

// ── ChatPage ───────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const [conversations, setConversations] = useState<StoredConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getAllConversations().then((convs) => {
      setConversations(convs);
      setLoaded(true);
    });
  }, []);

  const createNewChat = useCallback(() => {
    setActiveId(nanoid());
  }, []);

  const handleSave = useCallback(
    (id: string, title: string, messages: UIMessage[]) => {
      const now = Date.now();
      setConversations((prev) => {
        const existing = prev.find((c) => c.id === id);
        const updated: StoredConversation = {
          id,
          title,
          messages,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        };
        upsertConversation(updated);
        if (existing) {
          return prev
            .map((c) => (c.id === id ? updated : c))
            .sort((a, b) => b.updatedAt - a.updatedAt);
        }
        return [updated, ...prev];
      });
    },
    []
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await removeConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) setActiveId(null);
    },
    [activeId]
  );

  const activeConversation = conversations.find((c) => c.id === activeId);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside className="flex w-64 flex-shrink-0 flex-col border-r bg-muted/30">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="font-semibold tracking-tight">posthog-ai</span>
          <ThemeToggle />
        </div>

        <div className="p-2">
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={createNewChat}
          >
            <PlusIcon className="size-4" />
            New Chat
          </Button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {!loaded ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">Loading…</p>
          ) : conversations.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              No conversations yet
            </p>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                role="button"
                tabIndex={0}
                onClick={() => setActiveId(conv.id)}
                onKeyDown={(e) => e.key === "Enter" && setActiveId(conv.id)}
                className={`group flex cursor-pointer items-center rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent ${
                  activeId === conv.id
                    ? "bg-accent font-medium text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                <span className="flex-1 truncate">{conv.title}</span>
                <button
                  type="button"
                  aria-label="Delete conversation"
                  className="ml-1 hidden shrink-0 rounded p-0.5 hover:text-destructive group-hover:block"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(conv.id);
                  }}
                >
                  <Trash2Icon className="size-3.5" />
                </button>
              </div>
            ))
          )}
        </nav>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <main className="flex min-w-0 flex-1 flex-col">
        {activeId ? (
          <ChatInterface
            key={activeId}
            conversationId={activeId}
            initialMessages={activeConversation?.messages ?? []}
            onSave={handleSave}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Welcome to posthog-ai</h2>
              <p className="text-sm text-muted-foreground">
                Create a new chat or select one from the sidebar.
              </p>
            </div>
            <Button onClick={createNewChat} className="gap-2">
              <PlusIcon className="size-4" />
              New Chat
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
