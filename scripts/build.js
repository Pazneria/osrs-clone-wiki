const fs = require("fs");
const path = require("path");

const {
  DEFAULT_CODEX_BASE_PATH,
  buildCodexEntityPath,
  buildCodexHomePath
} = require("./lib/codex-link-contract");
const { loadCodexBundle, validateCodexBundle } = require("./lib/codex-data");
const { syncCodexData } = require("./sync-data");

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

function readJson(absPath) {
  return JSON.parse(fs.readFileSync(absPath, "utf8"));
}

function writeText(absPath, contents) {
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, contents);
}

function copyFile(absSource, absTarget) {
  fs.mkdirSync(path.dirname(absTarget), { recursive: true });
  fs.copyFileSync(absSource, absTarget);
}

function removeDir(absPath) {
  if (fs.existsSync(absPath)) fs.rmSync(absPath, { recursive: true, force: true });
}

function describeList(values) {
  return (Array.isArray(values) ? values : []).filter(Boolean).join(", ");
}

function formatValue(value) {
  if (value === null || value === undefined || value === "") return "None";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "None";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function renderMetaList(rows) {
  const filtered = rows.filter((row) => row && row.value !== undefined && row.value !== null && row.value !== "");
  if (!filtered.length) return "<p class=\"subtle\">No structured metadata yet.</p>";
  return `<ul class="meta-grid">${filtered.map((row) => `<li><span>${escapeHtml(row.label)}</span>${escapeHtml(formatValue(row.value))}</li>`).join("")}</ul>`;
}

function renderLinkList(rows) {
  if (!rows.length) return "<p class=\"subtle\">No linked pages yet.</p>";
  return `<ul class="link-list">${rows.map((row) => `<li><a href="${escapeHtml(row.href)}">${escapeHtml(row.label)}</a></li>`).join("")}</ul>`;
}

function renderChipList(values) {
  const rows = (Array.isArray(values) ? values : []).filter(Boolean);
  if (!rows.length) return "<p class=\"subtle\">None recorded.</p>";
  return `<ul class="pill-list">${rows.map((value) => `<li>${escapeHtml(String(value))}</li>`).join("")}</ul>`;
}

function renderJsonDetails(title, value) {
  return `
    <details>
      <summary>${escapeHtml(title)}</summary>
      <pre class="json-block">${escapeHtml(JSON.stringify(value, null, 2))}</pre>
    </details>
  `;
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

function renderLayout(options) {
  const {
    editorial,
    manifest,
    currentPath,
    pageTitle,
    eyebrow,
    heroTitle,
    heroBody,
    body
  } = options;

  const navLinks = [
    { label: "Home", href: buildCodexHomePath(), active: currentPath === buildCodexHomePath() },
    { label: "Items", href: buildSectionPath("items"), active: currentPath.startsWith(buildSectionPath("items")) },
    { label: "Skills", href: buildSectionPath("skills"), active: currentPath.startsWith(buildSectionPath("skills")) },
    { label: "World", href: buildSectionPath("world"), active: currentPath.startsWith(buildSectionPath("world")) }
  ];

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(pageTitle)} | ${escapeHtml(editorial.siteTitle)}</title>
    <meta name="description" content="${escapeHtml(editorial.tagline)}" />
    <link rel="stylesheet" href="${DEFAULT_CODEX_BASE_PATH}styles.css" />
    <script src="${DEFAULT_CODEX_BASE_PATH}site.js" defer></script>
  </head>
  <body>
    <div class="site-shell">
      <header class="masthead">
        <div class="brandline">
          <div>
            <h1 class="site-title">${escapeHtml(editorial.siteTitle)}</h1>
            <p class="site-tagline">${escapeHtml(editorial.tagline)}</p>
          </div>
          <nav class="main-nav" aria-label="Codex navigation">
            ${navLinks.map((link) => `<a href="${escapeHtml(link.href)}" data-active="${link.active ? "true" : "false"}">${escapeHtml(link.label)}</a>`).join("")}
          </nav>
        </div>
      </header>
      <section class="hero">
        <p class="eyebrow">${escapeHtml(eyebrow)}</p>
        <h2 class="page-title">${escapeHtml(heroTitle)}</h2>
        <div class="prose">${heroBody}</div>
      </section>
      <main class="page-stack">
        ${body}
      </main>
      <p class="footer-note">
        Generated from commit <strong>${escapeHtml(manifest.sourceCommit.slice(0, 12))}</strong>
        on ${escapeHtml(manifest.generatedAt)}.
      </p>
    </div>
  </body>
</html>
`;
}

function renderSearchHeader(groupId, placeholder, count) {
  return `
    <div class="filter-box">
      <label class="eyebrow" for="${escapeHtml(groupId)}">Filter</label>
      <input id="${escapeHtml(groupId)}" type="search" placeholder="${escapeHtml(placeholder)}" data-filter-input="${escapeHtml(groupId)}" />
      <div class="filter-meta"><span data-filter-count="${escapeHtml(groupId)}">${count}</span> visible</div>
    </div>
  `;
}

function renderHomePage(bundle, editorial) {
  const stats = [
    { label: "Items", value: bundle.items.length },
    { label: "Skills", value: bundle.skills.length },
    { label: "Worlds", value: bundle.worlds.length }
  ];

  const sections = (Array.isArray(editorial.homeSections) ? editorial.homeSections : [])
    .map((section) => `<article class="entity-card"><h3>${escapeHtml(section.title)}</h3><p>${escapeHtml(section.body)}</p></article>`)
    .join("");

  const body = `
    <section class="section-card">
      <div class="prose">
        ${editorial.intro.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
      </div>
      <div class="stat-grid">
        ${stats.map((stat) => `<article class="stat-card"><span class="eyebrow">${escapeHtml(stat.label)}</span><strong>${escapeHtml(String(stat.value))}</strong></article>`).join("")}
      </div>
    </section>
    <section class="entity-grid">
      <article class="entity-card">
        <h3><a href="${escapeHtml(buildSectionPath("items"))}">Items</a></h3>
        <p>Canonical item definitions, values, actions, and tool metadata exported from the game runtime catalog.</p>
      </article>
      <article class="entity-card">
        <h3><a href="${escapeHtml(buildSectionPath("skills"))}">Skills</a></h3>
        <p>Skill specs, economy tables, recipes, node tables, and codex cross-links into the worlds that exercise them.</p>
      </article>
      <article class="entity-card">
        <h3><a href="${escapeHtml(buildSectionPath("world"))}">World</a></h3>
        <p>Manifest-backed world pages with travel links, services, structures, and authored route groups.</p>
      </article>
      ${sections}
    </section>
    <section class="section-card">
      <h3>Route Contract</h3>
      <ul class="pill-list">
        <li>${escapeHtml(bundle.manifest.routes.item)}</li>
        <li>${escapeHtml(bundle.manifest.routes.skill)}</li>
        <li>${escapeHtml(bundle.manifest.routes.world)}</li>
      </ul>
      <p class="subtle">Arcade and in-game links should deep-link by stable ID and may optionally include <code>from</code> and <code>return</code> query params.</p>
    </section>
  `;

  return renderLayout({
    editorial,
    manifest: bundle.manifest,
    currentPath: buildCodexHomePath(),
    pageTitle: editorial.siteTitle,
    eyebrow: "Reference Hub",
    heroTitle: editorial.siteTitle,
    heroBody: `<p>${escapeHtml(editorial.tagline)}</p>`,
    body
  });
}

function renderItemCard(item) {
  return `
    <article class="entity-card" data-search="${escapeHtml(`${item.title} ${item.itemId} ${item.data.type || ""} ${(item.relatedSkillIds || []).join(" ")}`)}">
      <p class="eyebrow">${escapeHtml(item.itemId)}</p>
      <h3><a href="${escapeHtml(item.path)}">${escapeHtml(item.title)}</a></h3>
      <p>${escapeHtml(`Type: ${item.data.type || "unknown"} | Value: ${item.data.value ?? "n/a"} | Stackable: ${item.data.stackable ? "yes" : "no"}`)}</p>
    </article>
  `;
}

function renderSkillCard(skill) {
  const recipeCount = skill.data.recipeSet ? Object.keys(skill.data.recipeSet).length : 0;
  const nodeCount = skill.data.nodeTable ? Object.keys(skill.data.nodeTable).length : 0;
  return `
    <article class="entity-card" data-search="${escapeHtml(`${skill.title} ${skill.skillId} ${skill.merchantIds.join(" ")} ${skill.relatedItemIds.join(" ")}`)}">
      <p class="eyebrow">${escapeHtml(skill.skillId)}</p>
      <h3><a href="${escapeHtml(skill.path)}">${escapeHtml(skill.title)}</a></h3>
      <p>${escapeHtml(`Items: ${skill.relatedItemIds.length} | Worlds: ${skill.relatedWorldIds.length} | Nodes: ${nodeCount} | Recipes: ${recipeCount}`)}</p>
    </article>
  `;
}

function renderWorldCard(world) {
  return `
    <article class="entity-card" data-search="${escapeHtml(`${world.title} ${world.worldId} ${world.relatedSkillIds.join(" ")}`)}">
      <p class="eyebrow">${escapeHtml(world.worldId)}</p>
      <h3><a href="${escapeHtml(world.path)}">${escapeHtml(world.title)}</a></h3>
      <p>${escapeHtml(`Services: ${world.serviceCount} | Structures: ${world.structureCount} | Routes: ${world.routeCount}`)}</p>
    </article>
  `;
}

function renderIndexPage(bundle, editorial, options) {
  const { title, pathName, heroTitle, heroBody, groupId, placeholder, cards } = options;
  const currentPath = buildSectionPath(pathName);
  const body = `
    <section class="section-card">
      <div class="section-heading">
        <div>
          <h3>${escapeHtml(title)}</h3>
          <p class="subtle">${escapeHtml(heroBody)}</p>
        </div>
        ${renderSearchHeader(groupId, placeholder, cards.length)}
      </div>
    </section>
    <section class="entity-grid" data-filter-group="${escapeHtml(groupId)}">
      ${cards.join("")}
    </section>
  `;

  return {
    routePath: currentPath,
    html: renderLayout({
      editorial,
      manifest: bundle.manifest,
      currentPath,
      pageTitle: title,
      eyebrow: "Entity Index",
      heroTitle,
      heroBody: `<p>${escapeHtml(heroBody)}</p>`,
      body
    })
  };
}

function renderItemPage(bundle, editorial, item) {
  const skillIndex = new Map(bundle.skills.map((skill) => [skill.skillId, skill]));
  const worldIndex = new Map(bundle.worlds.map((world) => [world.worldId, world]));
  const body = `
    <section class="section-card">
      <h3>Item Summary</h3>
      ${renderMetaList([
        { label: "Item ID", value: item.itemId },
        { label: "Type", value: item.data.type || "unknown" },
        { label: "Value", value: item.data.value },
        { label: "Stackable", value: item.data.stackable ? "Yes" : "No" },
        { label: "Default Action", value: item.data.defaultAction || "None" },
        { label: "Actions", value: describeList(item.data.actions || []) },
        { label: "Icon Asset", value: item.data.icon && item.data.icon.assetId ? item.data.icon.assetId : "None" }
      ])}
    </section>
    <section class="section-card">
      <h3>Related Skills</h3>
      ${renderLinkList(item.relatedSkillIds.map((skillId) => ({
        href: buildCodexEntityPath("skill", skillId),
        label: (skillIndex.get(skillId) || {}).title || skillId
      })))}
    </section>
    <section class="section-card">
      <h3>Related Worlds</h3>
      ${renderLinkList(item.relatedWorldIds.map((worldId) => ({
        href: buildCodexEntityPath("world", worldId),
        label: (worldIndex.get(worldId) || {}).title || worldId
      })))}
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
      eyebrow: "Item",
      heroTitle: item.title,
      heroBody: `<p>${escapeHtml(`Stable item ID: ${item.itemId}`)}</p>`,
      body
    })
  };
}

