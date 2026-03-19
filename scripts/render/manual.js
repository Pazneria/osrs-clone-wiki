const { buildCodexEntityPath } = require("../lib/codex-link-contract");
const {
  escapeHtml,
  humanizeId,
  renderChipList,
  renderInlineLinkedText,
  renderLinkList
} = require("./shared");

function normalizeParagraphs(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map((entry) => String(entry).trim()).filter(Boolean);
  const text = String(value || "").trim();
  return text ? [text] : [];
}

function renderRichText(value, options = {}) {
  const paragraphs = normalizeParagraphs(value);
  if (!paragraphs.length) return `<p class="subtle">${escapeHtml(options.emptyText || "No manual notes yet.")}</p>`;
  if (paragraphs.length === 1) {
    return `<p class="card-note">${renderInlineLinkedText(paragraphs[0], options)}</p>`;
  }
  return `<ul class="${escapeHtml(options.listClassName || "guide-list")}">${paragraphs.map((entry) => `<li>${renderInlineLinkedText(entry, options)}</li>`).join("")}</ul>`;
}

function renderGuideBlockSection(options = {}) {
  const blocks = (Array.isArray(options.blocks) ? options.blocks : []).filter((block) => block && normalizeParagraphs(block.body).length);
  if (!blocks.length) return "";
  const badgeHtml = options.badges && options.badges.length
    ? renderChipList(options.badges, { className: "pill-list pill-list--dense" })
    : "";
  return `
    <section class="section-card">
      <div class="section-heading">
        <div>
          <p class="eyebrow">${escapeHtml(options.eyebrow || "Manual Guide")}</p>
          <h3>${escapeHtml(options.title || "Start Here")}</h3>
        </div>
        ${badgeHtml}
      </div>
      <div class="manual-grid">
        ${blocks.map((block) => `
          <article class="section-card section-card--nested manual-card">
            <p class="eyebrow">${escapeHtml(block.label)}</p>
            ${renderRichText(block.body, options)}
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderLinkedEntitySection(options = {}) {
  const rows = Array.isArray(options.rows) ? options.rows : [];
  if (!rows.length) return "";
  return `
    <section class="section-card">
      <div class="section-heading">
        <div>
          <p class="eyebrow">${escapeHtml(options.eyebrow || "Connected Systems")}</p>
          <h3>${escapeHtml(options.title || "Follow the loop outward")}</h3>
        </div>
      </div>
      ${renderLinkList(rows, { className: options.className || "manual-link-list", emptyText: options.emptyText || "No connected pages." })}
    </section>
  `;
}

function renderJourneyCard(journey, options = {}) {
  const meta = [
    journey.audience,
    journey.difficulty,
    `${journey.steps.length} steps`
  ].filter(Boolean);
  const summaryText = normalizeParagraphs(journey.summary).join(" ");
  return `
    <article class="entity-card journey-card" data-search="${escapeHtml(`${journey.title} ${journey.journeyId} ${summaryText} ${(journey.relatedItemIds || []).join(" ")} ${(journey.relatedSkillIds || []).join(" ")} ${(journey.relatedWorldIds || []).join(" ")} ${journey.audience || ""} ${journey.difficulty || ""}`)}">
      <div class="entity-card__header">
        <span class="entity-icon entity-icon--md entity-icon--fallback">${escapeHtml(options.monogram || "JR")}</span>
        <div class="entity-card__copy">
          <p class="eyebrow">${escapeHtml(journey.journeyId)}</p>
          <h3><a href="${escapeHtml(journey.path)}">${escapeHtml(journey.title)}</a></h3>
          ${renderRichText(journey.summary, {
            emptyText: "No summary.",
            linkRegistry: options.linkRegistry,
            excludeHrefs: Array.isArray(options.excludeHrefs) ? options.excludeHrefs : []
          })}
        </div>
      </div>
      ${renderChipList(meta, { className: "pill-list pill-list--dense" })}
    </article>
  `;
}

function buildEntityLinkRows(bundle, options = {}) {
  const rows = [];
  (Array.isArray(options.skillIds) ? options.skillIds : []).forEach((skillId) => {
    const skill = bundle.skills.find((entry) => entry.skillId === skillId);
    rows.push({
      href: buildCodexEntityPath("skill", skillId),
      label: skill ? skill.title : humanizeId(skillId),
      meta: "Skill"
    });
  });
  (Array.isArray(options.itemIds) ? options.itemIds : []).forEach((itemId) => {
    const item = bundle.items.find((entry) => entry.itemId === itemId);
    rows.push({
      href: buildCodexEntityPath("item", itemId),
      label: item ? item.title : humanizeId(itemId),
      meta: "Item"
    });
  });
  (Array.isArray(options.worldIds) ? options.worldIds : []).forEach((worldId) => {
    const world = bundle.worlds.find((entry) => entry.worldId === worldId);
    rows.push({
      href: buildCodexEntityPath("world", worldId),
      label: world ? world.title : humanizeId(worldId),
      meta: "World"
    });
  });
  (Array.isArray(options.enemyIds) ? options.enemyIds : []).forEach((enemyId) => {
    const enemy = bundle.enemies.find((entry) => entry.enemyId === enemyId);
    rows.push({
      href: buildCodexEntityPath("enemy", enemyId),
      label: enemy ? enemy.title : humanizeId(enemyId),
      meta: "Enemy"
    });
  });
  return rows;
}

module.exports = {
  buildEntityLinkRows,
  renderGuideBlockSection,
  renderJourneyCard,
  renderLinkedEntitySection,
  renderRichText
};
