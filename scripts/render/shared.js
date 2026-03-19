const path = require("path");

const {
  DEFAULT_CODEX_BASE_PATH,
  buildCodexEntityPath,
  buildCodexJourneyPath
} = require("../lib/codex-link-contract");

const numberFormatter = new Intl.NumberFormat("en-US");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeArray(values) {
  return (Array.isArray(values) ? values : []).filter(Boolean);
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

function pluralizeWord(word) {
  const text = String(word || "").trim();
  if (!text) return "";
  if (/fe$/i.test(text)) return text.replace(/fe$/i, "ves");
  if (/f$/i.test(text)) return text.replace(/f$/i, "ves");
  if (/[^aeiou]y$/i.test(text)) return text.replace(/y$/i, "ies");
  if (/(s|x|z|ch|sh)$/i.test(text)) return `${text}es`;
  return `${text}s`;
}

function pluralizeLabel(value) {
  const words = String(value || "").trim().split(/\s+/g).filter(Boolean);
  if (!words.length) return "";
  const last = words.pop();
  words.push(pluralizeWord(last));
  return words.join(" ");
}

function toPossessiveLabel(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return /s$/i.test(text) ? `${text}'` : `${text}'s`;
}

function buildLabelVariants(value) {
  const base = String(value || "").trim();
  if (!base) return [];

  const variants = [base];
  const plural = pluralizeLabel(base);
  const possessive = toPossessiveLabel(base);
  const pluralPossessive = plural ? toPossessiveLabel(plural) : "";

  if (possessive && possessive.toLowerCase() !== base.toLowerCase()) variants.push(possessive);
  if (plural && plural.toLowerCase() !== base.toLowerCase()) variants.push(plural);
  if (
    pluralPossessive
    && pluralPossessive.toLowerCase() !== base.toLowerCase()
    && pluralPossessive.toLowerCase() !== possessive.toLowerCase()
  ) {
    variants.push(pluralPossessive);
  }

  return Array.from(new Set(variants.filter(Boolean)));
}

function getJourneyRows(manualContent = {}) {
  return manualContent && manualContent.journeys && Array.isArray(manualContent.journeys.journeys)
    ? manualContent.journeys.journeys
    : [];
}

function buildInlineLinkRegistry(bundle, manualContent = {}) {
  const aliasRows = new Map();
  const routeEntries = [];
  const journeys = getJourneyRows(manualContent);

  bundle.items.forEach((item) => {
    routeEntries.push({
      href: item.path,
      label: item.title,
      aliases: [item.title]
    });
  });
  bundle.skills.forEach((skill) => {
    routeEntries.push({
      href: skill.path,
      label: skill.title,
      aliases: [skill.title]
    });
  });
  bundle.worlds.forEach((world) => {
    routeEntries.push({
      href: world.path,
      label: world.title,
      aliases: [world.title]
    });
  });
  bundle.enemies.forEach((enemy) => {
    const enemyData = enemy && enemy.data && typeof enemy.data === "object" ? enemy.data : {};
    const enemyAliases = [
      enemy.title,
      enemyData.displayName,
      enemyData.attackProfile && enemyData.attackProfile.familyTag
        ? humanizeId(enemyData.attackProfile.familyTag)
        : ""
    ].filter(Boolean);
    routeEntries.push({
      href: enemy.path,
      label: enemy.title,
      aliases: Array.from(new Set(enemyAliases))
    });
  });
  journeys.forEach((journey) => {
    routeEntries.push({
      href: journey.path || buildCodexJourneyPath(journey.journeyId),
      label: journey.title,
      aliases: [journey.title]
    });
  });

  routeEntries.forEach((entry) => {
    const aliases = Array.from(new Set((Array.isArray(entry.aliases) ? entry.aliases : []).flatMap((alias) => buildLabelVariants(alias))));
    aliases.forEach((alias) => {
      const normalized = String(alias || "").trim().toLowerCase();
      if (!normalized) return;
      if (!aliasRows.has(normalized)) aliasRows.set(normalized, new Map());
      aliasRows.get(normalized).set(entry.href, {
        alias,
        aliasLower: normalized,
        href: entry.href,
        label: entry.label
      });
    });
  });

  const byInitial = {};
  aliasRows.forEach((rowMap, normalizedAlias) => {
    if (rowMap.size !== 1) return;
    const row = Array.from(rowMap.values())[0];
    const initial = normalizedAlias.charAt(0);
    if (!initial) return;
    if (!byInitial[initial]) byInitial[initial] = [];
    byInitial[initial].push(row);
  });

  Object.keys(byInitial).forEach((key) => {
    byInitial[key].sort((left, right) => right.alias.length - left.alias.length || left.alias.localeCompare(right.alias));
  });

  return { byInitial };
}

function isInlineLinkBoundaryChar(value) {
  return !/[A-Za-z0-9]/.test(String(value || ""));
}

function hasInlineLinkBoundaries(text, start, end) {
  return (start === 0 || isInlineLinkBoundaryChar(text[start - 1]))
    && (end === text.length || isInlineLinkBoundaryChar(text[end]));
}

function renderInlineLinkedText(value, options = {}) {
  const text = String(value || "");
  const linkRegistry = options && options.linkRegistry ? options.linkRegistry : null;
  if (!text) return "";
  if (!linkRegistry || !linkRegistry.byInitial) return escapeHtml(text);

  const excluded = new Set(normalizeArray(options.excludeHrefs));
  const linkedHrefs = new Set();
  const lower = text.toLowerCase();
  let cursor = 0;
  let lastPlainTextIndex = 0;
  let html = "";

  while (cursor < text.length) {
    const candidates = linkRegistry.byInitial[lower.charAt(cursor)] || [];
    let match = null;

    for (const candidate of candidates) {
      const endIndex = cursor + candidate.alias.length;
      if (excluded.has(candidate.href) || linkedHrefs.has(candidate.href)) continue;
      if (!lower.startsWith(candidate.aliasLower, cursor)) continue;
      if (!hasInlineLinkBoundaries(text, cursor, endIndex)) continue;
      match = candidate;
      break;
    }

    if (!match) {
      cursor += 1;
      continue;
    }

    html += escapeHtml(text.slice(lastPlainTextIndex, cursor));
    html += `<a href="${escapeHtml(match.href)}">${escapeHtml(text.slice(cursor, cursor + match.alias.length))}</a>`;
    linkedHrefs.add(match.href);
    cursor += match.alias.length;
    lastPlainTextIndex = cursor;
  }

  html += escapeHtml(text.slice(lastPlainTextIndex));
  return html;
}

function renderInlineLinkedList(values, options = {}) {
  const rows = normalizeArray(values).map((value) => String(value || "").trim()).filter(Boolean);
  if (!rows.length) return escapeHtml(options.emptyText || "None");
  const delimiter = options.delimiter || ", ";
  return rows.map((row) => renderInlineLinkedText(row, options)).join(delimiter);
}

function buildMonogram(value, maxChars = 3) {
  const text = String(value || "").trim();
  if (!text) return "?";
  const words = text.split(/[\s_-]+/g).filter(Boolean);
  if (words.length > 1) return words.map((word) => word.charAt(0).toUpperCase()).join("").slice(0, maxChars);
  return text.replace(/[^a-z0-9]/gi, "").slice(0, maxChars).toUpperCase() || "?";
}

function describeList(values, emptyText = "None") {
  const rows = normalizeArray(values);
  return rows.length ? rows.join(", ") : emptyText;
}

function formatNumber(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return String(value);
  return numberFormatter.format(value);
}

function formatValue(value) {
  if (value === null || value === undefined || value === "") return "None";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "None";
  if (typeof value === "number") return formatNumber(value);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatTicks(value) {
  if (value === null || value === undefined || value === "") return "None";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return String(value);
  return `${formatNumber(amount)} tick${amount === 1 ? "" : "s"}`;
}

function formatPercent(value, digits = 0) {
  if (value === null || value === undefined || value === "") return "None";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return String(value);
  return `${(amount * 100).toFixed(digits)}%`;
}

function formatCoordinates(value) {
  if (!value || typeof value !== "object") return "None";
  if (value.x === undefined || value.y === undefined || value.z === undefined) return "None";
  return `${value.x}, ${value.y}, ${value.z}`;
}

function buildSectionPath(section) {
  return `${DEFAULT_CODEX_BASE_PATH}${String(section || "").replace(/^\/+|\/+$/g, "")}/`;
}

function routePathToOutputFile(siteRoot, routePath) {
  assert(routePath.startsWith(DEFAULT_CODEX_BASE_PATH), `Route ${routePath} does not live under ${DEFAULT_CODEX_BASE_PATH}`);
  const relative = routePath.slice(DEFAULT_CODEX_BASE_PATH.length);
  const segments = relative.split("/").filter(Boolean);
  return segments.length
    ? path.join(siteRoot, ...segments, "index.html")
    : path.join(siteRoot, "index.html");
}

function getItemIconAssetId(item) {
  const assetId = item && item.data && item.data.icon && item.data.icon.assetId
    ? String(item.data.icon.assetId).trim()
    : "";
  return assetId || null;
}

function buildIconHref(assetId) {
  return `${DEFAULT_CODEX_BASE_PATH}assets/pixel/${encodeURIComponent(assetId)}.png`;
}

function renderEntityIcon(options = {}) {
  const {
    siteAssets,
    assetId,
    label,
    size = "md",
    fallbackText
  } = options;

  const normalizedAssetId = assetId ? String(assetId).trim() : "";
  const copiedAssets = siteAssets && siteAssets.iconAssetIds instanceof Set ? siteAssets.iconAssetIds : new Set();
  if (normalizedAssetId && copiedAssets.has(normalizedAssetId)) {
    return `
      <span class="entity-icon entity-icon--${escapeHtml(size)}">
        <img src="${escapeHtml(buildIconHref(normalizedAssetId))}" alt="${escapeHtml(label || normalizedAssetId)}" loading="lazy" />
      </span>
    `;
  }

  const monogram = buildMonogram(fallbackText || label || normalizedAssetId || "?");
  return `<span class="entity-icon entity-icon--${escapeHtml(size)} entity-icon--fallback">${escapeHtml(monogram)}</span>`;
}

function renderMetaList(rows, options = {}) {
  const filtered = normalizeArray(rows).filter((row) => row && (row.html || row.value !== undefined && row.value !== null && row.value !== ""));
  if (!filtered.length) return `<p class="subtle">${escapeHtml(options.emptyText || "No structured metadata yet.")}</p>`;
  return `<ul class="meta-grid">${filtered.map((row) => {
    const valueHtml = row.html || escapeHtml(formatValue(row.value));
    return `<li><span>${escapeHtml(row.label)}</span>${valueHtml}</li>`;
  }).join("")}</ul>`;
}

function renderLinkList(rows, options = {}) {
  const filtered = normalizeArray(rows);
  if (!filtered.length) return `<p class="subtle">${escapeHtml(options.emptyText || "No linked pages yet.")}</p>`;
  const className = options.className || "link-list";
  return `<ul class="${escapeHtml(className)}">${filtered.map((row) => {
    const metaHtml = row.meta ? `<small>${escapeHtml(row.meta)}</small>` : "";
    return `
      <li>
        <a href="${escapeHtml(row.href)}">
          <span>${escapeHtml(row.label)}</span>
          ${metaHtml}
        </a>
      </li>
    `;
  }).join("")}</ul>`;
}

function renderChipList(values, options = {}) {
  const rows = normalizeArray(values);
  if (!rows.length) return `<p class="subtle">${escapeHtml(options.emptyText || "None recorded.")}</p>`;
  const className = options.className || "pill-list";
  return `<ul class="${escapeHtml(className)}">${rows.map((value) => `<li>${escapeHtml(String(value))}</li>`).join("")}</ul>`;
}

function renderStatGrid(stats, options = {}) {
  const filtered = normalizeArray(stats).filter((stat) => stat && (stat.html || stat.value !== undefined && stat.value !== null && stat.value !== ""));
  if (!filtered.length) return `<p class="subtle">${escapeHtml(options.emptyText || "No highlights yet.")}</p>`;
  const className = options.className || "stat-grid";
  const itemClassName = options.itemClassName || "stat-card";
  return `<div class="${escapeHtml(className)}">${filtered.map((stat) => {
    const valueHtml = stat.html || escapeHtml(formatValue(stat.value));
    return `
      <article class="${escapeHtml(itemClassName)}">
        <span class="eyebrow">${escapeHtml(stat.label)}</span>
        <strong>${valueHtml}</strong>
        ${stat.detail ? `<p>${escapeHtml(stat.detail)}</p>` : ""}
      </article>
    `;
  }).join("")}</div>`;
}

function renderSearchHeader(groupId, placeholder, count) {
  return `
    <div class="filter-box">
      <label class="eyebrow" for="${escapeHtml(groupId)}">Filter</label>
      <input id="${escapeHtml(groupId)}" type="search" placeholder="${escapeHtml(placeholder)}" data-filter-input="${escapeHtml(groupId)}" />
      <div class="filter-meta"><span data-filter-count="${escapeHtml(groupId)}">${escapeHtml(formatNumber(count))}</span> visible</div>
    </div>
  `;
}

function renderJsonDetails(title, value) {
  return `
    <details class="details-card">
      <summary>${escapeHtml(title)}</summary>
      <pre class="json-block">${escapeHtml(JSON.stringify(value, null, 2))}</pre>
    </details>
  `;
}

function renderTable(options) {
  const columns = normalizeArray(options.columns);
  const rows = normalizeArray(options.rows);
  if (!rows.length) return `<p class="subtle">${escapeHtml(options.emptyText || "No rows yet.")}</p>`;
  return `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>${columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>${columns.map((column) => `<td>${column.render(row)}</td>`).join("")}</tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

module.exports = {
  DEFAULT_CODEX_BASE_PATH,
  buildInlineLinkRegistry,
  buildMonogram,
  buildSectionPath,
  describeList,
  escapeHtml,
  formatCoordinates,
  formatNumber,
  formatPercent,
  formatTicks,
  formatValue,
  getItemIconAssetId,
  humanizeId,
  renderChipList,
  renderEntityIcon,
  renderInlineLinkedList,
  renderInlineLinkedText,
  renderJsonDetails,
  renderLinkList,
  renderMetaList,
  renderSearchHeader,
  renderStatGrid,
  renderTable,
  routePathToOutputFile
};
