# Memoria sync agent

Runs on the home Windows PC. Every few minutes it asks the API for photos waiting in the cloud inbox, downloads each one, checks its SHA-256, saves it to the library folder, and reports it as saved. The PC only makes outgoing HTTPS requests; nothing on it is exposed to the internet.

## What it writes

```
<libraryDir>/
  Photos/2026/2026-11-27_<id>.heic        the original, byte for byte
  Photos/2026/2026-11-27_<id>.heic.json   sidecar: hash, original name, dates
  .memoria-tmp/                           in-progress downloads (safe to ignore)
```

Photos are filed by the date taken from their EXIF data, or by the upload date when they have none.

## Safety rules

- A photo counts as saved only after the file on disk is read back and its SHA-256 matches the upload.
- An existing file with different contents is never overwritten.
- If the PC crashes or goes offline partway through, the next run finishes the job; nothing is lost or saved twice.
- The cloud copy is kept. It is deleted only once a WD backup also holds the photo (Phase 2).

## Setup on Windows

1. Install Node.js 26 and pnpm 12, clone the repo, and run `pnpm install`.
2. Create a token, then run the command it prints (from `apps/web`) to register its hash:
   ```
   pnpm --filter @memoria/agent token:new home-pc
   ```
3. Copy `config.example.json` to `config.json` (git-ignored) and fill in `libraryDir` and `token`.
4. Test one pass: `pnpm --filter @memoria/agent sync:once`
5. Run it at login with Task Scheduler: **Create Task**, trigger **At log on** (your user), action **Start a program** → `scripts\run-agent.cmd` in this folder. Under **Settings**, turn off "Stop the task if it runs longer than".

Logs go to `%LOCALAPPDATA%\Memoria\agent.log`.

## Configuration

| `config.json` | Environment variable   | Default                              |
| ------------- | ---------------------- | ------------------------------------ |
| `apiUrl`      | `MEMORIA_API_URL`      | `https://memoria.kyletranfaglia.top` |
| `libraryDir`  | `MEMORIA_LIBRARY_DIR`  | required                             |
| `token`       | `MEMORIA_AGENT_TOKEN`  | required                             |
| `pollMinutes` | `MEMORIA_POLL_MINUTES` | `5`                                  |

`MEMORIA_CONFIG` points to a config file somewhere else. To revoke a token, set `revoked_at` on its row in `agent_tokens`.
