import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const MAX_COMMAND_OUTPUT = 32 * 1024 * 1024;

export class WranglerCommandError extends Error {
  readonly output: string;

  constructor(args: string[], status: number | null, output: string) {
    super(
      `Wrangler ${args.slice(0, 2).join(" ")} failed with exit code ${status}.`
    );
    this.name = "WranglerCommandError";
    this.output = output;
  }
}

const getWranglerPath = (projectRoot: string): string =>
  resolve(projectRoot, "node_modules", "wrangler", "bin", "wrangler.js");

export const runWranglerCapture = (
  projectRoot: string,
  args: string[],
  retries = 0
): string => {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const result = spawnSync(
      process.execPath,
      [getWranglerPath(projectRoot), ...args],
      {
        cwd: projectRoot,
        encoding: "utf8",
        maxBuffer: MAX_COMMAND_OUTPUT,
        env: { ...process.env, CI: "1" },
      }
    );

    if (result.error) {
      throw result.error;
    }

    if (result.status === 0) {
      return result.stdout;
    }

    const output = `${result.stdout}\n${result.stderr}`.trim();

    if (attempt === retries) {
      throw new WranglerCommandError(args, result.status, output);
    }
  }

  throw new Error("Wrangler retry loop ended unexpectedly.");
};

export const runWranglerMutation = (
  projectRoot: string,
  title: string,
  args: string[]
): void => {
  console.log(`\n==> ${title}`);
  const result = spawnSync(
    process.execPath,
    [getWranglerPath(projectRoot), ...args],
    {
      cwd: projectRoot,
      stdio: "inherit",
      env: { ...process.env, CI: "1" },
    }
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `Wrangler ${args.slice(0, 2).join(" ")} failed with exit code ${result.status}.`
    );
  }
};
