import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const NPX = process.platform === "win32" ? "npx.cmd" : "npx";
const NPM = process.platform === "win32" ? "npm.cmd" : "npm";

const projectRoot = process.cwd();
const wranglerConfigPath = join(projectRoot, "wrangler.jsonc");
const wranglerBackupPath = join(projectRoot, "wrangler.backup.jsonc");

const parseArgs = () => {
  const args = process.argv.slice(2);
  const result = {
    prefix: "",
    location: "apac",
    vectorDim: 1024,
    bootstrapOnly: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--prefix") {
      result.prefix = args[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (argument === "--location") {
      result.location = args[index + 1] ?? "apac";
      index += 1;
      continue;
    }

    if (argument === "--vector-dim") {
      const parsedValue = Number.parseInt(args[index + 1] ?? "", 10);

      if (Number.isFinite(parsedValue) && parsedValue > 0) {
        result.vectorDim = parsedValue;
      }

      index += 1;
      continue;
    }

    if (argument === "--bootstrap-only") {
      result.bootstrapOnly = true;
    }
  }

  return result;
};

const normalizePrefix = (rawPrefix) => {
  const normalized = rawPrefix
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);

  if (normalized.length > 0) {
    return normalized;
  }

  const fallbackSuffix = Date.now().toString(36).slice(-6);

  return `cloudmind-${fallbackSuffix}`;
};

const readWranglerConfig = (filePath) => {
  const content = readFileSync(filePath, "utf8");

  return JSON.parse(content);
};

const writeWranglerConfig = (filePath, config) => {
  writeFileSync(filePath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
};

const runCommand = (title, command, args) => {
  console.log(`\n==> ${title}`);
  execFileSync(command, args, {
    cwd: projectRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      CI: "1",
    },
  });
};

const ensureBootstrapConfig = (queueName, workerName) => {
  const config = readWranglerConfig(wranglerConfigPath);

  config.name = workerName;
  config.d1_databases = [];
  config.r2_buckets = [];
  config.vectorize = [];
  config.queues = {
    producers: [
      {
        queue: queueName,
        binding: "WORKFLOW_QUEUE",
      },
    ],
    consumers: [
      {
        queue: queueName,
        max_batch_size: 1,
        max_batch_timeout: 1,
        max_retries: 3,
      },
    ],
  };

  writeWranglerConfig(wranglerConfigPath, config);
};

const ensureFinalConfig = (queueName) => {
  const config = readWranglerConfig(wranglerConfigPath);

  const d1Databases = Array.isArray(config.d1_databases)
    ? config.d1_databases
    : [];

  config.d1_databases = d1Databases.map((database) => ({
    ...database,
    migrations_dir: "drizzle",
  }));
  config.queues = {
    producers: [
      {
        queue: queueName,
        binding: "WORKFLOW_QUEUE",
      },
    ],
    consumers: [
      {
        queue: queueName,
        max_batch_size: 1,
        max_batch_timeout: 1,
        max_retries: 3,
      },
    ],
  };

  writeWranglerConfig(wranglerConfigPath, config);
};

const main = () => {
  const options = parseArgs();
  const workerPrefix = normalizePrefix(options.prefix);
  const workerName = workerPrefix;
  const databaseName = `${workerPrefix}-db`;
  const bucketName = `${workerPrefix}-assets`;
  const vectorIndexName = `${workerPrefix}-vectors`;
  const queueName = `${workerPrefix}-workflows`;

  writeFileSync(
    wranglerBackupPath,
    readFileSync(wranglerConfigPath, "utf8"),
    "utf8"
  );

  ensureBootstrapConfig(queueName, workerName);

  runCommand("检查 Cloudflare 登录状态", NPX, ["wrangler", "whoami"]);

  runCommand("创建 D1 数据库并回写绑定", NPX, [
    "wrangler",
    "d1",
    "create",
    databaseName,
    "--location",
    options.location,
    "--update-config",
    "--binding",
    "DB",
  ]);

  runCommand("创建 R2 存储桶并回写绑定", NPX, [
    "wrangler",
    "r2",
    "bucket",
    "create",
    bucketName,
    "--location",
    options.location,
    "--update-config",
    "--binding",
    "ASSET_FILES",
  ]);

  runCommand("创建 Vectorize 索引并回写绑定", NPX, [
    "wrangler",
    "vectorize",
    "create",
    vectorIndexName,
    "--dimensions",
    `${options.vectorDim}`,
    "--metric",
    "cosine",
    "--update-config",
    "--binding",
    "ASSET_VECTORS",
  ]);

  runCommand("创建 Queue", NPX, ["wrangler", "queues", "create", queueName]);

  ensureFinalConfig(queueName);

  if (options.bootstrapOnly) {
    runCommand("应用 D1 迁移", NPM, ["run", "db:migrate:remote"]);
    console.log("\n✅ Cloudflare 资源初始化完成。后续可执行 npm run deploy。");
    return;
  }

  runCommand("执行标准部署流程", NPM, ["run", "deploy"]);

  console.log("\n✅ 一键部署完成。\n");
  console.log(`- Worker 名称: ${workerName}`);
  console.log(`- D1: ${databaseName}`);
  console.log(`- R2: ${bucketName}`);
  console.log(`- Vectorize: ${vectorIndexName}`);
  console.log(`- Queue: ${queueName}`);
};

main();
