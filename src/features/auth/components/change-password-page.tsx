import { buttonClass, FlashMessage, Panel } from "@/features/ui/components";

const cpInputClass =
  "w-full rounded-md border border-line bg-ink-raised px-3 py-2 text-[14px] text-bone outline-none transition-colors placeholder:text-bone-faint focus:border-brass";

// 改密页：独立全屏，首次登录与后续手动更新复用。
export const ChangePasswordPage = ({
  username,
  mustChangePassword,
  nextPath,
  errorMessage,
  flashMessage,
}: {
  username: string;
  mustChangePassword: boolean;
  nextPath?: string | undefined;
  errorMessage?: string | undefined;
  flashMessage?: string | undefined;
}) => {
  return (
    <main class="flex min-h-screen items-center justify-center px-4 py-10">
      <Panel class="w-full max-w-[560px] p-8" variant="panel">
        <p class="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-brass">
          Account Security
        </p>
        <h1 class="font-display text-[32px] font-medium tracking-tight text-bone">
          修改密码
        </h1>
        <p class="mt-3.5 text-[14px] leading-relaxed text-bone-soft">
          当前登录：<span class="font-medium text-bone">{username}</span>。
          {mustChangePassword
            ? " 此账号仍在用默认密码，继续前请先修改。"
            : " 更新密码以锁定这个单用户工作台。"}
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

        <form
          action="/auth/change-password"
          method="post"
          class="mt-6 grid gap-4"
        >
          <input type="hidden" name="next" value={nextPath ?? ""} />
          <label class="grid gap-1.5">
            <span class="text-[12px] font-medium text-bone-soft">当前密码</span>
            <input
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              class={cpInputClass}
            />
          </label>
          <label class="grid gap-1.5">
            <span class="text-[12px] font-medium text-bone-soft">新密码</span>
            <input
              name="newPassword"
              type="password"
              autoComplete="new-password"
              class={cpInputClass}
            />
          </label>
          <label class="grid gap-1.5">
            <span class="text-[12px] font-medium text-bone-soft">
              确认新密码
            </span>
            <input
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              class={cpInputClass}
            />
          </label>
          <div class="mt-2 flex flex-wrap items-center gap-3">
            <button type="submit" class={buttonClass("primary")}>
              保存密码
            </button>
            <a class={buttonClass("subtle")} href="/auth/logout">
              退出登录
            </a>
          </div>
        </form>
      </Panel>
    </main>
  );
};
