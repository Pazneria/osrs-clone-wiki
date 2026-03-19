const { buildCodexEntityPath } = require("../lib/codex-link-contract");
const { renderLayout } = require("./layout");
const {
  renderGuideBlockSection,
  renderJourneyCard
} = require("./manual");
const {
  buildSectionPath,
  describeList,
  escapeHtml,
  formatNumber,
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

function countRecipes(skill) {
  return skill.data && skill.data.recipeSet ? Object.keys(skill.data.recipeSet).length : 0;
}

function countNodes(skill) {
  return skill.data && skill.data.nodeTable ? Object.keys(skill.data.nodeTable).length : 0;
}

function countMerchants(skill) {
  return Array.isArray(skill.merchantIds) ? skill.merchantIds.length : 0;
}

function getPrimaryResource(skill, itemIndex) {
  const itemId = skill.data && skill.data.economy ? skill.data.economy.primaryResource : null;
  if (!itemId) return "None";
  const item = itemIndex.get(itemId);
  return item ? item.title : humanizeId(itemId);
}

function compactItemList(itemIds, itemIndex, max = 6) {
  const rows = (Array.isArray(itemIds) ? itemIds : []).filter(Boolean);
  if (!rows.length) return "None";
  const labels = rows.slice(0, max).map((itemId) => {
    const item = itemIndex.get(itemId);
    return item ? item.title : humanizeId(itemId);
  });
  const overflow = rows.length - labels.length;
  return overflow > 0 ? `${labels.join(", ")} + ${overflow} more` : labels.join(", ");
}

function resolveManualContent(bundle, editorial, manualContent) {
  return manualContent || (editorial && editorial.manualContent) || (bundle && bundle.manualContent) || {};
}

function getManualSkillEntry(manualContent, skillId) {
  return manualContent && manualContent.skillsById ? manualContent.skillsById[skillId] : null;
}

function getManualJourneys(manualContent) {
  if (manualContent && manualContent.journeys && Array.isArray(manualContent.journeys.journeys)) {
    return manualContent.journeys.journeys;
  }
  return Array.isArray(manualContent && manualContent.journeys) ? manualContent.journeys : [];
}

function resolveSkillRenderArgs(bundle, editorial, manualContentOrSkill, skillOrSiteAssets, maybeSiteAssets) {
  const looksLikeSkill = manualContentOrSkill && typeof manualContentOrSkill === "object" && typeof manualContentOrSkill.skillId === "string";
  if (looksLikeSkill) {
    return {
      manualContent: resolveManualContent(bundle, editorial, maybeSiteAssets),
      skill: manualContentOrSkill,
      siteAssets: skillOrSiteAssets || {}
    };
  }

  return {
    manualContent: resolveManualContent(bundle, editorial, manualContentOrSkill),
    skill: skillOrSiteAssets,
    siteAssets: maybeSiteAssets || {}
  };
}

function resolveSkillIndexArgs(bundle, editorial, manualContentOrSiteAssets, maybeSiteAssets) {
  const looksLikeManualContent = manualContentOrSiteAssets
    && typeof manualContentOrSiteAssets === "object"
    && (manualContentOrSiteAssets.skillsById || manualContentOrSiteAssets.journeys || manualContentOrSiteAssets.schemaVersion);

  return looksLikeManualContent
    ? {
      manualContent: resolveManualContent(bundle, editorial, manualContentOrSiteAssets),
      siteAssets: maybeSiteAssets || {}
    }
    : {
      manualContent: resolveManualContent(bundle, editorial, maybeSiteAssets),
      siteAssets: manualContentOrSiteAssets || {}
    };
}

function buildSkillIndexTeaser(skill, itemIndex, manualEntry) {
  if (manualEntry && Array.isArray(manualEntry.overview) && manualEntry.overview.length) {
    return manualEntry.overview[0];
  }
  return buildSkillSummaryLine(skill, itemIndex);
}

function buildManualGuidanceBlocks(skill, manualEntry) {
  return [
    {
      label: "Overview",
      body: manualEntry && Array.isArray(manualEntry.overview) && manualEntry.overview.length
        ? manualEntry.overview
        : [`Use ${skill.title} as a living reference: start with the manual story, then follow the linked systems and journey routes before opening the raw export data.`]
    },
    {
      label: "Why It Matters",
      body: manualEntry && Array.isArray(manualEntry.whyItMatters) && manualEntry.whyItMatters.length
        ? manualEntry.whyItMatters
        : [`${skill.title} is where item flow, unlock pacing, and regional loops meet in one place.`]
    },
    {
      label: "How To Get Started",
      body: manualEntry && Array.isArray(manualEntry.howToGetStarted) && manualEntry.howToGetStarted.length
        ? manualEntry.howToGetStarted
        : [`Open the unlock highlights first, then jump into the connected systems and journey links that fit your current goal.`]
    },
    {
      label: "Connected Systems",
      body: manualEntry && Array.isArray(manualEntry.connectedSystems) && manualEntry.connectedSystems.length
        ? manualEntry.connectedSystems
        : [`Treat the linked items, worlds, and journeys on this page as the operational map around ${skill.title}.`]
    },
    {
      label: "Next Steps",
      body: manualEntry && Array.isArray(manualEntry.nextSteps) && manualEntry.nextSteps.length
        ? manualEntry.nextSteps
        : [`Use the deeper reference tables below once you have the manual story in mind.`]
    }
  ];
}

function buildUnlockHighlights(skill, itemIndex) {
  const recipeRows = buildRecipeRows(skill, itemIndex);
  const nodeTable = skill.data && skill.data.nodeTable && typeof skill.data.nodeTable === "object" ? skill.data.nodeTable : {};
  const nodeIds = Object.keys(nodeTable);
  const firstRecipe = recipeRows[0] || null;
  const firstNode = nodeIds
    .map((nodeId) => ({ nodeId, node: nodeTable[nodeId] }))
    .sort((left, right) => (left.node.unlockLevel || 0) - (right.node.unlockLevel || 0))[0] || null;
  const merchantTable = skill.data && skill.data.economy && skill.data.economy.merchantTable
    ? skill.data.economy.merchantTable
    : {};
  const merchantIds = Object.keys(merchantTable).sort();
  const firstMerchantUnlock = merchantIds
    .map((merchantId) => ({ merchantId, merchant: merchantTable[merchantId] }))
    .find((entry) => entry.merchant && (entry.merchant.unlocks || entry.merchant.pouchUnlocks));
  const bands = Array.isArray(skill.data && skill.data.levelBands) ? skill.data.levelBands : [];

  return [
    {
      label: "First Recipe Gate",
      value: firstRecipe && firstRecipe.level !== null && firstRecipe.level !== undefined ? `Level ${firstRecipe.level}` : "No level gate",
      detail: firstRecipe ? firstRecipe.output : "No exported recipe rows."
    },
    {
      label: "First Node Unlock",
      value: firstNode && firstNode.node && firstNode.node.unlockLevel !== undefined ? `Level ${firstNode.node.unlockLevel}` : "No node unlock",
      detail: firstNode ? humanizeId(firstNode.nodeId) : "No node families exported."
    },
    {
      label: "Merchant Access",
      value: firstMerchantUnlock
        ? firstMerchantUnlock.merchant.unlocks
          ? `Threshold ${firstMerchantUnlock.merchant.unlocks.threshold || "varies"}`
          : "Pouch unlocks"
        : "No merchant unlock",
      detail: firstMerchantUnlock ? humanizeId(firstMerchantUnlock.merchantId) : "No merchant gating exported."
    },
    {
      label: "Level Bands",
      value: bands.length ? `${bands.length} bands` : "None",
      detail: bands.length ? bands.slice(0, 3).join(", ") : "No progression bands exported."
    },
    {
      label: "Primary Resource",
      value: getPrimaryResource(skill, itemIndex),
      detail: "Backbone resource for the loop"
    }
  ];
}

function getJourneyIdsForSkill(skillId, manualEntry, journeys) {
  const ids = [];
  const manualIds = Array.isArray(manualEntry && manualEntry.featuredJourneyIds) ? manualEntry.featuredJourneyIds : [];
  const related = journeys.filter((journey) => Array.isArray(journey.relatedSkillIds) && journey.relatedSkillIds.includes(skillId));
  manualIds.forEach((journeyId) => {
    if (!ids.includes(journeyId)) ids.push(journeyId);
  });
  related.forEach((journey) => {
    if (!ids.includes(journey.journeyId)) ids.push(journey.journeyId);
  });
  return ids;
}

function renderManualGuidanceSection(skill, manualEntry, linkRegistry) {
  const featuredItemCount = manualEntry && Array.isArray(manualEntry.featuredItemIds) ? manualEntry.featuredItemIds.length : 0;
  const featuredSkillCount = manualEntry && Array.isArray(manualEntry.featuredSkillIds) ? manualEntry.featuredSkillIds.length : 0;
  const featuredWorldCount = manualEntry && Array.isArray(manualEntry.featuredWorldIds) ? manualEntry.featuredWorldIds.length : 0;
  const featuredJourneyCount = manualEntry && Array.isArray(manualEntry.featuredJourneyIds) ? manualEntry.featuredJourneyIds.length : 0;

  return renderGuideBlockSection({
    eyebrow: "Manual Guidance",
    title: `How to read ${skill.title}`,
    badges: [
      `${featuredItemCount} featured items`,
      `${featuredSkillCount} featured skills`,
      `${featuredWorldCount} featured worlds`,
      `${featuredJourneyCount} featured journeys`
    ],
    blocks: buildManualGuidanceBlocks(skill, manualEntry),
    linkRegistry,
    excludeHrefs: [skill.path]
  });
}

function renderUnlockHighlightsSection(skill, itemIndex) {
  return `
    <section class="section-card">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Unlock Highlights</p>
          <h3>What opens up as you progress</h3>
        </div>
      </div>
      ${renderStatGrid(buildUnlockHighlights(skill, itemIndex), {
        className: "hero-stat-grid",
        itemClassName: "hero-stat-card"
      })}
    </section>
  `;
}

function renderSkillConnectionsSection(skill, itemIndex, skillIndex, worldIndex, manualEntry, linkRegistry) {
  const linkedItemIds = Array.isArray(manualEntry && manualEntry.featuredItemIds) && manualEntry.featuredItemIds.length
    ? manualEntry.featuredItemIds
    : skill.relatedItemIds;
  const linkedSkillIds = Array.isArray(manualEntry && manualEntry.featuredSkillIds) && manualEntry.featuredSkillIds.length
    ? manualEntry.featuredSkillIds
    : (skill.relatedSkillIds || []).filter((skillId) => skillId !== skill.skillId);
  const linkedWorldIds = Array.isArray(manualEntry && manualEntry.featuredWorldIds) && manualEntry.featuredWorldIds.length
    ? manualEntry.featuredWorldIds
    : skill.relatedWorldIds;

  const itemLabels = linkedItemIds.map((itemId) => (itemIndex.get(itemId) || {}).title || itemId);
  const skillLabels = linkedSkillIds.map((relatedSkillId) => (skillIndex.get(relatedSkillId) || {}).title || relatedSkillId);
  const worldLabels = linkedWorldIds.map((worldId) => (worldIndex.get(worldId) || {}).title || worldId);
  const summaryParagraphs = [
    itemLabels.length ? `This skill is most visible through ${describeList(itemLabels)}.` : "",
    skillLabels.length ? `It overlaps with ${describeList(skillLabels)}.` : "",
    worldLabels.length ? `The loop is anchored in ${describeList(worldLabels)}.` : ""
  ].filter(Boolean);

  return `
    <section class="section-card">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Connected Systems</p>
          <h3>Items, skills, and worlds that anchor the loop</h3>
        </div>
      </div>
      ${summaryParagraphs.length
        ? `<div class="prose">${summaryParagraphs.map((paragraph) => `<p>${renderInlineLinkedText(paragraph, { linkRegistry, excludeHrefs: [skill.path] })}</p>`).join("")}</div>`
        : `<p class="subtle">No connected systems yet.</p>`}
      ${renderMetaList([
        { label: "Related items", html: renderInlineLinkedList(itemLabels, { linkRegistry, excludeHrefs: [skill.path], emptyText: "None" }) },
        { label: "Related skills", html: renderInlineLinkedList(skillLabels, { linkRegistry, excludeHrefs: [skill.path], emptyText: "None" }) },
        { label: "Related worlds", html: renderInlineLinkedList(worldLabels, { linkRegistry, excludeHrefs: [skill.path], emptyText: "None" }) }
      ], { emptyText: "No connected systems yet." })}
    </section>
  `;
}

function renderJourneySection(skill, manualEntry, journeys, linkRegistry) {
  const journeyIds = getJourneyIdsForSkill(skill.skillId, manualEntry, journeys);
  const journeyMap = new Map(journeys.map((journey) => [journey.journeyId, journey]));
  const spotlightJourneys = journeyIds.map((journeyId) => journeyMap.get(journeyId)).filter(Boolean);

  return `
    <section class="section-card">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Guided Routes</p>
          <h3>Guided routes that teach this skill in context</h3>
        </div>
      </div>
      ${spotlightJourneys.length
        ? `<div class="prose"><p>${renderInlineLinkedText(
          `Follow ${describeList(spotlightJourneys.slice(0, 4).map((journey) => journey.title))} if you want guided progression instead of reading ${skill.title} in isolation.`,
          { linkRegistry, excludeHrefs: [skill.path] }
        )}</p></div>`
        : `<p class="subtle">No linked journeys were exported for this skill.</p>`}
    </section>
  `;
}

function buildSkillSummaryLine(skill, itemIndex) {
  const parts = [];
  if (countRecipes(skill)) parts.push(`${countRecipes(skill)} recipes`);
  if (countNodes(skill)) parts.push(`${countNodes(skill)} node families`);
  if (countMerchants(skill)) parts.push(`${countMerchants(skill)} merchants`);
  parts.push(`Primary resource: ${getPrimaryResource(skill, itemIndex)}`);
  return parts.join(" | ");
}

function renderSkillCard(skill, itemIndex, siteAssets) {
  return `
    <article class="entity-card entity-card--indexed" data-search="${escapeHtml(`${skill.title} ${skill.skillId} ${skill.merchantIds.join(" ")} ${skill.relatedItemIds.join(" ")}`)}">
      <div class="entity-card__header">
        ${renderEntityIcon({
          siteAssets,
          label: skill.title,
          size: "md",
          fallbackText: skill.skillId
        })}
        <div class="entity-card__copy">
          <p class="eyebrow">${escapeHtml(skill.skillId)}</p>
          <h3><a href="${escapeHtml(skill.path)}">${escapeHtml(skill.title)}</a></h3>
          <p class="entity-card__lede">${escapeHtml(buildSkillSummaryLine(skill, itemIndex))}</p>
        </div>
      </div>
      ${renderChipList([
        `${skill.relatedItemIds.length} items`,
        `${skill.relatedWorldIds.length} worlds`,
        `${countRecipes(skill)} recipes`,
        `${countNodes(skill)} nodes`
      ], { className: "pill-list pill-list--dense" })}
    </article>
  `;
}

function buildRecipeRows(skill, itemIndex) {
  const recipeSet = skill.data && skill.data.recipeSet && typeof skill.data.recipeSet === "object" ? skill.data.recipeSet : {};
  return Object.keys(recipeSet).map((recipeId) => {
    const recipe = recipeSet[recipeId];
    const output = recipe && recipe.output ? recipe.output : {};
    const outputItem = output.itemId ? itemIndex.get(output.itemId) : null;
    return {
      level: recipe && recipe.requiredLevel !== undefined ? recipe.requiredLevel : null,
      xp: recipe && recipe.xpPerAction !== undefined ? recipe.xpPerAction : null,
      station: recipe && recipe.stationType ? humanizeId(recipe.stationType) : "Any",
      tools: describeList(recipe && recipe.requiredToolIds ? recipe.requiredToolIds.map(humanizeId) : [], "None"),
      output: outputItem ? `${outputItem.title}${output.amount > 1 ? ` x${output.amount}` : ""}` : recipeId,
      outputHref: output.itemId ? buildCodexEntityPath("item", output.itemId) : null,
      inputs: (Array.isArray(recipe && recipe.inputs) ? recipe.inputs : []).map((input) => {
        const inputItem = itemIndex.get(input.itemId);
        return `${inputItem ? inputItem.title : humanizeId(input.itemId)} x${input.amount}`;
      }).join(", ")
    };
  }).sort((left, right) => (left.level || 0) - (right.level || 0) || left.output.localeCompare(right.output));
}

function renderRecipeSection(skill, itemIndex, linkRegistry) {
  const rows = buildRecipeRows(skill, itemIndex);
  if (!rows.length) return "";
  return `
    <section class="section-card">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Recipes</p>
          <h3>Crafting and conversion routes</h3>
        </div>
      </div>
      ${renderTable({
        columns: [
          {
            label: "Output",
            render: (row) => row.outputHref
              ? `<a class="table-link" href="${escapeHtml(row.outputHref)}">${escapeHtml(row.output)}</a>`
              : escapeHtml(row.output)
          },
          { label: "Level", render: (row) => escapeHtml(formatNumber(row.level)) },
          { label: "XP", render: (row) => escapeHtml(formatNumber(row.xp)) },
          { label: "Inputs", render: (row) => renderInlineLinkedText(row.inputs || "None", { linkRegistry }) },
          { label: "Tools / Station", render: (row) => renderInlineLinkedText(`${row.tools} | ${row.station}`, { linkRegistry }) }
        ],
        rows,
        emptyText: "No recipe rows exported."
      })}
    </section>
  `;
}

function renderNodeSection(skill, itemIndex, linkRegistry) {
  const nodeTable = skill.data && skill.data.nodeTable && typeof skill.data.nodeTable === "object" ? skill.data.nodeTable : {};
  const nodeIds = Object.keys(nodeTable);
  if (!nodeIds.length) return "";

  const hasMethodNodes = nodeIds.some((nodeId) => nodeTable[nodeId] && nodeTable[nodeId].methods);
  if (hasMethodNodes) {
    return `
      <section class="section-card">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Node Families</p>
            <h3>Gathering methods and unlock breakpoints</h3>
          </div>
        </div>
        <div class="entity-grid">
          ${nodeIds.sort().map((nodeId) => {
            const node = nodeTable[nodeId];
            const methods = node && node.methods ? Object.values(node.methods) : [];
            return `
              <article class="entity-card">
                <p class="eyebrow">${escapeHtml(humanizeId(nodeId))}</p>
                <h4>${escapeHtml(`${node.unlockLevel || 1}+ unlock`)}${node.baseCatchChance !== undefined ? ` | ${escapeHtml(String(Math.round(node.baseCatchChance * 100)))}% base` : ""}</h4>
                ${renderMetaList([
                  { label: "Level scaling", value: node.levelScaling !== undefined ? node.levelScaling : "None" },
                  { label: "Max success", value: node.maxCatchChance !== undefined ? `${Math.round(node.maxCatchChance * 100)}%` : "None" },
                  { label: "Tile IDs", value: describeList(node.tileIds || []) }
                ], { emptyText: "No node-family summary." })}
                ${renderTable({
                  columns: [
                    { label: "Method", render: (row) => escapeHtml(humanizeId(row.methodId)) },
                    { label: "Unlock", render: (row) => escapeHtml(formatNumber(row.unlockLevel)) },
                    { label: "Tools", render: (row) => renderInlineLinkedText(row.tools, { linkRegistry }) },
                    { label: "Rewards", render: (row) => renderInlineLinkedText(row.rewards, { linkRegistry }) }
                  ],
                  rows: methods.map((method) => ({
                    methodId: method.methodId,
                    unlockLevel: method.unlockLevel,
                    tools: describeList((method.toolIds || []).map((toolId) => {
                      const item = itemIndex.get(toolId);
                      return item ? item.title : humanizeId(toolId);
                    })),
                    rewards: (Array.isArray(method.fishByLevel) ? method.fishByLevel : []).map((entry) => {
                      return (Array.isArray(entry.fish) ? entry.fish : []).map((fish) => {
                        const reward = itemIndex.get(fish.itemId);
                        return `${reward ? reward.title : humanizeId(fish.itemId)} (${fish.requiredLevel}+ / ${fish.xp} XP)`;
                      }).join(", ");
                    }).filter(Boolean).join(" | ")
                  })),
                  emptyText: "No node methods exported."
                })}
              </article>
            `;
          }).join("")}
        </div>
      </section>
    `;
  }

  const rows = nodeIds.sort().map((nodeId) => {
    const node = nodeTable[nodeId];
    const rewardItem = itemIndex.get(node.rewardItemId);
    return {
      nodeId,
      reward: rewardItem ? rewardItem.title : humanizeId(node.rewardItemId),
      rewardHref: node.rewardItemId ? buildCodexEntityPath("item", node.rewardItemId) : null,
      level: node.requiredLevel,
      xp: node.xpPerSuccess,
      respawn: node.respawnTicks !== undefined ? `${node.respawnTicks} ticks` : node.persistent ? "Persistent" : "None",
      difficulty: node.difficulty !== undefined ? node.difficulty : "None"
    };
  });

  return `
    <section class="section-card">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Node Table</p>
          <h3>Gathering targets and reward pacing</h3>
        </div>
      </div>
      ${renderTable({
        columns: [
          { label: "Node", render: (row) => escapeHtml(humanizeId(row.nodeId)) },
          {
            label: "Reward",
            render: (row) => row.rewardHref
              ? `<a class="table-link" href="${escapeHtml(row.rewardHref)}">${escapeHtml(row.reward)}</a>`
              : escapeHtml(row.reward)
          },
          { label: "Level", render: (row) => escapeHtml(formatNumber(row.level)) },
          { label: "XP", render: (row) => escapeHtml(formatNumber(row.xp)) },
          { label: "Respawn", render: (row) => escapeHtml(row.respawn) },
          { label: "Difficulty", render: (row) => escapeHtml(formatNumber(row.difficulty)) }
        ],
        rows,
        emptyText: "No node rows exported."
      })}
    </section>
  `;
}

function renderMerchantSection(skill, itemIndex, linkRegistry) {
  const merchantTable = skill.data && skill.data.economy && skill.data.economy.merchantTable
    ? skill.data.economy.merchantTable
    : {};
  const merchantIds = Object.keys(merchantTable).sort();
  const valueTable = skill.data && skill.data.economy && skill.data.economy.valueTable
    ? skill.data.economy.valueTable
    : {};

  const merchantCards = merchantIds.length ? `
    <div class="entity-grid">
      ${merchantIds.map((merchantId) => {
        const merchant = merchantTable[merchantId];
        return `
          <article class="entity-card">
            <p class="eyebrow">${escapeHtml(humanizeId(merchantId))}</p>
            <h4>${escapeHtml(`${(merchant.buys || []).length} buys | ${(merchant.sells || []).length} sells`)}</h4>
            ${renderMetaList([
              { label: "Strict buys", value: merchant.strictBuys ? "Yes" : "No" },
              {
                label: "Unlocks",
                html: renderInlineLinkedText(
                  merchant.unlocks
                    ? `Threshold ${merchant.unlocks.threshold || "varies"}`
                    : merchant.pouchUnlocks
                      ? describeList(Object.keys(merchant.pouchUnlocks).map((itemId) => `${humanizeId(itemId)} @ ${merchant.pouchUnlocks[itemId]}`))
                      : "None",
                  { linkRegistry }
                )
              },
              { label: "Buys", html: renderInlineLinkedText(compactItemList(merchant.buys, itemIndex), { linkRegistry }) },
              { label: "Sells", html: renderInlineLinkedText(compactItemList(merchant.sells, itemIndex), { linkRegistry }) }
            ], { emptyText: "No merchant data." })}
          </article>
        `;
      }).join("")}
    </div>
  ` : "<p class=\"subtle\">No merchant table exported.</p>";

  const valueRows = Object.keys(valueTable).sort().map((itemId) => {
    const item = itemIndex.get(itemId);
    return {
      itemLabel: item ? item.title : humanizeId(itemId),
      buy: valueTable[itemId].buy,
      sell: valueTable[itemId].sell
    };
  });

  return `
    <section class="section-card">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Economy</p>
          <h3>Merchants, buyback rules, and value references</h3>
        </div>
      </div>
      ${renderMetaList([
        { label: "Primary resource", html: renderInlineLinkedText(getPrimaryResource(skill, itemIndex), { linkRegistry }) },
        { label: "General store fallback", value: skill.data && skill.data.economy && skill.data.economy.generalStoreFallback ? describeList(Object.keys(skill.data.economy.generalStoreFallback)) : "None" }
      ])}
      ${merchantCards}
      ${renderTable({
        columns: [
          { label: "Item", render: (row) => renderInlineLinkedText(row.itemLabel, { linkRegistry }) },
          { label: "Buy", render: (row) => escapeHtml(row.buy === null || row.buy === undefined ? "None" : formatNumber(row.buy)) },
          { label: "Sell", render: (row) => escapeHtml(row.sell === null || row.sell === undefined ? "None" : formatNumber(row.sell)) }
        ],
        rows: valueRows,
        emptyText: "No value table exported."
      })}
    </section>
  `;
}

function renderFormulaSection(skill) {
  const formulas = skill.data && skill.data.formulas ? skill.data.formulas : {};
  const timing = skill.data && skill.data.timing ? skill.data.timing : {};
  return `
    <section class="section-card">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Rules</p>
          <h3>Timing, formulas, and progression ranges</h3>
        </div>
      </div>
      ${renderMetaList([
        { label: "Level bands", value: describeList(skill.data.levelBands || []) },
        { label: "Timing", value: Object.keys(timing).length ? Object.keys(timing).map((key) => `${humanizeId(key)}: ${formatTicks(timing[key])}`).join(", ") : "None" },
        { label: "Formulas", value: Object.keys(formulas).length ? Object.keys(formulas).map((key) => `${humanizeId(key)}: ${formulas[key]}`).join(", ") : "None" }
      ])}
    </section>
  `;
}

function renderSkillPage(bundle, editorial, manualContentOrSkill, skillOrSiteAssets, maybeSiteAssets) {
  const { manualContent, skill, siteAssets } = resolveSkillRenderArgs(
    bundle,
    editorial,
    manualContentOrSkill,
    skillOrSiteAssets,
    maybeSiteAssets
  );
  const itemIndex = new Map(bundle.items.map((item) => [item.itemId, item]));
  const skillIndex = new Map(bundle.skills.map((entry) => [entry.skillId, entry]));
  const worldIndex = new Map(bundle.worlds.map((world) => [world.worldId, world]));
  const manualEntry = getManualSkillEntry(manualContent, skill.skillId);
  const journeys = getManualJourneys(manualContent);

  const heroAside = `
    <div class="hero-panel hero-panel--entity">
      <div class="hero-entity-lockup">
        ${renderEntityIcon({
          siteAssets,
          label: skill.title,
          size: "xl",
          fallbackText: skill.skillId
        })}
        <div>
          <p class="eyebrow">Showcase Skill</p>
          <p class="hero-entity-note">${escapeHtml(buildSkillSummaryLine(skill, itemIndex))}</p>
        </div>
      </div>
      ${renderStatGrid([
        { label: "Recipes", value: countRecipes(skill) },
        { label: "Nodes", value: countNodes(skill) },
        { label: "Merchants", value: countMerchants(skill) },
        { label: "Worlds", value: skill.relatedWorldIds.length }
      ], {
        className: "hero-stat-grid",
        itemClassName: "hero-stat-card"
      })}
    </div>
  `;

  const body = `
    ${renderManualGuidanceSection(skill, manualEntry, siteAssets.linkRegistry)}
    ${renderUnlockHighlightsSection(skill, itemIndex)}
    ${renderSkillConnectionsSection(skill, itemIndex, skillIndex, worldIndex, manualEntry, siteAssets.linkRegistry)}
    ${renderJourneySection(skill, manualEntry, journeys, siteAssets.linkRegistry)}
    <section class="section-card">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Overview</p>
          <h3>What this skill contributes to the sandbox</h3>
        </div>
      </div>
      ${renderMetaList([
        { label: "Skill ID", value: skill.skillId },
        { label: "Primary resource", html: renderInlineLinkedText(getPrimaryResource(skill, itemIndex), { linkRegistry: siteAssets.linkRegistry, excludeHrefs: [skill.path] }) },
        { label: "Referenced items", value: skill.relatedItemIds.length },
        {
          label: "Referenced worlds",
          html: renderInlineLinkedList(
            skill.relatedWorldIds.map((worldId) => (worldIndex.get(worldId) || {}).title || worldId),
            { linkRegistry: siteAssets.linkRegistry, excludeHrefs: [skill.path], emptyText: "None" }
          )
        },
        { label: "Recipe count", value: countRecipes(skill) },
        { label: "Node families", value: countNodes(skill) }
      ])}
    </section>
    ${renderRecipeSection(skill, itemIndex, siteAssets.linkRegistry)}
    ${renderNodeSection(skill, itemIndex, siteAssets.linkRegistry)}
    ${renderMerchantSection(skill, itemIndex, siteAssets.linkRegistry)}
    ${renderFormulaSection(skill)}
    <section class="section-card">
      ${renderJsonDetails("Raw exported skill data", skill.data)}
    </section>
  `;

  return {
    routePath: skill.path,
    html: renderLayout({
      editorial,
      manifest: bundle.manifest,
      currentPath: skill.path,
      pageTitle: skill.title,
      eyebrow: "Skill Reference",
      heroTitle: skill.title,
      heroBody: `<p>${escapeHtml(`Use this page to review ${skill.title}'s manual guidance, unlock highlights, inline reference context, and guided routes before opening the raw export bundle.`)}</p>`,
      heroBadges: [getPrimaryResource(skill, itemIndex), `${countRecipes(skill)} recipes`, `${countNodes(skill)} node families`],
      heroAside,
      body
    })
  };
}

function renderSkillIndexPage(bundle, editorial, manualContentOrSiteAssets, maybeSiteAssets) {
  const { manualContent, siteAssets } = resolveSkillIndexArgs(bundle, editorial, manualContentOrSiteAssets, maybeSiteAssets);
  const itemIndex = new Map(bundle.items.map((item) => [item.itemId, item]));
  const manualJourneys = getManualJourneys(manualContent);
  const journeyCount = manualJourneys.length;
  const cards = bundle.skills.map((skill) => {
    const manualEntry = getManualSkillEntry(manualContent, skill.skillId);
    const teaser = buildSkillIndexTeaser(skill, itemIndex, manualEntry);
    const relatedJourneyCount = getJourneyIdsForSkill(skill.skillId, manualEntry, manualJourneys).length;
    return `
      <article class="entity-card entity-card--indexed" data-search="${escapeHtml(`${skill.title} ${skill.skillId} ${skill.merchantIds.join(" ")} ${skill.relatedItemIds.join(" ")}`)}">
        <div class="entity-card__header">
          ${renderEntityIcon({
            siteAssets,
            label: skill.title,
            size: "md",
            fallbackText: skill.skillId
          })}
          <div class="entity-card__copy">
            <p class="eyebrow">${escapeHtml(skill.skillId)}</p>
            <h3><a href="${escapeHtml(skill.path)}">${escapeHtml(skill.title)}</a></h3>
            <p class="entity-card__lede">${renderInlineLinkedText(teaser, { linkRegistry: siteAssets.linkRegistry, excludeHrefs: [skill.path] })}</p>
          </div>
        </div>
        ${renderChipList([
          `${skill.relatedItemIds.length} items`,
          `${skill.relatedWorldIds.length} worlds`,
          `${countRecipes(skill)} recipes`,
          `${relatedJourneyCount} journeys`
        ], { className: "pill-list pill-list--dense" })}
      </article>
    `;
  }).join("");
  const journeySpotlights = manualJourneys.slice(0, 4).map((journey) => renderJourneyCard(journey, {
    monogram: journey.journeyId.slice(0, 2).toUpperCase(),
    linkRegistry: siteAssets.linkRegistry,
    excludeHrefs: [journey.path]
  })).join("");

  const heroAside = `
    <div class="hero-panel">
      ${renderStatGrid([
        { label: "Skills", value: bundle.skills.length, detail: "Core sandbox systems" },
        { label: "Recipes", value: bundle.skills.reduce((total, skill) => total + countRecipes(skill), 0), detail: "Actionable crafting rows" },
        { label: "Node Families", value: bundle.skills.reduce((total, skill) => total + countNodes(skill), 0), detail: "Gathering and method groups" },
        { label: "Journeys", value: journeyCount, detail: "Manual learning routes" }
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
          <p class="eyebrow">Manual Primer</p>
          <h3>Use the index like a field guide, not just a directory.</h3>
        </div>
      </div>
      ${renderGuideBlockSection({
        eyebrow: "Skill Index Manual",
        title: "How to navigate the skill layer",
        badges: [
          `${bundle.skills.length} skills`,
          `${journeyCount} journeys`,
          "Manual-first reading"
        ],
        blocks: [
          {
            label: "Start With Intent",
            body: ["Pick the skill page that matches the loop you want to understand, then read the manual guidance before the raw tables."]
          },
          {
            label: "Follow The Links",
            body: ["Use the connected systems and journey routes to understand how the skill fits into items, worlds, and progression."]
          }
        ]
      })}
    </section>
    ${journeySpotlights ? `
      <section class="section-card">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Journey Spotlight</p>
            <h3>Routes that teach the skill layer in motion</h3>
          </div>
        </div>
        <div class="entity-grid">
          ${journeySpotlights}
        </div>
      </section>
    ` : ""}
    <section class="section-card">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Browse Skills</p>
          <h3>Search by skill ID, merchant, or the items a system touches.</h3>
        </div>
        ${renderSearchHeader("skills", "Search skills by id, merchant, or referenced item", bundle.skills.length)}
      </div>
    </section>
    <section class="entity-grid" data-filter-group="skills">
      ${cards}
    </section>
  `;

  return {
    routePath: buildSectionPath("skills"),
    html: renderLayout({
      editorial,
      manifest: bundle.manifest,
      currentPath: buildSectionPath("skills"),
      pageTitle: "Skills",
      eyebrow: "Entity Index",
      heroTitle: "Skills",
      heroBody: "<p>Browse skill pages designed as living manuals: guidance first, then unlocks, connected systems, and journey links, with raw reference data waiting below.</p>",
      heroBadges: ["Manual-first pages", "Journey-linked", "Connected systems"],
      heroAside,
      body
    })
  };
}

module.exports = {
  renderSkillIndexPage,
  renderSkillPage
};
