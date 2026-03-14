const path = require("path");

const { loadCodexBundle, validateCodexBundle } = require("./lib/codex-data");
const { syncCodexData } = require("./sync-data");

function run() {
  const projectRoot = path.resolve(__dirname, "..");
  const { outDir } = syncCodexData();
  const bundle = loadCodexBundle(projectRoot, outDir);
  validateCodexBundle(bundle);
  console.log(
    `Validated codex bundle `
    + `(${bundle.items.length} items, ${bundle.skills.length} skills, ${bundle.worlds.length} worlds).`
  );
}

try {
  run();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
