import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { AssetNotFoundError } from "@/core/assets/errors";
import { WorkflowRunNotFoundError } from "@/core/workflows/errors";
import type { AppBindings } from "@/env";
import {
  deleteAsset,
  getAssetById,
  listAssets,
  updateAsset,
} from "@/features/assets/server/service";
import {
  askLibrary,
  askLibraryForContext,
} from "@/features/chat/server/service";
import {
  ingestTextAsset,
  reprocessAsset,
  ingestUrlAsset,
} from "@/features/ingest/server/service";
import {
  getContextProfileDescriptions,
  getContextProfileSummary,
  resolveContextRetrievalPolicy,
  contextProfileValues,
} from "@/features/mcp/server/context-profiles";
import {
  searchAssets,
  searchAssetsForContext,
} from "@/features/search/server/service";
import {
  getWorkflowRunDetail,
  listWorkflowRunsByAssetId,
} from "@/features/workflows/server/service";

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

const searchAssetsForContextInputSchema = searchAssetsInputSchema.extend({
  profile: z.enum(contextProfileValues).optional(),
  allowFallback: z.boolean().optional(),
});

const getAssetInputSchema = z.object({
  id: z.string().trim().min(1),
});

const listAssetsInputSchema = z.object({
  status: z.enum(["pending", "processing", "ready", "failed"]).optional(),
  type: z.enum(["url", "pdf", "note", "image", "chat"]).optional(),
  query: z.string().trim().min(1).optional(),
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().max(50).optional(),
});

const updateAssetInputSchema = z
  .object({
    id: z.string().trim().min(1),
    title: z.string().trim().min(1).max(300).optional(),
    summary: z.string().trim().min(1).optional(),
    sourceUrl: z.string().url().optional(),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.summary !== undefined ||
      value.sourceUrl !== undefined,
    {
      message:
        'At least one of "title", "summary", or "sourceUrl" must be provided.',
      path: ["title"],
    }
  );

const deleteAssetInputSchema = z.object({
  id: z.string().trim().min(1),
});

const reprocessAssetInputSchema = z.object({
  id: z.string().trim().min(1),
});

const listAssetWorkflowsInputSchema = z.object({
  assetId: z.string().trim().min(1),
});

const getWorkflowRunInputSchema = z.object({
  runId: z.string().trim().min(1),
});

const askLibraryInputSchema = z.object({
  question: z.string().trim().min(1),
  topK: z.number().int().positive().max(10).optional(),
});

const askLibraryForContextInputSchema = askLibraryInputSchema.extend({
  profile: z.enum(contextProfileValues).optional(),
  allowFallback: z.boolean().optional(),
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

  if (error instanceof WorkflowRunNotFoundError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown MCP tool error.";
};

const contextProfileDescriptions = getContextProfileDescriptions()
  .map((profile) => `${profile.name}: ${profile.description}`)
  .join(" ");

const contextFallbackGuidance =
  "Prefer allowFallback=false first. If results are insufficient, rerun with allowFallback=true only when broader retrieval still matches the user's intent.";

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
    "list_assets",
    {
      title: "List Assets",
      description:
        "List assets in the CloudMind library with optional filters and pagination.",
      inputSchema: listAssetsInputSchema,
    },
    async (input) => {
      try {
        const result = await listAssets(bindings, input);

        return createToolResult(result);
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
    "search_assets_for_context",
    {
      title: "Search Assets For Context",
      description:
        "Search the library with context-aware retrieval weighting for AI clients. " +
        `${contextFallbackGuidance} Available profiles: ${contextProfileDescriptions}`,
      inputSchema: searchAssetsForContextInputSchema,
    },
    async (input) => {
      try {
        const policy = resolveContextRetrievalPolicy(input.profile, {
          allowFallback: input.allowFallback,
        });
        const result = await searchAssetsForContext(bindings, input, policy);

        return createToolResult({
          ...result,
          appliedPolicy: getContextProfileSummary(policy),
        });
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
    "update_asset",
    {
      title: "Update Asset",
      description: "Update editable asset fields such as title, summary, or source URL.",
      inputSchema: updateAssetInputSchema,
    },
    async (input) => {
      try {
        const item = await updateAsset(bindings, input.id, {
          title: normalizeOptionalString(input.title),
          summary: normalizeOptionalString(input.summary),
          sourceUrl: normalizeOptionalString(input.sourceUrl),
        });

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
    "delete_asset",
    {
      title: "Delete Asset",
      description: "Soft delete one asset from the CloudMind library.",
      inputSchema: deleteAssetInputSchema,
    },
    async (input) => {
      try {
        await deleteAsset(bindings, input.id);

        return createToolResult({
          ok: true,
          id: input.id,
        });
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
    "reprocess_asset",
    {
      title: "Reprocess Asset",
      description: "Trigger reprocessing for an existing asset and return the updated asset state.",
      inputSchema: reprocessAssetInputSchema,
    },
    async (input) => {
      try {
        const item = await reprocessAsset(bindings, input.id);

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
    "list_asset_workflows",
    {
      title: "List Asset Workflows",
      description: "List workflow runs associated with one asset.",
      inputSchema: listAssetWorkflowsInputSchema,
    },
    async (input) => {
      try {
        await getAssetById(bindings, input.assetId);
        const items = await listWorkflowRunsByAssetId(bindings, input.assetId);

        return createToolResult({ items });
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
    "get_workflow_run",
    {
      title: "Get Workflow Run",
      description: "Fetch the detail of one workflow run including steps and artifacts.",
      inputSchema: getWorkflowRunInputSchema,
    },
    async (input) => {
      try {
        const item = await getWorkflowRunDetail(bindings, input.runId);

        return createToolResult({ item });
      } catch (error) {
        const code =
          error instanceof WorkflowRunNotFoundError
            ? "WORKFLOW_RUN_NOT_FOUND"
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

  server.registerTool(
    "ask_library_for_context",
    {
      title: "Ask Library For Context",
      description:
        "Answer a question using context-aware retrieval weighting for AI clients. " +
        `${contextFallbackGuidance} Available profiles: ${contextProfileDescriptions}`,
      inputSchema: askLibraryForContextInputSchema,
    },
    async (input) => {
      try {
        const policy = resolveContextRetrievalPolicy(input.profile, {
          allowFallback: input.allowFallback,
        });
        const result = await askLibraryForContext(bindings, input, policy);

        return createToolResult({
          ...result,
          appliedPolicy: getContextProfileSummary(policy),
        });
      } catch (error) {
        return createToolErrorResult(getErrorMessage(error));
      }
    }
  );

  return server;
};
