const getDefaultHint = (showDefaultHint: boolean): string => {
  if (!showDefaultHint) {
    return "Use your CloudMind admin credentials to continue.";
  }

  return "First-time default credentials: admin / admin.";
};

// 这里提供登录页，先服务单用户本地后台入口。
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
    <main class="min-h-screen bg-[#f7f6f3] px-4 py-10">
      <div class="mx-auto grid max-w-[980px] gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.75fr)]">
        <section class="rounded-[24px] border border-[#e8e8e7] bg-white p-8 shadow-[0_24px_80px_rgba(55,53,47,0.08)]">
          <p class="mb-3 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#9b9a97]">
            CloudMind Admin
          </p>
          <h1 class="m-0 max-w-[12ch] text-[42px] font-semibold leading-[1.05] tracking-[-0.03em] text-[#37352f]">
            Sign in to your private knowledge workspace.
          </h1>
          <p class="mt-4 mb-0 max-w-[56ch] text-[16px] leading-relaxed text-[#787774]">
            This dashboard is now protected by JWT session auth. Sign in before
            opening the library, capture flows, or internal APIs.
          </p>
        </section>

        <section class="rounded-[24px] border border-[#e8e8e7] bg-white p-7 shadow-[0_16px_48px_rgba(55,53,47,0.08)]">
          <h2 class="mt-0 text-[24px] font-semibold text-[#37352f]">Login</h2>
          <p class="mt-2 text-[14px] leading-relaxed text-[#787774]">
            {getDefaultHint(showDefaultHint)}
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

          <form action="/auth/login" method="post" class="mt-5 grid gap-4">
            <input type="hidden" name="next" value={nextPath ?? ""} />

            <label class="grid gap-2">
              <span class="text-[14px] font-semibold text-[#37352f]">
                Username
              </span>
              <input
                name="username"
                type="text"
                autoComplete="username"
                defaultValue="admin"
                class="rounded-md border border-[#e8e8e7] bg-white px-3 py-2 text-[14px] text-[#37352f] focus:border-[#37352f] focus:outline-none"
              />
            </label>

            <label class="grid gap-2">
              <span class="text-[14px] font-semibold text-[#37352f]">
                Password
              </span>
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                defaultValue={showDefaultHint ? "admin" : undefined}
                class="rounded-md border border-[#e8e8e7] bg-white px-3 py-2 text-[14px] text-[#37352f] focus:border-[#37352f] focus:outline-none"
              />
            </label>

            <button
              type="submit"
              class="mt-2 w-full cursor-pointer rounded-md bg-[#37352f] px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-[#2f2d28]"
            >
              Sign in
            </button>
          </form>
        </section>
      </div>
    </main>
  );
};
