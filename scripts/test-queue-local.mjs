import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const root = fileURLToPath(new URL("../", import.meta.url));
const docker = process.env.DOCKER_BIN || "docker";
const id = `pawsrescue-test-${randomUUID().slice(0, 8)}`;
const database = `${id}-db`;
const redis = `${id}-redis`;

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, ...options });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve(stdout.trim())
        : reject(
            new Error(
              `${command} ${args[0]} failed (${code}): ${stderr.trim()}`,
            ),
          ),
    );
  });
}

async function waitFor(name, command) {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    try {
      await run(docker, ["exec", name, ...command]);
      return;
    } catch {
      await delay(500);
    }
  }
  throw new Error(`${name} did not become ready`);
}

async function port(name, internal) {
  const address = await run(docker, ["port", name, `${internal}/tcp`]);
  const value = Number(address.split(":").at(-1));
  if (!Number.isInteger(value) || value < 1024)
    throw new Error("Invalid local port");
  return value;
}

try {
  const python =
    process.env.QUEUE_TEST_PYTHON ||
    fileURLToPath(new URL("../apps/ai/.venv/bin/python", import.meta.url));
  await access(python).catch(() => {
    throw new Error(
      "Install the Python worker environment first; see docs/DEVELOPMENT.md#integration-test.",
    );
  });
  await run(docker, ["info", "--format", "{{.ServerVersion}}"]);
  console.log(
    "Starting disposable localhost-only Postgres and Redis containers…",
  );
  const started = await Promise.allSettled([
    run(docker, [
      "run",
      "-d",
      "--name",
      database,
      "-p",
      "127.0.0.1::5432",
      "-e",
      "POSTGRES_DB=pawsrescue_test",
      "-e",
      "POSTGRES_USER=postgres",
      "-e",
      "POSTGRES_PASSWORD=postgres",
      "pgvector/pgvector:0.8.7-pg17-bookworm",
    ]),
    run(docker, [
      "run",
      "-d",
      "--name",
      redis,
      "-p",
      "127.0.0.1::6379",
      "redis:7.4-alpine",
    ]),
  ]);
  for (const result of started)
    if (result.status === "rejected") throw result.reason;
  await Promise.all([
    waitFor(database, [
      "pg_isready",
      "-U",
      "postgres",
      "-d",
      "pawsrescue_test",
    ]),
    waitFor(redis, ["redis-cli", "ping"]),
  ]);
  const [databasePort, redisPort] = await Promise.all([
    port(database, 5432),
    port(redis, 6379),
  ]);
  const env = {
    ...process.env,
    DATABASE_URL: `postgresql://postgres:postgres@127.0.0.1:${databasePort}/pawsrescue_test`,
    DB_HOST_NEST: "127.0.0.1",
    DB_PORT_NEST: String(databasePort),
    DB_USER_NEST: "postgres",
    DB_PASSWORD_NEST: "postgres",
    DB_NAME_NEST: "pawsrescue_test",
    DB_SSL: "false",
    DB_SSL_CA: "",
    REDIS_HOST: "127.0.0.1",
    REDIS_PORT: String(redisPort),
    REDIS_PASSWORD: "",
    QUEUE_TEST_REDIS_PORT: String(redisPort),
    QUEUE_TEST_PYTHON: python,
  };
  console.log(
    `Testing only local DB :${databasePort} and Redis :${redisPort}. Existing services are untouched.`,
  );
  const args = ["run", "--workspace", "api", "test:queue"];
  if (process.env.npm_execpath)
    await run(process.execPath, [process.env.npm_execpath, ...args], {
      env,
      stdio: "inherit",
    });
  else await run("npm", args, { env, stdio: "inherit" });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  // Only containers created with this invocation's random names are removed.
  await Promise.allSettled(
    [database, redis].map((name) =>
      run(docker, ["rm", "-f", "--volumes", name]),
    ),
  );
}
