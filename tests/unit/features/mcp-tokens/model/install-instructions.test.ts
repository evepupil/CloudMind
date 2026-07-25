import { describe, expect, it } from "vitest";

import {
  buildMcpConfigSnippet,
  buildMcpInstallPrompt,
  MCP_INSTALL_TARGETS,
} from "@/features/mcp-tokens/model/install-instructions";

const endpointUrl = "https://memory.example.com/mcp";
const tokenValue = "cm_test_secret_token";

describe("MCP client install instructions", () => {
  it("builds a compatible JSON snippet", () => {
    expect(JSON.parse(buildMcpConfigSnippet(endpointUrl, tokenValue))).toEqual({
      mcpServers: {
        cloudmind: {
          url: endpointUrl,
          headers: { Authorization: `Bearer ${tokenValue}` },
        },
      },
    });
  });

  it.each(
    MCP_INSTALL_TARGETS
  )("builds a complete $label installation prompt", ({ value }) => {
    const prompt = buildMcpInstallPrompt({
      target: value,
      endpointUrl,
      tokenValue,
    });

    expect(prompt).toContain(endpointUrl);
    expect(prompt).toContain(tokenValue);
    expect(prompt).toContain("Streamable HTTP");
    expect(prompt).toContain("skills/cloudmind-memory");
    expect(prompt).toContain("不要把 token 写入 Git");
    expect(prompt).toContain("CloudMind 自身的任何 memory/library 记录");
    expect(prompt).toContain("不要为了测试创建、修改或删除记忆");
    expect(prompt).toContain("recall_agent");
    expect(prompt).toContain("所有敏感值必须脱敏");
  });
});
