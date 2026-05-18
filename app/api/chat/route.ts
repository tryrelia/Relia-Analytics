import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { convertToModelMessages, stepCountIs, streamText } from "ai";
import type { UIMessage } from "ai";
import { createPostHogMCPSession } from "@/lib/posthog-mcp";

export const maxDuration = 60;

const POSTHOG_SYSTEM_PROMPT = `You are a helpful AI assistant with direct access to PostHog analytics tools.
Use these tools to answer questions about product analytics, feature flags, experiments, user behavior, and error tracking.
When a user asks about their data, proactively use the available tools to fetch real information rather than guessing.
For complex analytics questions, use SQL tools with HogQL queries.`;

export async function POST(req: Request) {
  const { 
    messages, 
    data 
  }: { 
    messages: UIMessage[], 
    data?: { 
      apiKey?: string; 
      projectId?: string;
      aiProvider?: "openai" | "anthropic" | "google" | "openrouter";
      aiApiKey?: string;
      aiModel?: string;
    } 
  } = await req.json();

  const providerType = data?.aiProvider || "openrouter";
  const userApiKey = data?.aiApiKey || "";
  const userModel = data?.aiModel;

  let modelInstance;

  if (providerType === "openai") {
    const openai = createOpenAI({
      apiKey: userApiKey,
    });
    modelInstance = openai(userModel || "gpt-4o");
  } else if (providerType === "anthropic") {
    const anthropic = createAnthropic({
      apiKey: userApiKey,
    });
    modelInstance = anthropic(userModel || "claude-3-5-sonnet-latest");
  } else if (providerType === "google") {
    const google = createGoogleGenerativeAI({
      apiKey: userApiKey,
    });
    modelInstance = google(userModel || "gemini-2.5-flash");
  } else {
    // default / openrouter
    const openrouter = createOpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: userApiKey,
    });
    modelInstance = openrouter(userModel || "openrouter/owl-alpha");
  }

  const session = await createPostHogMCPSession({
    apiKey: data?.apiKey,
    projectId: data?.projectId
  }).catch(() => null);
  const hasTools = session && Object.keys(session.tools).length > 0;

  const result = streamText({
    model: modelInstance,
    messages: await convertToModelMessages(messages),
    system: hasTools ? POSTHOG_SYSTEM_PROMPT : undefined,
    tools: hasTools ? session.tools : undefined,
    stopWhen: hasTools ? stepCountIs(5) : stepCountIs(1),
    onFinish: async () => {
      await session?.close();
    },
  });

  return result.toUIMessageStreamResponse({ sendReasoning: true });
}
