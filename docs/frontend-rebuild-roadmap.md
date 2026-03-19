# CloudMind 前端改造 Roadmap

## 文档目标

这份 roadmap 用于把前端产品设计 Spec 转换成可执行的改造计划。

它回答的问题是：

- 先做什么
- 每阶段要交付什么
- 要改哪些页面和目录
- 每阶段的验收标准是什么

这不是长期愿景文档，而是当前仓库可直接执行的前端改造计划。

---

## 总体策略

前端改造不建议一次性推翻全部页面。

建议采用以下策略：

1. 先建立统一的侧边栏式 App Shell
2. 再重做用户第一感知最强的页面
3. 再重做高频工作页面
4. 最后落问答和高级体验

这样做的好处是：

- 每一阶段都能交付完整成果
- 不会因为一次性重写过多页面而失控
- 能持续验证产品方向是否正确

---

## 阶段总览

### Phase 0：基线整理

目标：

- 明确当前页面和组件边界
- 确定命名、视觉变量和公共布局方向

交付物：

- 前端设计 Spec
- 前端改造 Roadmap
- 新的页面命名约定

状态：

- 已完成文档阶段

### Phase 1：建立侧边栏式 App Shell

目标：

- 让应用先有统一的产品壳层，而不是散装页面

主要工作：

- 重做全局导航为侧边栏模式
- 增加移动端抽屉入口
- 重做页面容器和页头
- 定义颜色、间距、边框、阴影、状态色变量
- 建立统一空状态和提示样式

建议修改位置：

- `src/features/layout/components/page-shell.tsx`
- 未来新增 `src/features/layout/components/app-shell.tsx`
- 未来新增 `src/features/layout/components/sidebar-nav.tsx`
- 未来新增 `src/features/layout/components/page-header.tsx`

验收标准：

- 所有主要页面共享统一 shell
- 侧边栏能够切换主工作区
- 移动端具备抽屉式入口
- 视觉基调稳定，不再像默认后台

### Phase 2：重做 Overview 首页

目标：

- 让用户一进来就感受到产品价值

主要工作：

- 重做首页 Hero 区
- 增加知识库状态概览
- 增加最近资产卡片
- 增加处理中和失败任务区
- 增加快速保存模块
- 增加建议提问区

建议修改位置：

- `app/routes/index.tsx`
- `src/features/home/components/home-page.tsx`
- 未来新增首页专用卡片组件

验收标准：

- 首页能独立解释产品当前状态
- 首页有明确主 CTA
- 空状态下也可直接开始使用

### Phase 3：重做 Library

目标：

- 让资产页从“表单 + 列表”升级成真正的知识浏览器

主要工作：

- 重构页面头部筛选区
- 增加视图切换
- 重做资产卡片
- 强化结果概览信息
- 优化空状态和分页体验

建议修改位置：

- `app/routes/assets/index.tsx`
- `src/features/assets/components/assets-page.tsx`
- `src/features/assets/components/asset-status-badge.tsx`
- 未来新增 `asset-card.tsx`
- 未来新增 `asset-list-row.tsx`
- 未来新增 `library-filter-bar.tsx`

验收标准：

- Library 页可高效扫读
- 搜索、筛选、切换视图体验清晰
- 每张资产卡片都表达“内容对象”而不是“数据库记录”

### Phase 4：重做 Asset Detail

目标：

- 把详情页做成“知识档案页”

主要工作：

- 重构标题区与动作区
- 调整摘要、正文、来源、状态的布局关系
- 增加任务时间线和来源侧栏
- 增加进入 Ask 的入口

建议修改位置：

- `app/routes/assets/[id].tsx`
- `src/features/assets/components/asset-detail-page.tsx`

验收标准：

- 用户能快速理解一条资产的价值和状态
- 详情页阅读体验明显优于字段回显
- 重处理、跳转来源、进入问答等动作明显可见

### Phase 5：建立 Capture 体验

目标：

- 把采集入口从散落表单升级成统一 Capture 体验

主要工作：

- 提取 URL / Text / PDF 三种采集表单
- 用 tabs 或 segmented control 组织它们
- 支持成功与错误反馈
- 首页和 Library 的快速保存与 Capture 主页面复用同一套组件

建议新增或修改位置：

- `app/routes/capture.tsx`
- `src/features/capture/components/*`
- 从 `assets-page.tsx` 中拆出采集相关 UI

验收标准：

- 采集入口统一
- 三种输入都具备一致体验
- 成功和失败反馈明确

### Phase 6：正式做 Ask MVP

目标：

- 让问答页具备产品亮点

主要工作：

- 建立 Ask 页面布局
- 实现对话区和证据区双栏
- 增加输入区和建议问题
- 把来源跳转做通

建议新增或修改位置：

- `app/routes/ask.tsx`
- `src/features/chat/components/*`
- 使用已有 `src/features/chat/server/*` 边界继续落地

验收标准：

