import { createRoute } from "honox/factory";

import { LoginPage } from "@/features/auth/components/login-page";
import { ensurePrimaryAccount } from "@/features/auth/server/service";
import {
  readOptionalSession,
  sanitizeNextPath,
} from "@/features/auth/server/session";

const getFlashMessage = (
  loggedOut: string | undefined,
  passwordChanged: string | undefined
): string | undefined => {
  if (passwordChanged) {
    return "Password updated successfully. Please sign in again if needed.";
  }

  if (loggedOut) {
    return "You have been logged out.";
  }

  return undefined;
};

export default createRoute(async (context) => {
  const session = await readOptionalSession(context);
  const nextPath = sanitizeNextPath(context.req.query("next") ?? undefined);

  if (session) {
    if (session.mustChangePassword) {
      const location = nextPath
        ? `/change-password?next=${encodeURIComponent(nextPath)}`
        : "/change-password";

      return context.redirect(location, 303);
    }

    return context.redirect(nextPath ?? "/", 303);
  }

  const account = await ensurePrimaryAccount(context.env);

  return context.render(
    <LoginPage
      errorMessage={context.req.query("error") ?? undefined}
      flashMessage={getFlashMessage(
        context.req.query("loggedOut") ?? undefined,
        context.req.query("passwordChanged") ?? undefined
      )}
      nextPath={nextPath ?? undefined}
      showDefaultHint={account.mustChangePassword}
    />
  );
});
