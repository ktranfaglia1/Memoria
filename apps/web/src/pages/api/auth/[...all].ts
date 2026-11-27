import type { APIRoute } from "astro";
import { auth } from "../../../lib/server/auth.ts";

/** Better Auth's routes: Google sign-in, callback, session, sign-out. */
export const ALL: APIRoute = ({ request }) => auth.handler(request);
