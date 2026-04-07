import { createRoute } from "honox/factory";

import { McpTokensPage } from "@/features/mcp-tokens/components/mcp-tokens-page";
import { listMcpTokens } from "@/features/mcp-tokens/server/service";

const getFlashMessage = (
  created: string | undefined,
  revoked: string | undefined
): string | undefined => {
  if (revoked) {
    return "MCP token revoked successfully.";
  }

  if (created) {
    return "MCP token created successfully.";
  }

  return undefined;
};

// 这里渲染 MCP token 管理页，直接读取当前站点的 MCP endpoint。
export default createRoute(async (context) => {
  try {
    const items = await listMcpTokens(context.env);
    const endpointUrl = new URL("/mcp", context.req.url).toString();

    return context.render(
      <McpTokensPage
        items={items}
        endpointUrl={endpointUrl}
        errorMessage={context.req.query("error") ?? undefined}
        flashMessage={getFlashMessage(
          context.req.query("created") ?? undefined,
          context.req.query("revoked") ?? undefined
        )}
      />
    );
  } catch (error) {
    return context.render(
      <McpTokensPage
        items={[]}
        endpointUrl={new URL("/mcp", context.req.url).toString()}
        errorMessage={
          error instanceof Error ? error.message : "Failed to load MCP tokens."
        }
      />
    );
  }
});
