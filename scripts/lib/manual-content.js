const fs = require("fs");
const path = require("path");

const { buildCodexJourneyPath } = require("./codex-link-contract");

const MANUAL_SCHEMA_VERSION = 1;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(absPath) {
  return JSON.parse(fs.readFileSync(absPath, "utf8"));
}

function normalizeString(value, fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

function normalizeParagraphs(value) {
  if (Array.isArray(value)) return value.map((entry) => normalizeString(entry)).filter(Boolean);
  const text = normalizeString(value);
  return text ? [text] : [];
}

function normalizeIdArray(value) {
  return (Array.isArray(value) ? value : [])
    .map((entry) => normalizeString(entry))
    .filter(Boolean);
}

function getManualSkillPath(projectRoot) {
  return path.join(projectRoot, "content", "editorial", "skills-manual.json");
}

function getManualWorldPath(projectRoot) {
  return path.join(projectRoot, "content", "editorial", "worlds-manual.json");
}

function getJourneyContentPath(projectRoot) {
  return path.join(projectRoot, "content", "editorial", "journeys.json");
}

function normalizeGuideEntry(entry = {}) {
  return {
    overview: normalizeParagraphs(entry.overview),
    whyItMatters: normalizeParagraphs(entry.whyItMatters),
    howToGetStarted: normalizeParagraphs(entry.howToGetStarted),
    connectedSystems: normalizeParagraphs(entry.connectedSystems),
    nextSteps: normalizeParagraphs(entry.nextSteps),
    featuredItemIds: normalizeIdArray(entry.featuredItemIds),
    featuredSkillIds: normalizeIdArray(entry.featuredSkillIds),
    featuredWorldIds: normalizeIdArray(entry.featuredWorldIds),
    featuredJourneyIds: normalizeIdArray(entry.featuredJourneyIds)
  };
}

function validateKnownIds(ids, knownSet, label) {
  ids.forEach((id) => assert(knownSet.has(id), `${label} references unknown id ${id}`));
}

function loadSkillManual(projectRoot, bundle, journeyIds) {
  const absPath = getManualSkillPath(projectRoot);
  assert(fs.existsSync(absPath), `Missing skill manual content at ${absPath}`);
  const data = readJson(absPath);
  assert(data && data.schemaVersion === MANUAL_SCHEMA_VERSION, "skill manual schema version mismatch");
  assert(data.entries && typeof data.entries === "object" && !Array.isArray(data.entries), "skill manual entries are required");

  const knownSkillIds = new Set(bundle.skills.map((skill) => skill.skillId));
  const knownItemIds = new Set(bundle.items.map((item) => item.itemId));
  const knownWorldIds = new Set(bundle.worlds.map((world) => world.worldId));
  const entriesById = {};

  bundle.skills.forEach((skill) => {
    const entry = normalizeGuideEntry(data.entries[skill.skillId]);
    assert(entry.overview.length, `skill manual ${skill.skillId} is missing overview`);
    validateKnownIds(entry.featuredItemIds, knownItemIds, `skill manual ${skill.skillId}`);
    validateKnownIds(entry.featuredSkillIds, knownSkillIds, `skill manual ${skill.skillId}`);
    if (knownWorldIds.size) validateKnownIds(entry.featuredWorldIds, knownWorldIds, `skill manual ${skill.skillId}`);
    validateKnownIds(entry.featuredJourneyIds, journeyIds, `skill manual ${skill.skillId}`);
    entriesById[skill.skillId] = entry;
  });

  return entriesById;
}

function loadWorldManual(projectRoot, bundle, journeyIds) {
  if (!Array.isArray(bundle.worlds) || !bundle.worlds.length) return {};
  const absPath = getManualWorldPath(projectRoot);
  assert(fs.existsSync(absPath), `Missing world manual content at ${absPath}`);
  const data = readJson(absPath);
  assert(data && data.schemaVersion === MANUAL_SCHEMA_VERSION, "world manual schema version mismatch");
  assert(data.entries && typeof data.entries === "object" && !Array.isArray(data.entries), "world manual entries are required");

  const knownSkillIds = new Set(bundle.skills.map((skill) => skill.skillId));
  const knownItemIds = new Set(bundle.items.map((item) => item.itemId));
  const knownWorldIds = new Set(bundle.worlds.map((world) => world.worldId));
  const entriesById = {};

  bundle.worlds.forEach((world) => {
    const entry = normalizeGuideEntry(data.entries[world.worldId]);
    assert(entry.overview.length, `world manual ${world.worldId} is missing overview`);
    validateKnownIds(entry.featuredItemIds, knownItemIds, `world manual ${world.worldId}`);
    validateKnownIds(entry.featuredSkillIds, knownSkillIds, `world manual ${world.worldId}`);
    validateKnownIds(entry.featuredWorldIds, knownWorldIds, `world manual ${world.worldId}`);
    validateKnownIds(entry.featuredJourneyIds, journeyIds, `world manual ${world.worldId}`);
    entriesById[world.worldId] = entry;
  });

  return entriesById;
}

function loadJourneys(projectRoot, bundle) {
  const absPath = getJourneyContentPath(projectRoot);
  assert(fs.existsSync(absPath), `Missing journey content at ${absPath}`);
  const data = readJson(absPath);
  assert(data && data.schemaVersion === MANUAL_SCHEMA_VERSION, "journey manual schema version mismatch");
  assert(Array.isArray(data.entries), "journey manual entries must be an array");

  const knownItemIds = new Set(bundle.items.map((item) => item.itemId));
  const knownSkillIds = new Set(bundle.skills.map((skill) => skill.skillId));
  const knownWorldIds = new Set(bundle.worlds.map((world) => world.worldId));
  const journeyIds = new Set();

  const journeys = data.entries.map((entry) => {
    const journeyId = normalizeString(entry.journeyId);
    assert(journeyId, "journeyId is required");
    assert(!journeyIds.has(journeyId), `Duplicate journey ${journeyId}`);
    journeyIds.add(journeyId);
    const steps = (Array.isArray(entry.steps) ? entry.steps : []).map((step, index) => ({
      stepId: normalizeString(step.stepId, `${journeyId}_step_${index + 1}`),
      title: normalizeString(step.title, `Step ${index + 1}`),
      body: normalizeParagraphs(step.body),
      itemIds: normalizeIdArray(step.itemIds),
      skillIds: normalizeIdArray(step.skillIds),
      worldIds: normalizeIdArray(step.worldIds)
    }));
    const normalized = {
      journeyId,
      title: normalizeString(entry.title, journeyId),
      summary: normalizeParagraphs(entry.summary),
      audience: normalizeString(entry.audience, "All players"),
      difficulty: normalizeString(entry.difficulty, "Starter"),
      relatedItemIds: normalizeIdArray(entry.relatedItemIds),
      relatedSkillIds: normalizeIdArray(entry.relatedSkillIds),
      relatedWorldIds: normalizeIdArray(entry.relatedWorldIds),
      nextJourneyIds: normalizeIdArray(entry.nextJourneyIds),
      steps,
      path: buildCodexJourneyPath(journeyId)
    };

    assert(normalized.summary.length, `journey ${journeyId} is missing summary`);
    assert(normalized.steps.length, `journey ${journeyId} must include steps`);
    validateKnownIds(normalized.relatedItemIds, knownItemIds, `journey ${journeyId}`);
    validateKnownIds(normalized.relatedSkillIds, knownSkillIds, `journey ${journeyId}`);
    if (knownWorldIds.size) validateKnownIds(normalized.relatedWorldIds, knownWorldIds, `journey ${journeyId}`);
    normalized.steps.forEach((step) => {
      assert(step.body.length, `journey ${journeyId} step ${step.stepId} is missing body`);
      validateKnownIds(step.itemIds, knownItemIds, `journey ${journeyId} step ${step.stepId}`);
      validateKnownIds(step.skillIds, knownSkillIds, `journey ${journeyId} step ${step.stepId}`);
      if (knownWorldIds.size) validateKnownIds(step.worldIds, knownWorldIds, `journey ${journeyId} step ${step.stepId}`);
    });
    return normalized;
  });

  journeys.forEach((journey) => {
    validateKnownIds(journey.nextJourneyIds, journeyIds, `journey ${journey.journeyId}`);
  });

  return {
    journeyIds,
    journeys,
    journeysById: Object.fromEntries(journeys.map((journey) => [journey.journeyId, journey]))
  };
}

function loadManualContent(projectRoot, bundle) {
  const journeys = loadJourneys(projectRoot, bundle);
  return {
    schemaVersion: MANUAL_SCHEMA_VERSION,
    journeys,
    skillsById: loadSkillManual(projectRoot, bundle, journeys.journeyIds),
    worldsById: loadWorldManual(projectRoot, bundle, journeys.journeyIds)
  };
}

module.exports = {
  MANUAL_SCHEMA_VERSION,
  getJourneyContentPath,
  getManualSkillPath,
  getManualWorldPath,
  loadManualContent,
  normalizeGuideEntry
};
