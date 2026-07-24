import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const temporaryDirectories: string[] = [];
const scriptPath = join(process.cwd(), "scripts", "ops", "rescope-vectors.mjs");

const createInput = (value: unknown): string => {
  const directory = mkdtempSync(join(tmpdir(), "cloudmind-vectors-"));
  temporaryDirectories.push(directory);
  const inputPath = join(directory, "vectors.json");
  writeFileSync(inputPath, JSON.stringify(value), "utf8");
  return inputPath;
};

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("rescope-vectors", () => {
  it("补齐三维 metadata，同时保留向量值和已有 metadata", () => {
    const inputPath = createInput([
      {
        id: "vector-1",
        values: [0.1, 0.2],
        metadata: { domain: "engineering", scopeId: "personal" },
      },
    ]);
    const output = execFileSync(
      process.execPath,
      [
        scriptPath,
        inputPath,
        "--scope-id",
        "personal",
        "--context-key",
        "global",
        "--record-kind",
        "library",
      ],
      { encoding: "utf8" }
    );

    expect(JSON.parse(output.trim())).toEqual({
      id: "vector-1",
      values: [0.1, 0.2],
      metadata: {
        domain: "engineering",
        scopeId: "personal",
        contextKey: "global",
        recordKind: "library",
      },
    });
  });

  it("遇到已有冲突值时中止", () => {
    const inputPath = createInput([
      {
        id: "vector-2",
        values: [0.3],
        metadata: { contextKey: "project:github:evepupil/CloudMind" },
      },
    ]);

    expect(() =>
      execFileSync(
        process.execPath,
        [scriptPath, inputPath, "--context-key", "global"],
        { encoding: "utf8", stdio: "pipe" }
      )
    ).toThrow();
  });
});
