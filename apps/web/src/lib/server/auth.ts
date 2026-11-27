import { env } from "cloudflare:workers";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq } from "drizzle-orm";
import { db } from "./db.ts";
import {
  accounts,
  allowedEmails,
  sessions,
  users,
  verifications,
} from "./schema.ts";

/** Google sign-in only, limited to the emails in the allowed_emails table. */
export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
    },
  }),
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      prompt: "select_account",
    },
  },
  user: {
    // Runs before an account is created, linked, or signed in with Google,
    // using the email Google reports right now.
    async validateUserInfo({ user }) {
      const email = typeof user.email === "string" ? user.email : "";
      if (!email || user.emailVerified === false || !(await isAllowed(email))) {
        return {
          error: "not_allowed",
          errorDescription: "This Google account doesn't have access.",
        };
      }
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refreshed at most once a day
    // Keep a signed copy of the session in a cookie for 5 minutes, so most
    // requests skip the D1 lookup.
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  onAPIError: { errorURL: "/sign-in" },
  advanced: {
    ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
  },
  telemetry: { enabled: false },
});

async function isAllowed(email: string): Promise<boolean> {
  const row = await db
    .select({ email: allowedEmails.email })
    .from(allowedEmails)
    .where(eq(allowedEmails.email, email.toLowerCase()))
    .get();
  return row !== undefined;
}
