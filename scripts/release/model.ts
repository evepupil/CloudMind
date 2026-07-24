import { z } from "zod";

const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

const d1EnvelopeSchema = z.array(
  z.object({
    results: z.array(
      z.object({
        name: z.string(),
      })
    ),
  })
);

const deploymentSchema = z.object({
  created_on: z.string(),
  versions: z.array(
    z.object({
      version_id: z.string().min(1),
      percentage: z.number(),
    })
  ),
});

const deploymentListSchema = z.array(deploymentSchema);

export interface MigrationComparison {
  missing: string[];
  unexpected: string[];
  orderMatches: boolean;
}

export const readAppliedMigrationNames = (payload: unknown): string[] =>
  d1EnvelopeSchema
    .parse(payload)
    .flatMap((envelope) => envelope.results.map((row) => row.name));

export const compareMigrationNames = (
  expected: string[],
  applied: string[]
): MigrationComparison => {
  const expectedSet = new Set(expected);
  const appliedSet = new Set(applied);

  return {
    missing: expected.filter((name) => !appliedSet.has(name)),
    unexpected: applied.filter((name) => !expectedSet.has(name)),
    orderMatches:
      expected.length === applied.length &&
      expected.every((name, index) => applied[index] === name),
  };
};

export const assertMigrationNamesMatch = (
  expected: string[],
  applied: string[]
): void => {
  const comparison = compareMigrationNames(expected, applied);

  if (
    comparison.missing.length === 0 &&
    comparison.unexpected.length === 0 &&
    comparison.orderMatches
  ) {
    return;
  }

  const details = [
    comparison.missing.length > 0
      ? `missing=${comparison.missing.join(",")}`
      : undefined,
    comparison.unexpected.length > 0
      ? `unexpected=${comparison.unexpected.join(",")}`
      : undefined,
    !comparison.orderMatches ? "order=mismatch" : undefined,
  ].filter((value): value is string => Boolean(value));

  throw new Error(`Remote D1 migration state mismatch: ${details.join("; ")}.`);
};

export const getStableProductionVersion = (payload: unknown): string => {
  const deployment = deploymentSchema.parse(payload);
  const activeVersions = deployment.versions.filter(
    (version) => version.percentage > 0
  );

  if (activeVersions.length !== 1 || activeVersions[0]?.percentage !== 100) {
    throw new Error(
      "Production uses split traffic; automatic rollback requires one 100% version."
    );
  }

  const versionId = activeVersions[0]?.version_id;

  if (!versionId) {
    throw new Error("Production deployment has no active version.");
  }

  return versionId;
};

export interface RollbackPair {
  currentVersionId: string;
  previousVersionId: string;
}

export const getRollbackPair = (payload: unknown): RollbackPair => {
  const deployments = [...deploymentListSchema.parse(payload)].sort(
    (left, right) => left.created_on.localeCompare(right.created_on)
  );
  const currentDeployment = deployments.at(-1);

  if (!currentDeployment) {
    throw new Error("At least two stable production versions are required.");
  }

  const currentVersionId = getStableProductionVersion(currentDeployment);
  const previousVersionId = deployments
    .slice(0, -1)
    .reverse()
    .map((deployment) => {
      try {
        return getStableProductionVersion(deployment);
      } catch {
        return undefined;
      }
    })
    .filter((versionId): versionId is string => Boolean(versionId))
    .find((versionId) => versionId !== currentVersionId);

  if (!previousVersionId) {
    throw new Error("At least two stable production versions are required.");
  }

  return { currentVersionId, previousVersionId };
};

export const validateReleaseMetadata = (
  version: string,
  changelog: string
): void => {
  if (!SEMVER_PATTERN.test(version)) {
    throw new Error(`Package version is not valid SemVer: ${version}.`);
  }

  const escapedVersion = version.replaceAll(".", "\\.");
  const releaseHeading = new RegExp(
    `^## \\[${escapedVersion}\\] - \\d{4}-\\d{2}-\\d{2}$`,
    "m"
  );

  if (!releaseHeading.test(changelog)) {
    throw new Error(`CHANGELOG.md has no dated entry for ${version}.`);
  }
};
