import { spawn } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";

const rootDir = new URL("..", import.meta.url);
const packageDir = fileURLToPath(rootDir);
const watchDir = join(packageDir, "src");
const buildArgs = ["tailwindcss", "-i", "./src/styles.css", "-o", "./dist/index.css"];
const pollIntervalMs = Number(process.env.UI_STYLES_POLL_MS || 1500);

function listFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(fullPath));
      continue;
    }
    if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function snapshotFiles() {
  const files = listFiles(watchDir);
  return new Map(
    files.map((filePath) => [relative(packageDir, filePath), statSync(filePath).mtimeMs]),
  );
}

function hasChanges(previous, next) {
  if (previous.size !== next.size) {
    return true;
  }

  for (const [filePath, mtime] of next) {
    if (previous.get(filePath) !== mtime) {
      return true;
    }
  }

  return false;
}

function runBuild() {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", buildArgs, {
      cwd: packageDir,
      stdio: "inherit",
      shell: false,
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`tailwindcss exited with code ${code ?? "unknown"}`));
    });

    child.on("error", reject);
  });
}

let currentSnapshot = snapshotFiles();
let buildInFlight = false;

console.log(`UI styles watcher polling ${watchDir} every ${pollIntervalMs}ms`);

async function triggerBuild(reason) {
  if (buildInFlight) {
    return;
  }

  buildInFlight = true;
  console.log(`Rebuilding UI styles (${reason})`);

  try {
    await runBuild();
  } catch (error) {
    console.error("UI styles rebuild failed");
    console.error(error instanceof Error ? error.message : String(error));
  } finally {
    buildInFlight = false;
  }
}

await triggerBuild("initial");

setInterval(() => {
  try {
    const nextSnapshot = snapshotFiles();
    if (hasChanges(currentSnapshot, nextSnapshot)) {
      currentSnapshot = nextSnapshot;
      void triggerBuild("change detected");
    }
  } catch (error) {
    console.error("UI styles watcher failed to scan files");
    console.error(error instanceof Error ? error.message : String(error));
  }
}, pollIntervalMs);
