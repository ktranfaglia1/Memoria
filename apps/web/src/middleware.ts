import { defineMiddleware } from "astro:middleware";
import { auth } from "./lib/server/auth.ts";
import { jsonError } from "./lib/server/http.ts";

/** Reachable without a browser session. The agent routes check their own token. */
const PUBLIC_PATHS = ["/sign-in", "/api/health"];
const PUBLIC_PREFIXES = ["/api/auth/", "/api/agent/"];

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "same-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=31536000",
};

export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.user = null;
  context.locals.session = null;
  // Prerendered pages are built ahead of time, with no request to check.
  if (context.isPrerendered) return next();

  const { pathname } = context.url;

  const isPublic =
    PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (!isPublic || pathname === "/sign-in") {
    const result = await auth.api.getSession({
      headers: context.request.headers,
    });
    if (result) {
      context.locals.user = result.user;
      context.locals.session = result.session;
    }
  }

  if (!isPublic && !context.locals.user) {
    if (pathname.startsWith("/api/")) return jsonError(401, "Sign in first.");
    return context.redirect("/sign-in");
  }

  const response = await next();
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (!response.headers.has(name)) response.headers.set(name, value);
  }
  return response;
});
