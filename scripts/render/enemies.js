const { buildCodexEntityPath } = require("../lib/codex-link-contract");
const { renderLayout } = require("./layout");
const {
  buildSectionPath,
  describeList,
  escapeHtml,
  formatCoordinates,
  formatNumber,
  formatPercent,
  formatTicks,
  humanizeId,
  renderChipList,
  renderEntityIcon,
  renderInlineLinkedList,
  renderInlineLinkedText,
  renderJsonDetails,
  renderMetaList,
  renderSearchHeader,
  renderStatGrid,
  renderTable
} = require("./shared");

const DROP_CONTAINER_KEYS = new Set([
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
]);

function getEnemyData(enemy) {
  return enemy && enemy.data && typeof enemy.data === "object" ? enemy.data : {};
}

function getEnemyIconAssetId(enemy) {
  const data = getEnemyData(enemy);
  return String(
    data.icon && data.icon.assetId
    || data.appearance && data.appearance.assetId
    || data.model && data.model.assetId
    || ""
  ).trim() || null;
}

function getEnemyLevel(enemy) {
  const data = getEnemyData(enemy);
  return data.combatLevel !== undefined
    ? data.combatLevel
    : data.level !== undefined
      ? data.level
      : data.combat && data.combat.level !== undefined
        ? data.combat.level
        : enemy.level !== undefined
          ? enemy.level
          : null;
}

function getEnemyHitpoints(enemy) {
  const data = getEnemyData(enemy);
  return data.hitpoints !== undefined
    ? data.hitpoints
    : data.hp !== undefined
      ? data.hp
      : data.combat && data.combat.hitpoints !== undefined
        ? data.combat.hitpoints
        : null;
}

function getEnemyRespawnTicks(enemy) {
  const data = getEnemyData(enemy);
  return data.respawnTicks !== undefined ? data.respawnTicks : enemy.respawnTicks !== undefined ? enemy.respawnTicks : null;
}

function getEnemyRoamingRadius(enemy) {
  const data = getEnemyData(enemy);
  return data.roamingRadius !== undefined ? data.roamingRadius : enemy.roamingRadius !== undefined ? enemy.roamingRadius : null;
}

function getEnemyHomeTile(enemy) {
  const data = getEnemyData(enemy);
  return data.homeTile || data.homeTileOverride || enemy.homeTile || enemy.homeTileOverride || null;
}

function getEnemyRelatedWorldIds(enemy) {
  const data = getEnemyData(enemy);
  const ids = [
    ...(Array.isArray(enemy.relatedWorldIds) ? enemy.relatedWorldIds : []),
    ...(Array.isArray(data.relatedWorldIds) ? data.relatedWorldIds : []),
    ...(Array.isArray(data.spawnWorldIds) ? data.spawnWorldIds : []),
    ...(Array.isArray(data.worldIds) ? data.worldIds : [])
  ];
  return Array.from(new Set(ids.filter(Boolean)));
}

function getEnemyRelatedItemIds(enemy) {
  const data = getEnemyData(enemy);
  const ids = [
    ...(Array.isArray(enemy.relatedItemIds) ? enemy.relatedItemIds : []),
    ...(Array.isArray(data.relatedItemIds) ? data.relatedItemIds : []),
    ...(Array.isArray(data.lootItemIds) ? data.lootItemIds : [])
  ];
  return Array.from(new Set(ids.filter(Boolean)));
}

function looksLikeDropEntry(value) {
  if (!value) return false;
  if (typeof value === "string") return Boolean(String(value).trim());
  if (typeof value !== "object") return false;
  return [
    value.itemId,
    value.rewardItemId,
    value.outputItemId,
    value.dropItemId
  ].some(Boolean)
    || Array.isArray(value.itemIds)
    || value.amount !== undefined
    || value.quantity !== undefined
    || value.minAmount !== undefined
    || value.maxAmount !== undefined
    || value.weight !== undefined
    || value.chance !== undefined
    || value.rarity !== undefined
    || value.note !== undefined
    || value.notes !== undefined;
}

