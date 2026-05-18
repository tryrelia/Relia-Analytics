import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, stepCountIs, streamText } from "ai";
import type { UIMessage } from "ai";
import { createPostHogMCPSession } from "@/lib/posthog-mcp";

export const maxDuration = 60;

const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
});

const DEFAULT_MODEL = "openrouter/owl-alpha";

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
    data?: { apiKey?: string; projectId?: string } 
  } = await req.json();

  const session = await createPostHogMCPSession({
    apiKey: data?.apiKey,
    projectId: data?.projectId
  }).catch(() => null);
  const hasTools = session && Object.keys(session.tools).length > 0;

  const result = streamText({
    model: openrouter(DEFAULT_MODEL),
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
