import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

export const hashFile = async (
  filePath: string
): Promise<{ sha256: string; size: number }> => {
  const digest = createHash("sha256");

  await new Promise<void>((resolvePromise, rejectPromise) => {
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => digest.update(chunk));
    stream.on("error", rejectPromise);
    stream.on("end", resolvePromise);
  });

  const fileStat = await stat(filePath);

  return {
    sha256: digest.digest("hex"),
    size: fileStat.size,
  };
};

export const resolvePackageFile = (
  packageRoot: string,
  packagePath: string
): string => {
  const root = resolve(packageRoot);
  const target = resolve(root, ...packagePath.split("/"));
  const relativePath = relative(root, target);

  if (
    isAbsolute(relativePath) ||
    relativePath === ".." ||
    relativePath.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)
  ) {
    throw new Error(`Package path escapes its root: ${packagePath}.`);
  }

  return target;
};
