import { buttonClass, FlashMessage, Panel } from "@/features/ui/components";

const getDefaultHint = (showDefaultHint: boolean): string => {
  if (!showDefaultHint) {
    return "用你的 CloudMind 管理员凭据登录。";
  }
  return "首次默认凭据：admin / admin。";
};

const loginInputClass =
  "w-full rounded-md border border-line bg-ink-raised px-3 py-2 text-[14px] text-bone outline-none transition-colors placeholder:text-bone-faint focus:border-brass";

// 登录页：独立全屏（不挂 AppShell），Observatory 深墨底 + 黄铜金，左定位右表单。
export const LoginPage = ({
  errorMessage,
  flashMessage,
  nextPath,
  showDefaultHint,
}: {
  errorMessage?: string | undefined;
  flashMessage?: string | undefined;
  nextPath?: string | undefined;
  showDefaultHint: boolean;
}) => {
  return (
    <main class="flex min-h-screen items-center justify-center px-4 py-10">
      <div class="grid w-full max-w-[980px] gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.75fr)]">
        {/* 左：品牌定位 */}
        <section class="flex flex-col justify-center">
          <p class="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-brass">
            CloudMind · Admin
          </p>
          <h1 class="font-display text-[46px] font-medium leading-[1.04] tracking-tight text-bone">
            登入你的<em class="italic text-brass">私有</em>记忆工作台
          </h1>
          <p class="mt-5 max-w-[52ch] text-[15px] leading-relaxed text-bone-soft">
            这个后台由 JWT 会话保护。登录后再打开记忆库、采集流程或内部 API。
          </p>
          <p class="mt-6 font-mono text-[12px] text-bone-faint">
            self-hosted · single-user · data sovereignty
          </p>
        </section>

        {/* 右：登录表单 */}
        <Panel class="p-7" variant="panel">
          <h2 class="font-display text-[24px] font-semibold text-bone">登录</h2>
          <p class="mt-1.5 text-[13.5px] leading-relaxed text-bone-soft">
            {getDefaultHint(showDefaultHint)}
          </p>

          {flashMessage ? (
            <FlashMessage kind="success" class="mt-4">
              {flashMessage}
            </FlashMessage>
          ) : null}
          {errorMessage ? (
            <FlashMessage kind="error" class="mt-4">
              {errorMessage}
            </FlashMessage>
          ) : null}

          <form action="/auth/login" method="post" class="mt-5 grid gap-4">
            <input type="hidden" name="next" value={nextPath ?? ""} />
            <label class="grid gap-1.5">
              <span class="text-[12px] font-medium text-bone-soft">用户名</span>
              <input
                name="username"
                type="text"
                autoComplete="username"
                defaultValue="admin"
                class={loginInputClass}
              />
            </label>
            <label class="grid gap-1.5">
              <span class="text-[12px] font-medium text-bone-soft">密码</span>
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                defaultValue={showDefaultHint ? "admin" : undefined}
                class={loginInputClass}
              />
            </label>
            <button
              type="submit"
              class={`mt-1 w-full justify-center ${buttonClass("primary", "lg")}`}
            >
              登录
            </button>
          </form>
        </Panel>
      </div>
    </main>
  );
};