- 问答页能清楚展示答案和来源
- 用户可从问答跳转资产详情
- 追问路径顺畅

### Phase 7：Search 与 Activity 完善

目标：

- 补齐辅助工作流

主要工作：

- 强化 Search 的匹配说明
- 增加 recent searches 或搜索上下文
- 补一个 Jobs / Activity 页面或同等模块
- 统一失败任务与重处理入口

建议修改位置：

- `app/routes/search.tsx`
- `src/features/search/components/search-page.tsx`
- 未来新增 `app/routes/activity.tsx`
- 未来新增 `src/features/activity/components/*`

验收标准：

- Search 不再只是简单结果页
- 处理状态可以被集中查看
- 失败和恢复路径清晰

---

## 近期可直接执行的任务拆分

以下是建议的短期执行顺序。

## Sprint 1：侧边栏壳层和首页

目标：

- 建立统一视觉基础
- 建立侧边栏式 App Shell
- 重做首页

任务：

- 重做 `page-shell`
- 新增侧边栏导航
- 新增移动端菜单入口
- 重做首页 Hero 和状态面板
- 新增最近资产与快速保存模块

完成标志：

- 应用从“散装页面”升级为“统一工作台”

## Sprint 2：Library 和详情

目标：

- 提升资产浏览与阅读体验

任务：

- 重做资产列表页布局
- 提取资产卡片组件
- 重做详情页结构
- 增加从详情进入 Ask 的入口

完成标志：

- 用户可以把 Library 当成真正的知识浏览器来用

## Sprint 3：Capture 统一化

目标：

- 收口三种采集入口

任务：

- 建立 Capture 页面
- 抽出 URL / Text / PDF 采集组件
- 将首页和 Library 快捷采集复用同一套组件

完成标志：

- 采集体验不再散乱

## Sprint 4：Ask MVP

目标：

- 让问答页具备产品亮点

任务：

- 设计并实现双栏 Ask 页面
- 增加回答和引用联动
- 补充上下文限定 UI

完成标志：

- 问答页具备基本差异化体验

---

## 文件层改造建议

## 当前优先重写文件

- `src/features/layout/components/page-shell.tsx`
- `src/features/home/components/home-page.tsx`
- `src/features/assets/components/assets-page.tsx`
- `src/features/assets/components/asset-detail-page.tsx`
- `src/features/search/components/search-page.tsx`

## 建议新增文件

- `src/features/layout/components/app-shell.tsx`
- `src/features/layout/components/sidebar-nav.tsx`
- `src/features/layout/components/page-header.tsx`
- `src/features/assets/components/asset-card.tsx`
- `src/features/assets/components/library-filter-bar.tsx`
- `src/features/capture/components/capture-panel.tsx`
- `src/features/capture/components/url-capture-form.tsx`
- `src/features/capture/components/text-capture-form.tsx`
- `src/features/capture/components/pdf-capture-form.tsx`
- `src/features/chat/components/ask-page.tsx`
- `src/features/chat/components/chat-composer.tsx`
- `src/features/chat/components/evidence-panel.tsx`

## 建议新增页面入口

- `app/routes/capture.tsx`
- `app/routes/ask.tsx`
- 可选：`app/routes/activity.tsx`

---

## 每阶段验收问题

每完成一个阶段，都应回答以下问题。

### 体验问题

- 用户打开页面时，是否能一眼理解页面目的
- 用户是否知道下一步做什么
- 侧边栏是否真的提升了工作区切换效率
- 页面是否仍然像“接口管理后台”

### 视觉问题

- 是否建立了明确层级
- 是否足够耐看
- 是否避免了默认模板感

### 产品问题

- 这页是否真的帮助用户完成知识工作
- 这页是否强化了 CloudMind 的定位
- 这页是否有明显的长期价值

---

## 风险提醒

在改造过程中，需要特别避免以下风险。

### 风险 1：只换皮，不换结构

如果只是改颜色、圆角、阴影，而页面结构仍然按接口堆叠，结果不会好。

### 风险 2：侧边栏做成传统后台菜单

侧边栏不是为了复制 admin dashboard 模板。

它应该是工作台导航，而不是一组层级过深的系统菜单。

### 风险 3：一次性重写太多

如果同时重做所有页面，容易失控。

建议按阶段推进，每阶段形成完整结果。

### 风险 4：Ask 过早做成“普通聊天页”

如果 Ask 页先做成没有证据区的普通聊天窗，后面再补会很痛苦。

建议从一开始就预留证据面板。

### 风险 5：Capture 继续分散

如果 URL / Text / PDF 入口继续散落在不同页面，用户心智会始终混乱。

---

## 一句话执行建议

不要再围绕后端接口继续堆页面。

下一步前端改造应按以下顺序推进：

1. 先做侧边栏式 App Shell
2. 先重做首页
3. 再重做 Library 和详情
4. 再统一 Capture
5. 最后把 Ask 做成真正有证据的知识问答页
