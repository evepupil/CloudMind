import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { sign, verify } from "hono/jwt";

import type { AuthAccountRecord, AuthSessionPayload } from "@/core/auth/types";
import type { AppBindings } from "@/env";

export const AUTH_SESSION_COOKIE_NAME = "cloudmind_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const DEFAULT_JWT_SECRET = "cloudmind-dev-jwt-secret-change-me";

const isHttpsRequest = (requestUrl: string): boolean => {
  try {
    return new URL(requestUrl).protocol === "https:";
  } catch {
    return false;
  }
};

export const sanitizeNextPath = (
  value: string | undefined | null
): string | null => {
  if (!value) {
    return null;
  }

  const normalized = value.trim();

  if (!normalized.startsWith("/") || normalized.startsWith("//")) {
    return null;
  }

  if (normalized.startsWith("/login") || normalized.startsWith("/auth/login")) {
    return null;
  }

  return normalized;
};

export const getJwtSecret = (bindings: AppBindings | undefined): string => {
  return bindings?.JWT_SECRET?.trim() || DEFAULT_JWT_SECRET;
};

const getSessionCookieOptions = (context: Context) => {
  return {
    httpOnly: true,
    sameSite: "Lax" as const,
    secure: isHttpsRequest(context.req.url),
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
};

export const issueSessionToken = async (
  bindings: AppBindings | undefined,
  account: AuthAccountRecord
): Promise<string> => {
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const payload: AuthSessionPayload = {
    sub: account.id,
    username: account.username,
    mustChangePassword: account.mustChangePassword,
    iat: nowInSeconds,
    exp: nowInSeconds + SESSION_TTL_SECONDS,
  };

  return sign(payload, getJwtSecret(bindings), "HS256");
};

export const setSessionCookie = async (
  context: Context,
  account: AuthAccountRecord
): Promise<void> => {
  const token = await issueSessionToken(context.env, account);

  setCookie(
    context,
    AUTH_SESSION_COOKIE_NAME,
    token,
    getSessionCookieOptions(context)
  );
};

export const clearSessionCookie = (context: Context): void => {
  deleteCookie(context, AUTH_SESSION_COOKIE_NAME, {
    path: "/",
  });
};

const parseSessionPayload = (
  payload: Record<string, unknown>
): AuthSessionPayload | null => {
  if (
    typeof payload.sub !== "string" ||
    typeof payload.username !== "string" ||
    typeof payload.mustChangePassword !== "boolean" ||
    typeof payload.iat !== "number" ||
    typeof payload.exp !== "number"
  ) {
    return null;
  }

  return {
    sub: payload.sub,
    username: payload.username,
    mustChangePassword: payload.mustChangePassword,
    iat: payload.iat,
    exp: payload.exp,
  };
};

export const readOptionalSession = async (
  context: Context
): Promise<AuthSessionPayload | null> => {
  const authorization = context.req.header("Authorization");
  let token = null;

  if (authorization) {
    const segments = authorization.trim().split(/\s+/);

    if (segments.length === 2 && segments[0]?.toLowerCase() === "bearer") {
      token = segments[1] ?? null;
    }
  }

  if (!token) {
    token = getCookie(context, AUTH_SESSION_COOKIE_NAME) ?? null;
  }

  if (!token) {
    return null;
  }

  try {
    const payload = await verify(token, getJwtSecret(context.env), "HS256");

    return parseSessionPayload(payload as Record<string, unknown>);
  } catch {
    return null;
  }
};
