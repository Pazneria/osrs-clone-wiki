const fs = require("fs");
const path = require("path");

const {
  DEFAULT_CODEX_BASE_PATH,
  buildCodexEntityPath,
  getCodexRouteTemplates
} = require("./codex-link-contract");

const DEFAULT_FILENAMES = Object.freeze({
  manifest: "manifest.json",
  items: "items.json",
  skills: "skills.json",
  worlds: "worlds.json",
  enemies: "enemies.json"
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function getDefaultDataDir(projectRoot) {
  return path.join(projectRoot, "content", "generated", "codex-export");
}

function readJson(absPath) {
  return JSON.parse(fs.readFileSync(absPath, "utf8"));
}

function createEntityIndex(rows, keyField) {
  return rows.map((row) => ({
    id: row[keyField],
    title: row.title,
    slug: row.slug,
    path: row.path
  }));
}

function collectEnemyDropItemIds(value, found = new Set()) {
  if (!value) return found;
  if (Array.isArray(value)) {
    value.forEach((entry) => collectEnemyDropItemIds(entry, found));
    return found;
  }
  if (typeof value !== "object") return found;

  const directIds = [
    value.itemId,
    value.rewardItemId,
    value.outputItemId,
    value.dropItemId
  ];
  directIds.forEach((itemId) => {
    const normalized = String(itemId || "").trim();
    if (normalized) found.add(normalized);
  });

  [
    "itemIds",
    "dropTable",
    "dropTables",
    "drops",
    "lootTable",
    "lootTables",
    "loot",
    "dropGroups",
    "entries",
    "rolls",
    "items"
  ].forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      collectEnemyDropItemIds(value[key], found);
    }
  });

  return found;
}

function loadCodexBundle(projectRoot, dataDir = getDefaultDataDir(projectRoot)) {
  const manifestPath = path.join(dataDir, DEFAULT_FILENAMES.manifest);
  assert(fs.existsSync(manifestPath), `Missing codex bundle manifest at ${manifestPath}`);
  const manifest = readJson(manifestPath);
  const filenames = Object.assign({}, DEFAULT_FILENAMES, manifest.files || {});
  const itemsPath = path.join(dataDir, filenames.items);
  const skillsPath = path.join(dataDir, filenames.skills);
  const worldsPath = path.join(dataDir, filenames.worlds);
  const enemiesPath = path.join(dataDir, filenames.enemies);

  assert(fs.existsSync(itemsPath), `Missing codex bundle items at ${itemsPath}`);
  assert(fs.existsSync(skillsPath), `Missing codex bundle skills at ${skillsPath}`);
  assert(fs.existsSync(worldsPath), `Missing codex bundle worlds at ${worldsPath}`);
  assert(fs.existsSync(enemiesPath), `Missing codex bundle enemies at ${enemiesPath}`);

  return {
    manifest,
    items: readJson(itemsPath),
    skills: readJson(skillsPath),
    worlds: readJson(worldsPath),
    enemies: readJson(enemiesPath),
    dataDir
  };
}

function validateEntityCollection(rows, idField, entityLabel, entityType) {
  const ids = new Set();
  const slugs = new Set();
  const paths = new Set();

  rows.forEach((row, index) => {
    const id = String(row[idField] || "").trim();
    assert(id, `${entityLabel} at index ${index} is missing ${idField}`);
    assert(!ids.has(id), `Duplicate ${entityLabel} id ${id}`);
    ids.add(id);

    const slug = String(row.slug || "").trim();
    assert(slug, `${entityLabel} ${id} is missing slug`);
    assert(!slugs.has(slug), `Duplicate ${entityLabel} slug ${slug}`);
    slugs.add(slug);

    const expectedPath = buildCodexEntityPath(entityType, id, { basePath: DEFAULT_CODEX_BASE_PATH });
    assert(row.path === expectedPath, `${entityLabel} ${id} path mismatch`);
    assert(!paths.has(row.path), `Duplicate ${entityLabel} path ${row.path}`);
    paths.add(row.path);
  });
}

