const { buildCodexHomePath } = require("../lib/codex-link-contract");
const { renderLayout } = require("./layout");
const {
  buildSectionPath,
  describeList,
  escapeHtml,
  formatNumber,
  formatTicks,
  getItemIconAssetId,
  humanizeId,
  renderChipList,
  renderEntityIcon,
  renderInlineLinkedText,
  renderStatGrid
} = require("./shared");
const {
  buildEntityLinkRows,
  renderGuideBlockSection,
  renderJourneyCard,
  renderRichText
} = require("./manual");

function countRecipes(skill) {
  return skill.data && skill.data.recipeSet ? Object.keys(skill.data.recipeSet).length : 0;
}

function countNodes(skill) {
  return skill.data && skill.data.nodeTable ? Object.keys(skill.data.nodeTable).length : 0;
}

function countMerchants(skill) {
  return Array.isArray(skill.merchantIds) ? skill.merchantIds.length : 0;
}

function getEnemyIconAssetId(enemy) {
  const data = enemy && enemy.data && typeof enemy.data === "object" ? enemy.data : {};
  return String(
    data.icon && data.icon.assetId
    || data.appearance && data.appearance.assetId
    || data.model && data.model.assetId
    || ""
  ).trim() || null;
}

function getEnemyLevel(enemy) {
  const data = enemy && enemy.data && typeof enemy.data === "object" ? enemy.data : {};
  return data.combatLevel !== undefined
    ? data.combatLevel
    : data.level !== undefined
      ? data.level
      : data.combat && data.combat.level !== undefined
        ? data.combat.level
        : null;
}

function getEnemyRespawnTicks(enemy) {
  const data = enemy && enemy.data && typeof enemy.data === "object" ? enemy.data : {};
  return data.respawnTicks !== undefined ? data.respawnTicks : enemy.respawnTicks !== undefined ? enemy.respawnTicks : null;
}

function getEnemyRoamingRadius(enemy) {
  const data = enemy && enemy.data && typeof enemy.data === "object" ? enemy.data : {};
  return data.roamingRadius !== undefined ? data.roamingRadius : enemy.roamingRadius !== undefined ? enemy.roamingRadius : null;
}

function getEnemyDropCount(enemy) {
  const data = enemy && enemy.data && typeof enemy.data === "object" ? enemy.data : {};
  const source = data.dropTable !== undefined ? data.dropTable : data.dropTables !== undefined ? data.dropTables : data.drops !== undefined ? data.drops : enemy.dropTable !== undefined ? enemy.dropTable : enemy.drops !== undefined ? enemy.drops : [];
  const count = (value) => {
    if (!value) return 0;
    if (Array.isArray(value)) return value.reduce((sum, entry) => sum + count(entry), 0);
    if (typeof value === "string") return String(value).trim() ? 1 : 0;
    if (typeof value !== "object") return 0;
    const direct = [
      value.itemId,
      value.rewardItemId,
      value.outputItemId,
      value.dropItemId
    ].some(Boolean) || Array.isArray(value.itemIds);
    if (direct) return 1;
    return Object.keys(value).reduce((sum, key) => sum + count(value[key]), 0);
  };
  return count(source);
}

function buildEnemySummaryLine(enemy) {
  const parts = [];
  const level = getEnemyLevel(enemy);
  const drops = getEnemyDropCount(enemy);
  const respawn = getEnemyRespawnTicks(enemy);
  const roam = getEnemyRoamingRadius(enemy);
  const data = enemy && enemy.data && typeof enemy.data === "object" ? enemy.data : {};
  if (level !== null && level !== undefined) parts.push(`Lvl ${formatNumber(level)}`);
  if (drops) parts.push(`${formatNumber(drops)} drop${drops === 1 ? "" : "s"}`);
  if (respawn !== null) parts.push(`${formatTicks(respawn)} respawn`);
  if (roam !== null) parts.push(`Roam ${formatNumber(roam)}`);
  if (data.attackStyle || data.combatStyle || data.family) parts.push(humanizeId(data.attackStyle || data.combatStyle || data.family));
  return parts.length ? parts.join(" | ") : "Enemy encounter";
}

function normalizeManualContent(manualContent = {}) {
  const journeys = manualContent.journeys && Array.isArray(manualContent.journeys.journeys)
    ? manualContent.journeys.journeys
    : [];
  const journeysById = manualContent.journeys && manualContent.journeys.journeysById
    ? manualContent.journeys.journeysById
    : {};

  return {
    journeys,
    journeysById,
    skillsById: manualContent.skillsById && typeof manualContent.skillsById === "object" ? manualContent.skillsById : {},
    worldsById: manualContent.worldsById && typeof manualContent.worldsById === "object" ? manualContent.worldsById : {}
  };
}

