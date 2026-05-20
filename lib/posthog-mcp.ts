import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { ToolSet } from "ai";
import { dynamicTool, jsonSchema } from "ai";

const POSTHOG_MCP_URL = "https://mcp.posthog.com/mcp";

const FEATURES =
  "sql,insights,flags,events,persons,dashboards,experiments,data_schema,error_tracking,surveys";

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
  url.searchParams.set("features", FEATURES);
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

  const tools: ToolSet = Object.fromEntries(
    mcpTools.map((mcpTool) => {
      const toolKey = mcpTool.name.replaceAll("-", "_");

      // Special handling for query_run - match PostHog API format
      if (mcpTool.name === "query_run") {
        return [
          toolKey,
          dynamicTool({
            description: "Execute HogQL queries. Use structure: {\"query\": {\"kind\": \"HogQLQuery\", \"query\": \"SELECT ...\"}}",
            inputSchema: jsonSchema({
              type: "object" as const,
              properties: {
                query: {
                  type: "object" as const,
                  properties: {
                    kind: { type: "string" as const },
                    query: { type: "string" as const },
                  },
                  required: ["kind", "query"],
                },
              },
              required: ["query"],
            }),
            execute: async (input: unknown) => {
              const inp = input as Record<string, unknown>;
              const queryObj = inp.query as Record<string, unknown>;
              
              console.log(`[MCP] Calling query_run:`, JSON.stringify(inp));

              // Ensure correct structure for PostHog API - remove extra fields
              const cleanInput = {
                query: {
                  kind: queryObj.kind || "HogQLQuery",
                  query: String(queryObj.query || ""),
                },
              };

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
                console.error(`[MCP] query_run error:`, errText);
                throw new Error(errText || "Query failed");
              }

              const textParts = content.filter((c) => c.type === "text");
              const fullText = textParts.map((p) => String(p.text)).join("");
              
              try {
                return JSON.parse(fullText);
              } catch {
                return fullText;
              }
            },
          }),
        ];
      }

      // Default handling for other tools
      return [
        toolKey,
        dynamicTool({
          description: mcpTool.description ?? mcpTool.name,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          inputSchema: jsonSchema((mcpTool.inputSchema ?? { type: "object", properties: {} }) as any),
          execute: async (input: unknown) => {
            console.log(`[MCP] Calling ${mcpTool.name}:`, JSON.stringify(input));

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
            const fullText = textParts.map((p) => String(p.text)).join("");
            
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
      await client.close().catch(() => { });
    },
  };
}
