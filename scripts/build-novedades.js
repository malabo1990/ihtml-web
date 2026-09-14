#!/usr/bin/env node
// IHTML — Generador de "Novedades" (blog/changelog) a partir de Markdown.
//
// Por qué existe: el sitio es 100% estático (sin backend, ver .nojekyll
// y que no hay package.json) — a propósito, para no romper esa promesa
// ("No backend required") solo por tener un blog. Este script corre UNA
// VEZ por entrada nueva (a mano, vos o un agente de IA lo ejecutan) y
// genera HTML estático de verdad: nada corre en el navegador del
// visitante para armar la página.
//
// Uso: node scripts/build-novedades.js
// Lee   content/novedades/*.md   (frontmatter + Markdown simple)
// Escribe:
//   novedades/<slug>.html   (una página por entrada)
//   novedades/index.html    (listado, más nueva primero)
//   novedades/feed.xml      (RSS 2.0)
//   sitemap.xml             (agrega/actualiza las URLs de Novedades)
//   llms.txt                (agrega/actualiza la sección "## Novedades")
//
// Es SEGURO correrlo de nuevo: recalcula todo desde los .md, no acumula
// duplicados ni pide confirmación.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'content', 'novedades');
const OUT_DIR = path.join(ROOT, 'novedades');
const SITE_URL = 'https://ihtml.app';

// ---------------------------------------------------------------
// 1. Frontmatter + Markdown MINIMO (sin dependencias externas a
//    propósito — el resto del sitio tampoco usa npm). Soporta lo
//    suficiente para notas de versión: encabezados, párrafos,
//    negrita/cursiva, links, listas y bloques de código.
// ---------------------------------------------------------------

function parsePost(raw, filename) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) throw new Error(`${filename}: falta el frontmatter (--- ... ---) al principio`);
  const [, fmRaw, body] = m;
  const fm = {};
  fmRaw.split(/\r?\n/).forEach((line) => {
    const mm = line.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
    if (!mm) return;
    fm[mm[1]] = mm[2].trim();
  });
  if (!fm.title) throw new Error(`${filename}: falta "title" en el frontmatter`);
  if (!fm.date || !/^\d{4}-\d{2}-\d{2}$/.test(fm.date)) {
    throw new Error(`${filename}: falta "date" o no tiene formato AAAA-MM-DD`);
  }
  if (!fm.summary) throw new Error(`${filename}: falta "summary" en el frontmatter`);
  const youtube = fm.youtube ? extractYoutubeId(fm.youtube) : null;
  const tags = fm.tags
    ? fm.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    : [];
  const slug = filename.replace(/\.md$/, '');
  return { slug, title: fm.title, date: fm.date, summary: fm.summary, youtube, tags, body: body.trim() };
}

