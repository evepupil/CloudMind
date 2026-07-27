const scenarios = {
  personal: {
    source: ["收集", "把网页、文件与笔记安全地收进自己的 R2 原始快照。"],
    semantic: ["调和", "提取实体、关系与带有效期的陈述，始终保留来源。"],
    memory: ["调用", "通过 MCP 与 Web，让被授权的 AI 带证据地召回和更新。"],
    boundary:
      "原始资料、结构化记忆、索引和导出都在你的 Cloudflare 账户中。CloudMind 可以删除、恢复、校验和迁移，但从不把所有权带走。",
  },
  agent: {
    source: [
      "写入",
      "由 Agent 明确提交高密度工作结论，完整会话不会被默认收存。",
    ],
    semantic: [
      "隔离",
      "记忆按 scope 与项目上下文分开调和，避免跨项目和跨主体串扰。",
    ],
    memory: [
      "召回",
      "MCP 依据 contextKey 返回相关证据，Agent 只看到被授权的记忆范围。",
    ],
    boundary:
      "Agent 不能替你拥有记忆。个人与 Agent 记录独立管理；更新、遗忘、恢复和导出都经过明确的范围与项目键校验。",
  },
};

const modeButtons = document.querySelectorAll("[data-mode]");
const menuToggle = document.querySelector(".menu-toggle");
const siteNav = document.querySelector(".site-nav");

function selectScenario(mode) {
  const scenario = scenarios[mode];
  if (!scenario) {
    return;
  }

  modeButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
  });

  for (const key of ["source", "semantic", "memory"]) {
    const [title, copy] = scenario[key];
    document.querySelector(`[data-flow-title="${key}"]`).textContent = title;
    document.querySelector(`[data-flow-copy="${key}"]`).textContent = copy;
  }

  document.querySelector("#boundary-copy").textContent = scenario.boundary;
}

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectScenario(button.dataset.mode);
  });
});

menuToggle?.addEventListener("click", () => {
  const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
  menuToggle.setAttribute("aria-expanded", String(!isOpen));
  siteNav?.setAttribute("data-open", String(!isOpen));
});

siteNav?.addEventListener("click", () => {
  menuToggle?.setAttribute("aria-expanded", "false");
  siteNav.setAttribute("data-open", "false");
});
