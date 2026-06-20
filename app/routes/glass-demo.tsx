import {
  AuroraBackground,
  Button,
  buttonClass,
  EmptyState,
  FlashMessage,
  GlassCard,
  GlassPanel,
  Input,
  StatusBadge,
  Textarea,
} from "@/features/ui/components";

// Phase 0 验收页：渲染全部玻璃原语，肉眼过 Glass 一致性 / 对比度 / 空态。
// 临时产物，Phase 6 收尾时移除（或迁到 /dev 工具区）。
export default function GlassDemo() {
  return (
    <>
      <AuroraBackground />
      <main class="relative mx-auto max-w-[980px] px-6 py-10">
        <header class="mb-8">
          <p class="text-[12px] font-semibold uppercase tracking-[0.16em] text-accent">
            Glass / Aurora
          </p>
          <h1 class="mt-2 text-[34px] font-semibold tracking-tight text-ink">
            玻璃设计系统
          </h1>
          <p class="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-ink-soft">
            深色极光底 + 磨砂玻璃面板。正文一律落 reading/raised
            玻璃面（高不透明度）以保 WCAG AA；chrome
            面更通透，让极光透出。所有颜色取自令牌，组件零内联 hex。
          </p>
        </header>

        <div class="flex flex-col gap-8">
          {/* 玻璃面分档 */}
          <GlassPanel variant="reading">
            <SectionTitle>玻璃面分档 · Glass surfaces</SectionTitle>
            <div class="mt-4 grid gap-4 sm:grid-cols-3">
              <GlassPanel variant="reading" class="!shadow-none p-4">
                <p class="text-[13px] font-medium text-ink">reading</p>
                <p class="mt-1 text-[12px] text-ink-soft">
                  正文区，不透明度最高，文字 AA。
                </p>
              </GlassPanel>
              <GlassPanel variant="raised" class="!shadow-none p-4">
                <p class="text-[13px] font-medium text-ink">raised</p>
                <p class="mt-1 text-[12px] text-ink-soft">
                  卡片/浮层，略浮起，文字 AA。
                </p>
              </GlassPanel>
              <GlassPanel variant="chrome" class="!shadow-none p-4">
                <p class="text-[13px] font-medium text-ink">chrome</p>
                <p class="mt-1 text-[12px] text-ink-soft">
                  侧栏/页头，通透让极光透出。
                </p>
              </GlassPanel>
            </div>
          </GlassPanel>

          {/* 卡片 + 交互态（Catalyst 深色卡片配方：内高光边 + 分层阴影 + hover 上浮） */}
          <div class="grid gap-4 sm:grid-cols-2">
            <GlassCard variant="raised">
              <p class="text-[15px] font-medium text-ink">卡片 GlassCard</p>
              <p class="mt-1.5 text-[13px] leading-relaxed text-ink-soft">
                内顶部高光发丝线 + 外柔分层阴影，玻璃质感分层悬浮。
              </p>
            </GlassCard>
            <GlassCard variant="raised" interactive>
              <p class="text-[15px] font-medium text-ink">
                可点击卡片 · interactive
              </p>
              <p class="mt-1.5 text-[13px] leading-relaxed text-ink-soft">
                hover 时边框变亮、阴影加深、轻微上浮 0.5。
              </p>
            </GlassCard>
          </div>

          {/* 按钮 */}
          <GlassPanel variant="reading">
            <SectionTitle>按钮 · Buttons（Catalyst 配方）</SectionTitle>
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
                <span class="text-[12px] text-ink-faint">尺寸：</span>
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
          </GlassPanel>

          {/* 表单 */}
          <GlassPanel variant="reading">
            <SectionTitle>表单控件 · Inputs</SectionTitle>
            <div class="mt-4 flex flex-col gap-3">
              <label class="flex flex-col gap-1.5" htmlFor="gd-title">
                <span class="text-[13px] font-medium text-ink-soft">标题</span>
                <Input
                  type="text"
                  name="title"
                  id="gd-title"
                  placeholder="给这条记忆起个标题"
                />
              </label>
              <label class="flex flex-col gap-1.5" htmlFor="gd-content">
                <span class="text-[13px] font-medium text-ink-soft">正文</span>
                <Textarea
                  name="content"
                  id="gd-content"
                  rows={3}
                  placeholder="粘贴原文或 AI 生成的高密度内容…"
                />
              </label>
            </div>
          </GlassPanel>

          {/* 状态 */}
          <GlassPanel variant="reading">
            <SectionTitle>状态 · Status</SectionTitle>
            <div class="mt-4 flex flex-wrap items-center gap-3">
              <StatusBadge status="pending" />
              <StatusBadge status="processing" />
              <StatusBadge status="ready" />
              <StatusBadge status="failed" />
              <StatusBadge status="ready" label="自定义文案" />
            </div>
          </GlassPanel>

          {/* 提示条 */}
          <div class="flex flex-col gap-3">
            <FlashMessage kind="success">
              已保存。新记忆进入处理流水线，稍候可在 Library 查看。
            </FlashMessage>
            <FlashMessage kind="error">
              处理失败：抽取正文超时。可在详情页重试。
            </FlashMessage>
            <FlashMessage kind="info">
              sleep-time 维护每日 03:00 UTC 自动运行，修复漂移边与重复陈述。
            </FlashMessage>
          </div>

          {/* 空状态 */}
          <EmptyState
            title="还没有记忆"
            description="从 Capture 收进第一条内容，或用 MCP 的 remember 写入高密度记忆。"
            action={
              <a class={buttonClass("primary")} href="/capture">
                开始采集
              </a>
            }
          />
        </div>
      </main>
    </>
  );
}

const SectionTitle = ({ children }: { children: string }) => (
  <h2 class="text-[16px] font-semibold text-ink">{children}</h2>
);
