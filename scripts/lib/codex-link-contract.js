const DEFAULT_CODEX_BASE_PATH = "/osrs-clone-codex/";
const JOURNEY_SEGMENT = "journeys";

const ENTITY_SEGMENTS = Object.freeze({
  item: "items",
  skill: "skills",
  world: "world",
  enemy: "enemies"
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizeCodexBasePath(basePath = DEFAULT_CODEX_BASE_PATH) {
  let normalized = String(basePath || DEFAULT_CODEX_BASE_PATH).trim();
  if (!normalized) normalized = DEFAULT_CODEX_BASE_PATH;
  if (!normalized.startsWith("/")) normalized = `/${normalized}`;
  normalized = normalized.replace(/\/+/g, "/");
  if (!normalized.endsWith("/")) normalized += "/";
  return normalized;
}

function normalizeCodexEntityType(entityType) {
  const normalized = String(entityType || "").trim().toLowerCase();
  if (normalized === "item" || normalized === "items") return "item";
  if (normalized === "skill" || normalized === "skills") return "skill";
  if (normalized === "world" || normalized === "worlds") return "world";
  if (normalized === "enemy" || normalized === "enemies") return "enemy";
  throw new Error(`Unsupported codex entity type: ${entityType}`);
}

function buildSearchParams(options = {}) {
  const params = new URLSearchParams();
  const from = String(options.from || "").trim();
  const returnTo = String(options.returnTo || "").trim();
  if (from) params.set("from", from);
  if (returnTo) params.set("return", returnTo);
  const query = params.toString();
  return query ? `?${query}` : "";
}

function buildCodexHomePath(options = {}) {
  return `${normalizeCodexBasePath(options.basePath)}${buildSearchParams(options)}`;
}

function buildCodexEntityPath(entityType, entityId, options = {}) {
  const normalizedType = normalizeCodexEntityType(entityType);
  const normalizedId = String(entityId || "").trim();
  assert(normalizedId, `${normalizedType} id is required`);
  return `${normalizeCodexBasePath(options.basePath)}${ENTITY_SEGMENTS[normalizedType]}/${encodeURIComponent(normalizedId)}${buildSearchParams(options)}`;
}

function buildCodexJourneyPath(journeyId, options = {}) {
  const normalizedId = String(journeyId || "").trim();
  assert(normalizedId, "journey id is required");
  return `${normalizeCodexBasePath(options.basePath)}${JOURNEY_SEGMENT}/${encodeURIComponent(normalizedId)}${buildSearchParams(options)}`;
}

function buildCodexHomeUrl(options = {}) {
  if (!options.baseUrl) return buildCodexHomePath(options);
  return new URL(buildCodexHomePath(options), options.baseUrl).toString();
}

function buildCodexEntityUrl(entityType, entityId, options = {}) {
  if (!options.baseUrl) return buildCodexEntityPath(entityType, entityId, options);
  return new URL(buildCodexEntityPath(entityType, entityId, options), options.baseUrl).toString();
}

function buildCodexJourneyUrl(journeyId, options = {}) {
  if (!options.baseUrl) return buildCodexJourneyPath(journeyId, options);
  return new URL(buildCodexJourneyPath(journeyId, options), options.baseUrl).toString();
}

function getCodexRouteTemplates(basePath = DEFAULT_CODEX_BASE_PATH) {
  const normalizedBasePath = normalizeCodexBasePath(basePath);
  return {
    home: normalizedBasePath,
    item: `${normalizedBasePath}${ENTITY_SEGMENTS.item}/:itemId`,
    skill: `${normalizedBasePath}${ENTITY_SEGMENTS.skill}/:skillId`,
    world: `${normalizedBasePath}${ENTITY_SEGMENTS.world}/:worldId`,
    enemy: `${normalizedBasePath}${ENTITY_SEGMENTS.enemy}/:enemyId`
  };
}

module.exports = {
  DEFAULT_CODEX_BASE_PATH,
  JOURNEY_SEGMENT,
  normalizeCodexBasePath,
  buildCodexHomePath,
  buildCodexEntityPath,
  buildCodexJourneyPath,
  buildCodexHomeUrl,
  buildCodexEntityUrl,
  buildCodexJourneyUrl,
  getCodexRouteTemplates
};
