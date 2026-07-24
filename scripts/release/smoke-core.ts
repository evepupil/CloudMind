export interface SmokeOptions {
  baseUrl: string;
  fetcher?: typeof fetch;
  attempts?: number;
  retryDelayMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
}

const defaultSleep = (milliseconds: number): Promise<void> =>
  new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));

const normalizeBaseUrl = (value: string): string => value.replace(/\/$/, "");

const fetchHealth = async (
  baseUrl: string,
  fetcher: typeof fetch
): Promise<void> => {
  const response = await fetcher(`${baseUrl}/api/health`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Health check returned HTTP ${response.status}.`);
  }

  const payload: unknown = await response.json();

  if (
    typeof payload !== "object" ||
    payload === null ||
    !("ok" in payload) ||
    payload.ok !== true ||
    !("service" in payload) ||
    payload.service !== "cloudmind"
  ) {
    throw new Error("Health check returned an unexpected payload.");
  }
};

export const runProductionSmoke = async (
  options: SmokeOptions
): Promise<void> => {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const fetcher = options.fetcher ?? fetch;
  const attempts = options.attempts ?? 6;
  const retryDelayMs = options.retryDelayMs ?? 2_000;
  const sleep = options.sleep ?? defaultSleep;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await fetchHealth(baseUrl, fetcher);
      lastError = undefined;
      break;
    } catch (error) {
      lastError = error;

      if (attempt < attempts) {
        await sleep(retryDelayMs);
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  const loginResponse = await fetcher(`${baseUrl}/login`, {
    headers: { accept: "text/html" },
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
  });

  if (
    loginResponse.status !== 200 ||
    !loginResponse.headers.get("content-type")?.includes("text/html")
  ) {
    throw new Error(`Login page returned HTTP ${loginResponse.status}.`);
  }

  const mcpResponse = await fetcher(`${baseUrl}/mcp`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "release-smoke",
      method: "tools/list",
      params: {},
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (mcpResponse.status !== 401) {
    throw new Error(
      `Unauthenticated MCP boundary returned HTTP ${mcpResponse.status}.`
    );
  }
};
