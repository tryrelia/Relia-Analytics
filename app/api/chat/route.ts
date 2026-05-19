import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { convertToModelMessages, stepCountIs, streamText } from "ai";
import type { UIMessage } from "ai";
import { createPostHogMCPSession } from "@/lib/posthog-mcp";

export const maxDuration = 60;

const POSTHOG_SYSTEM_PROMPT = `You are a world-class Product Analytics & Growth Specialist with direct access to PostHog analytics tools.
Your goal is to answer questions about product analytics, feature flags, experiments, user behavior, and error tracking using data-driven insights.

CRITICAL RULES FOR RESPONSES:
1. EXTREMELY BRIEF TEXT: Keep plain text explanations to an absolute minimum (MAXIMUM 3 sentences total per response). Let the chart and tables speak for themselves.
2. NO UNNECESSARY SECTIONS: Do NOT include long sections for "Key Observations", "Recommendations", etc., unless the user explicitly asks.
3. PREFER TABLES: Always present tabular, metric, or comparative data in clean Markdown tables.
4. PREFER INTERACTIVE CHARTS: For trend data, breakdowns, or conversions, output a \`\`\`recharts code block containing a single valid JSON object following this EXACT schema:
\`\`\`recharts
{
  "type": "bar" | "line" | "area" | "pie",
  "title": "Clear, descriptive title",
  "description": "Short description or summary of what is shown",
  "xKey": "Property name for X-axis labels (e.g., 'device', 'date', 'page')",
  "keys": ["Array of metric keys to plot on Y-axis (e.g., ['visitors', 'conversions'])"],
  "data": [
    { "date": "2026-05-10", "visitors": 1200, "conversions": 150 },
    { "date": "2026-05-11", "visitors": 1400, "conversions": 210 }
  ]
}
\`\`\`
   - Use "bar" for categorized breakdowns (e.g., device type, OS, country, browsers).
   - Use "line" or "area" for trends over time (e.g., daily active users, event counts over 30 days).
   - Use "pie" for percentage distribution/shares (e.g., device breakdown, browser share).
   - Never place any other text, comments, or nested markdown inside the \`\`\`recharts block. Ensure it is strict, valid JSON.
5. MERMAID DIAGRAMS: For representing user conversion flows, signup funnels, path analysis, or feature flag logic, use \`\`\`mermaid diagrams.

When a user asks about their data, proactively use the available tools to fetch real information rather than guessing. For complex queries, craft precise HogQL queries via SQL tools.`;

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
    const openai = createOpenAI({ apiKey: userApiKey });
    modelInstance = openai(userModel || "gpt-4o");
  } else if (providerType === "anthropic") {
    const anthropic = createAnthropic({ apiKey: userApiKey });
    modelInstance = anthropic(userModel || "claude-3-5-sonnet-latest");
  } else if (providerType === "google") {
    const google = createGoogleGenerativeAI({ apiKey: userApiKey });
    modelInstance = google(userModel || "gemini-2.5-flash");
  } else {
    const openrouter = createOpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: userApiKey,
    });
    modelInstance = openrouter(userModel || "openrouter/owl-alpha");
  }

  const session = await createPostHogMCPSession({
    apiKey: data?.apiKey,
    projectId: data?.projectId,
  }).catch(() => null);

  const hasTools = session != null && Object.keys(session.tools).length > 0;

  req.signal.addEventListener("abort", () => {
    session?.close().catch(() => {});
  });

  const result = streamText({
    model: modelInstance,
    messages: await convertToModelMessages(messages),
    system: hasTools ? POSTHOG_SYSTEM_PROMPT : undefined,
    tools: hasTools ? session!.tools : undefined,
    stopWhen: hasTools ? stepCountIs(5) : stepCountIs(1),
    abortSignal: req.signal,
    onFinish: async () => {
      await session?.close();
    },
  });

  return result.toUIMessageStreamResponse({ sendReasoning: true });
}
