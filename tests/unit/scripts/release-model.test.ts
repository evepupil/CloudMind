import { describe, expect, it } from "vitest";

import {
  assertMigrationNamesMatch,
  compareMigrationNames,
  getRollbackPair,
  getStableProductionVersion,
  readAppliedMigrationNames,
  validateReleaseMetadata,
} from "../../../scripts/release/model.ts";

describe("release migration state", () => {
  it("reads D1 migration names and accepts an exact ordered match", () => {
    const applied = readAppliedMigrationNames([
      { results: [{ name: "0001_init.sql" }, { name: "0002_scope.sql" }] },
    ]);

    expect(applied).toEqual(["0001_init.sql", "0002_scope.sql"]);
    expect(() => assertMigrationNamesMatch(applied, applied)).not.toThrow();
  });

  it("reports missing, unexpected, and reordered migrations", () => {
    expect(
      compareMigrationNames(
        ["0001_init.sql", "0002_scope.sql"],
        ["0002_scope.sql", "0003_unknown.sql"]
      )
    ).toEqual({
      missing: ["0001_init.sql"],
      unexpected: ["0003_unknown.sql"],
      orderMatches: false,
    });
  });
});

describe("release deployment state", () => {
  it("selects a single production version at 100 percent traffic", () => {
    expect(
      getStableProductionVersion({
        created_on: "2026-07-24T10:00:00Z",
        versions: [{ version_id: "current", percentage: 100 }],
      })
    ).toBe("current");
  });

  it("rejects split traffic before automatic rollback", () => {
    expect(() =>
      getStableProductionVersion({
        created_on: "2026-07-24T10:00:00Z",
        versions: [
          { version_id: "old", percentage: 50 },
          { version_id: "new", percentage: 50 },
        ],
      })
    ).toThrow("split traffic");
  });

  it("rejects rollback rehearsal when the latest deployment uses split traffic", () => {
    expect(() =>
      getRollbackPair([
        {
          created_on: "2026-07-24T10:00:00Z",
          versions: [{ version_id: "old", percentage: 100 }],
        },
        {
          created_on: "2026-07-24T11:00:00Z",
          versions: [
            { version_id: "old", percentage: 50 },
            { version_id: "new", percentage: 50 },
          ],
        },
      ])
    ).toThrow("split traffic");
  });

  it("finds the two newest distinct stable versions", () => {
    expect(
      getRollbackPair([
        {
          created_on: "2026-07-24T10:00:00Z",
          versions: [{ version_id: "old", percentage: 100 }],
        },
        {
          created_on: "2026-07-24T11:00:00Z",
          versions: [{ version_id: "current", percentage: 100 }],
        },
      ])
    ).toEqual({
      currentVersionId: "current",
      previousVersionId: "old",
    });
  });

  it("uses the deployment before the latest occurrence of the current version", () => {
    expect(
      getRollbackPair([
        {
          created_on: "2026-07-24T09:00:00Z",
          versions: [{ version_id: "current", percentage: 100 }],
        },
        {
          created_on: "2026-07-24T10:00:00Z",
          versions: [{ version_id: "previous", percentage: 100 }],
        },
        {
          created_on: "2026-07-24T11:00:00Z",
          versions: [{ version_id: "current", percentage: 100 }],
        },
      ])
    ).toEqual({
      currentVersionId: "current",
      previousVersionId: "previous",
    });
  });
});

describe("release version metadata", () => {
  it("accepts SemVer with a matching dated changelog entry", () => {
    expect(() =>
      validateReleaseMetadata(
        "0.3.0",
        "# Changelog\n\n## [0.3.0] - 2026-07-24\n"
      )
    ).not.toThrow();
  });

  it("rejects missing changelog entries", () => {
    expect(() => validateReleaseMetadata("0.3.0", "# Changelog\n")).toThrow(
      "no dated entry"
    );
  });
});
