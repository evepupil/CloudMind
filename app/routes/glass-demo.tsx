import {
  Button,
  buttonClass,
  Card,
  EmptyState,
  FlashMessage,
  Input,
  Panel,
  StatusBadge,
  Textarea,
} from "@/features/ui/components";

// Phase 0' 验收页：渲染全部 Observatory 原语，肉眼过调性 / 对比度 / 空态。
// 氛围层（点阵网格 + 地平线暖光 + 颗粒）由 _renderer 全局注入，本页不重复。
// 临时产物，收尾时移除（或迁到 /dev 工具区）。
export default function GlassDemo() {
  return (
    <main class="relative mx-auto max-w-[980px] px-6 py-10">
      <header class="mb-8 rise" style="animation-delay: 0.05s">
        <p class="font-mono text-[11px] uppercase tracking-[0.2em] text-brass">
          Observatory · Design System
        </p>
        <h1 class="mt-3 font-display text-[40px] font-medium leading-none tracking-tight text-bone">
          硬核<em class="italic text-brass">记忆层</em>控制台
        </h1>
        <p class="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-bone-soft">
          深墨底 + 暖骨白 + 单一黄铜金。Fraunces 衬线标题 + Hanken Grotesk 正文
          + JetBrains Mono 数据。所有颜色取自令牌，组件零内联 hex。
        </p>
      </header>

      <div class="flex flex-col gap-8">
        {/* 面板分档 */}
        <Panel class="p-6 rise" variant="panel">
          <SectionTitle>面板分档 · Panels</SectionTitle>
          <div class="mt-4 grid gap-4 sm:grid-cols-3">
            <Panel variant="panel" class="p-4">
              <p class="text-[13px] font-medium text-bone">panel</p>
              <p class="mt-1 text-[12px] text-bone-soft">
                标准内容面板，承载正文。
              </p>
            </Panel>
            <Panel variant="raised" class="p-4">
              <p class="text-[13px] font-medium text-bone">raised</p>
              <p class="mt-1 text-[12px] text-bone-soft">
                抬升面，嵌套小块/输入底。
              </p>
            </Panel>
            <Panel variant="bare" class="p-4">
              <p class="text-[13px] font-medium text-bone">bare</p>
              <p class="mt-1 text-[12px] text-bone-soft">仅描边，轻量分组。</p>
            </Panel>
          </div>
        </Panel>

        {/* 卡片 + 交互态 */}
        <div class="grid gap-4 sm:grid-cols-2">
          <Card variant="raised">
            <p class="text-[15px] font-medium text-bone">卡片 Card</p>
            <p class="mt-1.5 text-[13px] leading-relaxed text-bone-soft">
              内顶部高光发丝线 + 外柔分层阴影，分层悬浮。
            </p>
          </Card>
          <Card variant="raised" interactive>
            <p class="text-[15px] font-medium text-bone">
              可点击卡片 · interactive
            </p>
            <p class="mt-1.5 text-[13px] leading-relaxed text-bone-soft">
              hover 时边框转黄铜暖调、阴影加深、轻微上浮。
            </p>
          </Card>
        </div>

        {/* 按钮 */}
        <Panel class="p-6" variant="panel">
          <SectionTitle>按钮 · Buttons</SectionTitle>
          <div class="mt-4 flex flex-col gap-4">
            <div class="flex flex-wrap items-center gap-3">
              <Button variant="primary">Primary 主操作</Button>
              <Button variant="subtle">Subtle 次操作</Button>
              <Button variant="ghost">Ghost 幽灵</Button>
              <Button variant="danger">Danger 危险</Button>
              <Button variant="primary" disabled>
                Disabled
              </Button>
              <a class={buttonClass("primary")} href="/glass-demo">
                链接型 Primary
              </a>
            </div>
            <div class="flex flex-wrap items-center gap-3">
              <span class="text-[12px] text-bone-faint">尺寸：</span>
              <Button variant="primary" size="sm">
                Small
              </Button>
              <Button variant="primary" size="md">
                Medium
              </Button>
              <Button variant="primary" size="lg">
                Large
              </Button>
              <Button variant="subtle" size="icon" aria-label="add">
                +
              </Button>
            </div>
          </div>
        </Panel>

        {/* 表单 */}
        <Panel class="p-6" variant="panel">
          <SectionTitle>表单控件 · Inputs</SectionTitle>
          <div class="mt-4 flex flex-col gap-3">
            <label class="flex flex-col gap-1.5" htmlFor="gd-title">
              <span class="text-[13px] font-medium text-bone-soft">标题</span>
              <Input
                type="text"
                name="title"
                id="gd-title"
                placeholder="给这条记忆起个标题"
              />
            </label>
            <label class="flex flex-col gap-1.5" htmlFor="gd-content">
              <span class="text-[13px] font-medium text-bone-soft">正文</span>
              <Textarea
                name="content"
                id="gd-content"
                rows={3}
                placeholder="粘贴原文或 AI 生成的高密度内容…"
              />
            </label>
          </div>
        </Panel>

        {/* 状态 */}
        <Panel class="p-6" variant="panel">
          <SectionTitle>状态 · Status</SectionTitle>
          <div class="mt-4 flex flex-wrap items-center gap-3">
            <StatusBadge status="pending" />
            <StatusBadge status="processing" />
            <StatusBadge status="ready" />
            <StatusBadge status="failed" />
            <StatusBadge status="ready" label="自定义文案" />
          </div>
        </Panel>

        {/* 提示条 */}
        <div class="flex flex-col gap-3">
          <FlashMessage kind="success">
            已采集。新记忆进入处理流水线，稍候可在记忆库查看。
          </FlashMessage>
          <FlashMessage kind="error">
            处理失败：抽取正文超时。可在详情页重试。
          </FlashMessage>
          <FlashMessage kind="info">
            sleep-time 整合每日 03:00 UTC 自动运行，修复漂移边与重复陈述。
          </FlashMessage>
        </div>

        {/* 空状态 */}
        <EmptyState
          title="还没有记忆"
          description="从采集收进第一条内容，或用 MCP 的 remember 写入高密度记忆。"
          action={
            <a class={buttonClass("primary")} href="/capture">
              开始采集
            </a>
          }
        />
      </div>
    </main>
  );
}

const SectionTitle = ({ children }: { children: string }) => (
  <h2 class="font-display text-[18px] font-semibold text-bone">{children}</h2>
);