function flattenDropEntries(value, rows = []) {
  if (!value) return rows;
  if (Array.isArray(value)) {
    value.forEach((entry) => flattenDropEntries(entry, rows));
    return rows;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) rows.push({ itemId: trimmed });
    return rows;
  }
  if (typeof value !== "object") return rows;

  if (looksLikeDropEntry(value)) {
    rows.push(value);
    return rows;
  }

  Object.keys(value).forEach((key) => {
    const child = value[key];
    if (DROP_CONTAINER_KEYS.has(key) || Array.isArray(child) || (child && typeof child === "object")) {
      flattenDropEntries(child, rows);
    }
  });

  return rows;
}

function getEnemyDropEntries(enemy) {
  const data = getEnemyData(enemy);
  const sourceCandidates = [
    data.dropTable,
    data.dropTables,
    data.drops,
    data.lootTable,
    data.lootTables,
    data.loot,
    enemy.dropTable,
    enemy.dropTables,
    enemy.drops,
    enemy.lootTable,
    enemy.lootTables,
    enemy.loot
  ];
  const source = sourceCandidates.find((entry) => entry !== undefined);
  return flattenDropEntries(source, []);
}

function getEnemyDropItemIds(enemy) {
  const dropIds = new Set();
  getEnemyDropEntries(enemy).forEach((entry) => {
    const itemIds = Array.isArray(entry.itemIds) ? entry.itemIds : [];
    itemIds.forEach((itemId) => {
      const normalized = String(itemId || "").trim();
      if (normalized) dropIds.add(normalized);
    });
    const directId = String(
      entry.itemId
      || entry.rewardItemId
      || entry.outputItemId
      || entry.dropItemId
      || ""
    ).trim();
    if (directId) dropIds.add(directId);
  });
  return Array.from(dropIds);
}

function formatDropAmount(entry) {
  const amount = entry.amount !== undefined
    ? entry.amount
    : entry.quantity !== undefined
      ? entry.quantity
      : entry.qty !== undefined
        ? entry.qty
        : null;
  if (amount !== null && amount !== undefined) return String(amount);

  const min = entry.minAmount !== undefined ? entry.minAmount : entry.min !== undefined ? entry.min : null;
  const max = entry.maxAmount !== undefined ? entry.maxAmount : entry.max !== undefined ? entry.max : null;
  if (min !== null || max !== null) {
    if (min !== null && max !== null && String(min) === String(max)) return String(min);
    if (min !== null && max !== null) return `${min}-${max}`;
    if (min !== null) return String(min);
    if (max !== null) return String(max);
  }

  return "1";
}

function formatDropChance(entry) {
  const chance = entry.chance !== undefined
    ? entry.chance
    : entry.dropChance !== undefined
      ? entry.dropChance
      : entry.weight !== undefined
        ? entry.weight
        : null;
  if (chance === null || chance === undefined) return "Varies";
  const amount = Number(chance);
  if (!Number.isFinite(amount)) return String(chance);
  if (amount >= 0 && amount <= 1) return formatPercent(amount);
  return formatNumber(amount);
}

function buildEnemySummaryLine(enemy) {
  const data = getEnemyData(enemy);
  const parts = [];
  const level = getEnemyLevel(enemy);
  const hp = getEnemyHitpoints(enemy);
  const drops = getEnemyDropEntries(enemy).length;

  if (level !== null && level !== undefined) parts.push(`Lvl ${formatNumber(level)}`);
  if (hp !== null && hp !== undefined) parts.push(`${formatNumber(hp)} HP`);
  if (drops) parts.push(`${drops} drop${drops === 1 ? "" : "s"}`);
  if (getEnemyRespawnTicks(enemy) !== null) parts.push(`${formatTicks(getEnemyRespawnTicks(enemy))} respawn`);
  if (getEnemyRoamingRadius(enemy) !== null) parts.push(`Roam ${formatNumber(getEnemyRoamingRadius(enemy))}`);
  if (data.attackStyle || data.combatStyle || data.family) parts.push(humanizeId(data.attackStyle || data.combatStyle || data.family));
  if (data.behavior && typeof data.behavior === "string") parts.push(humanizeId(data.behavior));
  return parts.length ? parts.join(" | ") : "Enemy encounter";
}