function scoreManualEntry(entry = {}) {
  return (Array.isArray(entry.featuredJourneyIds) ? entry.featuredJourneyIds.length : 0) * 3
    + (Array.isArray(entry.featuredWorldIds) ? entry.featuredWorldIds.length : 0) * 2
    + (Array.isArray(entry.featuredItemIds) ? entry.featuredItemIds.length : 0);
}

function getDifficultyRank(value) {
  const normalized = String(value || "").toLowerCase();
  const order = ["starter", "beginner", "early", "intermediate", "advanced"];
  const index = order.findIndex((entry) => normalized.includes(entry));
  return index === -1 ? order.length : index;
}

function sortJourneysForHome(journeys) {
  return journeys.slice().sort((left, right) => {
    return getDifficultyRank(left.difficulty) - getDifficultyRank(right.difficulty)
      || (left.steps.length - right.steps.length)
      || left.title.localeCompare(right.title);
  });
}

function selectManualEntries(entriesById, collection, limit = 4) {
  return collection
    .map((entry) => ({
      entry,
      manual: entriesById[entry.skillId || entry.worldId] || {}
    }))
    .sort((left, right) => scoreManualEntry(right.manual) - scoreManualEntry(left.manual) || left.entry.title.localeCompare(right.entry.title))
    .slice(0, limit);
}

function getRepresentativeIconAssetId(bundle, entry) {
  const featuredItemIds = Array.isArray(entry.featuredItemIds) ? entry.featuredItemIds : [];
  for (const itemId of featuredItemIds) {
    const item = bundle.items.find((candidate) => candidate.itemId === itemId);
    const assetId = item ? getItemIconAssetId(item) : null;
    if (assetId) return assetId;
  }
  return null;
}

function buildManualLinkRows(bundle, entry, type) {
  const rows = buildEntityLinkRows(bundle, {
    itemIds: Array.isArray(entry.featuredItemIds) ? entry.featuredItemIds : [],
    skillIds: Array.isArray(entry.featuredSkillIds) ? entry.featuredSkillIds : [],
    worldIds: Array.isArray(entry.featuredWorldIds) ? entry.featuredWorldIds : []
  });

  if (type === "skill") {
    return rows.filter((row) => row.href !== entry.path);
  }

  if (type === "world") {
    return rows.filter((row) => row.href !== entry.path);
  }

  return rows.filter((row) => row.href !== entry.path);
}

function renderManualEntryCard(bundle, entry, manualEntry, siteAssets, type) {
  const iconAssetId = getRepresentativeIconAssetId(bundle, manualEntry);
  const labels = [
    `${formatNumber(Array.isArray(manualEntry.featuredItemIds) ? manualEntry.featuredItemIds.length : 0)} items`,
    `${formatNumber(Array.isArray(manualEntry.featuredSkillIds) ? manualEntry.featuredSkillIds.length : 0)} skills`,
    `${formatNumber(Array.isArray(manualEntry.featuredWorldIds) ? manualEntry.featuredWorldIds.length : 0)} worlds`
  ];
  const supportingRows = buildManualLinkRows(bundle, manualEntry, type);
  const supportCopy = supportingRows.length
    ? `<p class="card-note">${renderInlineLinkedText(
      `Best paired with ${describeList(supportingRows.slice(0, 4).map((row) => row.label))}.`,
      { linkRegistry: siteAssets.linkRegistry, excludeHrefs: [entry.path] }
    )}</p>`
    : "";

  return `
    <article class="entity-card entity-card--indexed">
      <div class="entity-card__header">
        ${renderEntityIcon({
          siteAssets,
          assetId: iconAssetId,
          label: entry.title,
          size: "md",
          fallbackText: entry.skillId || entry.worldId || entry.title
        })}
        <div class="entity-card__copy">
          <p class="eyebrow">${escapeHtml(type === "skill" ? entry.skillId : entry.worldId)}</p>
          <h3><a href="${escapeHtml(entry.path)}">${escapeHtml(entry.title)}</a></h3>
          ${renderRichText(manualEntry.overview, {
            emptyText: "No overview yet.",
            linkRegistry: siteAssets.linkRegistry,
            excludeHrefs: [entry.path]
          })}
        </div>
      </div>
      ${renderChipList(labels, { className: "pill-list pill-list--dense" })}
      ${renderRichText(manualEntry.howToGetStarted, {
        emptyText: "No start notes yet.",
        listClassName: "guide-list guide-list--compact",
        linkRegistry: siteAssets.linkRegistry,
        excludeHrefs: [entry.path]
      })}
      ${supportCopy}
    </article>
  `;
}

