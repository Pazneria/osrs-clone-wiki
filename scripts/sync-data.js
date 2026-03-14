const fs = require("fs");
const path = require("path");
const { getDefaultDataDir } = require("./lib/codex-data");

const DEFAULT_SOURCE_ROOT = path.resolve(__dirname, "..", "..", "OSRS Clone");
const SOURCE_ROOT_ENV_VAR = "OSRS_CLONE_SOURCE_ROOT";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function syncCodexData(options = {}) {
  const projectRoot = path.resolve(__dirname, "..");
  const sourceRoot = path.resolve(
    options.sourceRoot
    || process.env[SOURCE_ROOT_ENV_VAR]
    || DEFAULT_SOURCE_ROOT
  );
  const outDir = path.resolve(options.outDir || getDefaultDataDir(projectRoot));
  const exportModulePath = path.join(sourceRoot, "tools", "content", "codex-export.js");

  assert(fs.existsSync(sourceRoot), `OSRS Clone repo not found at ${sourceRoot}`);
  assert(fs.existsSync(exportModulePath), `Codex export module not found at ${exportModulePath}`);

  fs.mkdirSync(outDir, { recursive: true });
  // Load the exporter directly so local codex checks do not depend on nested process spawning.
  delete require.cache[require.resolve(exportModulePath)];
  const { exportCodexBundle } = require(exportModulePath);
  assert(typeof exportCodexBundle === "function", `Codex export module did not expose exportCodexBundle: ${exportModulePath}`);
  exportCodexBundle(sourceRoot, outDir);

  return { sourceRoot, outDir };
}

function run() {
  const { sourceRoot, outDir } = syncCodexData();
  console.log(`Synced codex bundle from ${sourceRoot} to ${outDir}.`);
}

if (require.main === module) {
  try {
    run();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  DEFAULT_SOURCE_ROOT,
  SOURCE_ROOT_ENV_VAR,
  syncCodexData
};
