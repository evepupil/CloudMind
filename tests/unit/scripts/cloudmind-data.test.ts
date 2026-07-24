import { describe, expect, it } from "vitest";

import {
  parseDataPackageCliOptions,
  resolveResourceNames,
} from "../../../scripts/ops/data-package/options";
import { parseWranglerJson } from "../../../scripts/ops/data-package/wrangler";

const configured = {
  database: "configured-db",
  bucket: "configured-bucket",
  assetIndex: "configured-assets",
  graphIndex: "configured-graph",
};

describe("CloudMind data CLI options", () => {
  it("requires an explicit local or remote mode for export", () => {
    expect(() =>
      parseDataPackageCliOptions(["export", "--output", "backup"])
    ).toThrow("Choose --remote or --local explicitly");
  });

  it("requires explicit restore target resources", () => {
    const options = parseDataPackageCliOptions([
      "restore",
      "--package",
      "backup",
      "--remote",
    ]);

    expect(() => resolveResourceNames(options, configured)).toThrow(
      "Restore requires explicit"
    );
  });

  it("uses configured source resources for export", () => {
    const options = parseDataPackageCliOptions([
      "export",
      "--output",
      "backup",
      "--remote",
    ]);

    expect(resolveResourceNames(options, configured)).toEqual(configured);
  });
});

describe("Wrangler JSON parsing", () => {
  it("extracts JSON after a progress line", () => {
    expect(
      parseWranglerJson('Fetching vectors...\n[{"id":"vector-1","values":[1]}]')
    ).toEqual([{ id: "vector-1", values: [1] }]);
  });
});
