import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { ToolSet } from "ai";
import { dynamicTool, jsonSchema } from "ai";

const POSTHOG_MCP_URL = "https://mcp.posthog.com/mcp";

/**
 * Request only these tools from the MCP server via the `tools` query param.
 * This avoids fetching all 74 tools (with huge schemas) and keeps token usage low.
 * See: https://posthog.com/docs/model-context-protocol#filter-by-tool-name
 */
const REQUESTED_TOOLS = [
  "query-run",
  "query-generate-hogql-from-question",
  "event-definitions-list",
  "properties-list",
  "read-data-schema",
  "annotations-list",
];

/** Max characters to return from a single tool result to prevent token overflow */
const MAX_RESULT_CHARS = 12_000;

export interface PostHogMCPSession {
  tools: ToolSet;
  close: () => Promise<void>;
}

export async function createPostHogMCPSession(credentials: {
  apiKey?: string;
  projectId?: string;
}): Promise<PostHogMCPSession | null> {
  const { apiKey, projectId } = credentials;
  if (!apiKey) return null;

  const client = new Client({ name: "relia-analytics", version: "1.0.0" });

  const url = new URL(POSTHOG_MCP_URL);
  // Use server-side tool filtering — only fetch the tools we actually need
  url.searchParams.set("tools", REQUESTED_TOOLS.join(","));
  if (projectId) {
    url.searchParams.set("project_id", projectId);
  }

  const transport = new StreamableHTTPClientTransport(url, {
    requestInit: {
      headers: { Authorization: `Bearer ${apiKey}` },
    },
  });

  await client.connect(transport);

  const { tools: mcpTools } = await client.listTools();

  console.log(
    `[MCP] Server returned ${mcpTools.length} tools (requested ${REQUESTED_TOOLS.length})`
  );

  const tools: ToolSet = Object.fromEntries(
    mcpTools
      .map((mcpTool) => {
        const toolKey = mcpTool.name.replaceAll("-", "_");

        // Special handling for query-run — HogQLQuery only (MCP server rejects all other kinds)
        if (mcpTool.name === "query-run") {
          return [
            toolKey,
            dynamicTool({
              description:
                'Execute a HogQL SQL query against PostHog. The "kind" MUST always be "HogQLQuery". Express paths, funnels, and trends as raw SQL.',
              inputSchema: jsonSchema({
                type: "object" as const,
                properties: {
                  query: {
                    type: "object" as const,
                    properties: {
                      kind: {
                        type: "string" as const,
                        enum: ["HogQLQuery"],
                        description:
                          'Must always be "HogQLQuery". No other value is accepted.',
                      },
                      query: {
                        type: "string" as const,
                        description:
                          "The HogQL SQL query string. Must be a complete SELECT statement.",
                      },
                    },
                    required: ["kind", "query"],
                    additionalProperties: false,
                  },
                },
                required: ["query"],
                additionalProperties: false,
              }),
              execute: async (input: unknown) => {
                const inp = input as Record<string, unknown>;
                const queryObj = inp.query as Record<string, unknown>;
                const sqlString = String(queryObj?.query || "").trim();

                // Reject empty/invalid queries
                if (!sqlString || sqlString.length < 6) {
                  throw new Error(
                    "Empty or invalid SQL query. You MUST provide a full HogQL SELECT statement, e.g. SELECT count() FROM events WHERE timestamp >= now() - INTERVAL 1 DAY"
                  );
                }

                // Force kind to HogQLQuery — MCP server rejects everything else
                const cleanInput = {
                  query: {
                    kind: "HogQLQuery" as const,
                    query: sqlString,
                  },
                };

                console.log(
                  `[MCP] Calling query-run:`,
                  JSON.stringify(cleanInput)
                );

                const result = await client.callTool({
                  name: mcpTool.name,
                  arguments: cleanInput,
                });

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const content = result.content as any[];

                if (result.isError) {
                  const errText = content
                    .filter((c) => c.type === "text")
                    .map((c) => String(c.text))
                    .join("\n");
                  console.error(`[MCP] query-run error:`, errText);
                  throw new Error(errText || "Query failed");
                }

                const textParts = content.filter((c) => c.type === "text");
                let fullText = textParts.map((p) => String(p.text)).join("");

                // Truncate large results to prevent token overflow on next LLM turn
                if (fullText.length > MAX_RESULT_CHARS) {
                  fullText =
                    fullText.slice(0, MAX_RESULT_CHARS) +
                    "\n...[TRUNCATED — result too large, add stricter filters or LIMIT]";
                }

                try {
                  return JSON.parse(fullText);
                } catch {
                  return fullText;
                }
              },
            }),
          ];
        }

        // Default handling for other whitelisted tools (with trimmed descriptions)
        const desc = (mcpTool.description ?? mcpTool.name).slice(0, 300);

        return [
          toolKey,
          dynamicTool({
            description: desc,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            inputSchema: jsonSchema(
              (mcpTool.inputSchema ?? {
                type: "object",
                properties: {},
              }) as any
            ),
            execute: async (input: unknown) => {
              console.log(
                `[MCP] Calling ${mcpTool.name}:`,
                JSON.stringify(input)
              );

              const result = await client.callTool({
                name: mcpTool.name,
                arguments: input as Record<string, unknown>,
              });

              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const content = result.content as any[];

              if (result.isError) {
                const errText = content
                  .filter((c) => c.type === "text")
                  .map((c) => String(c.text))
                  .join("\n");
                console.error(`[MCP] ${mcpTool.name} error:`, errText);
                throw new Error(errText || "PostHog tool call failed");
              }

              const textParts = content.filter((c) => c.type === "text");
              let fullText = textParts.map((p) => String(p.text)).join("");

              if (fullText.length > MAX_RESULT_CHARS) {
                fullText =
                  fullText.slice(0, MAX_RESULT_CHARS) +
                  "\n...[TRUNCATED]";
              }

              try {
                return JSON.parse(fullText);
              } catch {
                return fullText;
              }
            },
          }),
        ];
      })
  );

  return {
    tools,
    close: async () => {
      await client.close().catch(() => {});
    },
  };
}
