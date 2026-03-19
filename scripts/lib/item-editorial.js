const fs = require("fs");
const path = require("path");

const ITEM_EDITORIAL_SCHEMA_VERSION = 1;
const ITEM_EDITORIAL_STATUS_VALUES = new Set(["draft", "reviewed"]);
const EQUIPMENT_TYPES = new Set(["weapon", "head", "body", "legs", "feet", "shield"]);

const ITEM_EDITORIAL_BATCHES = Object.freeze([
  { id: "smithing_materials", title: "Smithing Materials" },
  { id: "metal_gear", title: "Metal Gear" },
  { id: "wood_and_fletching", title: "Wood And Fletching" },
  { id: "fishing_and_food", title: "Fishing And Food" },
  { id: "runecrafting_and_magic", title: "Runecrafting And Magic" },
  { id: "crafting_and_jewelry", title: "Crafting And Jewelry" },
  { id: "utility_and_outliers", title: "Utility And Outliers" }
]);

const UTILITY_ITEM_IDS = new Set([
  "hammer",
  "knife",
  "tinderbox",
  "coins",
  "ashes",
  "soft_clay",
  "feathers_bundle",
  "rat_tail",
  "goblin_club",
  "boar_tusk",
  "wolf_fang",
  "guard_spear",
  "guard_crest"
]);
const FISHING_ITEM_IDS = new Set(["bait", "small_net", "fishing_rod", "harpoon", "rune_harpoon"]);
const RUNECRAFTING_ITEM_IDS = new Set(["rune_essence", "air_staff", "earth_staff", "water_staff", "fire_staff"]);
const CRAFTING_ITEM_IDS = new Set(["bow_string", "needle", "thread", "chisel", "clay"]);
const SMITHING_COMPONENT_IDS = new Set(["coal"]);
const METAL_GEAR_PATTERN = /^(bronze|iron|steel|mithril|adamant|rune)_(axe|pickaxe|boots|helmet|platebody|platelegs|shield|sword)$/;
const JEWELRY_PATTERN = /_(ring|amulet)$/;
const GEM_PATTERN = /^(uncut|cut)_(diamond|emerald|ruby|sapphire)$/;
const TOOL_SKILL_HINTS = Object.freeze({
  axe: {
    skillId: "woodcutting",
    text: "Used as a Woodcutting tool and can also be equipped in combat."
  },
  pickaxe: {
    skillId: "mining",
    text: "Used as a Mining tool and can also be equipped in combat."
  },
  harpoon: {
    skillId: "fishing",
    text: "Used to catch fish at Harpoon fishing methods."
  }
});