function buildEnemySearchText(enemy) {
  const data = getEnemyData(enemy);
  return [
    enemy.title,
    enemy.enemyId,
    data.combatStyle || "",
    data.attackStyle || "",
    data.behavior || "",
    data.family || "",
    getEnemyRelatedWorldIds(enemy).join(" "),
    getEnemyRelatedItemIds(enemy).join(" "),
    getEnemyDropItemIds(enemy).join(" "),
    getEnemyDropEntries(enemy).map((entry) => [entry.itemId, entry.rewardItemId, entry.outputItemId, entry.dropItemId].filter(Boolean).join(" ")).join(" ")
  ].join(" ");
}

function renderEnemyCard(enemy, siteAssets) {
  const drops = getEnemyDropEntries(enemy).length;
  const relatedWorldLabels = getEnemyRelatedWorldIds(enemy).map(humanizeId);
  return `
    <article class="entity-card entity-card--indexed" data-search="${escapeHtml(buildEnemySearchText(enemy))}">
      <div class="entity-card__header">
        ${renderEntityIcon({
          siteAssets,
          assetId: getEnemyIconAssetId(enemy),
          label: enemy.title,
          size: "md",
          fallbackText: enemy.enemyId
        })}
        <div class="entity-card__copy">
          <p class="eyebrow">${escapeHtml(enemy.enemyId)}</p>
          <h3><a href="${escapeHtml(enemy.path)}">${escapeHtml(enemy.title)}</a></h3>
          <p class="entity-card__lede">${escapeHtml(buildEnemySummaryLine(enemy))}</p>
        </div>
      </div>
      ${renderChipList([
        getEnemyLevel(enemy) !== null && getEnemyLevel(enemy) !== undefined ? `Lvl ${formatNumber(getEnemyLevel(enemy))}` : null,
        drops ? `${drops} drops` : null,
        getEnemyRespawnTicks(enemy) !== null ? `${formatTicks(getEnemyRespawnTicks(enemy))} respawn` : null,
        getEnemyRoamingRadius(enemy) !== null ? `Roam ${formatNumber(getEnemyRoamingRadius(enemy))}` : null
      ].filter(Boolean), { className: "pill-list pill-list--dense" })}
      ${relatedWorldLabels.length
        ? `<p class="card-note">${renderInlineLinkedText(`Found in ${describeList(relatedWorldLabels)}.`, {
          linkRegistry: siteAssets.linkRegistry,
          excludeHrefs: [enemy.path]
        })}</p>`
        : `<p class="subtle">No linked worlds.</p>`}
    </article>
  `;
}

function renderDropTableSection(enemy, itemIndex) {
  const rows = getEnemyDropEntries(enemy).map((entry, index) => {
    const itemId = String(
      entry.itemId
      || entry.rewardItemId
      || entry.outputItemId
      || entry.dropItemId
      || (Array.isArray(entry.itemIds) ? entry.itemIds[0] : "")
      || ""
    ).trim();
    const item = itemId ? itemIndex.get(itemId) : null;
    return {
      key: `${itemId || "drop"}-${index}`,
      itemId,
      itemLabel: item ? item.title : humanizeId(itemId || entry.label || `Drop ${index + 1}`),
      itemHref: itemId ? buildCodexEntityPath("item", itemId) : null,
      amount: formatDropAmount(entry),
      chance: formatDropChance(entry),
      note: entry.note || entry.notes || entry.rarity || entry.category || "Varies"
    };
  });

  return `
    <section class="section-card">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Drop Table</p>
          <h3>What this enemy can drop</h3>
        </div>
      </div>
      ${renderTable({
        columns: [
          {
            label: "Item",
            render: (row) => row.itemHref
              ? `<a class="table-link" href="${escapeHtml(row.itemHref)}">${escapeHtml(row.itemLabel)}</a>`
              : escapeHtml(row.itemLabel)
          },
          { label: "Amount", render: (row) => escapeHtml(row.amount) },
          { label: "Chance / Weight", render: (row) => escapeHtml(row.chance) },
          { label: "Notes", render: (row) => escapeHtml(row.note) }
        ],
        rows,
        emptyText: "No drop table exported."
      })}
    </section>
  `;
}

