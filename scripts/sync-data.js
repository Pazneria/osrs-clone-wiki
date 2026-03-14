const fs = require("fs");
const path = require("path");
const { getDefaultDataDir } = require("./lib/codex-data");

const DEFAULT_SOURCE_ROOT = path.resolve(__dirname, "..", "..", "OSRS Clone");
const SOURCE_ROOT_ENV_VAR = "OSRS_CLONE_SOURCE_ROOT";
const EXPORT_MODULE_CANDIDATES = Object.freeze([
  {
    relativePath: path.join("tools", "content", "codex-export.js"),
    exportName: "exportCodexBundle"
  },
  {
    relativePath: path.join("tools", "content", "wiki-export.js"),
    exportName: "exportWikiBundle"
  }
]);

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

  assert(fs.existsSync(sourceRoot), `OSRS Clone repo not found at ${sourceRoot}`);

  const exportModuleConfig = EXPORT_MODULE_CANDIDATES
    .map((candidate) => ({
      modulePath: path.join(sourceRoot, candidate.relativePath),
      exportName: candidate.exportName
    }))
    .find((candidate) => fs.existsSync(candidate.modulePath));

  assert(
    exportModuleConfig,
    `Codex export module not found in ${sourceRoot} (checked ${EXPORT_MODULE_CANDIDATES.map((candidate) => candidate.relativePath).join(", ")})`
  );

  fs.mkdirSync(outDir, { recursive: true });
  // Load the exporter directly so local codex checks do not depend on nested process spawning.
  delete require.cache[require.resolve(exportModuleConfig.modulePath)];
  const exportModule = require(exportModuleConfig.modulePath);
  const exportCodexBundle = exportModule[exportModuleConfig.exportName];
  assert(
    typeof exportCodexBundle === "function",
    `Codex export module did not expose ${exportModuleConfig.exportName}: ${exportModuleConfig.modulePath}`
  );
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
