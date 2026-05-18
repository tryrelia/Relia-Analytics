"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import type { ChatStatus, UIMessage } from "ai";
import { CheckIcon, CopyIcon, XIcon, SettingsIcon } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { useChatContext } from "@/lib/chat-context";
import { parseContentWithCharts, InteractiveChart } from "@/components/chat-chart";

function getTitle(messages: UIMessage[]): string {
  const first = messages.find((m) => m.role === "user");
  const text = first?.parts.find((p) => p.type === "text")?.text ?? "";
  return text.slice(0, 60) || "New Conversation";
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
  const isError = state === "output-error";
  const isRunning = !isDone && !isError;

  return (
    <div
      className={cn(
        "relative flex w-fit items-center gap-3 overflow-hidden rounded-xl border p-2.5 pr-4 transition-all duration-500 shadow-xs",
        isRunning && "border-orange-200 bg-orange-50/50 text-orange-900 shadow-[0_4px_20px_-4px_rgba(249,115,22,0.1)] dark:border-orange-500/25 dark:bg-orange-950/20 dark:text-orange-300",
        isDone && "border-emerald-200 bg-emerald-50/50 text-emerald-900 dark:border-emerald-500/15 dark:bg-emerald-950/15 dark:text-emerald-300",
        isError && "border-red-200 bg-red-50/50 text-red-900 dark:border-red-500/15 dark:bg-red-950/15 dark:text-red-300",
      )}
    >
      {isRunning && (
        <div className="pointer-events-none absolute inset-0 animate-pulse bg-linear-to-r from-orange-500/5 to-transparent" />
      )}

      <div
        className={cn(
          "relative flex size-9 shrink-0 items-center justify-center rounded-lg border transition-all duration-300",
          isRunning && "bg-orange-500/10 border-orange-200/50 dark:bg-orange-500/15 dark:border-orange-500/20",
          isDone && "bg-emerald-500/10 border-emerald-200/50 dark:bg-emerald-500/15 dark:border-emerald-500/20",
          isError && "bg-red-500/10 border-red-200/50 dark:bg-red-500/15 dark:border-red-500/20",
        )}
      >
        {isRunning && (
          <span className="absolute inset-0 animate-ping rounded-lg border border-orange-400/30 dark:border-orange-400/50 animation-duration-[1.5s]" />
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/svg/mcp.webp" alt="MCP" className="size-5.5 object-contain invert dark:invert-0" />
      </div>

      <div className="flex flex-col gap-0.5">
        <span
          className={cn(
            "font-mono text-[9px] font-bold tracking-[0.2em] uppercase",
            isRunning && "text-orange-600 dark:text-orange-400/90",
            isDone && "text-emerald-600 dark:text-emerald-400/90",
            isError && "text-red-600 dark:text-red-400/90",
          )}
        >
          via mcp
        </span>
        <span className="font-mono text-[12px] font-semibold tracking-wide text-foreground/90 leading-tight">
          {toolName.replaceAll("_", " ")}
        </span>
        {isError && (
          <span className="text-[10px] font-medium text-red-600 dark:text-red-400/80">
            Couldn't get data
          </span>
        )}
      </div>

      <div className="ml-1.5 shrink-0 flex items-center">
        {isRunning && (
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-orange-400 opacity-65" />
            <span className="relative inline-flex size-2 rounded-full bg-orange-500" />
          </span>
        )}
        {isDone && <CheckIcon className="size-4 text-emerald-600 dark:text-emerald-400" />}
        {isError && <XIcon className="size-4 text-red-600 dark:text-red-400" />}
      </div>
    </div>
  );
}

interface ChatInterfaceProps {
  conversationId: string;
  initialMessages: UIMessage[];
  onSave: (id: string, title: string, messages: UIMessage[]) => void;
}

export function ChatInterface({
  conversationId,
  initialMessages,
  onSave,
}: ChatInterfaceProps) {
  const { settings, setIsSettingsOpen } = useChatContext();
  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  const { messages, sendMessage, status, stop, error } = useChat({
    id: conversationId,
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
        await sendMessage(msg, {
          body: {
            data: {
              apiKey: settings.apiKey,
              projectId: settings.projectId,
              aiProvider: settings.aiProvider,
              aiApiKey: settings.aiApiKey,
              aiModel: settings.aiModel,
            },
          },
        });
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
    [sendMessage, settings.apiKey, settings.projectId, settings.aiProvider, settings.aiApiKey, settings.aiModel]
  );

  const handleSubmit = useCallback(
    (msg: PromptInputMessage) => {
      if (!msg.text.trim()) return;
      if (!settings.aiApiKey || !settings.apiKey) {
        setIsSettingsOpen(true);
        return;
      }
      handleSendMessage({ text: msg.text });
    },
    [handleSendMessage, settings.aiApiKey, settings.apiKey, setIsSettingsOpen]
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
          {!settings.apiKey && (
            <div className="mb-6 rounded-xl border border-yellow-500/25 bg-yellow-500/5 p-4 text-sm text-yellow-500 shadow-sm backdrop-blur-xs flex items-start gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-yellow-500/10">
                <SettingsIcon className="size-4 animate-pulse text-yellow-500" />
              </span>
              <div className="flex-1 space-y-1">
                <p className="font-semibold text-foreground text-sm">PostHog MCP is disconnected</p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  To query your product analytics, HogQL queries, experiments, and behavior data, please enter your <span className="font-semibold text-foreground">PostHog MCP API Key</span> in Chat Settings.
                </p>
              </div>
            </div>
          )}

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
                      const blocks = parseContentWithCharts(tp.text);
                      return (
                        <div key={key} className="flex flex-col gap-2 w-full">
                          {blocks.map((block, idx) => {
                            if (block.type === "chart") {
                              return (
                                <InteractiveChart
                                  key={`chart-${idx}`}
                                  jsonString={block.content}
                                  isStreaming={isLast && status === "streaming"}
                                />
                              );
                            }
                            return (
                              <MessageResponse
                                key={`text-${idx}`}
                                isAnimating={isLast && status === "streaming" && idx === blocks.length - 1}
                              >
                                {block.content}
                              </MessageResponse>
                            );
                          })}
                        </div>
                      );
                    }

                    {
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

          {/* Thinking / Generating indicator — driven by the LAST part of the last assistant message */}
          {(() => {
            if (!isGenerating) return null;
            const last = messages[messages.length - 1];

            // No assistant message yet
            if (!last || last.role !== "assistant") {
              return (
                <Message from="assistant">
                  <MessageContent>
                    <Shimmer duration={1.5}>Thinking…</Shimmer>
                  </MessageContent>
                </Message>
              );
            }

            const lastPart = last.parts[last.parts.length - 1] as
              | { type: string; text?: string; state?: string }
              | undefined;

            // Tail text is actively streaming → no shimmer
            if (lastPart?.type === "text" && (lastPart.text?.length ?? 0) > 0) {
              return null;
            }

            let label = "Thinking…";
            const t = lastPart?.type ?? "";
            const isTool = t === "dynamic-tool" || t.startsWith("tool-");

            if (isTool) {
              const s = lastPart?.state;
              if (s === "input-streaming" || s === "input-available") {
                label = "Calling tool…";
              } else {
                label = "Generating response…";
              }
            } else if (
              last.parts.some((p) => {
                const pt = p.type as string;
                return pt === "dynamic-tool" || pt.startsWith("tool-");
              })
            ) {
              // Past tools exist, tail is empty text/step — model resuming
              label = "Generating response…";
            }

            return (
              <Message from="assistant">
                <MessageContent>
                  <Shimmer duration={1.5}>{label}</Shimmer>
                </MessageContent>
              </Message>
            );
          })()}

          {error && (
            <div className="mt-4 rounded-xl border border-red-500/25 bg-red-500/5 p-4 text-sm text-red-400 shadow-xs flex items-start gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-red-500/10">
                <XIcon className="size-4 text-red-500" />
              </span>
              <div className="flex-1 space-y-1">
                <p className="font-semibold text-foreground text-sm">An error occurred</p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {error.message || "Failed to generate a response. Please check your API keys or connection settings."}
                </p>
              </div>
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      {promptInput}
    </div>
  );
}
