import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { jwt } from "hono/jwt";

import type { AuthSessionPayload } from "@/core/auth/types";
import type { AppEnv } from "@/env";
import { ensurePrimaryAccount } from "./service";
import {
  AUTH_SESSION_COOKIE_NAME,
  clearSessionCookie,
  getJwtSecret,
  sanitizeNextPath,
} from "./session";

const isPublicPath = (path: string): boolean => {
  if (
    path === "/login" ||
    path === "/auth/login" ||
    path === "/auth/logout" ||
    path === "/styles.css" ||
    path === "/favicon.ico" ||
    path.startsWith("/node_modules/") ||
    path.startsWith("/src/") ||
    path.startsWith("/@")
  ) {
    return true;
  }

  if (/\.(css|js|map|ico|png|jpg|jpeg|svg|webp|woff|woff2)$/i.test(path)) {
    return true;
  }

  return false;
};

const isMcpPath = (path: string): boolean => {
  return path === "/mcp";
};

const isPasswordManagementPath = (path: string): boolean => {
  return path === "/change-password" || path === "/auth/change-password";
};

const isApiRequestPath = (path: string): boolean => {
  return path.startsWith("/api/");
};

const createJsonErrorResponse = (
  code: string,
  message: string,
  status: number
): Response => {
  return Response.json(
    {
      error: {
        code,
        message,
      },
    },
    {
      status,
    }
  );
};

const getRequestPathWithQuery = (requestUrl: string): string => {
  const url = new URL(requestUrl);

  return `${url.pathname}${url.search}`;
};

// 这里对页面与 API 统一挂 JWT 会话保护，MCP 入口继续走独立 token 鉴权。
export const authMiddleware: MiddlewareHandler<AppEnv> = async (
  context,
  next
) => {
  const path = context.req.path;

  if (isPublicPath(path) || isMcpPath(path)) {
    return next();
  }

  await ensurePrimaryAccount(context.env);

  const jwtMiddleware = jwt({
    secret: getJwtSecret(context.env),
    alg: "HS256",
    cookie: AUTH_SESSION_COOKIE_NAME,
  });

  try {
    await jwtMiddleware(context, async () => {});
  } catch (error) {
    if (error instanceof HTTPException && error.status === 401) {
      clearSessionCookie(context);

      if (isApiRequestPath(path)) {
        return createJsonErrorResponse(
          "UNAUTHORIZED",
          "Authentication is required.",
          401
        );
      }

      const nextPath = sanitizeNextPath(
        getRequestPathWithQuery(context.req.url)
      );
      const loginLocation = nextPath
        ? `/login?next=${encodeURIComponent(nextPath)}`
        : "/login";

      return context.redirect(loginLocation, 303);
    }

    throw error;
  }

  const payload = context.get("jwtPayload") as AuthSessionPayload;
  context.set("authSession", payload);

  if (payload.mustChangePassword && !isPasswordManagementPath(path)) {
    if (isApiRequestPath(path)) {
      return createJsonErrorResponse(
        "PASSWORD_CHANGE_REQUIRED",
        "Change your password before accessing other routes.",
        403
      );
    }

    const nextPath = sanitizeNextPath(getRequestPathWithQuery(context.req.url));
    const changePasswordLocation = nextPath
      ? `/change-password?next=${encodeURIComponent(nextPath)}`
      : "/change-password";

    return context.redirect(changePasswordLocation, 303);
  }

  return next();
};
