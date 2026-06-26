import { createClient } from "honox/client";

// HonoX 客户端入口：按需水合 app/islands/* 下的岛组件。
// _renderer.tsx 经 <Script src="/app/client.ts"> 注入本入口；Script 内部用
// HasIslands 条件，仅当页面真正用到岛时才加载本客户端 JS（渐进增强：无岛即零 JS）。
// 字体不在此 import——走 app.css 的 @font-face + /styles.css，SSR 首屏即可用。
export default createClient();
