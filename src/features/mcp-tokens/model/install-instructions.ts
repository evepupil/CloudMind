export type McpInstallTarget = "codex" | "claude-code" | "generic";

export interface McpInstallTargetOption {
  value: McpInstallTarget;
  label: string;
}

export const MCP_INSTALL_TARGETS: McpInstallTargetOption[] = [
  { value: "codex", label: "Codex" },
  { value: "claude-code", label: "Claude Code" },
  { value: "generic", label: "其他 AI" },
];

const targetGuidance: Record<McpInstallTarget, string[]> = {
  codex: [
    "你当前运行在 Codex 中。优先使用 codex mcp 命令或用户级 config.toml 配置远程 MCP。",
    "把 cloudmind-memory Skill 安装到用户级 Codex Skills 目录；如果内置 skill-installer 可用，优先使用它。",
  ],
  "claude-code": [
    "你当前运行在 Claude Code 中。使用当前版本支持的用户级 MCP 配置方式，不要只改当前项目。",
    "把 cloudmind-memory 安装为用户级 Skill；先检查当前 Claude Code 的 Skill 目录和安装命令。",
  ],
  generic: [
    "先识别当前 AI 客户端支持的 MCP 和 Skill 配置方式，优先写入用户级配置。",
    "客户端支持 Skills 时安装 cloudmind-memory；不支持时，只完成 MCP 连接并说明限制。",
  ],
};

export const buildMcpConfigSnippet = (
  endpointUrl: string,
  tokenValue: string
): string =>
  JSON.stringify(
    {
      mcpServers: {
        cloudmind: {
          url: endpointUrl,
          headers: { Authorization: `Bearer ${tokenValue}` },
        },
      },
    },
    null,
    2
  );

export const buildMcpInstallPrompt = ({
  target,
  endpointUrl,
  tokenValue,
}: {
  target: McpInstallTarget;
  endpointUrl: string;
  tokenValue: string;
}): string =>
  [
    "请直接在当前电脑上完成 CloudMind 客户端安装和验证，不要只给我步骤说明。",
    "",
    ...targetGuidance[target],
    "",
    "连接信息：",
    `- MCP 名称：cloudmind`,
    `- 传输方式：Streamable HTTP`,
    `- MCP URL：${endpointUrl}`,
    `- Bearer token：${tokenValue}`,
    "",
    "安装要求：",
    "1. 把 CloudMind 配置为用户级远程 MCP，避免写入当前项目仓库。已有同名配置时做幂等更新。",
    "2. 优先使用客户端支持的 secret 或环境变量机制保存 token；只能使用静态 header 时，写入用户级私有配置。",
    "3. 安装 GitHub 仓库 evepupil/CloudMind 中的 skills/cloudmind-memory Skill，使用 main 分支。",
    "4. 如果客户端需要刷新配置，完成后启动新任务或明确告诉我需要重启哪一部分。",
    "5. 验证 MCP 已启用，并确认工具列表至少包含 recall、remember、recall_agent、remember_agent。不要为了测试创建、修改或删除记忆。",
    "",
    "安全要求：",
    "- token 是秘密信息。不要在回复、终端输出、日志或错误详情中回显完整 token。",
    "- 不要把 token 写入 Git、项目文件、聊天记忆或 CloudMind 自身的任何 memory/library 记录。",
    "- 不要运行会把 token 放进命令行参数历史或公开进程列表的命令；需要时使用安全输入或私有配置文件。",
    "- 最终只报告：MCP 是否配置成功、Skill 是否安装成功、验证结果、是否还需要用户操作。所有敏感值必须脱敏。",
  ].join("\n");
