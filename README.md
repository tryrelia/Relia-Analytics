# Relia Analytics

> An open-source AI chat interface for [PostHog](https://posthog.com) analytics — query your product data using natural language, powered by the PostHog MCP server and your choice of LLM provider.

Ask questions like _"How many unique users visited yesterday?"_ or _"Show me the most common paths to conversion"_ and get answers backed by real PostHog data, rendered as interactive charts, tables, mermaid diagrams, and HogQL queries.

---

## Features

- **Multi-provider AI** — OpenAI, Anthropic (Claude), Google (Gemini), and OpenRouter all supported out of the box
- **PostHog MCP integration** — direct access to insights, events, persons, dashboards, experiments, feature flags, surveys, error tracking, and HogQL via the official [PostHog MCP server](https://mcp.posthog.com/mcp)
- **Interactive charts** — model outputs are rendered as live `recharts` bar/line/area/pie visualizations
- **HogQL query support** — the model can craft and execute precise HogQL queries against your data
- **Mermaid diagrams** — funnels, paths, and feature-flag logic rendered visually
- **Streaming reasoning** — collapsible thinking indicators for models that support reasoning tokens (Claude extended thinking, DeepSeek R1, etc.)
- **Per-conversation persistence** — chats saved locally in IndexedDB
- **Light/dark/system themes** — built on shadcn/ui + Tailwind v4
- **Bring your own keys** — no backend account required. API keys stored locally in your browser

---

## Tech Stack

- **Framework** — [Next.js 16](https://nextjs.org) (App Router) + React 19
- **AI** — [Vercel AI SDK v6](https://ai-sdk.dev/) with `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`
- **MCP** — [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk) talking to PostHog MCP over Streamable HTTP
- **UI** — [shadcn/ui](https://ui.shadcn.com) + [AI Elements](https://www.npmjs.com/package/ai-elements) + Tailwind v4
- **Charts** — [recharts](https://recharts.org)
- **Markdown** — [streamdown](https://www.npmjs.com/package/streamdown) with code/math/mermaid/cjk plugins
- **Storage** — IndexedDB for conversations, localStorage for settings

---

## Getting Started

### Prerequisites

- **Node.js 18+**
- A **PostHog account** with a [Personal API Key](https://app.posthog.com/settings/user-api-keys)
- An **AI provider API key** (OpenAI, Anthropic, Google AI Studio, or OpenRouter)

### Installation

```bash
git clone https://github.com/tryrelia/Relia-Analytics.git
cd Relia-Analytics
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Configuration

All configuration happens in-app via the **Settings** dialog (gear icon in the sidebar). No `.env` file required.

1. **AI Provider** — pick OpenAI / Anthropic / Google / OpenRouter and paste your API key
2. **Model** — choose from the predefined list or enter a custom model ID
3. **PostHog MCP API Key** — your PostHog personal API key
4. **PostHog Project ID** _(optional)_ — restricts queries to a single project

Settings are persisted in `localStorage` only — they never leave your browser.

---

## Where to Get API Keys

| Provider | Link |
|----------|------|
| OpenAI | <https://platform.openai.com/api-keys> |
| Anthropic | <https://console.anthropic.com/settings/keys> |
| Google AI Studio | <https://aistudio.google.com/app/apikey> |
| OpenRouter | <https://openrouter.ai/settings/keys> |
| PostHog | <https://app.posthog.com/settings/user-api-keys> |

> **OpenRouter note:** Some free models (like `owl-alpha`) require provider logging to be enabled in your [privacy settings](https://openrouter.ai/settings/privacy).

---

## How It Works

```
┌──────────────┐    headers     ┌────────────────────┐    MCP/HTTP     ┌──────────────┐
│   Browser    │ ─────────────► │  /api/chat route   │ ──────────────► │ PostHog MCP  │
│  (useChat)   │                │  (AI SDK stream)   │ ◄────────────── │   Server     │
└──────────────┘ ◄───────────── └────────────────────┘                 └──────────────┘
       ▲             SSE              │
       │                              ▼
       │                       ┌────────────────────┐
       │                       │   LLM Provider     │
       │                       │ OpenAI / Anthropic │
       │                       │  Google / OR       │
       │                       └────────────────────┘
       │
   InteractiveChart, Reasoning, Mermaid, Task indicators…
```

1. The chat UI sends a message via AI SDK's `useChat`, passing API keys as request headers
2. The Next.js route opens an MCP session against `mcp.posthog.com`, lists available tools, and exposes them to the LLM
3. The LLM calls tools (e.g. `query-run`, `insights-get-all`) — results stream back as part of the response
4. The response is parsed for ` ```recharts ` JSON blocks (rendered as `recharts` charts) and ` ```mermaid ` blocks (rendered as diagrams)
5. Reasoning tokens (where supported) stream into a collapsible thinking panel

---

## Project Structure

```
app/
  api/chat/route.ts    # AI SDK streaming route + MCP session wiring
  [id]/page.tsx        # individual conversation page
  page.tsx             # landing
components/
  chat-interface.tsx   # core chat UI (useChat, reasoning, tool indicators)
  chat-chart.tsx       # recharts renderer + recharts/json block parsing
  sidebar.tsx          # conversation list + settings dialog
  ai-elements/         # shadcn-style AI Elements primitives
  ui/                  # shadcn primitives
lib/
  posthog-mcp.ts       # MCP client + tool adapter
  chat-context.ts      # React context for settings + conversations
  db.ts                # IndexedDB persistence layer
```

---

## Available Scripts

```bash
npm run dev      # start dev server on 0.0.0.0:3000
npm run build    # production build
npm run start    # serve production build
npm run lint     # eslint
```

---

## Privacy

- API keys are stored **only** in `localStorage` on your device
- Conversations are stored **only** in IndexedDB on your device
- The Next.js API route is a stateless proxy — it does not log, persist, or forward anything beyond the LLM and MCP calls
- If you self-host, your data flows directly between your browser → your server → the LLM provider + PostHog MCP

---

## Security

A security scan report for this project is available here:

[Relia Security Report](https://tryrelia.com/sample-project/relia_Kg8k0Qi0W0Qn55Y-vNB1HDYaDybGtSf5cwl68Jq450SYUIYUD60RoXBFzOSOS0S2)

### Browser Storage Security Considerations

This project currently stores certain client-side data using browser storage mechanisms such as `IndexedDB` and `localStorage`.

Because browser storage is accessible from client-side JavaScript, sensitive data may be exposed in the event of XSS (Cross-Site Scripting) vulnerabilities or compromised browser environments.

The current implementation is primarily intended for development, experimentation, and demo usage.

---

## Contributing

PRs welcome. Please:

1. Open an issue first for non-trivial changes
2. Follow the existing code style (TypeScript strict, no comments unless the _why_ is non-obvious)
3. Test against at least one LLM provider end-to-end

---

## License

MIT — see [LICENSE](LICENSE).

---

## Acknowledgements

- [PostHog](https://posthog.com) for the analytics platform and MCP server
- [Vercel AI SDK](https://ai-sdk.dev/) and [AI Elements](https://www.npmjs.com/package/ai-elements)
- [shadcn/ui](https://ui.shadcn.com) for the component foundation
- [Model Context Protocol](https://modelcontextprotocol.io/) for the tool-calling standard
