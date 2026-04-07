// 这里提供改密页，首次登录和后续手动更新都复用这个表单。
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
    <main class="min-h-screen bg-[#f7f6f3] px-4 py-10">
      <div class="mx-auto max-w-[640px] rounded-[24px] border border-[#e8e8e7] bg-white p-8 shadow-[0_24px_80px_rgba(55,53,47,0.08)]">
        <p class="mb-3 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#9b9a97]">
          Account Security
        </p>
        <h1 class="m-0 text-[34px] font-semibold tracking-[-0.03em] text-[#37352f]">
          Change password
        </h1>
        <p class="mt-4 mb-0 text-[15px] leading-relaxed text-[#787774]">
          Signed in as{" "}
          <span class="font-semibold text-[#37352f]">{username}</span>.
          {mustChangePassword
            ? " This account is still using the default password. Update it before you continue."
            : " Update your password to keep this single-user workspace locked down."}
        </p>

        {flashMessage ? (
          <section class="mt-4 rounded-lg border border-[#b7dbbf] bg-[#e3f2e8] px-4 py-3 text-[14px] text-[#2e6c3e]">
            {flashMessage}
          </section>
        ) : null}

        {errorMessage ? (
          <section class="mt-4 rounded-lg border border-[#e8b7b7] bg-[#f9e3e3] px-4 py-3 text-[14px] text-[#9c2e2e]">
            {errorMessage}
          </section>
        ) : null}

        <form
          action="/auth/change-password"
          method="post"
          class="mt-6 grid gap-4"
        >
          <input type="hidden" name="next" value={nextPath ?? ""} />

          <label class="grid gap-2">
            <span class="text-[14px] font-semibold text-[#37352f]">
              Current password
            </span>
            <input
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              class="rounded-md border border-[#e8e8e7] bg-white px-3 py-2 text-[14px] text-[#37352f] focus:border-[#37352f] focus:outline-none"
            />
          </label>

          <label class="grid gap-2">
            <span class="text-[14px] font-semibold text-[#37352f]">
              New password
            </span>
            <input
              name="newPassword"
              type="password"
              autoComplete="new-password"
              class="rounded-md border border-[#e8e8e7] bg-white px-3 py-2 text-[14px] text-[#37352f] focus:border-[#37352f] focus:outline-none"
            />
          </label>

          <label class="grid gap-2">
            <span class="text-[14px] font-semibold text-[#37352f]">
              Confirm new password
            </span>
            <input
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              class="rounded-md border border-[#e8e8e7] bg-white px-3 py-2 text-[14px] text-[#37352f] focus:border-[#37352f] focus:outline-none"
            />
          </label>

          <div class="mt-2 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              class="cursor-pointer rounded-md bg-[#37352f] px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-[#2f2d28]"
            >
              Save password
            </button>
            <a
              href="/auth/logout"
              class="rounded-md border border-[#e8e8e7] px-4 py-2.5 text-[14px] font-semibold text-[#37352f] no-underline transition-colors hover:bg-[#f1f1f0]"
            >
              Log out
            </a>
          </div>
        </form>
      </div>
    </main>
  );
};