function renderEnemyPage(bundle, editorial, enemy, siteAssets) {
  const itemIndex = new Map(bundle.items.map((item) => [item.itemId, item]));
  const worldIndex = new Map(bundle.worlds.map((world) => [world.worldId, world]));
  const data = getEnemyData(enemy);
  const level = getEnemyLevel(enemy);
  const hp = getEnemyHitpoints(enemy);
  const respawnTicks = getEnemyRespawnTicks(enemy);
  const roamingRadius = getEnemyRoamingRadius(enemy);
  const homeTile = getEnemyHomeTile(enemy);
  const dropEntries = getEnemyDropEntries(enemy);
  const relatedWorldIds = getEnemyRelatedWorldIds(enemy);
  const relatedItemIds = Array.from(new Set([
    ...getEnemyRelatedItemIds(enemy),
    ...getEnemyDropItemIds(enemy)
  ]));

  const heroAside = `
    <div class="hero-panel hero-panel--entity">
      <div class="hero-entity-lockup">
        ${renderEntityIcon({
          siteAssets,
          assetId: getEnemyIconAssetId(enemy),
          label: enemy.title,
          size: "xl",
          fallbackText: enemy.enemyId
        })}
        <div>
          <p class="eyebrow">Enemy Profile</p>
          <p class="hero-entity-note">${escapeHtml(buildEnemySummaryLine(enemy))}</p>
        </div>
      </div>
      ${renderStatGrid([
        { label: "Level", value: level !== null && level !== undefined ? level : "None" },
        { label: "HP", value: hp !== null && hp !== undefined ? hp : "None" },
        { label: "Drops", value: dropEntries.length },
        { label: "Worlds", value: relatedWorldIds.length }
      ], {
        className: "hero-stat-grid",
        itemClassName: "hero-stat-card"
      })}
    </div>
  `;

  const body = `
    <section class="section-card">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Reference Layer</p>
          <h3>Core facts and encounter metadata</h3>
        </div>
      </div>
      ${renderMetaList([
        { label: "Enemy ID", value: enemy.enemyId },
        { label: "Type", value: data.type ? humanizeId(data.type) : "Enemy" },
        { label: "Level", value: level !== null && level !== undefined ? level : "None" },
        { label: "Hitpoints", value: hp !== null && hp !== undefined ? hp : "None" },
        { label: "Respawn", value: respawnTicks !== null ? formatTicks(respawnTicks) : "None" },
        { label: "Roaming radius", value: roamingRadius !== null && roamingRadius !== undefined ? formatNumber(roamingRadius) : "None" },
        { label: "Home tile", value: homeTile ? formatCoordinates(homeTile) : "None" },
        { label: "Battle style", value: data.attackStyle || data.combatStyle || data.behavior || "None" }
      ])}
    </section>
    <section class="section-card">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Placement</p>
          <h3>Where this enemy is meant to live</h3>
        </div>
      </div>
      ${renderMetaList([
        {
          label: "Related worlds",
          html: renderInlineLinkedList(
            relatedWorldIds.map((worldId) => (worldIndex.get(worldId) || {}).title || humanizeId(worldId)),
            { linkRegistry: siteAssets.linkRegistry, excludeHrefs: [enemy.path], emptyText: "None" }
          )
        },
        {
          label: "Related items",
          html: renderInlineLinkedList(
            relatedItemIds.map((itemId) => (itemIndex.get(itemId) || {}).title || humanizeId(itemId)),
            { linkRegistry: siteAssets.linkRegistry, excludeHrefs: [enemy.path], emptyText: "None" }
          )
        },
        { label: "Attack family", value: data.family || data.combatFamily || "None" },
        { label: "Behavior", value: data.behavior || "None" }
      ])}
      <div class="prose">
        <p>${renderInlineLinkedText(
          `This encounter is placed in ${describeList(relatedWorldIds.map((worldId) => (worldIndex.get(worldId) || {}).title || humanizeId(worldId)))}.`,
          { linkRegistry: siteAssets.linkRegistry, excludeHrefs: [enemy.path] }
        )}</p>
        <p>${renderInlineLinkedText(
          `Its drop and reference context runs through ${describeList(relatedItemIds.map((itemId) => (itemIndex.get(itemId) || {}).title || humanizeId(itemId)))}.`,
          { linkRegistry: siteAssets.linkRegistry, excludeHrefs: [enemy.path] }
        )}</p>
      </div>
    </section>
    ${renderDropTableSection(enemy, itemIndex)}
    <section class="section-card">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Raw Data</p>
          <h3>Export payload for this enemy</h3>
        </div>
      </div>
      ${renderJsonDetails("Raw exported enemy data", enemy.data)}
    </section>
  `;

  return {
    routePath: enemy.path,
    html: renderLayout({
      editorial,
      manifest: bundle.manifest,
      currentPath: enemy.path,
      pageTitle: enemy.title,
      eyebrow: "Enemy Reference",
      heroTitle: enemy.title,
      heroBody: `<p>${renderInlineLinkedText(`Use this page to inspect ${enemy.title}'s encounter profile, placement, and drop table before opening the raw export data.`, {
        linkRegistry: siteAssets.linkRegistry,
        excludeHrefs: [enemy.path]
      })}</p>`,
      heroBadges: [
        level !== null && level !== undefined ? `Lvl ${formatNumber(level)}` : "Enemy",
        dropEntries.length ? `${dropEntries.length} drops` : "No drops",
        respawnTicks !== null ? `${formatTicks(respawnTicks)} respawn` : "No respawn",
        relatedWorldIds.length ? `${relatedWorldIds.length} worlds` : "No world links"
      ],
      heroAside,
      body
    })
  };
}

function renderEnemyIndexPage(bundle, editorial, siteAssets) {
  const enemies = (bundle.enemies || []).slice().sort((left, right) => {
    const leftLevel = getEnemyLevel(left);
    const rightLevel = getEnemyLevel(right);
    const leftSortLevel = leftLevel === null || leftLevel === undefined ? Number.MAX_SAFE_INTEGER : Number(leftLevel);
    const rightSortLevel = rightLevel === null || rightLevel === undefined ? Number.MAX_SAFE_INTEGER : Number(rightLevel);
    return leftSortLevel - rightSortLevel || String(left.title || "").localeCompare(String(right.title || ""));
  });
  const totalDrops = enemies.reduce((sum, enemy) => sum + getEnemyDropEntries(enemy).length, 0);
  const roamingCount = enemies.filter((enemy) => getEnemyRoamingRadius(enemy) !== null && getEnemyRoamingRadius(enemy) !== undefined).length;
  const worldLinkedCount = enemies.reduce((sum, enemy) => sum + getEnemyRelatedWorldIds(enemy).length, 0);
  const cards = enemies.map((enemy) => renderEnemyCard(enemy, siteAssets)).join("");

  const heroAside = `
    <div class="hero-panel">
      ${renderStatGrid([
        { label: "Enemies", value: enemies.length, detail: "Published encounter pages" },
        { label: "Drop rows", value: totalDrops, detail: "All exported loot entries" },
        { label: "Roaming", value: roamingCount, detail: "Enemies with patrol radii" },
        { label: "World links", value: worldLinkedCount, detail: "Where enemies are placed" }
      ], {
        className: "hero-stat-grid",
        itemClassName: "hero-stat-card"
      })}
    </div>
  `;

  const body = `
    <section class="section-card">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Browse Enemies</p>
          <h3>Search by enemy id, title, or the loot and worlds tied to the encounter.</h3>
        </div>
        ${renderSearchHeader("enemies", "Search enemies by id, title, drop item, or world", enemies.length)}
      </div>
    </section>
    <section class="entity-grid" data-filter-group="enemies">
      ${cards}
    </section>
  `;

  return {
    routePath: buildSectionPath("enemies"),
    html: renderLayout({
      editorial,
      manifest: bundle.manifest,
      currentPath: buildSectionPath("enemies"),
      pageTitle: "Enemies",
      eyebrow: "Encounter Index",
      heroTitle: "Enemies",
      heroBody: "<p>Browse encounter pages for hostile creatures, their placement, and their drop tables.</p>",
      heroBadges: ["Encounter pages", "Drop tables", "World-linked"],
      heroAside,
      body
    })
  };
}

module.exports = {
  renderEnemyIndexPage,
  renderEnemyPage
};
