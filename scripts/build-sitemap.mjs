// Genera sitemap.xml desde las paginas reales: una <url> por cada canonical,
// con sus versiones en otros idiomas (xhtml:link hreflang) para Google/Bing.
// Correr AL FINAL, despues de cualquier otro build:
//   node scripts/build-sitemap.mjs
// lastmod = fecha del ultimo commit que toco el archivo (o hoy si no esta
// commiteado todavia).
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SKIP = /^(showreel\/obras|tests|node_modules|content|scripts)\//;

function walk(dir, out = []) {
  for (const name of readdirSync(path.join(ROOT, dir))) {
    if (name.startsWith('.')) continue;
    const rel = dir ? `${dir}/${name}` : name;
    if (SKIP.test(rel + '/')) continue;
    const st = statSync(path.join(ROOT, rel));
    if (st.isDirectory()) walk(rel, out);
    else if (name.endsWith('.html')) out.push(rel);
  }
  return out;
}

const today = new Date().toISOString().slice(0, 10);
function lastmod(file) {
  try {
    const dirty = execFileSync('git', ['status', '--porcelain', '--', file], { cwd: ROOT }).toString().trim();
    if (dirty) return today;
    const d = execFileSync('git', ['log', '-1', '--format=%cs', '--', file], { cwd: ROOT }).toString().trim();
    return d || today;
  } catch {
    return today;
  }
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const entries = [];
for (const file of walk('').sort()) {
  const html = readFileSync(path.join(ROOT, file), 'utf8');
  if (/<meta name="robots" content="[^"]*noindex/i.test(html)) continue;
  const canon = /<link rel="canonical" href="([^"]+)"/.exec(html);
  if (!canon) continue;
  const alts = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => [m[1], m[2]]);
  const isHome = /(^|\/)index\.html$/.test(file) && file.split('/').length <= 2 && !file.startsWith('novedades');
  entries.push({
    loc: canon[1],
    lastmod: lastmod(file),
    priority: file === 'index.html' ? '1.0' : isHome ? '0.9' : /guide|guia|downloads|descargas/.test(file) ? '0.8' : '0.6',
    alts
  });
}

const xml =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
  entries
    .map(
      (e) =>
        `  <url>\n    <loc>${esc(e.loc)}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n    <priority>${e.priority}</priority>\n` +
        e.alts.map(([l, u]) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${esc(u)}" />\n`).join('') +
        '  </url>'
    )
    .join('\n') +
  '\n</urlset>\n';
writeFileSync(path.join(ROOT, 'sitemap.xml'), xml);
console.log(`sitemap.xml: ${entries.length} URLs`);
