import { parseWranglerJson } from "../ops/data-package/wrangler.ts";
import { runWranglerCapture, WranglerCommandError } from "./command.ts";
import {
  getRollbackPair,
  getStableProductionVersion,
  type RollbackPair,
} from "./model.ts";

export const getCurrentProductionVersion = (
  projectRoot: string
): string | null => {
  try {
    const output = runWranglerCapture(
      projectRoot,
      ["deployments", "status", "--json"],
      2
    );

    return getStableProductionVersion(parseWranglerJson(output));
  } catch (error) {
    if (
      error instanceof WranglerCommandError &&
      /has no deployments/i.test(error.output)
    ) {
      return null;
    }

    throw error;
  }
};

export const getProductionRollbackPair = (
  projectRoot: string
): RollbackPair => {
  const output = runWranglerCapture(
    projectRoot,
    ["deployments", "list", "--json"],
    2
  );

  return getRollbackPair(parseWranglerJson(output));
};