function extractYoutubeId(value) {
  const m = value.match(/(?:v=|youtu\.be\/|embed\/)?([a-zA-Z0-9_-]{11})(?:[&?].*)?$/);
  return m ? m[1] : value.trim();
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Markdown -> HTML. Deliberadamente chico: cubre lo que necesita una
// nota de versión, no pretende ser CommonMark completo.
function markdownToHtml(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;
  let inList = false;
  let inCode = false;
  let codeBuf = [];

  function closeList() {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
  }
  function inlineMd(s) {
    let r = escapeHtml(s);
    r = r.replace(/`([^`]+)`/g, '<code>$1</code>');
    r = r.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    r = r.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
    r = r.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    return r;
  }

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim().startsWith('```')) {
      if (!inCode) {
        inCode = true;
        codeBuf = [];
      } else {
        inCode = false;
        out.push(`<pre><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`);
      }
      i++;
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      i++;
      continue;
    }
    const h = line.match(/^(#{2,4})\s+(.*)$/);
    if (h) {
      closeList();
      const level = h[1].length;
      out.push(`<h${level}>${inlineMd(h[2])}</h${level}>`);
      i++;
      continue;
    }
    const li = line.match(/^[-*]\s+(.*)$/);
    if (li) {
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(`<li>${inlineMd(li[1])}</li>`);
      i++;
      continue;
    }
    closeList();
    if (line.trim() === '') {
      i++;
      continue;
    }
    // Junta líneas seguidas en un mismo párrafo.
    const buf = [line];
    i++;
    while (i < lines.length && lines[i].trim() !== '' && !/^(#{2,4})\s+/.test(lines[i]) && !/^[-*]\s+/.test(lines[i]) && !lines[i].trim().startsWith('```')) {
      buf.push(lines[i]);
      i++;
    }
    out.push(`<p>${inlineMd(buf.join(' '))}</p>`);
  }
  closeList();
  return out.join('\n');
}

// ---------------------------------------------------------------
// 2. Plantillas HTML (mismo header/footer/CSS del sitio, clases
//    .guia para tipografía de artículo y .grid/.card para el listado
//    — nada de CSS nuevo, reutiliza el sistema de diseño existente).
// ---------------------------------------------------------------

function fechaLarga(iso) {
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} de ${meses[m - 1]} de ${y}`;
}

// Rutas RELATIVAS a propósito (nada de "/assets/..."): hoy el sitio
// vive bajo github.io/ihtml-web/ (no en la raíz), y todo lo demás del
// sitio ya usa rutas relativas para funcionar ahí. Estas páginas viven
// una carpeta abajo de la raíz (novedades/*.html), por eso "../".
function headerNav(activo) {
  const link = (href, label, id) =>
    `<a href="${href}"${id === activo ? ' class="is-activo"' : ''}>${label}</a>`;
  return `<header class="island">
      <button class="island-dot" aria-label="Menú" aria-expanded="false"></button>
      <a class="brand" href="../es/index.html">
        <svg viewBox="0 0 555 625" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="logoGrad" x1="277" y1="0" x2="277" y2="625" gradientUnits="userSpaceOnUse">
              <stop stop-color="#f16529" /><stop offset="1" stop-color="#a12100" />
            </linearGradient>
            <linearGradient id="logoGradH" x1="0" y1="312" x2="555" y2="312" gradientUnits="userSpaceOnUse">
              <stop stop-color="#f16529" /><stop offset="1" stop-color="#a12100" />
            </linearGradient>
          </defs>
          <path fill="url(#logoGrad)" d="M0 0H554.15V416.48L277.07 624.08 0 416.48Z" />
          <path fill="url(#logoGradH)" d="M554.15 0 277.07 624.08 0 0Z" />
        </svg>
        <span class="logo-text"><b>IHTML</b>&nbsp;Interactive HTML</span>
      </a>
      <div class="island-menu-wrap">
        <nav class="island-menu">
          ${link('../es/index.html', 'Inicio', 'inicio')}
          ${link('../es/guia-usuario.html', 'Guía', 'guia')}
          ${link('index.html', 'Novedades', 'novedades')}
          <a href="https://github.com/malabo1990/ihtml-releases/discussions" target="_blank" rel="noopener">Foro</a>
          ${link('../es/index.html#descargar', 'Descargar', 'descargar')}
          ${link('../es/index.html#precio', 'Precio', 'precio')}
          <a class="is-cta" href="../es/index.html#precio">Suscribirme</a>
        </nav>
      </div>
    </header>`;
}

const FOOTER = `<footer>
      <p><b>IHTML</b> (Interactive HTML) — editor de animaciones HTML/CSS para escritorio y Android.</p>
      <div class="docs">
        <a href="../es/index.html">Inicio</a>
        <a href="../es/guia-usuario.html">Guía de usuario</a>
        <a href="index.html">Novedades</a>
        <a href="https://github.com/malabo1990/ihtml-releases/discussions" target="_blank" rel="noopener">Foro</a>
        <a href="../es/index.html#descargar">Descargar</a>
        <a href="../es/index.html#precio">Precio</a>
      </div>
      <p class="footer-credit">© 2026 IHTML · Casimiro Ondo Obiang — CEO y líder desarrollador</p>
    </footer>`;

function postPageHtml(post) {
  const url = `${SITE_URL}/novedades/${post.slug}.html`;
  const videoHtml = post.youtube
    ? `<div class="video-embed"><iframe src="https://www.youtube-nocookie.com/embed/${post.youtube}" title="${escapeHtml(post.title)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`
    : '';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${url}#post`,
    headline: post.title,
    description: post.summary,
    inLanguage: 'es',
    datePublished: post.date,
    dateModified: post.date,
    url,
    isPartOf: { '@id': `${SITE_URL}/#website` },
    about: { '@id': `${SITE_URL}/#software` },
    author: { '@type': 'Person', name: 'Casimiro Ondo Obiang', jobTitle: 'CEO y líder desarrollador' },
    publisher: { '@type': 'Organization', name: 'IHTML', logo: { '@type': 'ImageObject', url: `${SITE_URL}/assets/favicon.svg` } },
    speakable: { '@type': 'SpeakableSpecification', cssSelector: ['.guia .intro', '.guia h1'] },
    mainEntityOfPage: url
  };
  if (post.youtube) jsonLd.video = { '@type': 'VideoObject', embedUrl: `https://www.youtube.com/embed/${post.youtube}`, name: post.title, description: post.summary, uploadDate: post.date, thumbnailUrl: `https://i.ytimg.com/vi/${post.youtube}/hqdefault.jpg` };

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(post.title)} — Novedades IHTML</title>
    <meta name="description" content="${escapeHtml(post.summary)}" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${url}" />
    <link rel="icon" type="image/svg+xml" href="../assets/favicon.svg" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="IHTML · Interactive HTML" />
    <meta property="og:locale" content="es_ES" />
    <meta property="og:title" content="${escapeHtml(post.title)}" />
    <meta property="og:description" content="${escapeHtml(post.summary)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${post.youtube ? `https://i.ytimg.com/vi/${post.youtube}/hqdefault.jpg` : `${SITE_URL}/assets/og-image.png`}" />
    <meta property="article:published_time" content="${post.date}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(post.title)}" />
    <meta name="twitter:description" content="${escapeHtml(post.summary)}" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="../assets/estilos.css" />
    <link rel="alternate" type="application/rss+xml" title="Novedades IHTML" href="feed.xml" />
    <style>
      .video-embed { position: relative; width: 100%; aspect-ratio: 16/9; border-radius: var(--radius); overflow: hidden; margin: 28px 0; }
      .video-embed iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
      .post-meta { color: var(--ink-3); font-size: 0.95rem; margin-top: -8px; margin-bottom: 24px; }
      .post-tags { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 24px; }
      .post-tags span { font-size: 0.8rem; color: var(--ink-2); border: 1px solid var(--line); border-radius: 999px; padding: 3px 11px; }
    </style>
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  </head>
  <body>
    ${headerNav('novedades')}
    <div class="layout-guia">
      <main class="guia" style="max-width: 760px; margin: 0 auto;">
        <p class="post-meta"><a href="index.html">← Novedades</a> · ${fechaLarga(post.date)}</p>
        <h1>${escapeHtml(post.title)}</h1>
        <p class="intro">${escapeHtml(post.summary)}</p>
        ${videoHtml}
        ${markdownToHtml(post.body)}
        ${post.tags.length ? `<div class="post-tags">${post.tags.map((t) => `<span>${escapeHtml(t)}</span>`).join('')}</div>` : ''}
      </main>
    </div>
    ${FOOTER}
  </body>
