/**
 * Creates a sync-agent token. Prints the token (for the agent's config.json)
 * and the command that stores its hash in D1. Only the hash ever reaches the
 * server, and nothing here is written to disk.
 *
 *   node src/new-token.ts [name]
 */
import { createHash, randomBytes } from "node:crypto";

const name = (process.argv[2] ?? "home-pc").replace(/[^\w-]/g, "");
const token = randomBytes(32).toString("base64url");
const hash = createHash("sha256").update(token).digest("hex");
const id = randomBytes(8).toString("hex");

console.log(`Token (put this in the agent's config.json as "token"; it is shown once):

  ${token}

Register it (run in apps/web):

  pnpm exec wrangler d1 execute memoria --remote --command "INSERT INTO agent_tokens (id, name, token_hash, created_at) VALUES ('${id}', '${name}', '${hash}', ${Date.now()})"

Use --local instead of --remote for local development.
`);
