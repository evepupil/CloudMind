// 客户端导航增强（boosted links）——纯静态 JS，由 Cloudflare 从 public/ 提供，
// renderer 用 <script src="/boost.js" defer> 无条件加载。不进 TS program（避免
// Worker 类型与 DOM 类型冲突），不依赖构建。
//
// 作用：拦截同源 GET 链接点击，fetch 目标页后只替换 #boost-root 内容（保留字体/
// CSS/氛围层不重载、不重解析整页），配 hover 预取 + 顶部黄铜加载条。
// 渐进增强：本脚本未加载/出错时，所有链接退化为原生整页导航，功能不受影响。
(() => {
  const ROOT_ID = "boost-root";
  const BAR_ID = "boost-bar";
  const prefetched = new Map();
  const inflight = new Set();

  // —— 是否应 boost：同源、普通左键、非新窗口/下载/纯锚点 ——
  const shouldBoost = (anchor, event) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return false;
    }
    if (
      anchor.target === "_blank" ||
      anchor.hasAttribute("download") ||
      anchor.getAttribute("rel") === "external" ||
      anchor.dataset.noBoost !== undefined
    ) {
      return false;
    }
    const url = new URL(anchor.href, location.href);
    if (url.origin !== location.origin) {
      return false;
    }
    if (url.pathname === location.pathname && url.hash) {
      return false;
    }
    return true;
  };

  // —— 顶部黄铜加载条 ——
  const ensureBar = () => {
    let bar = document.getElementById(BAR_ID);
    if (!bar) {
      bar = document.createElement("div");
      bar.id = BAR_ID;
      bar.style.cssText =
        "position:fixed;top:0;left:0;height:2px;width:0;z-index:9999;" +
        "background:#c9a35e;box-shadow:0 0 8px rgba(201,163,94,0.6);" +
        "transition:width .2s ease,opacity .3s ease;opacity:0;pointer-events:none;";
      document.body.appendChild(bar);
    }
    return bar;
  };
  const startBar = () => {
    const bar = ensureBar();
    bar.style.opacity = "1";
    bar.style.width = "0";
    void bar.offsetWidth;
    bar.style.width = "85%";
  };
  const finishBar = () => {
    const bar = ensureBar();
    bar.style.width = "100%";
    setTimeout(() => {
      bar.style.opacity = "0";
      setTimeout(() => {
        bar.style.width = "0";
      }, 300);
    }, 150);
  };

  // —— 取目标页 HTML（带预取缓存）——
  const fetchPage = async (url) => {
    const cached = prefetched.get(url);
    if (cached) {
      return cached;
    }
    try {
      const response = await fetch(url, {
        headers: { "x-boosted": "1" },
        credentials: "same-origin",
        redirect: "follow",
      });
      const contentType = response.headers.get("content-type") || "";
      if (!response.ok || !contentType.includes("text/html")) {
        return null;
      }
      const finalUrl = new URL(response.url, location.href);
      if (finalUrl.origin !== location.origin) {
        return null;
      }
      return await response.text();
    } catch {
      return null;
    }
  };

  // —— 把取回的 HTML 换进当前页：替换 #boost-root + title + 滚顶 ——
  const swap = (html, url, push) => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const nextRoot = doc.getElementById(ROOT_ID);
    const currentRoot = document.getElementById(ROOT_ID);
    if (!nextRoot || !currentRoot) {
      return false;
    }
    currentRoot.innerHTML = nextRoot.innerHTML;
    document.title = doc.title;
    if (push) {
      history.pushState({ boost: true }, "", url);
    }
    window.scrollTo({ top: 0, behavior: "auto" });
    return true;
  };

  const navigate = async (url, push) => {
    startBar();
    const html = await fetchPage(url);
    if (html === null || !swap(html, url, push)) {
      location.href = url; // 回退整页导航
      return;
    }
    prefetched.delete(url);
    finishBar();
  };

  // —— 点击拦截（事件委托）——
  document.addEventListener("click", (event) => {
    const anchor =
      event.target && event.target.closest ? event.target.closest("a") : null;
    if (!anchor || !shouldBoost(anchor, event)) {
      return;
    }
    event.preventDefault();
    navigate(new URL(anchor.href, location.href).href, true);
  });

  // —— hover / touchstart 预取 ——
  const prefetch = (anchor) => {
    const url = new URL(anchor.href, location.href).href;
    if (prefetched.has(url) || inflight.has(url) || url === location.href) {
      return;
    }
    inflight.add(url);
    fetchPage(url).then((html) => {
      inflight.delete(url);
      if (html) {
        prefetched.set(url, html);
      }
    });
  };
  const onHover = (event) => {
    const anchor =
      event.target && event.target.closest ? event.target.closest("a") : null;
    if (anchor && shouldBoost(anchor, { button: 0 })) {
      prefetch(anchor);
    }
  };
  document.addEventListener("mouseover", onHover);
  document.addEventListener("touchstart", onHover, { passive: true });

  // —— 前进 / 后退 ——
  window.addEventListener("popstate", () => {
    (async () => {
      startBar();
      const html = await fetchPage(location.href);
      if (html === null || !swap(html, location.href, false)) {
        location.reload();
        return;
      }
      finishBar();
    })();
  });
})();
