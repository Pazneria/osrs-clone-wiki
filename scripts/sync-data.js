const fs = require("fs");
const path = require("path");
const { getDefaultDataDir } = require("./lib/codex-data");
const { DEFAULT_CODEX_BASE_PATH } = require("./lib/codex-link-contract");

const DEFAULT_SOURCE_ROOT = path.resolve(__dirname, "..", "..", "OSRS Clone");
const SOURCE_ROOT_ENV_VAR = "OSRS_CLONE_SOURCE_ROOT";
const LEGACY_CODEX_BASE_PATH = "/osrs-clone-wiki/";
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

function rewriteLegacyCodexPaths(value) {
  if (Array.isArray(value)) return value.map(rewriteLegacyCodexPaths);
  if (!value || typeof value !== "object") {
    return typeof value === "string"
      ? value.replaceAll(LEGACY_CODEX_BASE_PATH, DEFAULT_CODEX_BASE_PATH)
      : value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [key, rewriteLegacyCodexPaths(entryValue)])
  );
}

function normalizeLegacyBundle(outDir) {
  const jsonFiles = ["manifest.json", "items.json", "skills.json", "worlds.json", "enemies.json"];
  for (const filename of jsonFiles) {
    const absPath = path.join(outDir, filename);
    if (!fs.existsSync(absPath)) continue;
    const original = JSON.parse(fs.readFileSync(absPath, "utf8"));
    const rewritten = rewriteLegacyCodexPaths(original);
    fs.writeFileSync(absPath, `${JSON.stringify(rewritten, null, 2)}\n`);
  }
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
  if (exportModuleConfig.exportName === "exportWikiBundle") {
    normalizeLegacyBundle(outDir);
  }

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
