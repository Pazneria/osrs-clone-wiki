const { buildCodexEntityPath, buildCodexJourneyPath } = require("../lib/codex-link-contract");
const { renderLayout } = require("./layout");
const {
  buildSectionPath,
  describeList,
  escapeHtml,
  formatCoordinates,
  formatNumber,
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

function summarizeResourceGroups(world) {
  const nodeGroups = world.data && world.data.resourceNodes ? world.data.resourceNodes : {};
  return Object.keys(nodeGroups).sort().map((skillId) => {
    const nodes = Array.isArray(nodeGroups[skillId]) ? nodeGroups[skillId] : [];
    const routeIds = Array.from(new Set(nodes.map((node) => node.routeId).filter(Boolean))).sort();
    const resourceLabels = Array.from(new Set(nodes.map((node) => humanizeId(node.oreType || node.resourceType || node.rewardItemId || skillId)).filter(Boolean))).sort();
    return {
      skillId,
      totalNodes: nodes.length,
      routeIds,
      resourceLabels
    };
  });
}

function summarizeLandmarks(world) {
  const landmarks = world.data && world.data.landmarks ? world.data.landmarks : {};
  return Object.keys(landmarks).sort().map((key) => {
    const rows = Array.isArray(landmarks[key]) ? landmarks[key] : [];
    const sample = rows[0] || {};
    return {
      key,
      count: rows.length,
      sampleId: sample.landmarkId || sample.tileId || sample.label || "Multiple entries"
    };
  }).filter((row) => row.count > 0);
}

function normalizeParagraphs(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map((entry) => String(entry).trim()).filter(Boolean);
  const text = String(value || "").trim();
  return text ? [text] : [];
}

function getManualWorldEntry(manualContent, worldId) {
  if (!manualContent || !manualContent.worldsById) return null;
  return manualContent.worldsById[worldId] || null;
}

function getManualJourneyCollection(manualContent) {
  const journeys = manualContent && manualContent.journeys && Array.isArray(manualContent.journeys.journeys)
    ? manualContent.journeys.journeys
    : Array.isArray(manualContent && manualContent.journeys)
      ? manualContent.journeys
      : [];
  const journeysById = manualContent && manualContent.journeys && manualContent.journeys.journeysById
    ? manualContent.journeys.journeysById
    : manualContent && manualContent.journeysById
      ? manualContent.journeysById
      : {};
  return { journeys, journeysById };
}

function resolveWorldRenderArgs(bundle, editorial, manualContentOrWorld, worldOrSiteAssets, maybeSiteAssets) {
  const looksLikeWorld = manualContentOrWorld && typeof manualContentOrWorld === "object" && typeof manualContentOrWorld.worldId === "string";
  if (looksLikeWorld) {
    return {
      manualContent: maybeSiteAssets || {},
      world: manualContentOrWorld,
      siteAssets: worldOrSiteAssets || {}
    };
  }

  return {
    manualContent: manualContentOrWorld || {},
    world: worldOrSiteAssets,
    siteAssets: maybeSiteAssets || {}
  };
}

function resolveWorldIndexArgs(manualContentOrSiteAssets, maybeSiteAssets) {
  const looksLikeManualContent = manualContentOrSiteAssets
    && typeof manualContentOrSiteAssets === "object"
    && (manualContentOrSiteAssets.worldsById || manualContentOrSiteAssets.journeys || manualContentOrSiteAssets.schemaVersion);

  return looksLikeManualContent
    ? {
      manualContent: manualContentOrSiteAssets,
      siteAssets: maybeSiteAssets || {}
    }
    : {
      manualContent: maybeSiteAssets || {},
      siteAssets: manualContentOrSiteAssets || {}
    };
}

function renderParagraphCopy(paragraphs, emptyText, options = {}) {
  const rows = normalizeParagraphs(paragraphs);
  if (!rows.length) return `<p class="subtle">${escapeHtml(emptyText || "No guidance yet.")}</p>`;
  if (rows.length === 1) return `<p class="card-note">${renderInlineLinkedText(rows[0], options)}</p>`;
  return `<ul class="guide-list">${rows.map((entry) => `<li>${renderInlineLinkedText(entry, options)}</li>`).join("")}</ul>`;
}

function buildWorldSummaryLine(world, manualWorld) {
  const resources = summarizeResourceGroups(world).map((row) => humanizeId(row.skillId));
  const parts = [
    `${world.serviceCount} services`,
    `${world.routeCount} route anchors`,
    `${world.travelLinks.length} travel links`
  ];
  if (manualWorld && Array.isArray(manualWorld.featuredJourneyIds) && manualWorld.featuredJourneyIds.length) {
    parts.push(`${manualWorld.featuredJourneyIds.length} journey links`);
  }
  parts.push(resources.length ? `Resources: ${resources.join(", ")}` : "No resource coverage");
  return parts.join(" | ");
}

function buildManualSearchText(world, manualWorld) {
  return [
    world.title,
    world.worldId,
    world.relatedSkillIds.join(" "),
    manualWorld && manualWorld.overview ? manualWorld.overview.join(" ") : "",
    manualWorld && manualWorld.whyItMatters ? manualWorld.whyItMatters.join(" ") : "",
    manualWorld && manualWorld.howToGetStarted ? manualWorld.howToGetStarted.join(" ") : "",
    manualWorld && manualWorld.connectedSystems ? manualWorld.connectedSystems.join(" ") : "",
    manualWorld && manualWorld.nextSteps ? manualWorld.nextSteps.join(" ") : "",
    manualWorld && manualWorld.featuredItemIds ? manualWorld.featuredItemIds.join(" ") : "",
    manualWorld && manualWorld.featuredSkillIds ? manualWorld.featuredSkillIds.join(" ") : "",
    manualWorld && manualWorld.featuredWorldIds ? manualWorld.featuredWorldIds.join(" ") : "",
    manualWorld && manualWorld.featuredJourneyIds ? manualWorld.featuredJourneyIds.join(" ") : ""
  ].join(" ");
}

function renderWorldCard(world, siteAssets, manualWorld) {
  const summary = buildWorldSummaryLine(world, manualWorld);
  const lede = manualWorld && Array.isArray(manualWorld.overview) && manualWorld.overview.length
    ? manualWorld.overview[0]
    : summary;
  const badges = [
    `${world.serviceCount} services`,
    `${world.routeCount} routes`,
    `${world.travelLinks.length} travel links`
  ];
  if (manualWorld && Array.isArray(manualWorld.featuredJourneyIds) && manualWorld.featuredJourneyIds.length) {
    badges.push(`${manualWorld.featuredJourneyIds.length} journeys`);
  }

  return `
    <article class="entity-card entity-card--indexed" data-search="${escapeHtml(buildManualSearchText(world, manualWorld))}">
      <div class="entity-card__header">
        ${renderEntityIcon({
          siteAssets,
          label: world.title,
          size: "md",
          fallbackText: world.worldId
        })}
        <div class="entity-card__copy">
          <p class="eyebrow">${escapeHtml(world.worldId)}</p>
          <h3><a href="${escapeHtml(world.path)}">${escapeHtml(world.title)}</a></h3>
          <p class="entity-card__lede">${renderInlineLinkedText(lede, { linkRegistry: siteAssets.linkRegistry, excludeHrefs: [world.path] })}</p>
        </div>
      </div>
      ${renderChipList(badges, { className: "pill-list pill-list--dense", emptyText: "No region highlights." })}
      ${world.relatedSkillIds.length
        ? `<p class="card-note">${renderInlineLinkedText(
          `Skill anchors: ${describeList(world.relatedSkillIds.map((skillId) => humanizeId(skillId)))}.`,
          { linkRegistry: siteAssets.linkRegistry, excludeHrefs: [world.path] }
        )}</p>`
        : `<p class="subtle">No linked skill groups.</p>`}
    </article>
  `;
}

function renderServiceSection(world) {
  const services = Array.isArray(world.data && world.data.services) ? world.data.services : [];
  return `
    <section class="section-card">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Services</p>
          <h3>Trade, travel, and station access</h3>
        </div>
      </div>
      ${renderTable({
        columns: [
          { label: "Service", render: (row) => escapeHtml(row.name) },
          { label: "Type", render: (row) => escapeHtml(row.type) },
          { label: "Action", render: (row) => escapeHtml(row.action) },
          { label: "Location", render: (row) => escapeHtml(row.location) },
          { label: "Tags", render: (row) => escapeHtml(row.tags) }
        ],
        rows: services.map((service) => ({
          name: service.name || service.serviceId || humanizeId(service.type || "service"),
          type: humanizeId(service.type || "service"),
          action: service.action || "None",
          location: `${service.x}, ${service.y}, ${service.z}`,
          tags: describeList(service.tags || [])
        })),
        emptyText: "No services exported."
      })}
    </section>
  `;
}

function renderTravelSection(world, worldIndex) {
  return `
    <section class="section-card">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Travel</p>
          <h3>Fast links to connected regions</h3>
        </div>
      </div>
      ${renderTable({
        columns: [
          { label: "Service", render: (row) => escapeHtml(row.serviceId) },
          {
            label: "Destination",
            render: (row) => `<a class="table-link" href="${escapeHtml(row.href)}">${escapeHtml(row.label)}</a>`
          },
          { label: "Target world", render: (row) => escapeHtml(row.targetWorldId) }
        ],
        rows: world.travelLinks.map((link) => ({
          serviceId: link.serviceId,
          href: buildCodexEntityPath("world", link.targetWorldId),
          label: ((worldIndex.get(link.targetWorldId) || {}).title || humanizeId(link.targetWorldId)),
          targetWorldId: link.targetWorldId
        })),
        emptyText: "No travel services exported."
      })}
    </section>
  `;
}

function renderResourceSection(world, linkRegistry) {
  const rows = summarizeResourceGroups(world);
  return `
    <section class="section-card">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Resource Coverage</p>
          <h3>What players can gather here at a glance</h3>
        </div>
      </div>
      ${renderTable({
        columns: [
          { label: "Skill", render: (row) => escapeHtml(humanizeId(row.skillId)) },
          { label: "Nodes", render: (row) => escapeHtml(formatNumber(row.totalNodes)) },
          { label: "Resources", render: (row) => renderInlineLinkedText(row.resourceLabels.join(", "), { linkRegistry }) },
          { label: "Route clusters", render: (row) => escapeHtml(row.routeIds.join(", ") || "None") }
        ],
        rows,
        emptyText: "No resource nodes exported."
      })}
    </section>
  `;
}

function renderRouteSection(world) {
  const groups = world.data && world.data.skillRoutes ? world.data.skillRoutes : {};
  const skillIds = Object.keys(groups).sort();
  if (!skillIds.length) return "";

  return `
    <section class="section-card">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Route Anchors</p>
          <h3>Skill-linked locations and route labels</h3>
        </div>
      </div>
      <div class="page-stack page-stack--tight">
        ${skillIds.map((skillId) => {
          const routes = Array.isArray(groups[skillId]) ? groups[skillId] : [];
          return `
            <article class="section-card section-card--nested">
              <h4><a href="${escapeHtml(buildCodexEntityPath("skill", skillId))}">${escapeHtml(humanizeId(skillId))}</a></h4>
              ${renderTable({
                columns: [
                  { label: "Label", render: (row) => escapeHtml(row.label) },
                  { label: "Alias", render: (row) => escapeHtml(row.alias) },
                  { label: "Location", render: (row) => escapeHtml(row.location) },
                  { label: "Tags", render: (row) => escapeHtml(row.tags) }
                ],
                rows: routes.map((route) => ({
                  label: route.label || route.routeId,
                  alias: route.alias || route.routeId,
                  location: `${route.x}, ${route.y}, ${route.z}`,
                  tags: describeList(route.tags || [])
                })),
                emptyText: "No route rows exported."
              })}
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderLandmarkSection(world) {
  const rows = summarizeLandmarks(world);
  return `
    <section class="section-card">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Landmarks</p>
          <h3>Named or grouped spatial details</h3>
        </div>
      </div>
      <div class="entity-grid">
        ${rows.length ? rows.map((row) => `
          <article class="entity-card">
            <p class="eyebrow">${escapeHtml(humanizeId(row.key))}</p>
            <h4>${escapeHtml(`${row.count} entries`)}</h4>
            <p>${escapeHtml(`Sample: ${humanizeId(row.sampleId)}`)}</p>
          </article>
        `).join("") : "<p class=\"subtle\">No landmark groups exported.</p>"}
      </div>
    </section>
  `;
}

function renderManualBriefSection(manualWorld, options = {}) {
  const hasBrief = manualWorld && (
    normalizeParagraphs(manualWorld.overview).length ||
    normalizeParagraphs(manualWorld.howToGetStarted).length ||
    normalizeParagraphs(manualWorld.whyItMatters).length ||
    normalizeParagraphs(manualWorld.nextSteps).length
  );
  if (!hasBrief) return "";

  return `
    <section class="section-card">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Manual Briefing</p>
          <h3>What to do here first</h3>
        </div>
      </div>
      <div class="manual-grid">
        <article class="section-card section-card--nested manual-card">
          <p class="eyebrow">What to do here</p>
          ${renderParagraphCopy(manualWorld.overview, "No overview yet.", options)}
        </article>
        <article class="section-card section-card--nested manual-card">
          <p class="eyebrow">How to get started</p>
          ${renderParagraphCopy(manualWorld.howToGetStarted, "No starter guidance yet.", options)}
        </article>
        <article class="section-card section-card--nested manual-card">
          <p class="eyebrow">Why it matters</p>
          ${renderParagraphCopy(manualWorld.whyItMatters, "No impact notes yet.", options)}
        </article>
        <article class="section-card section-card--nested manual-card">
          <p class="eyebrow">Next steps</p>
          ${renderParagraphCopy(manualWorld.nextSteps, "No next steps yet.", options)}
        </article>
      </div>
    </section>
  `;
}

function renderFeaturedLoopsSection(world, manualWorld, bundle, linkRegistry) {
  const itemIndex = new Map(bundle.items.map((item) => [item.itemId, item]));
  const skillIndex = new Map(bundle.skills.map((skill) => [skill.skillId, skill]));
  const worldIndex = new Map(bundle.worlds.map((entry) => [entry.worldId, entry]));

  const sections = [
    {
      label: "Featured items",
      ids: manualWorld && Array.isArray(manualWorld.featuredItemIds) ? manualWorld.featuredItemIds : [],
      render: (id) => ({
        href: buildCodexEntityPath("item", id),
        label: (itemIndex.get(id) || {}).title || humanizeId(id),
        meta: "Item loop"
      })
    },
    {
      label: "Featured skills",
      ids: manualWorld && Array.isArray(manualWorld.featuredSkillIds) ? manualWorld.featuredSkillIds : [],
      render: (id) => ({
        href: buildCodexEntityPath("skill", id),
        label: (skillIndex.get(id) || {}).title || humanizeId(id),
        meta: "Skill loop"
      })
    },
    {
      label: "Featured worlds",
      ids: manualWorld && Array.isArray(manualWorld.featuredWorldIds) ? manualWorld.featuredWorldIds : [],
      render: (id) => ({
        href: buildCodexEntityPath("world", id),
        label: (worldIndex.get(id) || {}).title || humanizeId(id),
        meta: "World loop"
      })
    }
  ].filter((section) => section.ids.length);

  if (!sections.length) return "";

  return `
    <section class="section-card">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Play Patterns</p>
          <h3>Shortest ways to read this region in context</h3>
        </div>
      </div>
      <div class="prose">
        ${sections.map((section) => {
          const labels = section.ids.map((id) => section.render(id).label);
          return `<p>${renderInlineLinkedText(`${section.label}: ${describeList(labels)}.`, { linkRegistry, excludeHrefs: [world.path] })}</p>`;
        }).join("")}
      </div>
    </section>
  `;
}

function renderConnectedSystemsSection(world, manualWorld, options = {}) {
  const connectedSystems = manualWorld ? normalizeParagraphs(manualWorld.connectedSystems) : [];
  const statRows = [
    { label: "Services", value: world.serviceCount },
    { label: "Routes", value: world.routeCount },
    { label: "Travel links", value: world.travelLinks.length },
    { label: "Related skills", value: world.relatedSkillIds.length }
  ];

  return `
    <section class="section-card">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Connected Systems</p>
          <h3>Where this world plugs into the sandbox</h3>
        </div>
      </div>
      <div class="split-grid">
        <article class="section-card section-card--nested">
          <p class="eyebrow">System notes</p>
          ${renderParagraphCopy(connectedSystems, "No connected systems yet.", options)}
        </article>
        <article class="section-card section-card--nested">
          <p class="eyebrow">Signals</p>
          ${renderMetaList(statRows)}
        </article>
      </div>
    </section>
  `;
}

function renderJourneySection(world, manualWorld, manualContent, linkRegistry) {
  const { journeys, journeysById } = getManualJourneyCollection(manualContent);
  const journeyIds = new Set();

  if (manualWorld && Array.isArray(manualWorld.featuredJourneyIds)) {
    manualWorld.featuredJourneyIds.forEach((journeyId) => journeyIds.add(journeyId));
  }

  journeys.forEach((journey) => {
    if (Array.isArray(journey.relatedWorldIds) && journey.relatedWorldIds.includes(world.worldId)) {
      journeyIds.add(journey.journeyId);
    }
  });

  const rows = Array.from(journeyIds).sort().map((journeyId) => {
    const journey = journeysById[journeyId] || journeys.find((entry) => entry.journeyId === journeyId);
    return {
      href: buildCodexJourneyPath(journeyId),
      label: journey ? journey.title : humanizeId(journeyId),
      meta: journey
        ? `${journey.audience || "All players"} | ${journey.difficulty || "Starter"} | ${journey.steps.length} steps`
        : "Journey"
    };
  });

  if (!rows.length) return "";

  return `
    <section class="section-card">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Guided Routes</p>
          <h3>Journeys that pass through this world</h3>
        </div>
      </div>
      <div class="prose">
        <p>${renderInlineLinkedText(
          `Guided routes that include this world: ${rows.map((row) => row.label).join(", ")}.`,
          { linkRegistry, excludeHrefs: [world.path] }
        )}</p>
      </div>
    </section>
  `;
}

function renderWorldPage(bundle, editorial, manualContentOrWorld, worldOrSiteAssets, maybeSiteAssets) {
  const { manualContent, world, siteAssets } = resolveWorldRenderArgs(
    bundle,
    editorial,
    manualContentOrWorld,
    worldOrSiteAssets,
    maybeSiteAssets
  );
  const skillIndex = new Map(bundle.skills.map((skill) => [skill.skillId, skill]));
  const worldIndex = new Map(bundle.worlds.map((entry) => [entry.worldId, entry]));
  const manualWorld = getManualWorldEntry(manualContent, world.worldId);

  const heroAside = `
    <div class="hero-panel hero-panel--entity">
      <div class="hero-entity-lockup">
        ${renderEntityIcon({
          siteAssets,
          label: world.title,
          size: "xl",
          fallbackText: world.worldId
        })}
        <div>
          <p class="eyebrow">Region Overview</p>
          <p class="hero-entity-note">${escapeHtml(buildWorldSummaryLine(world, manualWorld))}</p>
        </div>
      </div>
      ${renderStatGrid([
        { label: "Services", value: world.serviceCount },
        { label: "Routes", value: world.routeCount },
        { label: "Structures", value: world.structureCount },
        { label: "Travel", value: world.travelLinks.length }
      ], {
        className: "hero-stat-grid",
        itemClassName: "hero-stat-card"
      })}
    </div>
  `;

  const manualHeroText = manualWorld && Array.isArray(manualWorld.overview) && manualWorld.overview.length
    ? `${manualWorld.overview[0]} This page then moves through the manual briefing, play patterns, connected systems, guided routes, and the raw export tables.`
    : `Use this page to scan ${world.title}'s services, travel options, resource coverage, and route anchors before dropping into the raw region export.`;

  const body = `
    ${renderManualBriefSection(manualWorld, { linkRegistry: siteAssets.linkRegistry, excludeHrefs: [world.path] })}
    ${renderFeaturedLoopsSection(world, manualWorld, bundle, siteAssets.linkRegistry)}
    ${renderConnectedSystemsSection(world, manualWorld, { linkRegistry: siteAssets.linkRegistry, excludeHrefs: [world.path] })}
    ${renderJourneySection(world, manualWorld, manualContent, siteAssets.linkRegistry)}
    <section class="section-card">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Quick Facts</p>
          <h3>Core region metadata</h3>
        </div>
      </div>
      ${renderMetaList([
        { label: "World ID", value: world.worldId },
        { label: "Manifest version", value: world.manifestVersion },
        { label: "Region file", value: world.regionFile },
        { label: "Default spawn", value: formatCoordinates(world.defaultSpawn) },
        {
          label: "Related skills",
          html: renderInlineLinkedList(
            world.relatedSkillIds.map((skillId) => (skillIndex.get(skillId) || {}).title || skillId),
            { linkRegistry: siteAssets.linkRegistry, excludeHrefs: [world.path], emptyText: "None" }
          )
        }
      ])}
    </section>
    ${renderServiceSection(world)}
    ${renderTravelSection(world, worldIndex)}
    ${renderResourceSection(world, siteAssets.linkRegistry)}
    ${renderRouteSection(world)}
    ${renderLandmarkSection(world)}
    <section class="section-card">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Skill Coverage</p>
          <h3>Skill pages connected to this region</h3>
        </div>
      </div>
      <div class="prose">
        <p>${renderInlineLinkedText(
          `Open ${describeList(world.relatedSkillIds.map((skillId) => (skillIndex.get(skillId) || {}).title || skillId))} to read the skill-side loops that depend on this region.`,
          { linkRegistry: siteAssets.linkRegistry, excludeHrefs: [world.path] }
        )}</p>
      </div>
    </section>
    <section class="section-card">
      ${renderJsonDetails("Raw exported world data", world.data)}
    </section>
  `;

  return {
    routePath: world.path,
    html: renderLayout({
      editorial,
      manifest: bundle.manifest,
      currentPath: world.path,
      pageTitle: world.title,
      eyebrow: "World Reference",
      heroTitle: world.title,
      heroBody: `<p>${renderInlineLinkedText(manualHeroText, { linkRegistry: siteAssets.linkRegistry, excludeHrefs: [world.path] })}</p>`,
      heroBadges: [
        `${world.serviceCount} services`,
        `${world.routeCount} route anchors`,
        `${world.travelLinks.length} travel links`,
        manualWorld && Array.isArray(manualWorld.featuredJourneyIds) && manualWorld.featuredJourneyIds.length
          ? `${manualWorld.featuredJourneyIds.length} journey links`
          : null
      ].filter(Boolean),
      heroAside,
      body
    })
  };
}

function renderWorldIndexPage(bundle, editorial, manualContentOrSiteAssets, maybeSiteAssets) {
  const { manualContent, siteAssets } = resolveWorldIndexArgs(manualContentOrSiteAssets, maybeSiteAssets);
  const cards = bundle.worlds.map((world) => renderWorldCard(world, siteAssets, getManualWorldEntry(manualContent, world.worldId))).join("");
  const totalServices = bundle.worlds.reduce((sum, world) => sum + world.serviceCount, 0);
  const totalRoutes = bundle.worlds.reduce((sum, world) => sum + world.routeCount, 0);
  const journeyLinkCount = Array.from(new Set(bundle.worlds.reduce((ids, world) => {
    const manualWorld = getManualWorldEntry(manualContent, world.worldId);
    if (manualWorld && Array.isArray(manualWorld.featuredJourneyIds)) {
      manualWorld.featuredJourneyIds.forEach((journeyId) => ids.push(journeyId));
    }
    return ids;
  }, []))).length;

  const heroAside = `
    <div class="hero-panel">
      ${renderStatGrid([
        { label: "Worlds", value: bundle.worlds.length, detail: "Current published regions" },
        { label: "Services", value: totalServices, detail: "Trade, travel, and stations" },
        { label: "Routes", value: totalRoutes, detail: "Skill-linked anchors" },
        { label: "Journey links", value: journeyLinkCount, detail: "Manual paths into each world" }
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
          <p class="eyebrow">Browse Worlds</p>
          <h3>Search by region name, world ID, manual guidance, or linked system families.</h3>
        </div>
        ${renderSearchHeader("worlds", "Search worlds by id, title, guide text, or skill group", bundle.worlds.length)}
      </div>
    </section>
    <section class="entity-grid" data-filter-group="worlds">
      ${cards}
    </section>
  `;

  return {
    routePath: buildSectionPath("world"),
    html: renderLayout({
      editorial,
      manifest: bundle.manifest,
      currentPath: buildSectionPath("world"),
      pageTitle: "Worlds",
      eyebrow: "Entity Index",
      heroTitle: "Worlds",
      heroBody: "<p>Browse region pages that open with a manual briefing, play patterns, connected systems, and guided routes before the raw world export.</p>",
      heroBadges: ["Manual-first reading", "Linked journeys", "Travel-aware"],
      heroAside,
      body
    })
  };
}

module.exports = {
  renderWorldIndexPage,
  renderWorldPage
};
