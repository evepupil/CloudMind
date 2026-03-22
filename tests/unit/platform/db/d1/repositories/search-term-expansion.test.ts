import { describe, expect, it } from "vitest";

import {
  expandSearchTerms,
  MAX_ASSERTION_SEARCH_TERMS,
  MAX_SUMMARY_SEARCH_TERMS,
} from "@/platform/db/d1/repositories/search-term-expansion";

describe("search term expansion", () => {
  it("caps expanded terms for summary search sized workloads", () => {
    const query = Array.from({ length: 80 }, (_, index) => `term${index}`).join(
      " "
    );

    const terms = expandSearchTerms(query, MAX_SUMMARY_SEARCH_TERMS);

    expect(terms).toHaveLength(MAX_SUMMARY_SEARCH_TERMS);
    expect(terms[0]).toBe(query.toLowerCase());
  });

  it("caps expanded terms for assertion search sized workloads", () => {
    const query = Array.from(
      { length: 100 },
      (_, index) => `token${index}`
    ).join(" ");

    const terms = expandSearchTerms(query, MAX_ASSERTION_SEARCH_TERMS);

    expect(terms).toHaveLength(MAX_ASSERTION_SEARCH_TERMS);
    expect(terms[0]).toBe(query.toLowerCase());
  });

  it("keeps common aliases before the cap is reached", () => {
    const terms = expandSearchTerms("ts mcp", 6);

    expect(terms).toEqual([
      "ts mcp",
      "ts",
      "typescript",
      "mcp",
      "model context protocol",
    ]);
  });
});
