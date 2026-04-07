import type { Hono } from "hono";
import type { z } from "zod";

import { McpTokenNotFoundError } from "@/core/mcp-tokens/errors";
import type { AppEnv } from "@/env";

import { createMcpTokenPayloadSchema, mcpTokenIdParamsSchema } from "./schemas";
import { createMcpToken, revokeMcpToken } from "./service";

const getValidationErrorMessage = (error: z.ZodError): string => {
  const issue = error.issues[0];

  return issue?.message ?? "Invalid MCP token input.";
};

// 这里提供 MCP token 的页面表单 action，先服务单用户后台管理。
export const registerMcpTokenRoutes = (app: Hono<AppEnv>): void => {
  app.post("/mcp-tokens/actions/create", async (context) => {
    const formData = await context.req.formData();
    const parsedPayload = createMcpTokenPayloadSchema.safeParse({
      name: formData.get("name"),
    });

    if (!parsedPayload.success) {
      return context.redirect(
        `/mcp-tokens?error=${encodeURIComponent(
          getValidationErrorMessage(parsedPayload.error)
        )}`
      );
    }

    try {
      await createMcpToken(context.env, parsedPayload.data);

      return context.redirect("/mcp-tokens?created=1");
    } catch (error) {
      return context.redirect(
        `/mcp-tokens?error=${encodeURIComponent(
          error instanceof Error ? error.message : "Failed to create MCP token."
        )}`
      );
    }
  });

  app.post("/mcp-tokens/actions/:id/revoke", async (context) => {
    const parsedParams = mcpTokenIdParamsSchema.safeParse(context.req.param());

    if (!parsedParams.success) {
      return context.redirect(
        `/mcp-tokens?error=${encodeURIComponent(
          getValidationErrorMessage(parsedParams.error)
        )}`
      );
    }

    try {
      await revokeMcpToken(context.env, parsedParams.data.id);

      return context.redirect("/mcp-tokens?revoked=1");
    } catch (error) {
      if (error instanceof McpTokenNotFoundError) {
        return context.redirect(
          `/mcp-tokens?error=${encodeURIComponent("MCP token not found.")}`
        );
      }

      return context.redirect(
        `/mcp-tokens?error=${encodeURIComponent(
          error instanceof Error ? error.message : "Failed to revoke MCP token."
        )}`
      );
    }
  });
};