function renderSkillPage(bundle, editorial, skill) {
  const itemIndex = new Map(bundle.items.map((item) => [item.itemId, item]));
  const worldIndex = new Map(bundle.worlds.map((world) => [world.worldId, world]));
  const recipeCount = skill.data.recipeSet ? Object.keys(skill.data.recipeSet).length : 0;
  const nodeCount = skill.data.nodeTable ? Object.keys(skill.data.nodeTable).length : 0;
  const body = `
    <section class="section-card">
      <h3>Skill Summary</h3>
      ${renderMetaList([
        { label: "Skill ID", value: skill.skillId },
        { label: "Level Bands", value: describeList(skill.data.levelBands || []) },
        { label: "Merchants", value: skill.merchantIds.length },
        { label: "Referenced Items", value: skill.relatedItemIds.length },
        { label: "Worlds", value: skill.relatedWorldIds.length },
        { label: "Recipe Count", value: recipeCount },
        { label: "Node Count", value: nodeCount }
      ])}
    </section>
    <section class="section-card">
      <h3>Merchants</h3>
      ${renderChipList(skill.merchantIds)}
    </section>
    <section class="section-card">
      <h3>Related Items</h3>
      ${renderLinkList(skill.relatedItemIds.map((itemId) => ({
        href: buildCodexEntityPath("item", itemId),
        label: (itemIndex.get(itemId) || {}).title || itemId
      })))}
    </section>
    <section class="section-card">
      <h3>Related Worlds</h3>
      ${renderLinkList(skill.relatedWorldIds.map((worldId) => ({
        href: buildCodexEntityPath("world", worldId),
        label: (worldIndex.get(worldId) || {}).title || worldId
      })))}
    </section>
    <section class="section-card">
      <h3>Formulas</h3>
      ${renderMetaList(Object.keys(skill.data.formulas || {}).map((key) => ({
        label: key,
        value: skill.data.formulas[key]
      })))}
    </section>
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
      eyebrow: "Skill",
      heroTitle: skill.title,
      heroBody: `<p>${escapeHtml(`Stable skill ID: ${skill.skillId}`)}</p>`,
      body
    })
  };
}

function renderWorldRouteSections(world) {
  const groups = world.data && world.data.skillRoutes && typeof world.data.skillRoutes === "object"
    ? world.data.skillRoutes
    : {};
  const groupIds = Object.keys(groups).sort();
  if (!groupIds.length) return "<p class=\"subtle\">No route groups exported.</p>";

  return groupIds.map((groupId) => {
    const routes = Array.isArray(groups[groupId]) ? groups[groupId] : [];
    return `
      <article class="section-card">
        <h3><a href="${escapeHtml(buildCodexEntityPath("skill", groupId))}">${escapeHtml(groupId)}</a></h3>
        <ul class="link-list">
          ${routes.map((route) => `<li><a href="${escapeHtml(buildCodexEntityPath("skill", groupId))}">${escapeHtml(route.label || route.routeId)}</a></li>`).join("")}
        </ul>
      </article>
    `;
  }).join("");
}

function renderWorldServices(world) {
  const services = Array.isArray(world.data.services) ? world.data.services : [];
  if (!services.length) return "<p class=\"subtle\">No services exported.</p>";
  return `<div class="entity-grid">${services.map((service) => `
    <article class="entity-card">
      <p class="eyebrow">${escapeHtml(service.serviceId || "service")}</p>
      <h4>${escapeHtml(service.name || service.type || "Service")}</h4>
      <p>${escapeHtml(`Type: ${service.type || "unknown"}${service.merchantId ? ` | Merchant: ${service.merchantId}` : ""}`)}</p>
    </article>
  `).join("")}</div>`;
}

function renderWorldPage(bundle, editorial, world) {
  const skillIndex = new Map(bundle.skills.map((skill) => [skill.skillId, skill]));
  const worldIndex = new Map(bundle.worlds.map((entry) => [entry.worldId, entry]));
  const body = `
    <section class="section-card">
      <h3>World Summary</h3>
      ${renderMetaList([
        { label: "World ID", value: world.worldId },
        { label: "Manifest Version", value: world.manifestVersion },
        { label: "Region File", value: world.regionFile },
        { label: "Default Spawn", value: world.defaultSpawn ? `${world.defaultSpawn.x}, ${world.defaultSpawn.y}, ${world.defaultSpawn.z}` : "None" },
        { label: "Structures", value: world.structureCount },
        { label: "Services", value: world.serviceCount },
        { label: "Routes", value: world.routeCount }
      ])}
    </section>
    <section class="section-card">
      <h3>Related Skills</h3>
      ${renderLinkList(world.relatedSkillIds.map((skillId) => ({
        href: buildCodexEntityPath("skill", skillId),
        label: (skillIndex.get(skillId) || {}).title || skillId
      })))}
    </section>
    <section class="section-card">
      <h3>Travel Links</h3>
      ${renderLinkList(world.travelLinks.map((link) => ({
        href: buildCodexEntityPath("world", link.targetWorldId),
        label: `${link.serviceId} -> ${((worldIndex.get(link.targetWorldId) || {}).title || link.targetWorldId)}`
      })))}
    </section>
    <section class="section-card">
      <h3>Services</h3>
      ${renderWorldServices(world)}
    </section>
    ${renderWorldRouteSections(world)}
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
      eyebrow: "World",
      heroTitle: world.title,
      heroBody: `<p>${escapeHtml(`Stable world ID: ${world.worldId}`)}</p>`,
      body
    })
  };
}

