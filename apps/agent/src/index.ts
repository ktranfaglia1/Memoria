/**
 * Memoria sync agent (runs on the home Windows PC at login).
 *
 * Phase 0 placeholder. Phase 1 adds the real loop: pull new originals from the
 * R2 inbox, verify their SHA-256, save them to the library drive, and mark
 * them archived through the API.
 */
import { loadConfig } from "./config.ts";

const config = loadConfig(process.env);

console.log(
  `Memoria agent: API ${config.apiUrl}, library ${config.libraryDir}. ` +
    "Sync arrives in Phase 1.",
);