</html>
`;
}

function indexPageHtml(posts) {
  const cards = posts
    .map(
      (p) => `        <a class="card" href="${p.slug}.html" style="display:block; text-decoration:none;">
          <h3>${escapeHtml(p.title)}</h3>
          <p class="post-meta" style="margin: 0 0 8px;">${fechaLarga(p.date)}</p>
          <p>${escapeHtml(p.summary)}</p>
        </a>`
    )
    .join('\n');
  const vacio = `<p class="sub">Todavía no hay novedades publicadas. Volvé pronto.</p>`;
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Novedades — IHTML (Interactive HTML)</title>
    <meta name="description" content="Novedades de IHTML: versiones nuevas, features y contenido del proyecto." />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${SITE_URL}/novedades/index.html" />
    <link rel="icon" type="image/svg+xml" href="../assets/favicon.svg" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="IHTML · Interactive HTML" />
    <meta property="og:title" content="Novedades — IHTML" />
    <meta property="og:description" content="Versiones nuevas, features y contenido del proyecto IHTML." />
    <meta property="og:url" content="${SITE_URL}/novedades/index.html" />
    <meta property="og:image" content="${SITE_URL}/assets/og-image.png" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="../assets/estilos.css" />
    <link rel="alternate" type="application/rss+xml" title="Novedades IHTML" href="feed.xml" />
    <script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      '@id': `${SITE_URL}/novedades/index.html#novedades`,
      name: 'Novedades — IHTML',
      isPartOf: { '@id': `${SITE_URL}/#website` },
      about: { '@id': `${SITE_URL}/#software` },
      hasPart: posts.map((p) => ({ '@type': 'BlogPosting', headline: p.title, datePublished: p.date, url: `${SITE_URL}/novedades/${p.slug}.html` }))
    })}</script>
  </head>
  <body>
    ${headerNav('novedades')}
    <section class="centrado reveal visible" style="padding-top: 140px;">
      <p class="kicker">Novedades</p>
      <h2>Qué cambió en IHTML</h2>
      <p class="sub">Versiones, features nuevas y contenido del proyecto. <a href="feed.xml">RSS</a></p>
      <div class="grid" style="text-align:left; max-width: 900px; margin: 40px auto 0;">
