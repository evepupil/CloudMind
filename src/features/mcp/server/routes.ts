import { StreamableHTTPTransport } from "@hono/mcp";
import type { Hono } from "hono";

import type { AppEnv } from "@/env";
import { authenticateMcpRequest } from "@/features/mcp-tokens/server/service";

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

const createUnauthorizedBody = () => {
  return {
    jsonrpc: "2.0" as const,
    error: {
      code: -32001,
      message: "Unauthorized.",
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
    const token = await authenticateMcpRequest(
      context.env,
      context.req.header("Authorization")
    );

    if (!token) {
      return context.json(createUnauthorizedBody(), 401, {
        "WWW-Authenticate": 'Bearer realm="CloudMind MCP"',
      });
    }

    const server = createMcpServer(context.env);
    const transport = new StreamableHTTPTransport();

    await server.connect(transport as Parameters<typeof server.connect>[0]);

    return transport.handleRequest(context);
  });
};
