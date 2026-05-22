const fs = require("fs");
const path = require("path");

const {
  buildCodexEntityPath,
  buildCodexHomePath,
  buildCodexJourneyPath
} = require("./lib/codex-link-contract");
const { loadCodexBundle, validateCodexBundle } = require("./lib/codex-data");
const { loadItemEditorial, writeItemAuthoringArtifacts } = require("./lib/item-editorial");
const { loadManualContent } = require("./lib/manual-content");
const { syncCodexData } = require("./sync-data");
const { renderHomePage } = require("./render/home");
const { renderEnemyIndexPage, renderEnemyPage } = require("./render/enemies");
const { renderItemIndexPage, renderItemPage } = require("./render/items");
const { renderJourneyIndexPage, renderJourneyPage } = require("./render/journeys");
const { renderSkillIndexPage, renderSkillPage } = require("./render/skills");
const {
  buildInlineLinkRegistry,
  buildSectionPath,
  getItemIconAssetId,
  routePathToOutputFile
} = require("./render/shared");

function getEnemyIconAssetId(enemy) {
  const data = enemy && enemy.data && typeof enemy.data === "object" ? enemy.data : {};
  return String(
    data.icon && data.icon.assetId
    || data.appearance && data.appearance.assetId
    || data.model && data.model.assetId
    || ""
  ).trim() || null;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readJson(absPath) {
  return JSON.parse(fs.readFileSync(absPath, "utf8"));
}

function readText(absPath) {
  return fs.readFileSync(absPath, "utf8");
}

function writeText(absPath, contents) {
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, contents);
}

function copyFile(absSource, absTarget) {
  fs.mkdirSync(path.dirname(absTarget), { recursive: true });
  fs.copyFileSync(absSource, absTarget);
}

function removeDir(absPath) {
  if (fs.existsSync(absPath)) fs.rmSync(absPath, { recursive: true, force: true });
}

function writeRoutePage(siteRoot, page) {
  writeText(routePathToOutputFile(siteRoot, page.routePath), page.html);
}

function copyBundleFiles(bundle, siteRoot) {
  const filenames = Object.assign({
    manifest: "manifest.json",
    items: "items.json",
    skills: "skills.json",
    enemies: "enemies.json"
  }, bundle.manifest.files || {});

  const targets = [
    { source: path.join(bundle.dataDir, "manifest.json"), target: path.join(siteRoot, "data", "manifest.json") },
    { source: path.join(bundle.dataDir, filenames.items), target: path.join(siteRoot, "data", "items.json") },
    { source: path.join(bundle.dataDir, filenames.skills), target: path.join(siteRoot, "data", "skills.json") },
    { source: path.join(bundle.dataDir, filenames.enemies), target: path.join(siteRoot, "data", "enemies.json") }
  ];

  targets.forEach((entry) => copyFile(entry.source, entry.target));
}

function copyIconAssets(bundle, siteRoot, sourceRoot) {
  const assetIds = new Set();
  bundle.items.forEach((item) => {
    const assetId = getItemIconAssetId(item);
    if (assetId) assetIds.add(assetId);
  });
  bundle.enemies.forEach((enemy) => {
    const assetId = getEnemyIconAssetId(enemy);
    if (assetId) assetIds.add(assetId);
  });

  const copiedIds = new Set();
  assetIds.forEach((assetId) => {
    const sourcePath = path.join(sourceRoot, "assets", "pixel", `${assetId}.png`);
    if (!fs.existsSync(sourcePath)) return;
    copyFile(sourcePath, path.join(siteRoot, "assets", "pixel", `${assetId}.png`));
    copiedIds.add(assetId);
  });

  return {
    iconAssetIds: copiedIds
  };
}

function validateGeneratedPages(siteRoot, routePaths) {
  routePaths.forEach((routePath) => {
    const outputFile = routePathToOutputFile(siteRoot, routePath);
    assert(fs.existsSync(outputFile), `Missing generated page for ${routePath}`);
  });
}

