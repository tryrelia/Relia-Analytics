import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { convertToModelMessages, stepCountIs, streamText } from "ai";
import type { UIMessage } from "ai";
import { createPostHogMCPSession } from "@/lib/posthog-mcp";

export const maxDuration = 60;

const POSTHOG_SYSTEM_PROMPT = `You are a PostHog analytics expert. Your ONLY job is to fetch data using the query_run tool and present results.

CRITICAL: READ THESE EXACT INSTRUCTIONS BEFORE USING ANY TOOL:

## query_run Tool - EXACT Format Required
The query_run tool REQUIRES this exact JSON structure:
{
  "query": {
    "kind": "HogQLQuery",
    "query": "YOUR SQL QUERY HERE"
  }
}

IMPORTANT: The "query" and "kind" MUST be INSIDE the top-level "query" wrapper. This is required.

## Example Queries for Common Questions:

### "How many visitors in last 10 hours?"
{
  "query": {
    "kind": "HogQLQuery",
    "query": "SELECT count() as total_visitors FROM events WHERE timestamp >= now() - interval 10 hour"
  }
}

### "Visitors by country (last 10 hours)?"
{
  "query": {
    "kind": "HogQLQuery",
    "query": "SELECT properties.\`$geoip_country_name\` as country, count(DISTINCT person_id) as visitors FROM events WHERE timestamp >= now() - interval 10 hour GROUP BY country ORDER BY visitors DESC LIMIT 20"
  }
}

### "Top pages visited (last 10 hours)?"
{
  "query": {
    "kind": "HogQLQuery",
    "query": "SELECT properties.\`$current_url\` as page, count() as visits FROM events WHERE timestamp >= now() - interval 10 hour GROUP BY page ORDER BY visits DESC LIMIT 20"
  }
}

## HogQL Syntax Rules:
- ALWAYS use backticks for properties starting with $: properties.\`$browser\`, properties.\`$current_url\`, properties.\`$geoip_country_name\`
- Use count() for simple counts, and count(DISTINCT person_id) for unique visitors
- Always include time filters: timestamp >= now() - interval 24 hour (or similar)
- Add LIMIT to control result rows
- Use GROUP BY and ORDER BY for sorting

## Response Format:
- Show results as clean Markdown tables
- Use recharts JSON blocks for charts when visualizing geographic/page data
- NEVER show SQL to users
- Keep text explanations to 1-2 sentences maximum
- If a query fails, explain the error simply based on the tool output`;



export async function POST(req: Request) {
  const {
    messages,
  }: {
    messages: UIMessage[],
  } = await req.json();

  const providerType = (req.headers.get("x-ai-provider") || "openrouter") as any;
  const userApiKey = req.headers.get("x-ai-api-key") || "";
  const userModel = req.headers.get("x-ai-model") || undefined;
  const phApiKey = req.headers.get("x-ph-api-key") || undefined;
  const phProjectId = req.headers.get("x-ph-project-id") || undefined;

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
    modelInstance = openrouter(userModel || "poolside/laguna-m.1:free");
  }

  const session = await createPostHogMCPSession({
    apiKey: phApiKey,
    projectId: phProjectId,
  }).catch(() => null);

  const hasTools = session != null && Object.keys(session.tools).length > 0;

  req.signal.addEventListener("abort", () => {
    session?.close().catch(() => { });
  });

  const result = streamText({
    model: modelInstance,
    messages: await convertToModelMessages(messages),
    system: hasTools ? POSTHOG_SYSTEM_PROMPT : undefined,
    tools: hasTools ? session!.tools : undefined,
    stopWhen: stepCountIs(hasTools ? 5 : 1),
    abortSignal: req.signal,
    onFinish: async () => {
      await session?.close();
    },
  });

  return result.toUIMessageStreamResponse({ sendReasoning: true });
}
