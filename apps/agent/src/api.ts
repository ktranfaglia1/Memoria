import {
  AgentQueueResponse,
  type ArchivedRequest,
  type QueuedPhoto,
} from "@memoria/shared";

/** What the sync loop needs from the server. A fake implements it in tests. */
export interface AgentApi {
  queue(): Promise<QueuedPhoto[]>;
  download(id: string): Promise<ReadableStream<Uint8Array>>;
  markArchived(id: string, body: ArchivedRequest): Promise<void>;
}

export class HttpAgentApi implements AgentApi {
  readonly #baseUrl: string;
  readonly #token: string;

  constructor(baseUrl: string, token: string) {
    this.#baseUrl = baseUrl.replace(/\/$/, "");
    this.#token = token;
  }

  async #fetch(path: string, init: RequestInit = {}): Promise<Response> {
    const response = await fetch(`${this.#baseUrl}${path}`, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${this.#token}` },
      signal: AbortSignal.timeout(10 * 60 * 1000),
    });
    if (!response.ok) {
      let detail = response.statusText;
      try {
        detail =
          ((await response.json()) as { error?: string }).error ?? detail;
      } catch {
        // keep statusText
      }
      throw new Error(
        `${init.method ?? "GET"} ${path}: ${response.status} ${detail}`,
      );
    }
    return response;
  }

  async queue(): Promise<QueuedPhoto[]> {
    const response = await this.#fetch("/api/agent/queue");
    return AgentQueueResponse.parse(await response.json()).photos;
  }

  async download(id: string): Promise<ReadableStream<Uint8Array>> {
    const response = await this.#fetch(`/api/agent/photos/${id}/original`);
    if (!response.body) throw new Error(`Empty download for ${id}`);
    return response.body;
  }

  async markArchived(id: string, body: ArchivedRequest): Promise<void> {
    await this.#fetch(`/api/agent/photos/${id}/archived`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }
}
