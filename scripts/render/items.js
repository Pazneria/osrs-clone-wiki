const { buildCodexEntityPath } = require("../lib/codex-link-contract");
const { renderLayout } = require("./layout");
const {
  renderGuideBlockSection
} = require("./manual");
const {
  buildSectionPath,
  describeList,
  escapeHtml,
  formatNumber,
  formatPercent,
  formatTicks,
  getItemIconAssetId,
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

const EQUIPMENT_TYPES = new Set(["weapon", "head", "body", "legs", "feet", "shield"]);

function getItemTypeLabel(item) {
  return humanizeId(item.data && item.data.type ? item.data.type : "item");
}

function getRequirementSummary(item) {
  const bits = [];
  if (item.data && item.data.requiredAttackLevel !== undefined) bits.push(`Atk ${item.data.requiredAttackLevel}`);
  if (item.data && item.data.requiredDefenseLevel !== undefined) bits.push(`Def ${item.data.requiredDefenseLevel}`);
  if (item.data && item.data.requiredFishingLevel !== undefined) bits.push(`Fish ${item.data.requiredFishingLevel}`);
  if (item.data && item.data.toolTier !== undefined) bits.push(`Tier ${item.data.toolTier}`);
  return bits.length ? bits.join(" | ") : "No level gate";
}

function buildItemSummaryLine(item) {
  const type = item.data && item.data.type ? item.data.type : "item";
  if (type === "weapon") {
    const tickCycle = item.data && item.data.combat && item.data.combat.attackProfile
      ? item.data.combat.attackProfile.tickCycle
      : null;
    const family = item.data && item.data.weaponClass ? humanizeId(item.data.weaponClass) : "Weapon";
    return `${family} | ${tickCycle ? `${tickCycle}-tick cycle` : "combat-ready"} | ${getRequirementSummary(item)}`;
  }
  if (EQUIPMENT_TYPES.has(type)) return `Equipment | ${getRequirementSummary(item)}`;
  if (type === "food") return `Restores ${item.data.healAmount || 0} HP | ${formatTicks(item.data.eatDelayTicks)} eat delay`;
  if (item.data && item.data.cookResultId) return `Cookable ingredient | Burn chance ${item.data.burnChance !== undefined ? formatPercent(item.data.burnChance) : "varies"}`;
  if (type === "tool") return `${describeList(item.data.actions || [])} | ${getRequirementSummary(item)}`;
  return `${getItemTypeLabel(item)} | Value ${formatNumber(item.data.value || 0)} | ${item.data.stackable ? "Stackable" : "Single slot"}`;
}

function buildItemCardBadges(item) {
  const badges = [getItemTypeLabel(item)];
  if (item.data && item.data.defaultAction) badges.push(item.data.defaultAction);
  if (item.data && item.data.stackable) badges.push("Stackable");
  if (item.data && item.data.requiredAttackLevel !== undefined) badges.push(`Atk ${item.data.requiredAttackLevel}`);
  if (item.data && item.data.requiredDefenseLevel !== undefined) badges.push(`Def ${item.data.requiredDefenseLevel}`);
  if (item.data && item.data.healAmount !== undefined) badges.push(`Heal ${item.data.healAmount}`);
  return badges;
}

function buildPossessiveLabel(value) {
  const text = String(value || "").trim();
  if (!text) return "This item's";
  return /s$/i.test(text) ? `${text}'` : `${text}'s`;
}

function deriveItemGoalTags(item) {
  const tags = new Set();
  const type = item && item.data ? item.data.type : "";
  const relatedSkillIds = Array.isArray(item.relatedSkillIds) ? item.relatedSkillIds : [];
  const lowerTitle = String(item.title || "").toLowerCase();
  const lowerId = String(item.itemId || "").toLowerCase();
  const lowerWeaponClass = String(item && item.data && item.data.weaponClass || "").toLowerCase();

  if (type === "weapon" || EQUIPMENT_TYPES.has(type) || item.data && item.data.combat) tags.add("combat");
  if (type === "food" || item.data && (item.data.healAmount !== undefined || item.data.cookResultId || item.data.burnResultId) || lowerId.startsWith("raw_") || lowerId.startsWith("cooked_") || lowerId.startsWith("burnt_")) {
    tags.add("food");
  }
  if (type === "tool" || item.data && item.data.toolTier !== undefined || lowerWeaponClass) {
    tags.add("tools");
  }
  if (["pickaxe", "axe", "harpoon", "fishing_rod", "small_net"].includes(lowerWeaponClass) || relatedSkillIds.some((skillId) => ["mining", "woodcutting", "fishing"].includes(skillId))) {
    tags.add("gather");
  }
  if (type === "rune" || lowerId.endsWith("_rune") || relatedSkillIds.includes("runecrafting")) {
    tags.add("runes");
  }
  if (/amulet|ring|necklace|bracelet|gem|jewel|mould|tiara|sapphire|emerald|ruby|diamond/.test(`${lowerTitle} ${lowerId}`)) {
    tags.add("jewelry");
  }

  return Array.from(tags);
}

function buildItemSearchText(item) {
  return [
    item.title,
    item.itemId,
    item.data.type || "",
    (item.relatedSkillIds || []).join(" "),
    (item.relatedWorldIds || []).join(" "),
    deriveItemGoalTags(item).join(" "),
    item.data && item.data.defaultAction ? item.data.defaultAction : "",
    item.data && item.data.weaponClass ? item.data.weaponClass : ""
  ].join(" ");
}

function renderItemFilterChips(groupId, values) {
  const rows = Array.isArray(values) ? values : [];
  if (!rows.length) return "";
  return `
    <ul class="filter-chip-list" data-filter-chips="${escapeHtml(groupId)}">
      ${rows.map((value) => `
        <li>
          <button type="button" class="filter-chip" data-filter-chip="${escapeHtml(groupId)}" data-filter-value="${escapeHtml(value)}">
            ${escapeHtml(value)}
          </button>
        </li>
      `).join("")}
    </ul>
  `;
}

function renderItemCard(item, siteAssets) {
  return `
    <article class="entity-card entity-card--indexed" data-search="${escapeHtml(buildItemSearchText(item))}" data-filter-values="${escapeHtml(deriveItemGoalTags(item).join(" "))}">
      <div class="entity-card__header">
        ${renderEntityIcon({
          siteAssets,
          assetId: getItemIconAssetId(item),
          label: item.title,
          size: "md",
          fallbackText: item.title
        })}
        <div class="entity-card__copy">
          <p class="eyebrow">${escapeHtml(item.itemId)}</p>
          <h3><a href="${escapeHtml(item.path)}">${escapeHtml(item.title)}</a></h3>
          <p class="entity-card__lede">${escapeHtml(buildItemSummaryLine(item))}</p>
        </div>
      </div>
      ${renderChipList(buildItemCardBadges(item), { className: "pill-list pill-list--dense" })}
    </article>
  `;
}

function renderCombatSection(item) {
  if (!item.data || !item.data.combat) return "";

  const attackProfile = item.data.combat.attackProfile || {};
  const bonusMap = [
    { label: "Melee accuracy", value: item.data.combat.bonuses && item.data.combat.bonuses.meleeAccuracyBonus },
    { label: "Melee strength", value: item.data.combat.bonuses && item.data.combat.bonuses.meleeStrengthBonus },
    { label: "Melee defense", value: item.data.combat.bonuses && item.data.combat.bonuses.meleeDefenseBonus },
    { label: "Ranged defense", value: item.data.combat.bonuses && item.data.combat.bonuses.rangedDefenseBonus },
    { label: "Magic defense", value: item.data.combat.bonuses && item.data.combat.bonuses.magicDefenseBonus }
  ].filter((row) => row.value !== undefined && row.value !== null);

  return `
    <section class="section-card">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Combat Profile</p>
          <h3>${escapeHtml(item.title)} in combat</h3>
        </div>
      </div>
      ${renderMetaList([
        { label: "Style family", value: attackProfile.styleFamily ? humanizeId(attackProfile.styleFamily) : "None" },
        { label: "Damage type", value: attackProfile.damageType ? humanizeId(attackProfile.damageType) : "None" },
        { label: "Range", value: attackProfile.range },
        { label: "Attack cycle", value: attackProfile.tickCycle ? `${attackProfile.tickCycle} ticks` : "None" },
        { label: "Weapon family", value: item.data.combat.weaponFamily ? humanizeId(item.data.combat.weaponFamily) : "None" },
        { label: "Tool family", value: item.data.combat.toolFamily ? humanizeId(item.data.combat.toolFamily) : "None" }
      ])}
      ${renderTable({
        columns: [
          { label: "Bonus", render: (row) => escapeHtml(row.label) },
          { label: "Value", render: (row) => escapeHtml(formatNumber(row.value)) }
        ],
        rows: bonusMap,
        emptyText: "No combat bonus rows."
      })}
    </section>
  `;
}

function renderToolSection(item) {
  if (!item.data || item.data.toolTier === undefined && !item.data.weaponClass) return "";
  return `
    <section class="section-card">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Tooling</p>
          <h3>Gathering and utility profile</h3>
        </div>
      </div>
      ${renderMetaList([
        { label: "Weapon class", value: item.data.weaponClass ? humanizeId(item.data.weaponClass) : "None" },
        { label: "Tool tier", value: item.data.toolTier !== undefined ? item.data.toolTier : "None" },
        { label: "Speed bonus", value: item.data.speedBonusTicks !== undefined ? `${item.data.speedBonusTicks} ticks faster` : "None" }
      ], { emptyText: "No tool metadata exported." })}
    </section>
  `;
}

function renderCookingSection(bundle, item, itemIndex, options = {}) {
  const data = item.data || {};
  const sourceItems = bundle.items.filter((entry) => entry.data && (entry.data.cookResultId === item.itemId || entry.data.burnResultId === item.itemId));
  const hasCookingData = data.cookResultId || data.burnResultId || data.healAmount !== undefined || sourceItems.length;
  if (!hasCookingData) return "";

  const relatedLabels = [];
  if (data.cookResultId) {
    const cooked = itemIndex.get(data.cookResultId);
    relatedLabels.push(cooked ? cooked.title : humanizeId(data.cookResultId));
  }
  if (data.burnResultId) {
    const burnt = itemIndex.get(data.burnResultId);
    relatedLabels.push(burnt ? burnt.title : humanizeId(data.burnResultId));
  }
  sourceItems.forEach((source) => {
    relatedLabels.push(source.title);
  });

  const chainParagraph = relatedLabels.length
    ? `<p class="card-note">${renderInlineLinkedText(`This cooking chain runs through ${describeList(relatedLabels)}.`, options)}</p>`
    : `<p class="subtle">No cooking-linked items.</p>`;

  return `
    <section class="section-card">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Cooking</p>
          <h3>Prep, burn, and recovery details</h3>
        </div>
      </div>
      ${renderMetaList([
        { label: "Heal amount", value: data.healAmount !== undefined ? data.healAmount : "None" },
        { label: "Eat delay", value: data.eatDelayTicks !== undefined ? formatTicks(data.eatDelayTicks) : "None" },
        { label: "Burn chance", value: data.burnChance !== undefined ? formatPercent(data.burnChance) : "None" }
      ], { emptyText: "No cooking metadata exported." })}
      ${chainParagraph}
    </section>
  `;
}

function collectItemJourneyLinks(manualContent, item) {
  const journeys = manualContent && manualContent.journeys ? manualContent.journeys.journeys : [];
  return journeys
    .filter((journey) => {
      if (journey.relatedItemIds.includes(item.itemId)) return true;
      return journey.relatedSkillIds.some((skillId) => item.relatedSkillIds.includes(skillId))
        || journey.relatedWorldIds.some((worldId) => item.relatedWorldIds.includes(worldId));
    })
    .slice(0, 4)
    .map((journey) => ({
      href: journey.path,
      label: journey.title,
      meta: `${journey.difficulty} | ${journey.audience}`
    }));
}

function buildItemGuideBlocks(bundle, item, entry, manualContent) {
  const worlds = item.relatedWorldIds.map(humanizeId);
  const skills = item.relatedSkillIds.map(humanizeId);
  const nextSteps = [];

  if (item.data && item.data.cookResultId) nextSteps.push(`Cook this into ${humanizeId(item.data.cookResultId)} when you are ready to move the loop forward.`);
  if (item.data && item.data.burnResultId) nextSteps.push(`Watch the burn result path into ${humanizeId(item.data.burnResultId)} if Cooking goes wrong.`);
  if (skills.length) nextSteps.push(`Open ${skills.slice(0, 2).join(" and ")} to see the larger systems that produce or consume this item.`);
  const journeyLinks = collectItemJourneyLinks(manualContent, item);
  if (journeyLinks.length) nextSteps.push(`Follow ${journeyLinks[0].label} if you want a guided route instead of reading this item in isolation.`);

  return [
    { label: "Overview", body: entry.description },
    { label: "Why It Matters", body: entry.uses },
    {
      label: "How To Get Started",
      body: [
        entry.acquisition,
        skills.length ? `The fastest way to understand this item is to pair it with ${skills.slice(0, 2).join(" and ")}.` : ""
      ].filter(Boolean)
    },
    {
      label: "Connected Systems",
      body: [
        skills.length ? `This item touches ${skills.join(", ")}.` : "This item sits on the edge of the manual and stays intentionally sparse.",
        worlds.length ? `You will see it show up around ${worlds.join(", ")}.` : ""
      ].filter(Boolean)
    },
    {
      label: "Next Steps",
      body: nextSteps.length ? nextSteps : ["Use the connected skill, world, and journey references in this guide to see where the item leads next."]
    }
  ];
}

function renderEditorialSection(bundle, item, itemEditorial, manualContent, siteAssets) {
  const entry = itemEditorial && itemEditorial.entriesByItemId ? itemEditorial.entriesByItemId[item.itemId] : null;
  if (!entry) return "";

  return `
    ${renderGuideBlockSection({
      eyebrow: "Living Manual",
      title: "What this item is for and where it leads",
      badges: [entry.status === "reviewed" ? "Reviewed guide copy" : "Draft guide copy"],
      blocks: buildItemGuideBlocks(bundle, item, entry, manualContent),
      linkRegistry: siteAssets.linkRegistry,
      excludeHrefs: [item.path]
    })}
  `;
}

function renderItemPage(bundle, editorial, itemEditorial, manualContent, item, siteAssets) {
  const skillIndex = new Map(bundle.skills.map((skill) => [skill.skillId, skill]));
  const worldIndex = new Map(bundle.worlds.map((world) => [world.worldId, world]));
  const itemIndex = new Map(bundle.items.map((entry) => [entry.itemId, entry]));

  const heroAside = `
    <div class="hero-panel hero-panel--entity">
      <div class="hero-entity-lockup">
        ${renderEntityIcon({
          siteAssets,
          assetId: getItemIconAssetId(item),
          label: item.title,
          size: "xl",
          fallbackText: item.title
        })}
        <div>
          <p class="eyebrow">${escapeHtml(getItemTypeLabel(item))}</p>
          <p class="hero-entity-note">${escapeHtml(buildItemSummaryLine(item))}</p>
        </div>
      </div>
      ${renderStatGrid([
        { label: "Value", value: item.data.value !== undefined ? item.data.value : "None" },
        { label: "Action", value: item.data.defaultAction || "None" },
        { label: "Skills", value: item.relatedSkillIds.length },
        { label: "Worlds", value: item.relatedWorldIds.length }
      ], {
        className: "hero-stat-grid",
        itemClassName: "hero-stat-card"
      })}
    </div>
  `;

  const body = `
    ${renderEditorialSection(bundle, item, itemEditorial, manualContent, siteAssets)}
    <section class="section-card">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Reference Layer</p>
          <h3>Core facts and exported numbers</h3>
        </div>
      </div>
      ${renderMetaList([
        { label: "Item ID", value: item.itemId },
        { label: "Type", value: getItemTypeLabel(item) },
        { label: "Value", value: item.data.value },
        { label: "Stackable", value: item.data.stackable ? "Yes" : "No" },
        { label: "Default action", value: item.data.defaultAction || "None" },
        { label: "Actions", value: describeList(item.data.actions || []) },
        { label: "Requirements", value: getRequirementSummary(item) }
      ])}
    </section>
    ${renderCombatSection(item)}
    ${renderToolSection(item)}
    ${renderCookingSection(bundle, item, itemIndex, {
      linkRegistry: siteAssets.linkRegistry,
      excludeHrefs: [item.path]
    })}
    <section class="section-card">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Reference Context</p>
          <h3>Where this item fits in the larger codex</h3>
        </div>
      </div>
      ${renderMetaList([
        {
          label: "Referenced skills",
          html: renderInlineLinkedList(
            item.relatedSkillIds.map((skillId) => (skillIndex.get(skillId) || {}).title || skillId),
            { linkRegistry: siteAssets.linkRegistry, excludeHrefs: [item.path], emptyText: "None" }
          )
        },
        {
          label: "Referenced worlds",
          html: renderInlineLinkedList(
            item.relatedWorldIds.map((worldId) => (worldIndex.get(worldId) || {}).title || worldId),
            { linkRegistry: siteAssets.linkRegistry, excludeHrefs: [item.path], emptyText: "None" }
          )
        },
        {
          label: "Guided journeys",
          html: renderInlineLinkedList(
            collectItemJourneyLinks(manualContent, item).map((journey) => journey.label),
            { linkRegistry: siteAssets.linkRegistry, excludeHrefs: [item.path], emptyText: "None" }
          )
        },
        { label: "Icon asset", value: getItemIconAssetId(item) || "None" }
      ], { emptyText: "No cross-reference metadata." })}
      <p class="card-note">${renderInlineLinkedText(
        `Read this item alongside ${describeList(
          [
            ...item.relatedSkillIds.map((skillId) => (skillIndex.get(skillId) || {}).title || skillId),
            ...item.relatedWorldIds.map((worldId) => (worldIndex.get(worldId) || {}).title || worldId),
            ...collectItemJourneyLinks(manualContent, item).map((journey) => journey.label)
          ].filter(Boolean).slice(0, 8)
        )}.`,
        { linkRegistry: siteAssets.linkRegistry, excludeHrefs: [item.path] }
      )}</p>
    </section>
    <section class="section-card">
      ${renderJsonDetails("Raw exported item data", item.data)}
    </section>
  `;

  return {
    routePath: item.path,
    html: renderLayout({
      editorial,
      manifest: bundle.manifest,
      currentPath: item.path,
      pageTitle: item.title,
      eyebrow: "Item Manual",
      heroTitle: item.title,
      heroBody: `<p>${escapeHtml(`Use this page to understand ${buildPossessiveLabel(item.title)} role in the sandbox, what system teaches it best, and which loop to open next before dropping into raw export details.`)}</p>`,
      heroBadges: [getItemTypeLabel(item), item.data.defaultAction || "No default action", item.data.stackable ? "Stackable" : "Single slot", `${collectItemJourneyLinks(manualContent, item).length} linked journeys`],
      heroAside,
      body
    })
  };
}

function renderItemIndexPage(bundle, editorial, manualContent, siteAssets) {
  const cards = bundle.items.map((item) => renderItemCard(item, siteAssets)).join("");

  const heroAside = `
    <div class="hero-panel">
      ${renderStatGrid([
        { label: "Items", value: bundle.items.length, detail: "All canonical exports" },
        { label: "Journeys", value: manualContent.journeys.journeys.length, detail: "Curated guided routes" },
        { label: "Icon coverage", value: `${bundle.items.filter((item) => getItemIconAssetId(item)).length} with artwork`, detail: "Pixel assets copied into the codex build" },
        { label: "Equipment", value: bundle.items.filter((item) => EQUIPMENT_TYPES.has(item.data.type) || item.data.type === "weapon").length, detail: "Combat and gear pages" }
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
          <p class="eyebrow">Browse Items</p>
          <h3>Search by item, role, type, or the systems that teach it.</h3>
        </div>
        ${renderSearchHeader("items", "Search items by role, type, skill, world, or title", bundle.items.length)}
      </div>
      ${renderItemFilterChips("items", ["combat", "gather", "food", "runes", "tools", "jewelry"])}
    </section>
    <section class="entity-grid" data-filter-group="items">
      ${cards}
    </section>
  `;

  return {
    routePath: buildSectionPath("items"),
    html: renderLayout({
      editorial,
      manifest: bundle.manifest,
      currentPath: buildSectionPath("items"),
      pageTitle: "Items",
      eyebrow: "Living Manual",
      heroTitle: "Items",
      heroBody: "<p>Browse the item layer as part of a bigger manual: what each item does, which system teaches it, and what journey it belongs to.</p>",
      heroBadges: ["Item-first guides", "Linked journeys", "Export-backed data"],
      heroAside,
      body
    })
  };
}

module.exports = {
  renderItemIndexPage,
  renderItemPage
};
