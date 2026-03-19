const { buildCodexHomePath } = require("../lib/codex-link-contract");
const {
  buildSectionPath,
  escapeHtml,
  renderChipList,
  renderStatGrid
} = require("./shared");

function renderLayout(options) {
  const {
    editorial,
    manifest,
    currentPath,
    pageTitle,
    eyebrow,
    heroTitle,
    heroBody,
    heroBadges = [],
    heroStats = [],
    heroAside = "",
    body
  } = options;

  const navLinks = [
    { label: "Home", href: buildCodexHomePath(), active: currentPath === buildCodexHomePath() },
    { label: "Journeys", href: buildSectionPath("journeys"), active: currentPath.startsWith(buildSectionPath("journeys")) },
    { label: "Items", href: buildSectionPath("items"), active: currentPath.startsWith(buildSectionPath("items")) },
    { label: "Skills", href: buildSectionPath("skills"), active: currentPath.startsWith(buildSectionPath("skills")) },
    { label: "Enemies", href: buildSectionPath("enemies"), active: currentPath.startsWith(buildSectionPath("enemies")) },
    { label: "Worlds", href: buildSectionPath("world"), active: currentPath.startsWith(buildSectionPath("world")) }
  ];

  const generatedCommit = manifest && manifest.sourceCommit ? String(manifest.sourceCommit).slice(0, 12) : "unknown";
  const generatedAt = manifest && manifest.generatedAt ? String(manifest.generatedAt) : "unknown";
  const brandKicker = editorial.brandKicker || "Pazneria Reference Hub";
  const footerNote = editorial.footerNote || "Export-backed reference pages for the OSRS Clone sandbox.";
  const heroAsideHtml = heroAside || renderStatGrid(heroStats, {
    className: "hero-stat-grid",
    itemClassName: "hero-stat-card",
    emptyText: ""
  });

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(pageTitle)} | ${escapeHtml(editorial.siteTitle)}</title>
    <meta name="description" content="${escapeHtml(editorial.tagline)}" />
    <link rel="stylesheet" href="${buildCodexHomePath()}styles.css" />
    <script src="${buildCodexHomePath()}site.js" defer></script>
  </head>
  <body>
    <div class="site-chrome"></div>
    <div class="site-shell">
      <header class="masthead">
        <div class="brandline">
          <div class="brand-lockup">
            <a class="brand-mark" href="${escapeHtml(buildCodexHomePath())}" aria-label="${escapeHtml(editorial.siteTitle)} home">OC</a>
            <div>
              <p class="brand-kicker">${escapeHtml(brandKicker)}</p>
              <h1 class="site-title">${escapeHtml(editorial.siteTitle)}</h1>
              <p class="site-tagline">${escapeHtml(editorial.tagline)}</p>
            </div>
          </div>
          <nav class="main-nav" aria-label="Codex navigation">
            ${navLinks.map((link) => `<a href="${escapeHtml(link.href)}" data-active="${link.active ? "true" : "false"}">${escapeHtml(link.label)}</a>`).join("")}
          </nav>
        </div>
      </header>
      <section class="hero">
        <div class="hero-grid">
          <div class="hero-copy">
            <p class="eyebrow">${escapeHtml(eyebrow)}</p>
            <h2 class="page-title">${escapeHtml(heroTitle)}</h2>
            <div class="prose">${heroBody}</div>
            ${heroBadges.length ? renderChipList(heroBadges, { className: "hero-badge-list" }) : ""}
          </div>
          <aside class="hero-aside">
            ${heroAsideHtml}
          </aside>
        </div>
      </section>
      <main class="page-stack">
        ${body}
      </main>
      <footer class="footer-note">
        <p>${escapeHtml(footerNote)}</p>
        <p>Generated from commit <strong>${escapeHtml(generatedCommit)}</strong> on ${escapeHtml(generatedAt)}.</p>
      </footer>
    </div>
  </body>
</html>
`;
}

module.exports = {
  renderLayout
};
