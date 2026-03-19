import { StreamableHTTPTransport } from "@hono/mcp";
import type { Hono } from "hono";

import type { AppEnv } from "@/env";

import { createMcpServer } from "./service";

const createMethodNotAllowedBody = () => {
  return {
    jsonrpc: "2.0" as const,
    error: {
      code: -32000,
      message: "Method not allowed.",
    },
    id: null,
  };
};

// 这里暴露最小远端 MCP server，优先采用 stateless HTTP，适配 AI 客户端远端工具调用。
export const registerMcpRoutes = (app: Hono<AppEnv>): void => {
  app.get("/mcp", (context) => {
    return context.json(createMethodNotAllowedBody(), 405, {
      Allow: "POST",
    });
  });

  app.delete("/mcp", (context) => {
    return context.json(createMethodNotAllowedBody(), 405, {
      Allow: "POST",
    });
  });

  app.post("/mcp", async (context) => {
    const server = createMcpServer(context.env);
    const transport = new StreamableHTTPTransport();

    await server.connect(transport as Parameters<typeof server.connect>[0]);

    return transport.handleRequest(context);
  });
};
