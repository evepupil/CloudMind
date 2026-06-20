import { createClient } from "honox/client";

// HonoX 客户端入口：按需水合 app/islands/* 下的岛组件。
// _renderer.tsx 经 <Script src="/app/client.ts"> 注入本入口；
// <HasIslands> 保证仅当页面真正用到岛时才加载客户端 JS（渐进增强：无岛即零 JS）。
export default createClient();
