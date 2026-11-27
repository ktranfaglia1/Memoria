import { z } from "zod";

/**
 * Agent settings come from environment variables. Secrets (the agent token,
 * R2 keys) are never stored in this repo: on the PC they live in Windows
 * Credential Manager and are passed in at startup.
 */
const AgentConfig = z.object({
  apiUrl: z.url().default("https://memoria.kyletranfaglia.top"),
  libraryDir: z.string().min(1, "MEMORIA_LIBRARY_DIR is required"),
});

export type AgentConfig = z.infer<typeof AgentConfig>;

export function loadConfig(source: Record<string, string | undefined>) {
  return AgentConfig.parse({
    apiUrl: source.MEMORIA_API_URL,
    libraryDir: source.MEMORIA_LIBRARY_DIR,
  });
}
