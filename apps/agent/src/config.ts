import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";

/**
 * Settings come from a JSON file (default: apps/agent/config.json, git-ignored;
 * see config.example.json), with environment variables taking precedence.
 * The token is a secret: keep the file in a folder only your Windows user can read.
 */
const AgentConfig = z.object({
  apiUrl: z.url().default("https://memoria.kyletranfaglia.top"),
  libraryDir: z.string().min(1, "libraryDir (MEMORIA_LIBRARY_DIR) is required"),
  token: z.string().min(32, "token (MEMORIA_AGENT_TOKEN) is required"),
  pollMinutes: z.coerce
    .number()
    .min(1)
    .max(24 * 60)
    .default(5),
});

export type AgentConfig = z.infer<typeof AgentConfig>;

export const DEFAULT_CONFIG_PATH = fileURLToPath(
  new URL("../config.json", import.meta.url),
);

export function readConfigFile(path: string): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw new Error(`Couldn't read ${path}: ${(error as Error).message}`, {
      cause: error,
    });
  }
}

export function loadConfig(
  env: Record<string, string | undefined>,
  file: Record<string, unknown> = {},
): AgentConfig {
  return AgentConfig.parse({
    ...file,
    ...(env.MEMORIA_API_URL && { apiUrl: env.MEMORIA_API_URL }),
    ...(env.MEMORIA_LIBRARY_DIR && { libraryDir: env.MEMORIA_LIBRARY_DIR }),
    ...(env.MEMORIA_AGENT_TOKEN && { token: env.MEMORIA_AGENT_TOKEN }),
    ...(env.MEMORIA_POLL_MINUTES && { pollMinutes: env.MEMORIA_POLL_MINUTES }),
  });
}
