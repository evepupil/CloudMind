import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppEnv } from "@/env";
import * as lifecycleService from "@/features/memory/server/lifecycle-service";
import type { MemoryManagementListView } from "@/features/memory/server/management-service";
import * as managementService from "@/features/memory/server/management-service";
import { registerMemoryRoutes } from "@/features/memory/server/routes";

vi.mock("@/features/memory/server/memory-browse-service", () => ({
  getConsolidationView: vi.fn(),
  getGraphView: vi.fn(),
  getTimelineView: vi.fn(),
}));

vi.mock("@/features/memory/server/lifecycle-service", () => ({
  forgetMemory: vi.fn(),
  restoreMemory: vi.fn(),
  updateMemory: vi.fn(),
}));

vi.mock("@/features/memory/server/management-service", () => ({
  getManagedMemory: vi.fn(),
  listManagedRecords: vi.fn(),
}));

const createApp = () => {
  const app = new Hono<AppEnv>();
  registerMemoryRoutes(app);
  return app;
};

const env = { APP_NAME: "cloudmind-test" };
const contextKey = "project:github:evepupil/CloudMind";

describe("memory management routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes repeated three-axis filters to the management service", async () => {
    const view: MemoryManagementListView = {
      items: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      contexts: [],
      filters: {
        recordKinds: ["library", "memory"],
        scopeIds: ["personal", "agent"],
        contextKeys: [contextKey],
      },
    };
    vi.mocked(managementService.listManagedRecords).mockResolvedValue(view);
    const params = new URLSearchParams();
    params.append("recordKinds", "library");
    params.append("recordKinds", "memory");
    params.append("scopeIds", "personal");
    params.append("scopeIds", "agent");
    params.append("contextKeys", contextKey);

    const response = await createApp().request(
      `/api/memory/manage?${params.toString()}`,
      undefined,
      env
    );

    expect(response.status).toBe(200);
    expect(managementService.listManagedRecords).toHaveBeenCalledWith(env, {
      recordKinds: ["library", "memory"],
      scopeIds: ["personal", "agent"],
      contextKeys: [contextKey],
    });
  });

  it("creates a new version through the dedicated lifecycle service", async () => {
    vi.mocked(lifecycleService.updateMemory).mockResolvedValue({
      previous: { id: "memory-v1" },
      current: { id: "memory-v2" },
    } as Awaited<ReturnType<typeof lifecycleService.updateMemory>>);
    const body = new URLSearchParams({
      scopeId: "agent",
      contextKey,
      title: "M3-A3 complete",
      content: "M3-A3 Web management is complete.",
    });

    const response = await createApp().request(
      "/memory/agent/actions/memory-v1/update",
      { method: "POST", body },
      env
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "/memory/agent/memory-v2?updated=1"
    );
    expect(lifecycleService.updateMemory).toHaveBeenCalledWith(env, {
      id: "memory-v1",
      scopeId: "agent",
      contextKey,
      title: "M3-A3 complete",
      content: "M3-A3 Web management is complete.",
    });
  });

  it("forgets with the exact scope and project context", async () => {
    vi.mocked(lifecycleService.forgetMemory).mockResolvedValue({
      item: { id: "memory-v1" },
      vectorCleanupPending: false,
    } as Awaited<ReturnType<typeof lifecycleService.forgetMemory>>);
    const body = new URLSearchParams({ scopeId: "agent", contextKey });

    const response = await createApp().request(
      "/memory/agent/actions/memory-v1/forget",
      { method: "POST", body },
      env
    );

    expect(response.status).toBe(303);
    expect(lifecycleService.forgetMemory).toHaveBeenCalledWith(env, {
      id: "memory-v1",
      scopeId: "agent",
      contextKey,
    });
  });

  it("rejects restore when the project context is missing", async () => {
    const body = new URLSearchParams({ scopeId: "agent" });

    const response = await createApp().request(
      "/memory/agent/actions/memory-v1/restore",
      { method: "POST", body },
      env
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("error=");
    expect(lifecycleService.restoreMemory).not.toHaveBeenCalled();
  });
});
