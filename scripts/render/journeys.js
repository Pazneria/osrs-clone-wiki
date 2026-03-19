const { buildCodexJourneyPath } = require("../lib/codex-link-contract");
const { renderLayout } = require("./layout");
const {
  buildSectionPath,
  escapeHtml,
  renderInlineLinkedText,
  renderChipList,
  renderEntityIcon,
  renderSearchHeader,
  renderStatGrid
} = require("./shared");
const {
  buildEntityLinkRows,
  renderGuideBlockSection,
  renderJourneyCard,
  renderRichText
} = require("./manual");

function renderJourneyStep(step, bundle, options = {}) {
  const linkedRows = buildEntityLinkRows(bundle, {
    itemIds: step.itemIds,
    skillIds: step.skillIds,
    worldIds: step.worldIds
  });

  return `
    <article class="section-card section-card--nested manual-step">
      <div class="section-heading">
        <div>
          <p class="eyebrow">${escapeHtml(step.stepId)}</p>
          <h4>${escapeHtml(step.title)}</h4>
        </div>
      </div>
      ${renderRichText(step.body, options)}
      ${linkedRows.length
        ? `<p class="card-note">${renderInlineLinkedText(
          `Keep ${linkedRows.map((row) => row.label).join(", ")} in view while you do this step.`,
          options
        )}</p>`
        : ""}
    </article>
  `;
}

function renderJourneyPage(bundle, editorial, manualContent, journey, siteAssets) {
  const nextJourneys = journey.nextJourneyIds
    .map((journeyId) => manualContent.journeys.journeysById[journeyId])
    .filter(Boolean);
  const linkedRows = buildEntityLinkRows(bundle, {
    itemIds: journey.relatedItemIds,
    skillIds: journey.relatedSkillIds,
    worldIds: journey.relatedWorldIds
  });

  const heroAside = `
    <div class="hero-panel">
      ${renderStatGrid([
        { label: "Audience", value: journey.audience, detail: "Who this path serves best" },
        { label: "Difficulty", value: journey.difficulty, detail: "Expected starting point" },
        { label: "Steps", value: journey.steps.length, detail: "Manual checkpoints" }
      ], {
        className: "hero-stat-grid",
        itemClassName: "hero-stat-card"
      })}
    </div>
  `;

  const body = `
    ${renderGuideBlockSection({
      eyebrow: "Journey Guide",
      title: "Why follow this route",
      badges: [journey.audience, journey.difficulty],
      blocks: [
        { label: "Summary", body: journey.summary },
        { label: "Outcome", body: [`This journey connects ${journey.relatedSkillIds.length} skills, ${journey.relatedWorldIds.length} worlds, and the items needed to make the loop feel concrete.`] }
      ],
      linkRegistry: siteAssets.linkRegistry,
      excludeHrefs: [journey.path]
    })}
    ${linkedRows.length ? `
      <section class="section-card">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Route Context</p>
            <h3>Pages that reinforce the journey while you follow it</h3>
          </div>
        </div>
        <div class="prose">
          <p>${renderInlineLinkedText(
            `This route is best read alongside ${linkedRows.map((row) => row.label).join(", ")}.`,
            { linkRegistry: siteAssets.linkRegistry, excludeHrefs: [journey.path] }
          )}</p>
        </div>
      </section>
    ` : ""}
    <section class="section-card">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Step Through It</p>
          <h3>Follow the loop in order</h3>
        </div>
      </div>
      <div class="page-stack page-stack--tight">
        ${journey.steps.map((step) => renderJourneyStep(step, bundle, {
          linkRegistry: siteAssets.linkRegistry,
          excludeHrefs: [journey.path]
        })).join("")}
      </div>
    </section>
    ${nextJourneys.length ? `
      <section class="section-card">
        <div class="section-heading">
          <div>
            <p class="eyebrow">What To Do Next</p>
            <h3>Continue into adjacent manual paths</h3>
          </div>
        </div>
        <div class="entity-grid">
          ${nextJourneys.map((entry) => renderJourneyCard(entry, {
            monogram: "NX",
            linkRegistry: siteAssets.linkRegistry,
            excludeHrefs: [entry.path]
          })).join("")}
        </div>
      </section>
    ` : ""}
  `;

  return {
    routePath: journey.path,
    html: renderLayout({
      editorial,
      manifest: bundle.manifest,
      currentPath: journey.path,
      pageTitle: journey.title,
      eyebrow: "Journey Manual",
      heroTitle: journey.title,
      heroBody: renderRichText(journey.summary, {
        linkRegistry: siteAssets.linkRegistry,
        excludeHrefs: [journey.path]
      }),
      heroBadges: [journey.audience, journey.difficulty, `${journey.steps.length} steps`],
      heroAside,
      body
    })
  };
}

function renderJourneyIndexPage(bundle, editorial, manualContent, siteAssets) {
  const journeys = manualContent.journeys.journeys;
  const journeyCards = journeys.map((journey) => renderJourneyCard(journey, {
    monogram: "JR",
    linkRegistry: siteAssets.linkRegistry,
    excludeHrefs: [journey.path]
  })).join("");

  const heroAside = `
    <div class="hero-panel">
      ${renderStatGrid([
        { label: "Journeys", value: journeys.length, detail: "Curated guided loops" },
        { label: "Skills", value: bundle.skills.length, detail: "Systems covered by the manual" },
        { label: "Worlds", value: bundle.worlds.length, detail: "Regions touched by the routes" }
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
          <p class="eyebrow">Start Here</p>
          <h3>Browse curated loops instead of raw systems.</h3>
        </div>
        ${renderSearchHeader("journeys", "Search journeys by title, system, region, or goal", journeys.length)}
      </div>
      <div class="prose">
        <p>Journey pages turn the codex into a living manual: choose a player goal, follow a route, and keep the important item, skill, and world pages within reach.</p>
      </div>
    </section>
    <section class="entity-grid" data-filter-group="journeys">
      ${journeyCards}
    </section>
  `;

  return {
    routePath: buildSectionPath("journeys"),
    html: renderLayout({
      editorial,
      manifest: bundle.manifest,
      currentPath: buildSectionPath("journeys"),
      pageTitle: "Journeys",
      eyebrow: "Living Manual",
      heroTitle: "Journeys",
      heroBody: "<p>Follow curated progression loops that explain what to gather, what to craft, where to go, and which systems to open next.</p>",
      heroBadges: ["Start-here guides", "Cross-system loops", "Static-site friendly"],
      heroAside,
      body
    })
  };
}

module.exports = {
  renderJourneyIndexPage,
  renderJourneyPage
};
