const fs = require("fs");
const path = require("path");
const { getDefaultDataDir } = require("./lib/wiki-data");

const DEFAULT_SOURCE_ROOT = path.resolve(__dirname, "..", "..", "OSRS Clone");
const SOURCE_ROOT_ENV_VAR = "OSRS_CLONE_SOURCE_ROOT";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function syncWikiData(options = {}) {
  const projectRoot = path.resolve(__dirname, "..");
  const sourceRoot = path.resolve(
    options.sourceRoot
    || process.env[SOURCE_ROOT_ENV_VAR]
    || DEFAULT_SOURCE_ROOT
  );
  const outDir = path.resolve(options.outDir || getDefaultDataDir(projectRoot));
  const exportModulePath = path.join(sourceRoot, "tools", "content", "wiki-export.js");

  assert(fs.existsSync(sourceRoot), `OSRS Clone repo not found at ${sourceRoot}`);
  assert(fs.existsSync(exportModulePath), `Wiki export module not found at ${exportModulePath}`);

  fs.mkdirSync(outDir, { recursive: true });
  // Load the exporter directly so local wiki checks do not depend on nested process spawning.
  delete require.cache[require.resolve(exportModulePath)];
  const { exportWikiBundle } = require(exportModulePath);
  assert(typeof exportWikiBundle === "function", `Wiki export module did not expose exportWikiBundle: ${exportModulePath}`);
  exportWikiBundle(sourceRoot, outDir);

  return { sourceRoot, outDir };
}

function run() {
  const { sourceRoot, outDir } = syncWikiData();
  console.log(`Synced wiki bundle from ${sourceRoot} to ${outDir}.`);
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
  syncWikiData
};
