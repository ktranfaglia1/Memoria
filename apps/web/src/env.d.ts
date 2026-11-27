declare namespace App {
  interface Locals {
    /** Set by src/middleware.ts for signed-in requests. */
    user: import("better-auth").User | null;
    session: import("better-auth").Session | null;
  }
}
