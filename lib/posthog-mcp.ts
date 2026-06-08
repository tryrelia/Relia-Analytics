import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { ToolSet } from "ai";
import { dynamicTool, jsonSchema } from "ai";

const POSTHOG_MCP_URL = "https://mcp.posthog.com/mcp";

/**
 * Request only these tools from the MCP server via the `tools` query param.
 * The deployed server (mcp.posthog.com) exposes ~214 tools; fetching all of them
 * (with huge schemas) blows the token budget. These are the exact deployed names
 * (verified against the live server — the repo's tool-definitions.json is stale,
 * e.g. there is NO `query-run`; the SQL tool is `execute-sql`).
 * See: https://posthog.com/docs/model-context-protocol#filter-by-tool-name
 */
const SQL_TOOL = "execute-sql";
const REQUESTED_TOOLS = [
  SQL_TOOL,
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

  const returnedNames = mcpTools.map((t) => t.name);
  console.log(
    `[MCP] Server returned ${mcpTools.length}/${REQUESTED_TOOLS.length} tools:`,
    returnedNames.join(", ") || "(none)"
  );

  // execute-sql is the core query tool. If absent, the key likely lacks the
  // `query:read` scope — warn loudly so it's diagnosable.
  if (!returnedNames.includes(SQL_TOOL)) {
    console.warn(
      `[MCP] '${SQL_TOOL}' NOT exposed by server. The PostHog personal API key is ` +
        "likely missing the 'query:read' scope. Recreate the key with Query (read) scope enabled."
    );
  }

  const tools: ToolSet = Object.fromEntries(
    mcpTools
      .map((mcpTool) => {
        const toolKey = mcpTool.name.replaceAll("-", "_");

        // All whitelisted tools (incl. execute-sql) use their real server-provided
        // input schema. execute-sql takes a flat { query: "SELECT ..." } string.
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
