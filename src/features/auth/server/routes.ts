import type { Hono } from "hono";
import type { z } from "zod";

import type { AppEnv } from "@/env";

import { changePasswordPayloadSchema, loginPayloadSchema } from "./schemas";
import { authenticateWithPassword, changePassword } from "./service";
import {
  clearSessionCookie,
  sanitizeNextPath,
  setSessionCookie,
} from "./session";

const getValidationErrorMessage = (error: z.ZodError): string => {
  return error.issues[0]?.message ?? "Invalid auth input.";
};

const getLoginRedirectLocation = (
  message: string,
  next: string | undefined
): string => {
  const params = new URLSearchParams({
    error: message,
  });
  const sanitizedNext = sanitizeNextPath(next);

  if (sanitizedNext) {
    params.set("next", sanitizedNext);
  }

  return `/login?${params.toString()}`;
};

// 这里注册登录、改密和登出入口，统一处理浏览器会话 cookie。
export const registerAuthRoutes = (app: Hono<AppEnv>): void => {
  app.post("/auth/login", async (context) => {
    const formData = await context.req.formData();
    const nextValue = formData.get("next");
    const parsedPayload = loginPayloadSchema.safeParse({
      username: formData.get("username"),
      password: formData.get("password"),
      next: nextValue,
    });

    if (!parsedPayload.success) {
      return context.redirect(
        getLoginRedirectLocation(
          getValidationErrorMessage(parsedPayload.error),
          typeof nextValue === "string" ? nextValue : undefined
        ),
        303
      );
    }

    const result = await authenticateWithPassword(context.env, {
      username: parsedPayload.data.username,
      password: parsedPayload.data.password,
    });

    if (!result.ok) {
      clearSessionCookie(context);

      return context.redirect(
        getLoginRedirectLocation(result.message, parsedPayload.data.next),
        303
      );
    }

    await setSessionCookie(context, result.account);

    const nextPath = sanitizeNextPath(parsedPayload.data.next);

    if (result.account.mustChangePassword) {
      const location = nextPath
        ? `/change-password?next=${encodeURIComponent(nextPath)}`
        : "/change-password";

      return context.redirect(location, 303);
    }

    return context.redirect(nextPath ?? "/", 303);
  });

  app.post("/auth/change-password", async (context) => {
    const session = context.get("authSession");
    const formData = await context.req.formData();
    const nextValue = formData.get("next");
    const parsedPayload = changePasswordPayloadSchema.safeParse({
      currentPassword: formData.get("currentPassword"),
      newPassword: formData.get("newPassword"),
      confirmPassword: formData.get("confirmPassword"),
      next: nextValue,
    });

    if (!parsedPayload.success) {
      const params = new URLSearchParams({
        error: getValidationErrorMessage(parsedPayload.error),
      });
      const sanitizedNext = sanitizeNextPath(
        typeof nextValue === "string" ? nextValue : undefined
      );

      if (sanitizedNext) {
        params.set("next", sanitizedNext);
      }

      return context.redirect(`/change-password?${params.toString()}`, 303);
    }

    const result = await changePassword(context.env, {
      accountId: session.sub,
      currentPassword: parsedPayload.data.currentPassword,
      newPassword: parsedPayload.data.newPassword,
    });

    if (!result.ok) {
      const params = new URLSearchParams({
        error: result.message,
      });
      const sanitizedNext = sanitizeNextPath(parsedPayload.data.next);

      if (sanitizedNext) {
        params.set("next", sanitizedNext);
      }

      return context.redirect(`/change-password?${params.toString()}`, 303);
    }

    await setSessionCookie(context, result.account);

    const nextPath = sanitizeNextPath(parsedPayload.data.next);
    const location = nextPath
      ? `${nextPath}${nextPath.includes("?") ? "&" : "?"}passwordChanged=1`
      : "/?passwordChanged=1";

    return context.redirect(location, 303);
  });

  app.get("/auth/logout", (context) => {
    clearSessionCookie(context);

    return context.redirect("/login?loggedOut=1", 303);
  });
};
