"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import type { ChatStatus, UIMessage } from "ai";
import { nanoid } from "nanoid";
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
import { Spinner } from "@/components/ui/spinner";
import {
  Task,
  TaskContent,
  TaskItem,
  TaskTrigger,
} from "@/components/ai-elements/task";
import { cn } from "@/lib/utils";
import { useChatContext } from "@/lib/chat-context";
import { parseContentWithCharts, InteractiveChart } from "@/components/chat-chart";
import { Shimmer } from "@/components/ai-elements/shimmer";

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


function TaskIndicator({ toolName, state }: { toolName: string; state: string }) {
  const isDone = state === "output-available";
  const isError = state === "output-error";
  const isRunning = !isDone && !isError;

  return (
    <Task className="my-2" defaultOpen={isRunning}>
      <TaskTrigger title={toolName.replaceAll("_", " ")} />
      <TaskContent>
        <TaskItem>
          {isRunning ? (
            <div className="flex items-center gap-2">
              <Spinner className="size-3" />
              <span>Executing tool...</span>
            </div>
          ) : isError ? (
            <span className="text-red-500 font-medium">Data not found.</span>
          ) : (
            <span className="text-emerald-500 font-medium flex items-center gap-1.5">
              <CheckIcon className="size-3.5" />
              Tool execution completed.
            </span>
          )}
        </TaskItem>
      </TaskContent>
    </Task>
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

  const { messages, sendMessage, status, stop, error, setMessages } = useChat({
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
      if (!settings.aiApiKey || !settings.apiKey) {
        setIsSettingsOpen(true);
        return;
      }
      try {
        await sendMessage(msg, {
          headers: {
            "x-ph-api-key": settings.apiKey || "",
            "x-ph-project-id": settings.projectId || "",
            "x-ai-provider": settings.aiProvider || "",
            "x-ai-api-key": settings.aiApiKey || "",
            "x-ai-model": settings.aiModel || "",
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
    [sendMessage, settings, setIsSettingsOpen]
  );

  const isGenerating = status === "submitted" || status === "streaming";

  const handleSubmit = useCallback(
    (msg: PromptInputMessage) => {
      if (!msg.text.trim() || isGenerating) return;
      handleSendMessage({ text: msg.text });
    },
    [handleSendMessage, isGenerating]
  );

  const handleStop = useCallback(() => {
    stop();
  }, [stop]);

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
          <PromptInputSubmit status={status} onStop={handleStop} />
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

          {!settings.aiApiKey && (
            <div className="mb-6 rounded-xl border border-blue-500/25 bg-blue-500/5 p-4 text-sm text-blue-500 shadow-sm backdrop-blur-xs flex items-start gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-blue-500/10">
                <SettingsIcon className="size-4 animate-pulse text-blue-500" />
              </span>
              <div className="flex-1 space-y-1">
                <p className="font-semibold text-foreground text-sm">AI Provider is disconnected</p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  To generate responses, please enter your <span className="font-semibold text-foreground">{settings.aiProvider.toUpperCase()} API Key</span> in Chat Settings.
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

            // Consolidate all reasoning parts into one block (ai-elements pattern)
            const reasoningText = msg.parts
              .filter((p) => p.type === "reasoning")
              .map((p) => (p as { type: "reasoning"; text: string }).text)
              .join("\n\n");
            const hasReasoning = reasoningText.length > 0;
            const lastMsgPart = msg.parts.at(-1);
            const isReasoningStreaming =
              isLast && isGenerating && lastMsgPart?.type === "reasoning";

            return (
              <Message from={msg.role} key={msg.id}>
                <MessageContent>
                  {(hasReasoning || isReasoningStreaming) && (
                    <Reasoning isStreaming={isReasoningStreaming}>
                      <ReasoningTrigger />
                      {hasReasoning && <ReasoningContent>{reasoningText}</ReasoningContent>}
                    </Reasoning>
                  )}
                  {msg.parts.map((part, i) => {
                    const key = `${msg.id}-${i}`;

                    if (part.type === "reasoning") return null;

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
                          <TaskIndicator
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

            // Tail text actively streaming or reasoning streaming → Reasoning trigger handles its own shimmer
            if (lastPart?.type === "text" && (lastPart.text?.length ?? 0) > 0) {
              return null;
            }
            if (lastPart?.type === "reasoning") {
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
                  {error.message?.includes("guardrail restrictions and data policy") ? (
                    <span>
                      OpenRouter blocked this request because of your data privacy settings. Go to{" "}
                      <a
                        href="https://openrouter.ai/settings/privacy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline font-medium hover:text-primary/80"
                      >
                        openrouter.ai/settings/privacy
                      </a>{" "}
                      to allow provider logging for free models (like owl-alpha), or switch to a paid model / direct provider.
                    </span>
                  ) : (
                    error.message || "Failed to generate a response. Please check your API keys or connection settings."
                  )}
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