function validateRenderedOutput(siteRoot, routePaths) {
  function assertInlineLink(html, href, labelPattern, message) {
    const pattern = new RegExp(`<a[^>]+href="${escapeRegex(href)}"[^>]*>${labelPattern}</a>`, "i");
    assert(pattern.test(html), message);
  }

  routePaths.forEach((routePath) => {
    const outputFile = routePathToOutputFile(siteRoot, routePath);
    const html = readText(outputFile);
    assert(!html.includes("north_road_camp"), `${routePath} still renders the retired north_road_camp world id`);
    assert(!html.includes("North Road Camp"), `${routePath} still renders the retired North Road Camp label`);
    if (routePath === buildCodexHomePath()) {
      assert(!html.includes("manual-link-list"), "home page still renders a manual-link-list wall");
      assert(!html.includes("guide-list--compact"), "home page still renders compact link stacks");
      assert(!html.includes("Best paired with"), "home page still renders best-paired link blurbs");
      assert(!html.includes("Supporting pages that reinforce those routes"), "home page still renders support-page link walls");
      return;
    }
    if (routePath === buildSectionPath("journeys")
      || routePath === buildSectionPath("items")
      || routePath === buildSectionPath("skills")
      || routePath === buildSectionPath("enemies")) {
      return;
    }
    assert(!html.includes("manual-link-list"), `detail page ${routePath} still renders a manual-link-list wall`);
  });

  const boarTuskHtml = readText(routePathToOutputFile(siteRoot, buildCodexEntityPath("item", "boar_tusk")));
  assert(!boarTuskHtml.includes("Guided Paths"), "boar_tusk item page still shows the Guided Paths section");
  assert(!boarTuskHtml.includes("Cross-Links"), "boar_tusk item page still shows the Cross-Links section");
  assertInlineLink(
    boarTuskHtml,
    buildCodexEntityPath("enemy", "enemy_boar"),
    "Boars",
    "boar_tusk item page is missing the inline Boars link"
  );
  const craftingHtml = readText(routePathToOutputFile(siteRoot, buildCodexEntityPath("skill", "crafting")));
  assert(!craftingHtml.includes("Journey Links"), "crafting skill page still shows the Journey Links section");
  assertInlineLink(
    craftingHtml,
    buildCodexJourneyPath("hides_of_the_frontier"),
    "Hides Of The Frontier",
    "crafting skill page is missing the inline Hides Of The Frontier link"
  );

  const rawChickenHtml = readText(routePathToOutputFile(siteRoot, buildCodexEntityPath("item", "raw_chicken")));
  assert(!rawChickenHtml.includes("Read this item alongside"), "raw_chicken item page still shows the read-along link pile");

  const boarEnemyHtml = readText(routePathToOutputFile(siteRoot, buildCodexEntityPath("enemy", "enemy_boar")));
  assert(!boarEnemyHtml.includes("Drop-linked items"), "enemy_boar page still shows the Drop-linked items wall");
  assertInlineLink(
    boarEnemyHtml,
    buildCodexEntityPath("item", "boar_tusk"),
    "Boar Tusk",
    "enemy_boar page is missing the inline Boar Tusk link"
  );

  const frontierJourneyHtml = readText(routePathToOutputFile(siteRoot, buildCodexJourneyPath("hides_of_the_frontier")));
  assert(!frontierJourneyHtml.includes("Pages to keep open while you follow it"), "hides_of_the_frontier page still shows the old connected-pages wall");
  assert(!frontierJourneyHtml.includes("This route is best read alongside"), "hides_of_the_frontier page still shows the route-context link pile");
  assert(!frontierJourneyHtml.includes("in view while you do this step."), "hides_of_the_frontier page still shows per-step link piles");
  assertInlineLink(
    frontierJourneyHtml,
    buildCodexEntityPath("enemy", "enemy_boar"),
    "boars",
    "hides_of_the_frontier page is missing the inline boars link"
  );
  assertInlineLink(
    frontierJourneyHtml,
    buildCodexEntityPath("enemy", "enemy_wolf"),
    "wolves",
    "hides_of_the_frontier page is missing the inline wolves link"
  );
}

function run() {
  const projectRoot = path.resolve(__dirname, "..");
  const siteEditorial = readJson(path.join(projectRoot, "content", "editorial", "site.json"));
  const { sourceRoot, outDir } = syncCodexData();
  const bundle = loadCodexBundle(projectRoot, outDir);
  validateCodexBundle(bundle);
  writeItemAuthoringArtifacts(projectRoot, bundle);
  const itemEditorial = loadItemEditorial(projectRoot, bundle);
  const manualContent = loadManualContent(projectRoot, bundle);

  const siteRoot = path.join(projectRoot, "dist", "osrs-clone-codex");
  removeDir(siteRoot);
  fs.mkdirSync(siteRoot, { recursive: true });

  copyFile(path.join(projectRoot, "src", "styles.css"), path.join(siteRoot, "styles.css"));
  copyFile(path.join(projectRoot, "src", "site.js"), path.join(siteRoot, "site.js"));
  copyBundleFiles(bundle, siteRoot);
  const siteAssets = copyIconAssets(bundle, siteRoot, sourceRoot);
  const renderAssets = {
    ...siteAssets,
    linkRegistry: buildInlineLinkRegistry(bundle, manualContent)
  };

  const routePaths = [
    buildCodexHomePath(),
    buildSectionPath("journeys"),
    buildSectionPath("items"),
    buildSectionPath("skills"),
    buildSectionPath("enemies"),
    ...manualContent.journeys.journeys.map((entry) => entry.path),
    ...bundle.manifest.indexes.items.map((entry) => entry.path),
    ...bundle.manifest.indexes.skills.map((entry) => entry.path),
    ...bundle.manifest.indexes.enemies.map((entry) => entry.path)
  ];

  const staticPages = [
    { routePath: buildCodexHomePath(), html: renderHomePage(bundle, siteEditorial, manualContent, renderAssets) },
    renderJourneyIndexPage(bundle, siteEditorial, manualContent, renderAssets),
    renderItemIndexPage(bundle, siteEditorial, manualContent, renderAssets),
    renderSkillIndexPage(bundle, siteEditorial, manualContent, renderAssets),
    renderEnemyIndexPage(bundle, siteEditorial, renderAssets)
  ];

  staticPages.forEach((page) => writeRoutePage(siteRoot, page));
  manualContent.journeys.journeys.forEach((journey) => writeRoutePage(siteRoot, renderJourneyPage(bundle, siteEditorial, manualContent, journey, renderAssets)));
  bundle.items.forEach((item) => writeRoutePage(siteRoot, renderItemPage(bundle, siteEditorial, itemEditorial, manualContent, item, renderAssets)));
  bundle.skills.forEach((skill) => writeRoutePage(siteRoot, renderSkillPage(bundle, siteEditorial, manualContent, skill, renderAssets)));
  bundle.enemies.forEach((enemy) => writeRoutePage(siteRoot, renderEnemyPage(bundle, siteEditorial, enemy, renderAssets)));

  validateGeneratedPages(siteRoot, routePaths);
  validateRenderedOutput(siteRoot, routePaths);
  console.log(`Built codex site at ${siteRoot}.`);
}

try {
  run();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