const SPECIAL_ITEM_EDITORIAL_SEEDS = Object.freeze({
  boar_tusk: Object.freeze({
    description: "A boar tusk kept as one of the first animal-specific trophy drops in the starter combat loop.",
    acquisition: "Drops from boars in the outer fields of Starter Town and North Road Camp.",
    uses: "No recipe or merchant path is exported for it, but it fits the same outer-field progression lane that feeds Tanner Rusk's tannery-side quest arc."
  }),
  goblin_club: Object.freeze({
    description: "A rough goblin club recovered as low-tier camp loot rather than player-ready equipment.",
    acquisition: "Drops from goblin grunts in Starter Town and North Road Camp.",
    uses: "No recipe or shop path is exported for it, so it mainly marks the jump from critter drops into roaming goblin encounters."
  }),
  guard_crest: Object.freeze({
    description: "A guard crest taken as a recognizable patrol drop with more identity than the starter animal trophies.",
    acquisition: "Drops from guards in Starter Town and North Road Camp.",
    uses: "No crafting or merchant path is exported for it, so it mainly serves as higher-tier patrol loot and named-faction flavor."
  }),
  guard_spear: Object.freeze({
    description: "A guard spear recovered as loot rather than exported player equipment.",
    acquisition: "Drops from guards in Starter Town and North Road Camp.",
    uses: "No equipment, recipe, or merchant path is exported for it yet, so it currently reads as higher-tier guard loot with presentation value more than utility."
  }),
  rat_tail: Object.freeze({
    description: "A rat tail kept as a disposable proof-of-kill drop from the very bottom of the combat ladder.",
    acquisition: "Drops from rats in Starter Town and North Road Camp.",
    uses: "No recipe or merchant path is exported for it, so it mainly serves as low-value starter loot and encounter flavor."
  }),
  raw_boar_meat: Object.freeze({
    description: "A raw boar meat drop from the outer fields that sits on the combat side of the starter food economy.",
    acquisition: "Drops from boars roaming the outer fields of Starter Town and North Road Camp.",
    uses: "No direct cooking recipe is exported for it yet, but it clearly belongs to the same outer-field progression loop around Tanner Rusk and Hides of the Frontier."
  }),
  raw_chicken: Object.freeze({
    description: "A raw chicken drop that functions as low-risk uncooked food stock in the Starter Town combat loop.",
    acquisition: "Drops from chickens around Starter Town's safer training pockets.",
    uses: "No direct cooking recipe is exported for it yet, so it mainly reads as beginner combat loot before players push into the harsher outer-field routes."
  }),
  raw_wolf_meat: Object.freeze({
    description: "A raw wolf meat drop that marks the more dangerous end of the starter-region food-side combat loot.",
    acquisition: "Drops from wolves in the outer reaches of Starter Town and North Road Camp.",
    uses: "No direct cooking recipe is exported for it yet, but it reads as part of the same animal-hunting loop that surrounds Tanner Rusk's tannery plot and Hides of the Frontier."
  }),
  wolf_fang: Object.freeze({
    description: "A wolf fang kept as a more dangerous animal trophy from the far-out starter-region encounter bands.",
    acquisition: "Drops from wolves in the outer reaches of Starter Town and North Road Camp.",
    uses: "No recipe or merchant path is exported for it, but it reads cleanly as part of the same outer-field pressure that frames Tanner Rusk's first quest and tannery progression."
  })
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(absPath) {
  return JSON.parse(fs.readFileSync(absPath, "utf8"));
}

function writeJson(absPath, value) {
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, `${JSON.stringify(value, null, 2)}\n`);
}

function normalizeArray(value) {
  return (Array.isArray(value) ? value : []).filter(Boolean);
}

function humanizeId(value) {
  return String(value || "")
    .split(/[_\s-]+/g)
    .filter(Boolean)
    .map((part) => {
      const normalized = /^[A-Z0-9]+$/.test(part) ? part.toLowerCase() : part;
      return normalized.charAt(0).toUpperCase() + normalized.slice(1);
    })
    .join(" ");
}

function getItemEditorialDir(projectRoot) {
  return path.join(projectRoot, "content", "editorial", "items");
}

function getItemEditorialOverridePath(projectRoot) {
  return path.join(getItemEditorialDir(projectRoot), "context-overrides.json");
}

function getItemEditorialBatchFile(projectRoot, batchId) {
  return path.join(getItemEditorialDir(projectRoot), `${batchId}.json`);
}

function getItemAuthoringContextDir(projectRoot) {
  return path.join(projectRoot, "content", "generated", "item-authoring-context");
}

function sortStrings(values) {
  return normalizeArray(values).slice().sort((left, right) => left.localeCompare(right));
}

function pushToIndex(index, key, value) {
  if (!key) return;
  if (!index.has(key)) index.set(key, []);
  index.get(key).push(value);
}

function dedupeRows(rows, keyFn) {
  const seen = new Set();
  const result = [];
  normalizeArray(rows).forEach((row) => {
    const key = keyFn(row);
    if (seen.has(key)) return;
    seen.add(key);
    result.push(row);
  });
  return result;
}

function listLabels(rows, max = 3) {
  const values = normalizeArray(rows);
  if (!values.length) return "";
  const labels = values.slice(0, max);
  const overflow = values.length - labels.length;
  return overflow > 0 ? `${labels.join(", ")} + ${overflow} more` : labels.join(", ");
}

function getItemLabel(itemIndex, itemId) {
  const item = itemIndex.get(itemId);
  return item ? item.title : humanizeId(itemId);
}

function getSkillLabel(skillIndex, skillId) {
  const skill = skillIndex.get(skillId);
  return skill ? skill.title : humanizeId(skillId);
}

function buildWorldTitleMap(bundle) {
  return new Map(bundle.worlds.map((world) => [world.worldId, world.title]));
}

function buildMerchantWorldIndex(bundle) {
  const index = new Map();
  bundle.worlds.forEach((world) => {
    normalizeArray(world.data && world.data.services).forEach((service) => {
      const merchantId = String(service && service.merchantId ? service.merchantId : "").trim();
      if (!merchantId) return;
      pushToIndex(index, merchantId, {
        worldId: world.worldId,
        worldTitle: world.title,
        serviceId: service.serviceId || null,
        serviceName: service.name || humanizeId(merchantId)
      });
    });
  });
  return index;
}

function buildNodeWorldIndex(bundle) {
  const index = new Map();
  bundle.worlds.forEach((world) => {
    const resourceNodes = world.data && world.data.resourceNodes ? world.data.resourceNodes : {};
    normalizeArray(resourceNodes.mining).forEach((placement) => {
      pushToIndex(index, `mining:${placement.oreType}`, {
        worldId: world.worldId,
        worldTitle: world.title,
        routeId: placement.routeId || null
      });
    });
    normalizeArray(resourceNodes.woodcutting).forEach((placement) => {
      pushToIndex(index, `woodcutting:${placement.nodeId}`, {
        worldId: world.worldId,
        worldTitle: world.title,
        routeId: placement.routeId || null
      });
    });
  });
  return index;
}

function getItemEditorialBatchId(item) {
  const itemId = item && item.itemId ? item.itemId : "";

  if (UTILITY_ITEM_IDS.has(itemId)) return "utility_and_outliers";
  if (FISHING_ITEM_IDS.has(itemId) || /^raw_/.test(itemId) || /^cooked_/.test(itemId) || /^burnt_/.test(itemId)) {
    return "fishing_and_food";
  }
  if (RUNECRAFTING_ITEM_IDS.has(itemId) || /_rune$/.test(itemId) || /_pouch$/.test(itemId) || /_tiara$/.test(itemId)) {
    return "runecrafting_and_magic";
  }
  if (
    itemId === "logs"
    || /_logs$/.test(itemId)
    || /_handle(_strapped)?$/.test(itemId)
    || /_shafts$/.test(itemId)
    || /_headless_arrows$/.test(itemId)
    || /(shortbow|longbow)(_u)?$/.test(itemId)
    || /^plain_staff_/.test(itemId)
  ) {
    return "wood_and_fletching";
  }
  if (CRAFTING_ITEM_IDS.has(itemId) || /_mould$/.test(itemId) || GEM_PATTERN.test(itemId) || /_leather$/.test(itemId) || JEWELRY_PATTERN.test(itemId)) {
    return "crafting_and_jewelry";
  }
  if (SMITHING_COMPONENT_IDS.has(itemId) || /_ore$/.test(itemId) || /_bar$/.test(itemId) || /_arrowheads$/.test(itemId) || /_arrows$/.test(itemId) || /_axe_head$/.test(itemId) || /_pickaxe_head$/.test(itemId) || /_sword_blade$/.test(itemId)) {
    return "smithing_materials";
  }
  if (METAL_GEAR_PATTERN.test(itemId)) return "metal_gear";

  throw new Error(`Unable to classify editorial batch for item ${itemId}`);
}

function buildItemBatchManifest(bundle) {
  const batches = ITEM_EDITORIAL_BATCHES.map((batch) => ({
    batchId: batch.id,
    title: batch.title,
    itemIds: []
  }));
  const batchMap = new Map(batches.map((batch) => [batch.batchId, batch]));

  bundle.items.forEach((item) => {
    batchMap.get(getItemEditorialBatchId(item)).itemIds.push(item.itemId);
  });

  batches.forEach((batch) => {
    batch.itemIds = sortStrings(batch.itemIds);
    batch.count = batch.itemIds.length;
  });

  return {
    schemaVersion: ITEM_EDITORIAL_SCHEMA_VERSION,
    totalItems: bundle.items.length,
    batches
  };
}

function loadItemEditorialOverrides(projectRoot) {
  const absPath = getItemEditorialOverridePath(projectRoot);
  if (!fs.existsSync(absPath)) return {};
  const overrides = readJson(absPath);
  assert(overrides && typeof overrides === "object" && !Array.isArray(overrides), "item editorial overrides must be an object");
  return overrides;
}

function createRecipeIndexes(bundle) {
  const skillIndex = new Map(bundle.skills.map((skill) => [skill.skillId, skill]));
  const itemIndex = new Map(bundle.items.map((item) => [item.itemId, item]));
  const outputsByItemId = new Map();
  const inputsByItemId = new Map();
  const toolUsesByItemId = new Map();
  const merchantSellsByItemId = new Map();
  const merchantBuysByItemId = new Map();
  const nodeRewardsByItemId = new Map();
  const pouchUsesByItemId = new Map();
  const merchantWorldIndex = buildMerchantWorldIndex(bundle);
  const nodeWorldIndex = buildNodeWorldIndex(bundle);

  bundle.skills.forEach((skill) => {
    const data = skill.data || {};
    const recipeSet = data.recipeSet && typeof data.recipeSet === "object" ? data.recipeSet : {};
    Object.entries(recipeSet).forEach(([recipeId, recipe]) => {
      const recipeLevel = recipe.requiredLevel !== undefined ? recipe.requiredLevel : null;
      const stationType = recipe.stationType || null;
      const requiredToolIds = sortStrings(recipe.requiredToolIds);

      if (recipe.output && recipe.output.itemId) {
        pushToIndex(outputsByItemId, recipe.output.itemId, {
          kind: "recipe_output",
          skillId: skill.skillId,
          skillTitle: skill.title,
          recipeId,
          requiredLevel: recipeLevel,
          stationType,
          outputAmount: recipe.output.amount || 1,
          inputItemIds: sortStrings(normalizeArray(recipe.inputs).map((input) => input.itemId)),
          inputSummary: normalizeArray(recipe.inputs).map((input) => `${getItemLabel(itemIndex, input.itemId)} x${input.amount}`),
          requiredToolIds,
          requiredToolLabels: requiredToolIds.map((itemId) => getItemLabel(itemIndex, itemId))
        });

        normalizeArray(recipe.inputs).forEach((input) => {
          pushToIndex(inputsByItemId, input.itemId, {
            kind: "recipe_input",
            skillId: skill.skillId,
            skillTitle: skill.title,
            recipeId,
            requiredLevel: recipeLevel,
            outputItemId: recipe.output.itemId,
            outputTitle: getItemLabel(itemIndex, recipe.output.itemId),
            outputAmount: recipe.output.amount || 1,
            stationType
          });
        });
      }

      if (recipe.outputItemId) {
        pushToIndex(outputsByItemId, recipe.outputItemId, {
          kind: "runecrafting_output",
          skillId: skill.skillId,
          skillTitle: skill.title,
          recipeId,
          requiredLevel: recipeLevel,
          altarName: recipe.altarName || null,
          outputAmount: null,
          essenceItemId: recipe.essenceItemId || null,
          secondaryRuneItemId: recipe.secondaryRuneItemId || null,
          inputSummary: [recipe.essenceItemId, recipe.secondaryRuneItemId].filter(Boolean).map((itemId) => getItemLabel(itemIndex, itemId))
        });

        if (recipe.essenceItemId) {
          pushToIndex(inputsByItemId, recipe.essenceItemId, {
            kind: "recipe_input",
            skillId: skill.skillId,
            skillTitle: skill.title,
            recipeId,
            requiredLevel: recipeLevel,
            outputItemId: recipe.outputItemId,
            outputTitle: getItemLabel(itemIndex, recipe.outputItemId),
            outputAmount: null,
            altarName: recipe.altarName || null
          });
        }

        if (recipe.secondaryRuneItemId) {
          pushToIndex(inputsByItemId, recipe.secondaryRuneItemId, {
            kind: "recipe_input",
            skillId: skill.skillId,
            skillTitle: skill.title,
            recipeId,
            requiredLevel: recipeLevel,
            outputItemId: recipe.outputItemId,
            outputTitle: getItemLabel(itemIndex, recipe.outputItemId),
            outputAmount: null,
            altarName: recipe.altarName || null
          });
        }
      }

      if (recipe.cookedItemId) {
        pushToIndex(outputsByItemId, recipe.cookedItemId, {
          kind: "cooking_output",
          skillId: skill.skillId,
          skillTitle: skill.title,
          recipeId,
          requiredLevel: recipeLevel,
          sourceItemId: recipe.sourceItemId || null,
          burnDifficulty: recipe.burnDifficulty !== undefined ? recipe.burnDifficulty : null
        });
      }

      if (recipe.burntItemId) {
        pushToIndex(outputsByItemId, recipe.burntItemId, {
          kind: "burn_output",
          skillId: skill.skillId,
          skillTitle: skill.title,
          recipeId,
          requiredLevel: recipeLevel,
          sourceItemId: recipe.sourceItemId || null,
          burnDifficulty: recipe.burnDifficulty !== undefined ? recipe.burnDifficulty : null
        });
      }

      if (recipe.sourceItemId) {
        const outputItemId = recipe.cookedItemId || recipe.burntItemId || null;
        pushToIndex(inputsByItemId, recipe.sourceItemId, {
          kind: "recipe_input",
          skillId: skill.skillId,
          skillTitle: skill.title,
          recipeId,
          requiredLevel: recipeLevel,
          outputItemId,
          outputTitle: outputItemId ? getItemLabel(itemIndex, outputItemId) : null,
          outputAmount: 1,
          target: recipe.sourceTarget || null
        });
      }

      requiredToolIds.forEach((toolId) => {
        pushToIndex(toolUsesByItemId, toolId, {
          kind: "required_tool",
          skillId: skill.skillId,
          skillTitle: skill.title,
          recipeId,
          requiredLevel: recipeLevel,
          outputTitle: recipe.output && recipe.output.itemId
            ? getItemLabel(itemIndex, recipe.output.itemId)
            : recipe.outputItemId
              ? getItemLabel(itemIndex, recipe.outputItemId)
              : null
        });
      });
    });

    const economy = data.economy || {};
    const merchantTable = economy.merchantTable && typeof economy.merchantTable === "object" ? economy.merchantTable : {};
    Object.entries(merchantTable).forEach(([merchantId, merchant]) => {
      const merchantWorlds = dedupeRows(merchantWorldIndex.get(merchantId) || [], (row) => `${row.worldId}:${row.serviceId || ""}`);
      normalizeArray(merchant.sells).forEach((itemId) => {
        pushToIndex(merchantSellsByItemId, itemId, {
          kind: "merchant_sells",
          skillId: skill.skillId,
          skillTitle: skill.title,
          merchantId,
          merchantLabel: humanizeId(merchantId),
          worldTitles: sortStrings(merchantWorlds.map((row) => row.worldTitle))
        });
      });
      normalizeArray(merchant.buys).forEach((itemId) => {
        pushToIndex(merchantBuysByItemId, itemId, {
          kind: "merchant_buys",
          skillId: skill.skillId,
          skillTitle: skill.title,
          merchantId,
          merchantLabel: humanizeId(merchantId),
          worldTitles: sortStrings(merchantWorlds.map((row) => row.worldTitle))
        });
      });
    });

    const defaultStock = normalizeArray(economy.generalStoreFallback && economy.generalStoreFallback.defaultStock);
    if (defaultStock.length) {
      const generalStoreWorlds = dedupeRows(merchantWorldIndex.get("general_store") || [], (row) => `${row.worldId}:${row.serviceId || ""}`);
      defaultStock.forEach((stock) => {
        pushToIndex(merchantSellsByItemId, stock.itemId, {
          kind: "general_store_stock",
          skillId: skill.skillId,
          skillTitle: skill.title,
          merchantId: "general_store",
          merchantLabel: "General Store",
          stockAmount: stock.stockAmount !== undefined ? stock.stockAmount : null,
          worldTitles: sortStrings(generalStoreWorlds.map((row) => row.worldTitle))
        });
      });
    }

    const nodeTable = data.nodeTable && typeof data.nodeTable === "object" ? data.nodeTable : {};
    Object.entries(nodeTable).forEach(([nodeId, node]) => {
      if (node.rewardItemId) {
        const worldKey = skill.skillId === "mining" ? `mining:${node.oreType}` : `woodcutting:${nodeId}`;
        const worldRows = dedupeRows(nodeWorldIndex.get(worldKey) || [], (row) => `${row.worldId}:${row.routeId || ""}`);
        pushToIndex(nodeRewardsByItemId, node.rewardItemId, {
          kind: "node_reward",
          skillId: skill.skillId,
          skillTitle: skill.title,
          nodeId,
          nodeLabel: humanizeId(nodeId),
          requiredLevel: node.requiredLevel !== undefined ? node.requiredLevel : null,
          worlds: sortStrings(worldRows.map((row) => row.worldTitle)),
          difficulty: node.difficulty !== undefined ? node.difficulty : null
        });
      }

      const methods = node && node.methods && typeof node.methods === "object" ? Object.values(node.methods) : [];
      methods.forEach((method) => {
        normalizeArray(method.fishByLevel).forEach((entry) => {
          normalizeArray(entry.fish).forEach((fish) => {
            pushToIndex(nodeRewardsByItemId, fish.itemId, {
              kind: "fishing_method",
              skillId: skill.skillId,
              skillTitle: skill.title,
              nodeId,
              nodeLabel: humanizeId(nodeId),
              methodId: method.methodId || null,
              methodLabel: method.methodId ? humanizeId(method.methodId) : "Fishing",
              requiredLevel: fish.requiredLevel !== undefined ? fish.requiredLevel : method.unlockLevel !== undefined ? method.unlockLevel : null,
              toolLabels: sortStrings(normalizeArray(method.toolIds).map((toolId) => getItemLabel(itemIndex, toolId)))
            });
          });
        });
      });
    });

    const pouchTable = data.pouchTable && typeof data.pouchTable === "object" ? data.pouchTable : {};
    Object.entries(pouchTable).forEach(([itemId, pouch]) => {
      pushToIndex(pouchUsesByItemId, itemId, {
        kind: "pouch_use",
        skillId: skill.skillId,
        skillTitle: skill.title,
        capacity: pouch.capacity !== undefined ? pouch.capacity : null,
        requiredLevel: pouch.requiredLevel !== undefined ? pouch.requiredLevel : null
      });
    });
  });

  return {
    outputsByItemId,
    inputsByItemId,
    toolUsesByItemId,
    merchantSellsByItemId,
    merchantBuysByItemId,
    nodeRewardsByItemId,
    pouchUsesByItemId,
    skillIndex
  };
}

function buildDerivedUseHints(item) {
  const data = item.data || {};
  const combat = data.combat || {};
  const hints = [];
  const toolFamily = combat.toolFamily || data.weaponClass || null;

  if (toolFamily && TOOL_SKILL_HINTS[toolFamily]) {
    hints.push({
      kind: "tool_family",
      skillId: TOOL_SKILL_HINTS[toolFamily].skillId,
      text: TOOL_SKILL_HINTS[toolFamily].text
    });
  }

  if (item.itemId === "small_net") {
    hints.push({ kind: "tool_family", skillId: "fishing", text: "Used to catch fish at Small Net fishing methods." });
  }
  if (item.itemId === "fishing_rod") {
    hints.push({ kind: "tool_family", skillId: "fishing", text: "Used to catch fish at Rod fishing methods, usually with bait." });
  }
  if (item.itemId === "tinderbox") {
    hints.push({ kind: "tool_family", skillId: "firemaking", text: "Used to light logs for Firemaking." });
  }
  if (/_mould$/.test(item.itemId)) {
    hints.push({ kind: "tool_family", skillId: "crafting", text: "Used in jewelry-crafting recipes to shape rings, amulets, or tiaras." });
  }
  if (data.healAmount !== undefined) {
    hints.push({ kind: "healing", text: `Restores ${data.healAmount} HP when eaten.` });
  }
  if (EQUIPMENT_TYPES.has(data.type)) {
    const requirements = [];
    if (data.requiredAttackLevel !== undefined) requirements.push(`Attack ${data.requiredAttackLevel}`);
    if (data.requiredDefenseLevel !== undefined) requirements.push(`Defense ${data.requiredDefenseLevel}`);
    hints.push({
      kind: "equipment",
      text: requirements.length
        ? `Can be equipped for combat and requires ${requirements.join(" / ")}.`
        : "Can be equipped for combat."
    });
  }
  if (/^plain_staff_/.test(item.itemId)) {
    hints.push({ kind: "component", skillId: "runecrafting", text: "Acts as a plain staff base for elemental staff recipes." });
  }

  return dedupeRows(hints, (row) => `${row.kind}:${row.skillId || ""}:${row.text}`);
}

function buildTransformationIndex(bundle) {
  const cookedFromIndex = new Map();
  const burntFromIndex = new Map();

  bundle.items.forEach((item) => {
    const data = item.data || {};
    if (data.cookResultId) pushToIndex(cookedFromIndex, data.cookResultId, item.itemId);
    if (data.burnResultId) pushToIndex(burntFromIndex, data.burnResultId, item.itemId);
  });

  return { cookedFromIndex, burntFromIndex };
}

function buildItemDescriptionSeed(item) {
  const data = item.data || {};
  const type = data.type || "item";
  const specialSeed = SPECIAL_ITEM_EDITORIAL_SEEDS[item.itemId];

  if (specialSeed && specialSeed.description) return specialSeed.description;

  if (/^raw_/.test(item.itemId)) return `A raw fish resource that can be cooked into a food item.`;
  if (/^cooked_/.test(item.itemId)) return `A cooked fish food item that restores health when eaten.`;
  if (/^burnt_/.test(item.itemId)) return `A burnt fish item left over from a failed cooking attempt.`;
  if (/_ore$/.test(item.itemId) || item.itemId === "coal") return `A gathered ore resource used for smelting bars and progressing metalworking recipes.`;
  if (/_bar$/.test(item.itemId)) return `A refined metal bar used in higher-tier smithing and crafting recipes.`;
  if (/_arrowheads$/.test(item.itemId)) return `A bundle of metal arrowheads used to assemble finished arrows.`;
  if (/_arrows$/.test(item.itemId)) return `A finished bundle of arrows produced through fletching.`;
  if (/_axe_head$/.test(item.itemId) || /_pickaxe_head$/.test(item.itemId) || /_sword_blade$/.test(item.itemId)) return `A metal weapon component used in later assembly recipes.`;
  if (METAL_GEAR_PATTERN.test(item.itemId)) {
    if (/_pickaxe$/.test(item.itemId)) return `A tiered metal pickaxe that works as both combat equipment and a mining tool.`;
    if (/_axe$/.test(item.itemId)) return `A tiered metal axe that works as both combat equipment and a woodcutting tool.`;
    if (/_sword$/.test(item.itemId)) return `A tiered metal sword meant for melee combat.`;
    if (/_shield$/.test(item.itemId)) return `A tiered metal shield for defensive combat gear sets.`;
    if (/_boots$/.test(item.itemId) || /_helmet$/.test(item.itemId) || /_platebody$/.test(item.itemId) || /_platelegs$/.test(item.itemId)) {
      return `A tiered metal armour piece worn for melee-oriented combat stats.`;
    }
    return `A tiered metal equipment piece that can be worn or wielded in combat.`;
  }
  if (/^plain_staff_/.test(item.itemId)) return `A plain staff base used in elemental staff recipes.`;
  if (/_logs$/.test(item.itemId)) return `A woodcutting resource used in fletching, firemaking, and related crafting chains.`;
  if (/_handle(_strapped)?$/.test(item.itemId)) return `A wooden assembly component used in crafting weapon and tool recipes.`;
  if (/_shafts$/.test(item.itemId)) return `A bundle of shafts used in fletching arrow recipes.`;
  if (/_headless_arrows$/.test(item.itemId)) return `A bundle of unfinished arrows waiting for arrowheads.`;
  if (/(shortbow|longbow)(_u)?$/.test(item.itemId)) return /_u$/.test(item.itemId)
    ? `An unfinished bow that still needs a bow string before it can be finished.`
    : `A finished bow created through fletching.`;
  if (/_rune$/.test(item.itemId)) return `A rune item tied to runecrafting outputs and related magical crafting chains.`;
  if (/_pouch$/.test(item.itemId)) return `A runecrafting pouch that increases how much essence can be carried at once.`;
  if (/_(ring|amulet)$/.test(item.itemId)) return `A crafted piece of jewelry made from metal bars and, in some cases, cut gems.`;
  if (/_tiara$/.test(item.itemId)) return `A crafted tiara tied to runecrafting-focused jewelry recipes.`;
  if (/_mould$/.test(item.itemId)) return `A crafting tool used to shape jewelry during metalworking recipes.`;
  if (GEM_PATTERN.test(item.itemId)) return /^uncut_/.test(item.itemId)
    ? `An uncut gem resource that can be refined through Crafting.`
    : `A cut gem used in higher-value jewelry recipes.`;
  if (/_leather$/.test(item.itemId)) return `A leather crafting material used in equipment and assembly recipes.`;
  if (item.itemId === "bait") return `A fishing consumable used with rod-based fishing methods.`;
  if (item.itemId === "small_net" || item.itemId === "fishing_rod" || item.itemId === "harpoon" || item.itemId === "rune_harpoon") return `A fishing tool used to catch specific fish at matching fishing spots.`;
  if (item.itemId === "tinderbox") return `A basic utility tool used to start fires.`;
  if (item.itemId === "hammer") return `A utility tool required by many smithing and assembly recipes.`;
  if (item.itemId === "knife") return `A utility tool used in woodcutting-adjacent crafting and fletching work.`;
  if (item.itemId === "coins") return `Standard currency used for trade and shop purchases.`;
  if (item.itemId === "ashes") return `A low-value residue item associated with firemaking output.`;
  if (item.itemId === "soft_clay") return `A worked clay resource with crafting-oriented utility.`;
  if (item.itemId === "feathers_bundle") return `A bundled resource used in fletching recipes.`;
  if (type === "food") return `A food item that restores health when eaten.`;
  if (type === "tool") return `A utility tool item used in skilling or production workflows.`;

  return `${item.title} is an export-backed item used somewhere in the project economy.`;
}

function buildItemAcquisitionSeed(context) {
  const specialSeed = SPECIAL_ITEM_EDITORIAL_SEEDS[context.itemId];
  if (specialSeed && specialSeed.acquisition) return specialSeed.acquisition;

  const firstOutput = context.acquisition.recipeOutputs[0];
  if (firstOutput) {
    if (firstOutput.kind === "recipe_output") {
      const inputs = listLabels(firstOutput.inputSummary, 2);
      const tools = listLabels(firstOutput.requiredToolLabels, 2);
      const station = firstOutput.stationType
        ? firstOutput.stationType === "INVENTORY"
          ? " in inventory"
          : ` at a ${humanizeId(firstOutput.stationType).toLowerCase()}`
        : "";
      const toolText = tools ? ` with ${tools}` : "";
      return `Mainly produced through ${firstOutput.skillTitle} at level ${firstOutput.requiredLevel || 1}${station}${toolText}${inputs ? ` using ${inputs}` : ""}.`;
    }
    if (firstOutput.kind === "runecrafting_output") {
      const parts = [firstOutput.essenceItemId ? getItemLabel(context.itemIndex, firstOutput.essenceItemId) : null];
      if (firstOutput.secondaryRuneItemId) parts.push(getItemLabel(context.itemIndex, firstOutput.secondaryRuneItemId));
      return `Mainly crafted through ${firstOutput.skillTitle} at the ${firstOutput.altarName || "matching altar"} starting at level ${firstOutput.requiredLevel || 1}${parts.filter(Boolean).length ? ` using ${parts.filter(Boolean).join(" and ")}` : ""}.`;
    }
    if (firstOutput.kind === "cooking_output") {
      return `Mainly made through ${firstOutput.skillTitle} by cooking ${getItemLabel(context.itemIndex, firstOutput.sourceItemId)} starting at level ${firstOutput.requiredLevel || 1}.`;
    }
    if (firstOutput.kind === "burn_output") {
      return `Produced when ${getItemLabel(context.itemIndex, firstOutput.sourceItemId)} burns during ${firstOutput.skillTitle} attempts.`;
    }
  }

  const firstNode = context.acquisition.nodeRewards[0];
  if (firstNode) {
    if (firstNode.kind === "fishing_method") {
      const tools = listLabels(firstNode.toolLabels, 2);
      return `Usually gathered through ${firstNode.skillTitle} at ${firstNode.methodLabel || "fishing"} spots starting at level ${firstNode.requiredLevel || 1}${tools ? ` with ${tools}` : ""}.`;
    }
    return `Usually gathered through ${firstNode.skillTitle} from ${firstNode.nodeLabel} nodes starting at level ${firstNode.requiredLevel || 1}.`;
  }

  const firstMerchant = context.acquisition.merchantSells[0];
  if (firstMerchant) {
    const worlds = listLabels(firstMerchant.worldTitles, 2);
    const stockText = firstMerchant.stockAmount !== null && firstMerchant.stockAmount !== undefined ? ` in stocks of ${firstMerchant.stockAmount}` : "";
    return `Usually bought from ${firstMerchant.merchantLabel}${worlds ? ` in ${worlds}` : ""}${stockText}.`;
  }

  if (context.acquisition.transformedFrom.length) {
    const source = context.acquisition.transformedFrom[0];
    return `Produced from ${source.via} ${source.sourceTitle}.`;
  }

  if (context.overrideHints.acquisitionHints.length) return context.overrideHints.acquisitionHints[0];
  return `No direct acquisition path is exported for this item, so it remains a conservative draft entry.`;
}

function buildItemUsesSeed(context) {
  const specialSeed = SPECIAL_ITEM_EDITORIAL_SEEDS[context.itemId];
  if (specialSeed && specialSeed.uses) return specialSeed.uses;

  const firstRecipeUse = context.uses.recipeInputs[0];
  if (firstRecipeUse) {
    const outputs = dedupeRows(context.uses.recipeInputs, (row) => `${row.skillId}:${row.outputItemId || ""}`)
      .slice(0, 3)
      .map((row) => row.outputTitle || humanizeId(row.recipeId));
    return `Used in ${firstRecipeUse.skillTitle} recipes that produce ${listLabels(outputs, 3)}.`;
  }

  if (context.uses.toolHints.length) return context.uses.toolHints[0].text;
  if (context.uses.requiredToolRecipes.length) {
    const row = context.uses.requiredToolRecipes[0];
    return `Required as a tool in ${row.skillTitle} production, including recipes for ${row.outputTitle || humanizeId(row.recipeId)}.`;
  }
  if (context.uses.pouchUses.length) {
    const row = context.uses.pouchUses[0];
    return `Used in ${row.skillTitle} to hold extra essence, with a capacity of ${row.capacity}.`;
  }
  if (context.uses.transformsInto.length) {
    const row = context.uses.transformsInto[0];
    return `Can be processed into ${row.targetTitle}${row.altTargetTitle ? ` and may also become ${row.altTargetTitle}` : ""}.`;
  }
  const firstMerchant = context.uses.merchantBuys[0];
  if (firstMerchant) {
    const worlds = listLabels(firstMerchant.worldTitles, 2);
    return `Can be traded to ${firstMerchant.merchantLabel}${worlds ? ` in ${worlds}` : ""} and appears in ${firstMerchant.skillTitle} economy tables.`;
  }
  if (context.overrideHints.useHints.length) return context.overrideHints.useHints[0];

  return `No strong downstream use is exported beyond its base economy presence, so this remains a conservative draft entry.`;
}

function buildContextForItem(item, bundle, indexes, overrides, transformationIndex) {
  const itemIndex = new Map(bundle.items.map((entry) => [entry.itemId, entry]));
  const worldTitleMap = buildWorldTitleMap(bundle);
  const override = overrides[item.itemId] || {};
  const outputs = dedupeRows(indexes.outputsByItemId.get(item.itemId) || [], (row) => `${row.kind}:${row.skillId}:${row.recipeId}`);
  const inputs = dedupeRows(indexes.inputsByItemId.get(item.itemId) || [], (row) => `${row.kind}:${row.skillId}:${row.recipeId}:${row.outputItemId || ""}`);
  const toolUses = dedupeRows(indexes.toolUsesByItemId.get(item.itemId) || [], (row) => `${row.kind}:${row.skillId}:${row.recipeId}`);
  const merchantSells = dedupeRows(indexes.merchantSellsByItemId.get(item.itemId) || [], (row) => `${row.kind}:${row.skillId}:${row.merchantId}`);
  const merchantBuys = dedupeRows(indexes.merchantBuysByItemId.get(item.itemId) || [], (row) => `${row.kind}:${row.skillId}:${row.merchantId}`);
  const nodeRewards = dedupeRows(indexes.nodeRewardsByItemId.get(item.itemId) || [], (row) => `${row.kind}:${row.skillId}:${row.nodeId}:${row.methodId || ""}`);
  const pouchUses = dedupeRows(indexes.pouchUsesByItemId.get(item.itemId) || [], (row) => `${row.kind}:${row.skillId}`);
  const cooksInto = item.data && item.data.cookResultId ? itemIndex.get(item.data.cookResultId) : null;
  const burnsInto = item.data && item.data.burnResultId ? itemIndex.get(item.data.burnResultId) : null;
  const cookedFrom = sortStrings((transformationIndex.cookedFromIndex.get(item.itemId) || []).map((itemId) => getItemLabel(itemIndex, itemId)));
  const burntFrom = sortStrings((transformationIndex.burntFromIndex.get(item.itemId) || []).map((itemId) => getItemLabel(itemIndex, itemId)));

  const context = {
    schemaVersion: ITEM_EDITORIAL_SCHEMA_VERSION,
    batchId: getItemEditorialBatchId(item),
    itemId: item.itemId,
    title: item.title,
    facts: {
      type: item.data && item.data.type ? item.data.type : null,
      value: item.data && item.data.value !== undefined ? item.data.value : null,
      stackable: Boolean(item.data && item.data.stackable),
      defaultAction: item.data && item.data.defaultAction ? item.data.defaultAction : null,
      actions: sortStrings(item.data && item.data.actions),
      weaponClass: item.data && item.data.weaponClass ? item.data.weaponClass : null,
      toolTier: item.data && item.data.toolTier !== undefined ? item.data.toolTier : null,
      speedBonusTicks: item.data && item.data.speedBonusTicks !== undefined ? item.data.speedBonusTicks : null,
      requiredAttackLevel: item.data && item.data.requiredAttackLevel !== undefined ? item.data.requiredAttackLevel : null,
      requiredDefenseLevel: item.data && item.data.requiredDefenseLevel !== undefined ? item.data.requiredDefenseLevel : null,
      requiredFishingLevel: item.data && item.data.requiredFishingLevel !== undefined ? item.data.requiredFishingLevel : null,
      healAmount: item.data && item.data.healAmount !== undefined ? item.data.healAmount : null,
      eatDelayTicks: item.data && item.data.eatDelayTicks !== undefined ? item.data.eatDelayTicks : null,
      burnChance: item.data && item.data.burnChance !== undefined ? item.data.burnChance : null
    },
    related: {
      skills: sortStrings(normalizeArray(item.relatedSkillIds).map((skillId) => getSkillLabel(indexes.skillIndex, skillId))),
      worlds: sortStrings(normalizeArray(item.relatedWorldIds).map((worldId) => worldTitleMap.get(worldId) || humanizeId(worldId)))
    },
    acquisition: {
      recipeOutputs: outputs,
      nodeRewards,
      merchantSells,
      transformedFrom: [
        ...cookedFrom.map((sourceTitle) => ({ via: "cooking", sourceTitle })),
        ...burntFrom.map((sourceTitle) => ({ via: "burning", sourceTitle }))
      ]
    },
    uses: {
      recipeInputs: inputs,
      merchantBuys,
      requiredToolRecipes: toolUses,
      toolHints: buildDerivedUseHints(item),
      pouchUses,
      transformsInto: cooksInto || burnsInto
        ? [{ targetTitle: cooksInto ? cooksInto.title : null, altTargetTitle: burnsInto ? burnsInto.title : null }]
        : []
    },
    overrideHints: {
      descriptionHints: sortStrings(override.descriptionHints),
      acquisitionHints: sortStrings(override.acquisitionHints),
      useHints: sortStrings(override.useHints)
    },
    seedCopy: {
      description: buildItemDescriptionSeed(item),
      acquisition: "",
      uses: ""
    }
  };

  context.seedCopy.acquisition = buildItemAcquisitionSeed(Object.assign({ itemIndex }, context));
  context.seedCopy.uses = buildItemUsesSeed(Object.assign({ itemIndex }, context));
  return context;
}

function buildItemAuthoringContext(bundle, projectRoot) {
  const overrides = loadItemEditorialOverrides(projectRoot);
  const indexes = createRecipeIndexes(bundle);
  const transformationIndex = buildTransformationIndex(bundle);
  const manifest = buildItemBatchManifest(bundle);
  const itemsById = {};
  const batches = {};

  bundle.items.forEach((item) => {
    const context = buildContextForItem(item, bundle, indexes, overrides, transformationIndex);
    itemsById[item.itemId] = context;
    if (!batches[context.batchId]) {
      const batchMeta = ITEM_EDITORIAL_BATCHES.find((batch) => batch.id === context.batchId);
      batches[context.batchId] = {
        schemaVersion: ITEM_EDITORIAL_SCHEMA_VERSION,
        batchId: context.batchId,
        title: batchMeta.title,
        items: {}
      };
    }
    batches[context.batchId].items[item.itemId] = context;
  });

  return {
    schemaVersion: ITEM_EDITORIAL_SCHEMA_VERSION,
    manifest,
    itemsById,
    batches
  };
}

function writeItemAuthoringArtifacts(projectRoot, bundle) {
  const context = buildItemAuthoringContext(bundle, projectRoot);
  const contextDir = getItemAuthoringContextDir(projectRoot);
  const batchDir = path.join(contextDir, "batches");
  fs.mkdirSync(batchDir, { recursive: true });

  writeJson(path.join(contextDir, "manifest.json"), context.manifest);
  writeJson(path.join(contextDir, "items.json"), context.itemsById);
  ITEM_EDITORIAL_BATCHES.forEach((batch) => {
    writeJson(path.join(batchDir, `${batch.id}.json`), context.batches[batch.id] || {
      schemaVersion: ITEM_EDITORIAL_SCHEMA_VERSION,
      batchId: batch.id,
      title: batch.title,
      items: {}
    });
  });

  return context;
}

function buildSeedEditorialEntry(context) {
  return {
    description: context.overrideHints.descriptionHints[0] || context.seedCopy.description,
    acquisition: context.seedCopy.acquisition,
    uses: context.seedCopy.uses,
    status: "draft"
  };
}

function scaffoldItemEditorial(projectRoot, bundle) {
  const authoringContext = writeItemAuthoringArtifacts(projectRoot, bundle);
  const editorialDir = getItemEditorialDir(projectRoot);
  fs.mkdirSync(editorialDir, { recursive: true });

  const summary = [];
  ITEM_EDITORIAL_BATCHES.forEach((batchMeta) => {
    const batchContext = authoringContext.batches[batchMeta.id] || {
      batchId: batchMeta.id,
      title: batchMeta.title,
      items: {}
    };
    const absPath = getItemEditorialBatchFile(projectRoot, batchMeta.id);
    const existing = fs.existsSync(absPath) ? readJson(absPath) : {};
    const existingEntries = existing && typeof existing === "object" && existing.entries && typeof existing.entries === "object"
      ? existing.entries
      : {};
    const nextEntries = {};
    let created = 0;

    Object.keys(batchContext.items).sort((left, right) => left.localeCompare(right)).forEach((itemId) => {
      const seedEntry = buildSeedEditorialEntry(batchContext.items[itemId]);
      const current = existingEntries[itemId];
      if (current && typeof current === "object") {
        nextEntries[itemId] = {
          description: String(current.description || "").trim() || seedEntry.description,
          acquisition: String(current.acquisition || "").trim() || seedEntry.acquisition,
          uses: String(current.uses || "").trim() || seedEntry.uses,
          status: ITEM_EDITORIAL_STATUS_VALUES.has(current.status) ? current.status : "draft"
        };
        return;
      }

      nextEntries[itemId] = seedEntry;
      created += 1;
    });

    writeJson(absPath, {
      schemaVersion: ITEM_EDITORIAL_SCHEMA_VERSION,
      batchId: batchMeta.id,
      title: batchMeta.title,
      entries: nextEntries
    });

    summary.push({ batchId: batchMeta.id, created, total: Object.keys(nextEntries).length });
  });

  return summary;
}

function validateNarrativeField(itemId, fieldName, value) {
  const text = String(value || "").trim();
  assert(text, `item editorial entry ${itemId} is missing ${fieldName}`);
  return text;
}

function loadItemEditorial(projectRoot, bundle) {
  const manifest = buildItemBatchManifest(bundle);
  const entriesByItemId = {};
  const batchSummaries = [];
  const itemById = new Map(bundle.items.map((item) => [item.itemId, item]));
  const seenIds = new Set();

  manifest.batches.forEach((batch) => {
    const absPath = getItemEditorialBatchFile(projectRoot, batch.batchId);
    assert(fs.existsSync(absPath), `Missing item editorial batch file ${absPath}`);
    const data = readJson(absPath);
    assert(data && typeof data === "object" && !Array.isArray(data), `item editorial batch ${batch.batchId} must be an object`);
    assert(data.batchId === batch.batchId, `item editorial batch ${absPath} batchId mismatch`);
    assert(data.entries && typeof data.entries === "object" && !Array.isArray(data.entries), `item editorial batch ${absPath} must contain entries`);

    const entryIds = Object.keys(data.entries).sort((left, right) => left.localeCompare(right));
    assert(JSON.stringify(entryIds) === JSON.stringify(batch.itemIds), `item editorial batch ${batch.batchId} coverage mismatch`);

    entryIds.forEach((itemId) => {
      assert(!seenIds.has(itemId), `Duplicate item editorial entry ${itemId}`);
      seenIds.add(itemId);
      const entry = data.entries[itemId];
      assert(entry && typeof entry === "object" && !Array.isArray(entry), `item editorial entry ${itemId} must be an object`);
      assert(getItemEditorialBatchId(itemById.get(itemId)) === batch.batchId, `item editorial entry ${itemId} is in the wrong batch`);
      const status = String(entry.status || "").trim();
      assert(ITEM_EDITORIAL_STATUS_VALUES.has(status), `item editorial entry ${itemId} has invalid status ${status}`);

      entriesByItemId[itemId] = {
        description: validateNarrativeField(itemId, "description", entry.description),
        acquisition: validateNarrativeField(itemId, "acquisition", entry.acquisition),
        uses: validateNarrativeField(itemId, "uses", entry.uses),
        status
      };
    });

    batchSummaries.push({
      batchId: batch.batchId,
      title: batch.title,
      total: entryIds.length
    });
  });

  assert(Object.keys(entriesByItemId).length === bundle.items.length, "item editorial coverage does not match exported item count");
  return {
    schemaVersion: ITEM_EDITORIAL_SCHEMA_VERSION,
    batches: batchSummaries,
    entriesByItemId
  };
}

module.exports = {
  ITEM_EDITORIAL_BATCHES,
  ITEM_EDITORIAL_SCHEMA_VERSION,
  buildItemAuthoringContext,
  buildItemBatchManifest,
  getItemAuthoringContextDir,
  getItemEditorialBatchFile,
  getItemEditorialBatchId,
  getItemEditorialDir,
  getItemEditorialOverridePath,
  loadItemEditorial,
  scaffoldItemEditorial,
  writeItemAuthoringArtifacts
};
