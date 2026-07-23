import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse, printParseErrorCode } from "jsonc-parser";

const projectRoot = process.cwd();

const readJson = (path) => {
  return JSON.parse(readFileSync(resolve(projectRoot, path), "utf8"));
};

const readJsonc = (path) => {
  const errors = [];
  const parsed = parse(
    readFileSync(resolve(projectRoot, path), "utf8"),
    errors
  );

  if (errors.length > 0 || !parsed || typeof parsed !== "object") {
    const error = errors[0];
    const detail = error ? printParseErrorCode(error.error) : "invalid root";

    throw new Error(`${path} cannot be parsed: ${detail}.`);
  }

  return parsed;
};

const asStringArray = (value, label) => {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${label} must be an array of strings.`);
  }

  return value;
};

const config = readJsonc("wrangler.jsonc");
const secretManifest = readJson("config/worker-secrets.json");
const requiredSecrets = asStringArray(
  secretManifest.required,
  "worker-secrets.required"
);
const optionalSecrets = asStringArray(
  secretManifest.optional,
  "worker-secrets.optional"
);
const secretNames = [...requiredSecrets, ...optionalSecrets];
const failures = [];

if (new Set(secretNames).size !== secretNames.length) {
  failures.push(
    "Secret names must be unique across required and optional lists."
  );
}

for (const name of secretNames) {
  if (!/^[A-Z][A-Z0-9_]*$/.test(name)) {
    failures.push(`Secret name ${name} must use upper snake case.`);
  }
}

const vars = config.vars;

if (vars && typeof vars === "object") {
  for (const name of secretNames) {
    if (Object.hasOwn(vars, name)) {
      failures.push(`${name} must not be stored in wrangler.jsonc vars.`);
    }
  }

  for (const [name, value] of Object.entries(vars)) {
    if (
      /(SECRET|TOKEN|PASSWORD|API_KEY|PRIVATE_KEY)$/i.test(name) &&
      typeof value === "string"
    ) {
      failures.push(`${name} looks sensitive and must use a secret binding.`);
    }
  }
}

const consumers = config.queues?.consumers;

if (!Array.isArray(consumers) || consumers.length === 0) {
  failures.push("At least one queue consumer must be configured.");
} else {
  for (const consumer of consumers) {
    if (
      !consumer ||
      typeof consumer !== "object" ||
      typeof consumer.queue !== "string"
    ) {
      failures.push("Every queue consumer must define a queue name.");
      continue;
    }

    if (
      typeof consumer.dead_letter_queue !== "string" ||
      consumer.dead_letter_queue.length === 0
    ) {
      failures.push(`Queue ${consumer.queue} must define a dead letter queue.`);
    } else if (consumer.dead_letter_queue === consumer.queue) {
      failures.push(`Queue ${consumer.queue} cannot use itself as its DLQ.`);
    }
  }
}

const gitignore = readFileSync(resolve(projectRoot, ".gitignore"), "utf8");

for (const pattern of [".dev.vars*", ".env*"]) {
  if (!gitignore.split(/\r?\n/u).includes(pattern)) {
    failures.push(`.gitignore must contain ${pattern}.`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  process.exitCode = 1;
} else {
  console.log(
    `Worker config valid: ${requiredSecrets.length} required secret(s), ` +
      `${optionalSecrets.length} optional secret(s), ${consumers.length} ` +
      "queue consumer(s) with DLQ."
  );
}
