import { describe, expect, it, vi } from "vitest";

import { VectorizeStore } from "@/platform/vector/vectorize/vectorize-store";

describe("VectorizeStore.search", () => {
  it("forwards a native metadata filter to the Vectorize index query", async () => {
    const query = vi.fn(async (_values: number[], _options: unknown) => ({
      matches: [],
    }));
    const store = new VectorizeStore({ query } as unknown as Vectorize);

    await store.search({
      values: [0.1, 0.2],
      topK: 5,
      filter: {
        aiVisibility: { $eq: "allow" },
        domain: { $eq: "engineering" },
      },
    });

    expect(query).toHaveBeenCalledTimes(1);
    const options = query.mock.calls[0]?.[1] as
      | { topK?: number; filter?: unknown }
      | undefined;
    expect(options?.topK).toBe(5);
    expect(options?.filter).toMatchObject({
      aiVisibility: { $eq: "allow" },
      domain: { $eq: "engineering" },
    });
  });

  it("omits the filter when none is provided", async () => {
    const query = vi.fn(async (_values: number[], _options: unknown) => ({
      matches: [],
    }));
    const store = new VectorizeStore({ query } as unknown as Vectorize);

    await store.search({ values: [0.1], topK: 3 });

    const options = query.mock.calls[0]?.[1] as
      | { filter?: unknown }
      | undefined;
    expect(options?.filter).toBeUndefined();
  });
});
