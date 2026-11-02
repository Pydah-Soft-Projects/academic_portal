import type { Request, Response, NextFunction } from "express";
import type { AuthUser } from "../services/auth.service.js";
import { getUserForSessionToken } from "../services/auth.service.js";
import { loadAuthzContext, type AuthzContext } from "../authz/authorization.service.js";
import { env } from "../config/env.js";

export type AuthedRequest = Request & {
  authUser?: AuthUser | null;
  authz?: AuthzContext | null;
  sessionToken?: string | null;
};

function readSessionToken(req: Request): string | null {
  const fromCookie = req.cookies?.[env.auth.cookieName];
  if (typeof fromCookie === "string" && fromCookie.trim()) {
    return fromCookie.trim();
  }
  const authHeader = req.headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return bearer;
  }
  const xAccessToken = req.headers["x-access-token"];
  if (typeof xAccessToken === "string" && xAccessToken.trim()) {
    return xAccessToken.trim();
  }
  const bodyToken = (req.body as Record<string, unknown> | undefined)?.token;
  if (typeof bodyToken === "string" && bodyToken.trim()) {
    return bodyToken.trim();
  }
  const delegatedToken = (
    (req.body as Record<string, unknown> | undefined)?.user_context as
      | Record<string, unknown>
      | undefined
  )?.delegated_access_token;
  if (typeof delegatedToken === "string" && delegatedToken.trim()) {
    return delegatedToken.trim();
  }
  return null;
}

/** Attach authUser + authz when a valid session cookie or bearer token is present. Never trusts client role claims. */
export async function loadSession(
  req: AuthedRequest,
  _res: Response,
  next: NextFunction,
) {
  try {
    const token = readSessionToken(req);
    req.sessionToken = token;
    if (!token) {
      req.authUser = null;
      req.authz = null;
      next();
      return;
    }
    const user = await getUserForSessionToken(token);
    req.authUser = user;
    req.authz = user ? await loadAuthzContext(user.id) : null;
    next();
  } catch (error) {
    next(error);
  }
}

/** Reject unauthenticated requests. */
export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.authUser) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }
  next();
}
