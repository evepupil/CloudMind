// MCP token 安装面板交互。脚本由全站外壳加载，事件委托可覆盖站内局部导航
// 后新换入的面板；脚本缺失时仍可直接选中文本手动复制。
(() => {
  const findVisibleTextarea = (panel) => {
    const visibleContent = Array.from(
      panel.querySelectorAll("[data-install-content]")
    ).find((content) => !content.hidden);

    return visibleContent?.querySelector("textarea") ?? null;
  };

  const fallbackCopy = (textarea) => {
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    try {
      return document.execCommand("copy");
    } catch {
      return false;
    }
  };

  const copyTextarea = async (textarea) => {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(textarea.value);
        return true;
      } catch {
        // 权限或浏览器策略拒绝时，继续尝试兼容复制。
      }
    }

    return fallbackCopy(textarea);
  };

  const restoreButtonLabel = (button, label) => {
    window.setTimeout(() => {
      button.textContent = label;
    }, 1600);
  };

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const modeButton = target.closest("[data-install-mode]");
    if (modeButton instanceof HTMLButtonElement) {
      const panel = modeButton.closest("[data-mcp-install]");
      if (!panel) {
        return;
      }

      const mode = modeButton.dataset.installMode;
      panel.querySelectorAll("[data-install-mode]").forEach((button) => {
        button.setAttribute("aria-selected", String(button === modeButton));
      });
      panel.querySelectorAll("[data-install-content]").forEach((content) => {
        content.hidden = content.getAttribute("data-install-content") !== mode;
      });
      return;
    }

    const copyButton = target.closest("[data-copy-install]");
    if (!(copyButton instanceof HTMLButtonElement)) {
      return;
    }

    const panel = copyButton.closest("[data-mcp-install]");
    const textarea = panel ? findVisibleTextarea(panel) : null;
    if (!(textarea instanceof HTMLTextAreaElement)) {
      return;
    }

    const originalLabel = copyButton.textContent || "复制";
    void copyTextarea(textarea).then((copied) => {
      copyButton.textContent = copied ? "已复制" : "请手动复制";
      restoreButtonLabel(copyButton, originalLabel);
    });
  });
})();
