/**
 * Memoria sync agent. Runs on the home Windows PC at login (Task Scheduler):
 * every few minutes it saves new photos from the cloud inbox to the library
 * drive, verifying each one's SHA-256.
 *
 *   node src/index.ts          keep running
 *   node src/index.ts --once   one pass, then exit (exit code 1 if any failed)
 */
import { setTimeout as sleep } from "node:timers/promises";
import exifr from "exifr";
import { HttpAgentApi } from "./api.ts";
import { DEFAULT_CONFIG_PATH, loadConfig, readConfigFile } from "./config.ts";
import { syncOnce, type ReadTakenAt } from "./sync.ts";

const log = (message: string) =>
  console.log(`${new Date().toISOString()} ${message}`);

const readTakenAt: ReadTakenAt = async (path) => {
  const tags = (await exifr.parse(path, {
    pick: ["DateTimeOriginal", "CreateDate"],
  })) as { DateTimeOriginal?: Date; CreateDate?: Date } | undefined;
  const date = tags?.DateTimeOriginal ?? tags?.CreateDate;
  return date instanceof Date && !Number.isNaN(date.getTime())
    ? date.getTime()
    : null;
};

const config = loadConfig(
  process.env,
  readConfigFile(process.env.MEMORIA_CONFIG ?? DEFAULT_CONFIG_PATH),
);
const api = new HttpAgentApi(config.apiUrl, config.token);
const once = process.argv.includes("--once");

log(
  `Memoria agent started: API ${config.apiUrl}, library ${config.libraryDir}`,
);

let stopping = false;
const controller = new AbortController();
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    stopping = true;
    controller.abort();
  });
}

let failures = 0;
while (!stopping) {
  try {
    const result = await syncOnce(api, config.libraryDir, readTakenAt, log);
    if (result.saved > 0 || result.failed > 0) {
      log(`sync done: ${result.saved} saved, ${result.failed} failed`);
    }
    failures = 0;
    if (once) process.exitCode = result.failed > 0 ? 1 : 0;
  } catch (error) {
    // Usually offline or the PC just woke up. Back off, up to the normal interval.
    failures++;
    log(`sync error: ${(error as Error).message}`);
    if (once) process.exitCode = 1;
  }
  if (once) break;

  const delayMs = Math.min(
    config.pollMinutes * 60_000,
    failures > 0 ? 15_000 * 2 ** failures : Infinity,
  );
  await sleep(delayMs, undefined, { signal: controller.signal }).catch(
    () => {},
  );
}
log("Memoria agent stopped");