function writeRoutePage(siteRoot, page) {
  writeText(routePathToOutputFile(siteRoot, page.routePath), page.html);
}

function copyBundleFiles(bundle, siteRoot) {
  const filenames = Object.assign({
    manifest: "manifest.json",
    items: "items.json",
    skills: "skills.json",
    worlds: "worlds.json"
  }, bundle.manifest.files || {});

  const targets = [
    { source: path.join(bundle.dataDir, "manifest.json"), target: path.join(siteRoot, "data", "manifest.json") },
    { source: path.join(bundle.dataDir, filenames.items), target: path.join(siteRoot, "data", "items.json") },
    { source: path.join(bundle.dataDir, filenames.skills), target: path.join(siteRoot, "data", "skills.json") },
    { source: path.join(bundle.dataDir, filenames.worlds), target: path.join(siteRoot, "data", "worlds.json") }
  ];

  targets.forEach((entry) => copyFile(entry.source, entry.target));
}

function validateGeneratedPages(siteRoot, routePaths) {
  routePaths.forEach((routePath) => {
    const outputFile = routePathToOutputFile(siteRoot, routePath);
    assert(fs.existsSync(outputFile), `Missing generated page for ${routePath}`);
  });
}

function run() {
  const projectRoot = path.resolve(__dirname, "..");
  const editorial = readJson(path.join(projectRoot, "content", "editorial", "site.json"));
  const { outDir } = syncCodexData();
  const bundle = loadCodexBundle(projectRoot, outDir);
  validateCodexBundle(bundle);

  const siteRoot = path.join(projectRoot, "dist", "osrs-clone-codex");
  removeDir(siteRoot);
  fs.mkdirSync(siteRoot, { recursive: true });

  copyFile(path.join(projectRoot, "src", "styles.css"), path.join(siteRoot, "styles.css"));
  copyFile(path.join(projectRoot, "src", "site.js"), path.join(siteRoot, "site.js"));
  copyBundleFiles(bundle, siteRoot);

  const routePaths = [
    buildCodexHomePath(),
    buildSectionPath("items"),
    buildSectionPath("skills"),
    buildSectionPath("world"),
    ...bundle.manifest.indexes.items.map((entry) => entry.path),
    ...bundle.manifest.indexes.skills.map((entry) => entry.path),
    ...bundle.manifest.indexes.worlds.map((entry) => entry.path)
  ];

  writeRoutePage(siteRoot, { routePath: buildCodexHomePath(), html: renderHomePage(bundle, editorial) });
  writeRoutePage(siteRoot, renderIndexPage(bundle, editorial, {
    title: "Items",
    pathName: "items",
    heroTitle: "Items",
    heroBody: "Browse canonical item definitions exported from the game runtime catalog.",
    groupId: "items",
    placeholder: "Search items by id, title, type, or related skill",
    cards: bundle.items.map(renderItemCard)
  }));
  writeRoutePage(siteRoot, renderIndexPage(bundle, editorial, {
    title: "Skills",
    pathName: "skills",
    heroTitle: "Skills",
    heroBody: "Browse authored skill specs, economy tables, recipes, and route connections.",
    groupId: "skills",
    placeholder: "Search skills by id, merchant, or referenced item",
    cards: bundle.skills.map(renderSkillCard)
  }));
  writeRoutePage(siteRoot, renderIndexPage(bundle, editorial, {
    title: "World",
    pathName: "world",
    heroTitle: "World",
    heroBody: "Browse manifest-backed world pages, services, route groups, and travel links.",
    groupId: "worlds",
    placeholder: "Search worlds by id, title, or skill group",
    cards: bundle.worlds.map(renderWorldCard)
  }));

  bundle.items.forEach((item) => writeRoutePage(siteRoot, renderItemPage(bundle, editorial, item)));
  bundle.skills.forEach((skill) => writeRoutePage(siteRoot, renderSkillPage(bundle, editorial, skill)));
  bundle.worlds.forEach((world) => writeRoutePage(siteRoot, renderWorldPage(bundle, editorial, world)));

  validateGeneratedPages(siteRoot, routePaths);
  console.log(`Built codex site at ${siteRoot}.`);
}

try {
  run();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
