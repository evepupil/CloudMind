import { createRoute } from "honox/factory";

import { ChangePasswordPage } from "@/features/auth/components/change-password-page";
import {
  readOptionalSession,
  sanitizeNextPath,
} from "@/features/auth/server/session";

export default createRoute(async (context) => {
  const session = await readOptionalSession(context);
  const nextPath = sanitizeNextPath(context.req.query("next") ?? undefined);

  if (!session) {
    return context.redirect("/login", 303);
  }

  return context.render(
    <ChangePasswordPage
      username={session.username}
      mustChangePassword={session.mustChangePassword}
      nextPath={nextPath ?? undefined}
      errorMessage={context.req.query("error") ?? undefined}
      flashMessage={context.req.query("flash") ?? undefined}
    />
  );
});
