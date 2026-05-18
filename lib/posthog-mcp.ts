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

export async function createPostHogMCPSession(): Promise<PostHogMCPSession | null> {
  const apiKey = process.env.POSTHOG_MCP_API_KEY;
  if (!apiKey) return null;

  const client = new Client({ name: "posthog-ai-chat", version: "1.0.0" });

  const url = new URL(POSTHOG_MCP_URL);
  url.searchParams.set("features", FEATURES);
  if (process.env.POSTHOG_PROJECT_ID) {
    url.searchParams.set("project_id", process.env.POSTHOG_PROJECT_ID);
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

      return [
        toolKey,
        dynamicTool({
          description: mcpTool.description ?? mcpTool.name,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          inputSchema: jsonSchema((mcpTool.inputSchema ?? { type: "object", properties: {} }) as any),
          execute: async (input: unknown) => {
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
              throw new Error(errText || "PostHog tool call failed");
            }

            const textParts = content.filter((c) => c.type === "text");
            if (textParts.length === 1) {
              try {
                return JSON.parse(String(textParts[0].text));
              } catch {
                return String(textParts[0].text);
              }
            }
            return content;
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