function renderEnemyCard(enemy, siteAssets) {
  return `
    <article class="entity-card entity-card--indexed">
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
        getEnemyDropCount(enemy) ? `${formatNumber(getEnemyDropCount(enemy))} drops` : null,
        getEnemyRespawnTicks(enemy) !== null ? `${formatTicks(getEnemyRespawnTicks(enemy))} respawn` : null,
        getEnemyRoamingRadius(enemy) !== null ? `Roam ${formatNumber(getEnemyRoamingRadius(enemy))}` : null
      ].filter(Boolean), { className: "pill-list pill-list--dense" })}
    </article>
  `;
}

function renderJourneySupportRows(bundle, journeys) {
  const rows = [];
  const seen = new Set();

  journeys.slice(0, 4).forEach((journey) => {
    (Array.isArray(journey.relatedItemIds) ? journey.relatedItemIds : []).forEach((itemId) => {
      const key = `item:${itemId}`;
      if (seen.has(key)) return;
      seen.add(key);
      const item = bundle.items.find((candidate) => candidate.itemId === itemId);
      rows.push({
        href: item ? item.path : buildSectionPath("items"),
        label: item ? item.title : humanizeId(itemId),
        meta: "Item"
      });
    });
    (Array.isArray(journey.relatedSkillIds) ? journey.relatedSkillIds : []).forEach((skillId) => {
      const key = `skill:${skillId}`;
      if (seen.has(key)) return;
      seen.add(key);
      const skill = bundle.skills.find((candidate) => candidate.skillId === skillId);
      rows.push({
        href: skill ? skill.path : buildSectionPath("skills"),
        label: skill ? skill.title : humanizeId(skillId),
        meta: "Skill"
      });
    });
    (Array.isArray(journey.relatedWorldIds) ? journey.relatedWorldIds : []).forEach((worldId) => {
      const key = `world:${worldId}`;
      if (seen.has(key)) return;
      seen.add(key);
      const world = bundle.worlds.find((candidate) => candidate.worldId === worldId);
      rows.push({
        href: world ? world.path : buildSectionPath("world"),
        label: world ? world.title : humanizeId(worldId),
        meta: "World"
      });
    });
  });

  return rows;
}