function validateCodexBundle(bundle) {
  assert(bundle && typeof bundle === "object", "codex bundle is required");
  const { manifest } = bundle;
  assert(manifest && typeof manifest === "object", "codex manifest is required");
  assert(typeof manifest.schemaVersion === "number", "codex manifest schemaVersion is required");
  assert(typeof manifest.generatedAt === "string" && manifest.generatedAt, "codex manifest missing generatedAt");
  assert(typeof manifest.sourceCommit === "string" && manifest.sourceCommit, "codex manifest missing sourceCommit");
  assert(manifest.basePath === DEFAULT_CODEX_BASE_PATH, "codex manifest basePath mismatch");

  const expectedRoutes = getCodexRouteTemplates(DEFAULT_CODEX_BASE_PATH);
  const manifestRoutes = manifest.routes && typeof manifest.routes === "object" ? manifest.routes : {};
  assert(
    Object.keys(manifestRoutes).length === Object.keys(expectedRoutes).length
    && Object.keys(expectedRoutes).every((key) => manifestRoutes[key] === expectedRoutes[key]),
    "codex route templates mismatch"
  );

  const items = Array.isArray(bundle.items) ? bundle.items : [];
  const skills = Array.isArray(bundle.skills) ? bundle.skills : [];
  const worlds = Array.isArray(bundle.worlds) ? bundle.worlds : [];
  const enemies = Array.isArray(bundle.enemies) ? bundle.enemies : [];

  validateEntityCollection(items, "itemId", "item", "item");
  validateEntityCollection(skills, "skillId", "skill", "skill");
  validateEntityCollection(worlds, "worldId", "world", "world");
  validateEntityCollection(enemies, "enemyId", "enemy", "enemy");

  const itemIds = new Set(items.map((entry) => entry.itemId));
  const skillIds = new Set(skills.map((entry) => entry.skillId));
  const worldIds = new Set(worlds.map((entry) => entry.worldId));

  items.forEach((item) => {
    (Array.isArray(item.relatedSkillIds) ? item.relatedSkillIds : []).forEach((skillId) => {
      assert(skillIds.has(skillId), `item ${item.itemId} links to unknown skill ${skillId}`);
    });
    (Array.isArray(item.relatedWorldIds) ? item.relatedWorldIds : []).forEach((worldId) => {
      assert(worldIds.has(worldId), `item ${item.itemId} links to unknown world ${worldId}`);
    });
  });

  skills.forEach((skill) => {
    (Array.isArray(skill.relatedItemIds) ? skill.relatedItemIds : []).forEach((itemId) => {
      assert(itemIds.has(itemId), `skill ${skill.skillId} links to unknown item ${itemId}`);
    });
    (Array.isArray(skill.relatedWorldIds) ? skill.relatedWorldIds : []).forEach((worldId) => {
      assert(worldIds.has(worldId), `skill ${skill.skillId} links to unknown world ${worldId}`);
    });
  });

  worlds.forEach((world) => {
    (Array.isArray(world.relatedSkillIds) ? world.relatedSkillIds : []).forEach((skillId) => {
      assert(skillIds.has(skillId), `world ${world.worldId} links to unknown skill ${skillId}`);
    });
    (Array.isArray(world.travelLinks) ? world.travelLinks : []).forEach((link) => {
      const targetWorldId = String(link && link.targetWorldId ? link.targetWorldId : "").trim();
      assert(worldIds.has(targetWorldId), `world ${world.worldId} links to unknown world ${targetWorldId}`);
    });
  });

  enemies.forEach((enemy) => {
    const enemyData = enemy && enemy.data && typeof enemy.data === "object" ? enemy.data : {};
    const relatedItemIds = [
      ...(Array.isArray(enemy.relatedItemIds) ? enemy.relatedItemIds : []),
      ...(Array.isArray(enemyData.relatedItemIds) ? enemyData.relatedItemIds : []),
      ...(Array.isArray(enemyData.lootItemIds) ? enemyData.lootItemIds : [])
    ];
    const relatedWorldIds = [
      ...(Array.isArray(enemy.relatedWorldIds) ? enemy.relatedWorldIds : []),
      ...(Array.isArray(enemyData.relatedWorldIds) ? enemyData.relatedWorldIds : []),
      ...(Array.isArray(enemyData.spawnWorldIds) ? enemyData.spawnWorldIds : []),
      ...(Array.isArray(enemyData.worldIds) ? enemyData.worldIds : [])
    ];

    relatedItemIds.forEach((itemId) => {
      assert(itemIds.has(itemId), `enemy ${enemy.enemyId} links to unknown item ${itemId}`);
    });
    relatedWorldIds.forEach((worldId) => {
      assert(worldIds.has(worldId), `enemy ${enemy.enemyId} links to unknown world ${worldId}`);
    });
    collectEnemyDropItemIds(enemy).forEach((itemId) => {
      assert(itemIds.has(itemId), `enemy ${enemy.enemyId} drop table links to unknown item ${itemId}`);
    });
  });

  assert(manifest.counts && manifest.counts.items === items.length, "codex item count mismatch");
  assert(manifest.counts && manifest.counts.skills === skills.length, "codex skill count mismatch");
  assert(manifest.counts && manifest.counts.worlds === worlds.length, "codex world count mismatch");
  assert(manifest.counts && manifest.counts.enemies === enemies.length, "codex enemy count mismatch");

  const indexes = manifest.indexes || {};
  assert(JSON.stringify(indexes.items || []) === JSON.stringify(createEntityIndex(items, "itemId")), "codex item index mismatch");
  assert(JSON.stringify(indexes.skills || []) === JSON.stringify(createEntityIndex(skills, "skillId")), "codex skill index mismatch");
  assert(JSON.stringify(indexes.worlds || []) === JSON.stringify(createEntityIndex(worlds, "worldId")), "codex world index mismatch");
  assert(JSON.stringify(indexes.enemies || []) === JSON.stringify(createEntityIndex(enemies, "enemyId")), "codex enemy index mismatch");

  return bundle;
}

module.exports = {
  DEFAULT_FILENAMES,
  getDefaultDataDir,
  loadCodexBundle,
  validateCodexBundle
};