${posts.length ? cards : vacio}
      </div>
    </section>
    ${FOOTER}
  </body>
</html>
`;
}

function rssXml(posts) {
  const items = posts
    .map(
      (p) => `    <item>
      <title>${escapeHtml(p.title)}</title>
      <link>${SITE_URL}/novedades/${p.slug}.html</link>
      <guid>${SITE_URL}/novedades/${p.slug}.html</guid>
      <pubDate>${new Date(p.date + 'T12:00:00Z').toUTCString()}</pubDate>
      <description>${escapeHtml(p.summary)}</description>
    </item>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Novedades — IHTML</title>
    <link>${SITE_URL}/novedades/index.html</link>
    <description>Versiones nuevas, features y contenido del proyecto IHTML.</description>
    <language>es</language>
${items}
  </channel>
</rss>
`;
}

// ---------------------------------------------------------------
// 3. sitemap.xml y llms.txt: se actualiza SOLO la parte de Novedades,
//    preservando a mano lo que ya había para las otras páginas.
// ---------------------------------------------------------------

function updateSitemap(posts) {
  const file = path.join(ROOT, 'sitemap.xml');
  let xml = fs.readFileSync(file, 'utf8');
  xml = xml.replace(/\n?\s*<url>\s*<loc>https:\/\/ihtml\.app\/novedades\/[\s\S]*?<\/url>/g, '');
  const today = new Date().toISOString().slice(0, 10);
  const entries = [
    `  <url>\n    <loc>${SITE_URL}/novedades/index.html</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>`,
    ...posts.map(
      (p) => `  <url>\n    <loc>${SITE_URL}/novedades/${p.slug}.html</loc>\n    <lastmod>${p.date}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>`
    )
  ];
  xml = xml.replace('</urlset>', entries.join('\n') + '\n</urlset>');
  fs.writeFileSync(file, xml);
}

function updateLlmsTxt(posts) {
  const file = path.join(ROOT, 'llms.txt');
  let txt = fs.readFileSync(file, 'utf8');
  txt = txt.replace(/\n## Novedades\n[\s\S]*?(?=\n## |$)/, '');
  if (posts.length) {
    const lines = posts
      .slice(0, 8)
      .map((p) => `- [${p.title}](${SITE_URL}/novedades/${p.slug}.html) (${p.date}): ${p.summary}`)
      .join('\n');
    const section = `\n## Novedades\n\nÚltimas entradas (${SITE_URL}/novedades/index.html):\n\n${lines}\n`;
    txt = txt.trimEnd() + '\n' + section;
  }
  fs.writeFileSync(file, txt.trimEnd() + '\n');
}

// ---------------------------------------------------------------
// 4. Main
// ---------------------------------------------------------------

function main() {
  fs.mkdirSync(CONTENT_DIR, { recursive: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.md'));
  const posts = files
    .map((f) => parsePost(fs.readFileSync(path.join(CONTENT_DIR, f), 'utf8'), f))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  posts.forEach((post) => {
    fs.writeFileSync(path.join(OUT_DIR, `${post.slug}.html`), postPageHtml(post));
  });

  // Borra páginas de entradas viejas que ya no tienen .md fuente.
  const validSlugs = new Set(posts.map((p) => `${p.slug}.html`));
  fs.readdirSync(OUT_DIR)
    .filter((f) => f.endsWith('.html') && f !== 'index.html')
    .forEach((f) => {
      if (!validSlugs.has(f)) fs.unlinkSync(path.join(OUT_DIR, f));
    });

  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), indexPageHtml(posts));
  fs.writeFileSync(path.join(OUT_DIR, 'feed.xml'), rssXml(posts));
  updateSitemap(posts);
  updateLlmsTxt(posts);

  console.log(`OK: ${posts.length} entrada(s) generada(s).`);
  posts.forEach((p) => console.log(`  - novedades/${p.slug}.html  (${p.date})`));
}

main();
