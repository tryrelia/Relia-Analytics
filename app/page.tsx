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
  XIcon,
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
import { cn } from "@/lib/utils";

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
  "How many unique users visited yesterday?",
  "What is our week-over-week retention?",
  "Show me the most common paths to conversion",
  "Write a HogQL query to find power users",
] as const;


function MCPIndicator({ toolName, state }: { toolName: string; state: string }) {
  const isDone = state === "output-available";
  const isError = state === "error";
  const isRunning = !isDone && !isError;

  return (
    <div
      className={cn(
        "relative flex w-fit items-center gap-3 overflow-hidden rounded-lg border p-2 pr-3.5 transition-all duration-500",
        isRunning && "border-orange-500/30 bg-gradient-to-r from-orange-950/60 to-orange-950/10 shadow-[0_0_16px_0_rgba(249,115,22,0.06)]",
        isDone && "border-emerald-500/20 bg-gradient-to-r from-emerald-950/40 to-emerald-950/10",
        isError && "border-red-500/20 bg-gradient-to-r from-red-950/40 to-red-950/10",
      )}
    >
      {/* Pulse overlay */}
      {isRunning && (
        <div className="pointer-events-none absolute inset-0 animate-pulse bg-gradient-to-r from-orange-500/5 to-transparent" />
      )}

      {/* Icon cell */}
      <div
        className={cn(
          "relative flex size-9 shrink-0 items-center justify-center rounded-md",
          isRunning && "bg-orange-500/10",
          isDone && "bg-emerald-500/10",
          isError && "bg-red-500/10",
        )}
      >
        {isRunning && (
          <span className="absolute inset-0 animate-ping rounded-md border border-orange-400/50 [animation-duration:1.5s]" />
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/svg/mcp.webp" alt="MCP" className="size-6 object-contain" />
      </div>

      {/* Labels */}
      <div className="flex flex-col gap-0.5">
        <span
          className={cn(
            "font-mono text-[10px] tracking-[0.18em] uppercase",
            isRunning && "text-orange-400/60",
            isDone && "text-emerald-400/60",
            isError && "text-red-400/60",
          )}
        >
          via mcp
        </span>
        <span className="font-mono text-[12px] tracking-wide text-foreground/75">
          {toolName.replaceAll("_", " ")}
        </span>
      </div>

      {/* Status dot */}
      <div className="ml-1 shrink-0">
        {isRunning && (
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-orange-400 opacity-65" />
            <span className="relative inline-flex size-2 rounded-full bg-orange-500" />
          </span>
        )}
        {isDone && <CheckIcon className="size-3.5 text-emerald-400" />}
        {isError && <XIcon className="size-3.5 text-red-400" />}
      </div>
    </div>
  );
}

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
    onError: (error) => {
      if (error.name === "AbortError" || error.message?.includes("aborted")) {
        return;
      }
      console.error(error);
    },
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

  const handleSendMessage = useCallback(
    async (msg: { text: string; files?: any[] }) => {
      try {
        await sendMessage(msg);
      } catch (error) {
        if (
          error instanceof Error &&
          (error.name === "AbortError" || error.message?.includes("aborted"))
        ) {
          return;
        }
        throw error;
      }
    },
    [sendMessage]
  );

  const handleSubmit = useCallback(
    (msg: PromptInputMessage) => {
      if (!msg.text.trim()) return;
      handleSendMessage({ text: msg.text });
    },
    [handleSendMessage]
  );

  const isGenerating = status === "submitted" || status === "streaming";

  const promptInput = (
    <div className="border-t bg-background p-4">
      <PromptInput
        onSubmit={handleSubmit}
        className="mx-auto max-w-5xl px-9"
      >
        <PromptInputBody>
          <PromptInputTextarea placeholder="Message…" />
        </PromptInputBody>
        <PromptInputFooter className="justify-end">
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
                onClick={() => handleSendMessage({ text: s })}
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
      <Conversation className="flex-1 w-full">
        <ConversationContent className="max-w-5xl mx-auto w-full px-9">
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

                    // DynamicToolUIPart (from dynamicTool()) — type is "dynamic-tool"
                    // ToolUIPart (from tool()) — type is "tool-${toolName}"
                    {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const tp = part as any;
                      const pt = part.type as string;
                      const isDynamic = pt === "dynamic-tool";
                      const isStatic = pt.startsWith("tool-");

                      if (isDynamic || isStatic) {
                        const toolName: string = isDynamic
                          ? (tp.toolName as string)
                          : pt.slice(5).replaceAll("_", "-");

                        return (
                          <MCPIndicator
                            key={key}
                            toolName={toolName}
                            state={tp.state ?? "input-available"}
                          />
                        );
                      }
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

          {/* Thinking: only before any tool or text appears */}
          {(() => {
            if (!isGenerating) return null;
            const last = messages[messages.length - 1];
            if (!last || last.role !== "assistant") {
              // No assistant message yet — show shimmer
              return (
                <Message from="assistant">
                  <MessageContent>
                    <Shimmer duration={1.5}>Thinking…</Shimmer>
                  </MessageContent>
                </Message>
              );
            }
            const hasText = last.parts.some(
              (p) => p.type === "text" && (p as any).text?.length > 0
            );
            const hasMCPParts = last.parts.some((p) => {
              const pt = p.type as string;
              return pt === "dynamic-tool" || pt.startsWith("tool-");
            });
            // Suppress once any tool part exists — MCP indicator handles status
            if (hasText || hasMCPParts) return null;
            return (
              <Message from="assistant">
                <MessageContent>
                  <Shimmer duration={1.5}>Thinking…</Shimmer>
                </MessageContent>
              </Message>
            );
          })()}
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
