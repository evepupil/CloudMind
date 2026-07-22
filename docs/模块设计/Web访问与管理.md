# Web 访问与管理

> 模块定位：提供浏览、采集、检索、问答、记忆查看和运维状态的 Web 工作台。
>
> 对应代码：`app/routes/*`、`src/features/{layout,ui,home,assets,capture,search,chat,memory,activity,auth,mcp-tokens}/components/*`
>
> 所属 M 里程碑：[`M4 Web 访问与管理`](../roadmap.md#m4-web-访问与管理)
>
> 当前状态：已完成
>
> 最近更新时间：2026-07-22

## 职责与边界

- App Shell 负责桌面与移动端的统一导航、页面头部和反馈样式。
- 各 feature 页面负责把服务端数据转换为可扫描、可操作的工作界面。
- 记忆区展示图谱、时间线和整合状态，Activity 集中展示任务运行情况。
- 业务规则留在 server/core 层，展示组件不直接访问 Cloudflare 资源。

## 结构与数据流

```text
HonoX route -> feature server service -> page props -> feature component
user action -> REST route -> domain service -> redirect / partial navigation
```

全站使用 Observatory 视觉令牌、自托管字体和统一组件原语。

## 关键决策

1. 首页直接展示真实知识库状态，不维护演示数据。
2. 资产、搜索、问答和记忆区按工作流组织，避免营销页式信息层级。
3. 客户端导航使用预取和局部替换，同时保留服务端渲染回退。
4. 纯视觉和布局通过构建与人工检查验证，不增加脆弱的样式单测。

## 当前实现

- Overview、Library、Asset Detail、Capture、Search、Ask 和 Activity。
- 记忆图谱、时间线、整合页，以及对应 `/api/memory/*` 数据接口。
- 登录、改密、MCP token 管理和移动端导航。
- 统一按钮、输入框、状态、空状态、面板和反馈组件。

## 验证方式

运行类型检查、lint 和生产构建；服务端行为由现有 route/service 单测覆盖。
涉及布局或视觉调整时，在目标桌面和移动端视口人工检查主要页面。

## 待扩展项

- 增加真实数据规模下的可用性和性能检查。
- 随 M3/M5/M6 增加记忆编辑、聚合和导出入口。
- 补充失败任务批量处理与更细的运维筛选。

## 改动历史

- 2026-07-22：确认 Observatory 重构和 Activity 均已完成，建立模块归档。
- 2026-06-07：记忆图谱、时间线与整合页面接入真实接口。
- 2026-06-06：分阶段完成 App Shell、首页、资产、采集、问答和搜索重构。
