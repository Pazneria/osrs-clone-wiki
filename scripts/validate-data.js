const path = require("path");

const { loadCodexBundle, validateCodexBundle } = require("./lib/codex-data");
const { loadItemEditorial, writeItemAuthoringArtifacts } = require("./lib/item-editorial");
const { loadManualContent } = require("./lib/manual-content");
const { syncCodexData } = require("./sync-data");

function run() {
  const projectRoot = path.resolve(__dirname, "..");
  const { outDir } = syncCodexData();
  const bundle = loadCodexBundle(projectRoot, outDir);
  validateCodexBundle(bundle);
  writeItemAuthoringArtifacts(projectRoot, bundle);
  const itemEditorial = loadItemEditorial(projectRoot, bundle);
  const manualContent = loadManualContent(projectRoot, bundle);
  console.log(
    `Validated codex bundle `
    + `(${bundle.items.length} items, ${bundle.skills.length} skills, ${bundle.worlds.length} worlds, ${bundle.enemies.length} enemies, `
    + `${Object.keys(itemEditorial.entriesByItemId).length} item descriptions, `
    + `${manualContent.journeys.journeys.length} journeys).`
  );
}

try {
  run();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
