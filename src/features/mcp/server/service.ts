import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { AssetNotFoundError } from "@/core/assets/errors";
import type { AppBindings } from "@/env";
import { getAssetById } from "@/features/assets/server/service";
import { askLibrary } from "@/features/chat/server/service";
import {
  ingestTextAsset,
  ingestUrlAsset,
} from "@/features/ingest/server/service";
import { searchAssets } from "@/features/search/server/service";

const saveAssetInputSchema = z
  .object({
    type: z.enum(["text", "url"]),
    title: z.string().trim().min(1).max(300).optional(),
    content: z.string().trim().min(1).optional(),
    url: z.string().url().optional(),
  })
  .superRefine((value, context) => {
    if (value.type === "text" && !value.content) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Field "content" is required when type is "text".',
        path: ["content"],
      });
    }

    if (value.type === "url" && !value.url) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Field "url" is required when type is "url".',
        path: ["url"],
      });
    }
  });

const searchAssetsInputSchema = z.object({
  query: z.string().trim().min(1),
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().max(50).optional(),
});

const getAssetInputSchema = z.object({
  id: z.string().trim().min(1),
});

const askLibraryInputSchema = z.object({
  question: z.string().trim().min(1),
  topK: z.number().int().positive().max(10).optional(),
});

const normalizeOptionalString = (
  value: string | undefined
): string | undefined => {
  const normalized = value?.trim();

  return normalized && normalized.length > 0 ? normalized : undefined;
};

const toTextContent = (payload: Record<string, unknown>): string => {
  return JSON.stringify(payload, null, 2);
};

const createToolResult = <T extends object>(payload: T) => {
  return {
    content: [
      {
        type: "text" as const,
        text: toTextContent(payload as Record<string, unknown>),
      },
    ],
    structuredContent: payload as Record<string, unknown>,
  };
};

const createToolErrorResult = (message: string, code = "TOOL_ERROR") => {
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: message,
      },
    ],
    structuredContent: {
      ok: false,
      error: {
        code,
        message,
      },
    },
  };
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof AssetNotFoundError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown MCP tool error.";
};

// 这里集中注册 MCP tools，避免在 route 层重复拼装业务调用与错误处理。
export const createMcpServer = (
  bindings: AppBindings | undefined
): McpServer => {
  const server = new McpServer({
    name: "cloudmind",
    version: "0.1.0",
  });

  server.registerTool(
    "save_asset",
    {
      title: "Save Asset",
      description:
        "Save a text note or URL into the CloudMind library and trigger processing.",
      inputSchema: saveAssetInputSchema,
    },
    async (input) => {
      try {
        if (input.type === "text") {
          const content = input.content;

          if (!content) {
            return createToolErrorResult('Field "content" is required.');
          }

          const item = await ingestTextAsset(bindings, {
            title: normalizeOptionalString(input.title),
            content,
            sourceKind: "mcp",
          });

          return createToolResult({ item });
        }

        const url = input.url;

        if (!url) {
          return createToolErrorResult('Field "url" is required.');
        }

        const item = await ingestUrlAsset(bindings, {
          title: normalizeOptionalString(input.title),
          url,
          sourceKind: "mcp",
        });

        return createToolResult({ item });
      } catch (error) {
        return createToolErrorResult(getErrorMessage(error));
      }
    }
  );

  server.registerTool(
    "search_assets",
    {
      title: "Search Assets",
      description:
        "Search the library with semantic retrieval and return matched chunks.",
      inputSchema: searchAssetsInputSchema,
    },
    async (input) => {
      try {
        const result = await searchAssets(bindings, input);

        return createToolResult(result);
      } catch (error) {
        return createToolErrorResult(getErrorMessage(error));
      }
    }
  );

  server.registerTool(
    "get_asset",
    {
      title: "Get Asset",
      description: "Fetch one asset detail by ID.",
      inputSchema: getAssetInputSchema,
    },
    async (input) => {
      try {
        const item = await getAssetById(bindings, input.id);

        return createToolResult({ item });
      } catch (error) {
        const code =
          error instanceof AssetNotFoundError
            ? "ASSET_NOT_FOUND"
            : "TOOL_ERROR";

        return createToolErrorResult(getErrorMessage(error), code);
      }
    }
  );

  server.registerTool(
    "ask_library",
    {
      title: "Ask Library",
      description:
        "Answer a question using grounded evidence from the CloudMind library.",
      inputSchema: askLibraryInputSchema,
    },
    async (input) => {
      try {
        const result = await askLibrary(bindings, input);

        return createToolResult(result);
      } catch (error) {
        return createToolErrorResult(getErrorMessage(error));
      }
    }
  );

  return server;
};