function renderHomePage(bundle, editorial, manualContentOrSiteAssets = {}, maybeSiteAssets) {
  const hasManualContent = arguments.length >= 4;
  const manualContent = hasManualContent ? manualContentOrSiteAssets : {};
  const siteAssets = hasManualContent ? (maybeSiteAssets || {}) : (manualContentOrSiteAssets || {});
  const manual = normalizeManualContent(manualContent);
  const introParagraphs = Array.isArray(editorial.intro) ? editorial.intro : [];
  const editorialCards = Array.isArray(editorial.homeSections) ? editorial.homeSections : [];
  const startJourneys = sortJourneysForHome(manual.journeys).slice(0, 4);
  const featuredSkills = selectManualEntries(manual.skillsById, bundle.skills, 4);
  const featuredWorlds = selectManualEntries(manual.worldsById, bundle.worlds, 4);
  const featuredEnemies = (bundle.enemies || []).slice().sort((left, right) => String(left.title || "").localeCompare(String(right.title || ""))).slice(0, 4);
  const goalRows = startJourneys.map((journey) => ({
    href: journey.path,
    label: journey.title,
    meta: [journey.audience, journey.difficulty].filter(Boolean).join(" | ")
  }));
  const supportRows = renderJourneySupportRows(bundle, startJourneys);

  const heroAside = `
    <div class="hero-panel">
      ${renderStatGrid([
        { label: "Journeys", value: manual.journeys.length, detail: "Start-here routes" },
        { label: "Skills", value: bundle.skills.length, detail: "Manual-backed pages" },
        { label: "Worlds", value: bundle.worlds.length, detail: "Region references" },
        { label: "Enemies", value: bundle.enemies.length, detail: "Encounter pages" },
        { label: "Goal routes", value: goalRows.length, detail: "Player entry points" }
      ], {
        className: "hero-stat-grid",
        itemClassName: "hero-stat-card"
      })}
    </div>
  `;

  const body = `
    ${renderGuideBlockSection({
      eyebrow: "Manual Portal",
      title: "A homepage that tracks what is live right now",
      badges: ["Encounter pages", "Talk-to aware", "Quest-ready"],
      blocks: [
        {
          label: "At a glance",
          body: introParagraphs.length ? introParagraphs : [editorial.tagline]
        },
        {
          label: "How to use it",
          body: [
            "Start with a journey or the first live quest, then open the linked skills, encounters, NPCs, and worlds to keep the active loop visible.",
            "The homepage is driven by `manualContent`, so the cards stay aligned with the exported reference data instead of drifting into hand-wavy summaries."
          ]
        },
        {
          label: "What's live now",
          body: editorialCards.length
            ? editorialCards.map((section) => `${section.title}: ${section.body}`)
            : ["Stable IDs and exported content keep the portal predictable across builds."]
        }
      ],
      linkRegistry: siteAssets.linkRegistry
    })}

    <section class="section-card">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Start Here Journeys</p>
          <h3>Choose a route that already explains the loop, or points you toward the first live quest.</h3>
        </div>
        <a class="text-link" href="${escapeHtml(buildSectionPath("journeys"))}">Browse all journeys</a>
      </div>
      <div class="entity-grid">
        ${startJourneys.map((journey) => renderJourneyCard(journey, {
          monogram: "JR",
          linkRegistry: siteAssets.linkRegistry,
          excludeHrefs: [journey.path]
        })).join("")}
      </div>
    </section>

    <section class="section-card">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Featured Skills</p>
          <h3>Skills that anchor the manual with concrete loops and outcomes.</h3>
        </div>
        <a class="text-link" href="${escapeHtml(buildSectionPath("skills"))}">Open skills index</a>
      </div>
      <div class="entity-grid">
        ${featuredSkills.map(({ entry, manual: manualEntry }) => renderManualEntryCard(bundle, entry, manualEntry, siteAssets, "skill")).join("")}
      </div>
    </section>

    <section class="section-card">
      <div class="section-heading">
        <div>
          <p class="eyebrow">World Highlights</p>
          <h3>Regions that tell you what is actually live before you go, including service districts and starter-town homesteads.</h3>
        </div>
        <a class="text-link" href="${escapeHtml(buildSectionPath("world"))}">Open world index</a>
      </div>
      <div class="entity-grid">
        ${featuredWorlds.map(({ entry, manual: manualEntry }) => renderManualEntryCard(bundle, entry, manualEntry, siteAssets, "world")).join("")}
      </div>
    </section>

    <section class="section-card">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Enemy Encounters</p>
          <h3>Live encounter pages with danger level, roaming, respawn, and loot at a glance.</h3>
        </div>
        <a class="text-link" href="${escapeHtml(buildSectionPath("enemies"))}">Open enemies index</a>
      </div>
      <div class="entity-grid">
        ${featuredEnemies.map((enemy) => renderEnemyCard(enemy, siteAssets)).join("")}
      </div>
    </section>

    <section class="section-card">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Player Goal Entry Points</p>
          <h3>Jump into the path that matches what you want to do next, from starter loops to the first live quest.</h3>
        </div>
        <a class="text-link" href="${escapeHtml(buildSectionPath("journeys"))}">See all goal routes</a>
      </div>
      <div class="prose">
        <p>${renderInlineLinkedText(
          `Good starting routes: ${describeList(goalRows.map((row) => row.label))}.`,
          { linkRegistry: siteAssets.linkRegistry }
        )}</p>
        ${supportRows.length ? `<p>${renderInlineLinkedText(
          `Supporting pages that reinforce those routes: ${describeList(supportRows.map((row) => row.label))}.`,
          { linkRegistry: siteAssets.linkRegistry }
        )}</p>` : ""}
      </div>
    </section>

    <section class="section-card">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Link Contract</p>
          <h3>Stable paths keep the codex wired into the rest of the project.</h3>
        </div>
      </div>
      ${renderChipList([
        bundle.manifest.routes.item,
        bundle.manifest.routes.skill,
        bundle.manifest.routes.enemy,
        bundle.manifest.routes.world,
        buildSectionPath("enemies"),
        buildSectionPath("journeys")
      ], { className: "pill-list" })}
    </section>
  `;

  return renderLayout({
    editorial,
    manifest: bundle.manifest,
    currentPath: buildCodexHomePath(),
    pageTitle: editorial.siteTitle,
    eyebrow: "Player-First Codex",
    heroTitle: editorial.siteTitle,
    heroBody: `
      <p>${escapeHtml(editorial.tagline)}</p>
      <p>${escapeHtml("Open a journey, inspect the supporting encounters, Talk-to NPCs, homestead-heavy world pages, and the first live quest, then follow the links back to the exported game data.")}</p>
    `,
    heroBadges: ["Reference-first", "Encounter pages", "Talk-to and quest aware"],
    heroAside,
    body
  });
}

module.exports = {
  renderHomePage
};
