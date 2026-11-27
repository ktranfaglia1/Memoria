import { createAuthClient } from "better-auth/client";

/** Talks to Better Auth's routes on the same origin (/api/auth/*). */
export const authClient = createAuthClient();
