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
const SITE_URL = 'https://ihtml.eu';

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
    const CJK = /[\u3000-\u30ff\u3400-\u9fff\uff00-\uffef]/;
    const joined = buf.reduce((acc, l) => (!acc ? l : CJK.test(acc.replace(/[*_\])`]+$/, '').slice(-1)) && CJK.test(l.replace(/^[*_[`(]+/, '')[0] || '') ? acc + l : acc + ' ' + l), '');
    out.push(`<p>${inlineMd(joined)}</p>`);
  }
  closeList();
  return out.join('\n');
}

// ---------------------------------------------------------------
// 2. Idiomas. Cada entrada: content/novedades/<slug>.md (español) y
//    <slug>.<lang>.md para los demás. Salida: español en novedades/
//    (URLs de siempre), el resto en novedades/<lang>/. Cabecera, pie y
//    selector de idioma salen de la guía de ESE idioma (mismo diseño).
//    En el Markdown, un link que empieza con "/" es relativo a la raíz
//    del sitio (ej. "/de/downloads.html") y se convierte solo.
// ---------------------------------------------------------------

const LANGS = ['es', 'en', 'pt', 'fr', 'de', 'it', 'ja', 'zh'];
const LANG_NAMES = { en: 'English', es: 'Español', pt: 'Português', fr: 'Français', de: 'Deutsch', it: 'Italiano', ja: '日本語', zh: '中文' };
const OG_LOCALE = { es: 'es_ES', en: 'en_US', pt: 'pt_BR', fr: 'fr_FR', de: 'de_DE', it: 'it_IT', ja: 'ja_JP', zh: 'zh_CN' };
const T = {
  es: { name: 'Novedades', h1: 'Qué cambió en IHTML', sub: 'Versiones, funciones nuevas y contenido del proyecto.', empty: 'Todavía no hay novedades publicadas. Vuelve pronto.', skip: 'Saltar al contenido', desc: 'Novedades de IHTML: versiones nuevas, funciones y contenido del proyecto.' },
  en: { name: 'Updates', h1: "What's new in IHTML", sub: 'Releases, new features and project news.', empty: 'No updates published yet. Check back soon.', skip: 'Skip to content', desc: 'IHTML updates: new releases, features and project news.' },
  pt: { name: 'Novidades', h1: 'O que mudou no IHTML', sub: 'Versões, novos recursos e notícias do projeto.', empty: 'Ainda não há novidades publicadas. Volte em breve.', skip: 'Pular para o conteúdo', desc: 'Novidades do IHTML: novas versões, recursos e notícias do projeto.' },
  fr: { name: 'Nouveautés', h1: "Quoi de neuf dans IHTML", sub: 'Versions, nouvelles fonctions et actualités du projet.', empty: "Aucune nouveauté publiée pour l'instant. Revenez bientôt.", skip: 'Aller au contenu', desc: "Nouveautés d'IHTML : nouvelles versions, fonctions et actualités du projet." },
  de: { name: 'Neuigkeiten', h1: 'Was ist neu in IHTML', sub: 'Versionen, neue Funktionen und Projektneuigkeiten.', empty: 'Noch keine Neuigkeiten veröffentlicht. Schau bald wieder vorbei.', skip: 'Zum Inhalt springen', desc: 'IHTML-Neuigkeiten: neue Versionen, Funktionen und Projektneuigkeiten.' },
  it: { name: 'Novità', h1: 'Cosa cambia in IHTML', sub: 'Versioni, nuove funzioni e notizie sul progetto.', empty: 'Ancora nessuna novità pubblicata. Torna presto.', skip: 'Vai al contenuto', desc: 'Novità di IHTML: nuove versioni, funzioni e notizie sul progetto.' },
  ja: { name: 'お知らせ', h1: 'IHTML の最新情報', sub: 'リリース、新機能、プロジェクトのニュース。', empty: 'まだお知らせはありません。またお越しください。', skip: 'コンテンツへスキップ', desc: 'IHTML のお知らせ: 新しいリリース、機能、プロジェクトのニュース。' },
  zh: { name: '更新动态', h1: 'IHTML 有哪些新变化', sub: '版本发布、新功能和项目动态。', empty: '暂无发布的更新，敬请期待。', skip: '跳到内容', desc: 'IHTML 更新动态：新版本、新功能和项目动态。' }
};

const outDir = (lang) => (lang === 'es' ? 'novedades' : `novedades/${lang}`);
const guidePath = (lang) => (lang === 'en' ? 'guide.html' : lang === 'es' ? 'es/guia-usuario.html' : `${lang}/guide.html`);

// Ruta relativa de un archivo a otro (los dos desde la raíz del sitio).
function rel(fromFile, toPath) {
  const depth = fromFile.split('/').length - 1;
  return '../'.repeat(depth) + toPath;
}
// Reescribe href/src relativos de un trozo de HTML que vivía en `fromFile`
// para que funcionen desde `toFile`.
function rebase(html, fromFile, toFile) {
  return html.replace(/\b(href|src)="([^"]*)"/g, (all, attr, url) => {
    if (!url || /^(https?:|mailto:|#|data:|\/\/)/.test(url)) return all;
    const abs = new URL(url, 'http://x/' + fromFile);
    const root = abs.pathname.replace(/^\//, '') + abs.search + abs.hash;
    return `${attr}="${rel(toFile, root)}"`;
  });
}

function fechaLarga(iso, lang) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : lang, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

// Cabecera (con selector de idioma propio), pie y scripts de la guía del idioma.
function chrome(lang, file, langLinks) {
  const g = fs.readFileSync(path.join(ROOT, guidePath(lang)), 'utf8');
  let header = /<header class="island">[\s\S]*?<\/header>/.exec(g)[0].replace(/ class="is-activo"/g, '');
  let footer = /<footer>[\s\S]*?<\/footer>/.exec(g)[0];
  const scripts = /<\/footer>([\s\S]*?)<\/body>/.exec(g)[1];
  header = rebase(header, guidePath(lang), file);
  footer = rebase(footer, guidePath(lang), file);
  const idx = rel(file, `${outDir(lang)}/index.html`);
  header = header.replace(`<a href="${idx}">`, `<a href="${idx}" class="is-activo">`);
  const menu = LANGS.map((l) => `<a href="${langLinks[l]}"${l === lang ? ' class="is-activo"' : ''} lang="${l}">${LANG_NAMES[l]}</a>`).join('\n          ');
  header = header.replace(/<div class="lang-switch-menu">[\s\S]*?<\/div>/, `<div class="lang-switch-menu">\n          ${menu}\n        </div>`);
  return { header, footer, scripts: rebase(scripts, guidePath(lang), file) };
}

const STYLE = `<style>
      .video-embed { position: relative; width: 100%; aspect-ratio: 16/9; border-radius: var(--radius); overflow: hidden; margin: 28px 0; }
      .video-embed iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
      .post-meta { color: var(--ink-3); font-size: 0.95rem; margin-top: -8px; margin-bottom: 24px; }
      .post-tags { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 24px; }
      .post-tags span { font-size: 0.8rem; color: var(--ink-2); border: 1px solid var(--line); border-radius: 999px; padding: 3px 11px; }
    </style>`;

function head({ lang, title, desc, url, file, ogType, image, alternates, extra }) {
  const up = rel(file, '');
  return `<!doctype html>
<html lang="${lang}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(desc)}" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${url}" />
    ${alternates}
    <link rel="icon" type="image/svg+xml" href="${up}assets/favicon.svg" />
    <meta property="og:type" content="${ogType}" />
    <meta property="og:site_name" content="IHTML · Interactive HTML" />
    <meta property="og:locale" content="${OG_LOCALE[lang]}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(desc)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${image}" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="${up}assets/estilos.css" />
    <script src="${up}assets/idioma.js"></script>
    <link rel="alternate" type="application/rss+xml" title="${escapeHtml(T[lang].name)} IHTML" href="feed.xml" />
    ${extra || ''}
  </head>`;
}

function postPageHtml(post, lang, langsOfPost) {
  const t = T[lang];
  const file = `${outDir(lang)}/${post.slug}.html`;
  const url = `${SITE_URL}/${file}`;
  const langLinks = {};
  LANGS.forEach((l) => {
    langLinks[l] = rel(file, langsOfPost.includes(l) ? `${outDir(l)}/${post.slug}.html` : `${outDir(l)}/index.html`);
  });
  const alternates = langsOfPost.map((l) => `<link rel="alternate" hreflang="${l}" href="${SITE_URL}/${outDir(l)}/${post.slug}.html" />`).join('\n    ');
  const { header, footer, scripts } = chrome(lang, file, langLinks);
  const videoHtml = post.youtube
    ? `<div class="video-embed"><iframe src="https://www.youtube-nocookie.com/embed/${post.youtube}" title="${escapeHtml(post.title)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`
    : '';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${url}#post`,
    headline: post.title,
    description: post.summary,
    inLanguage: lang,
    datePublished: post.date,
    dateModified: post.date,
    url,
    isPartOf: { '@id': `${SITE_URL}/#website` },
    about: { '@id': `${SITE_URL}/#software` },
    author: { '@type': 'Organization', name: 'IHTML' },
    publisher: { '@type': 'Organization', name: 'IHTML', logo: { '@type': 'ImageObject', url: `${SITE_URL}/assets/favicon.svg` } },
    mainEntityOfPage: url
  };
  // Links "/ruta" del Markdown = relativos a la raíz del sitio.
  const body = markdownToHtml(post.body).replace(/href="\/([^"]*)" target="_blank" rel="noopener"/g, (_, p) => `href="${rel(file, p)}"`);
  return `${head({
    lang,
    title: `${post.title} — ${t.name} IHTML`,
    desc: post.summary,
    url,
    file,
    ogType: 'article',
    image: post.youtube ? `https://i.ytimg.com/vi/${post.youtube}/hqdefault.jpg` : `${SITE_URL}/assets/og-image.png`,
    alternates,
    extra: `<meta property="article:published_time" content="${post.date}" />\n    ${STYLE}\n    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`
  })}
  <body>
    <a class="skip-link" href="#contenido">${t.skip}</a>
    ${header}
    <div class="layout-guia">
      <main id="contenido" class="guia" style="max-width: 760px; margin: 0 auto;">
        <p class="post-meta"><a href="index.html">← ${t.name}</a> · ${fechaLarga(post.date, lang)}</p>
        <h1>${escapeHtml(post.title)}</h1>
        <p class="intro">${escapeHtml(post.summary)}</p>
        ${videoHtml}
        ${body}
        ${post.tags.length ? `<div class="post-tags">${post.tags.map((x) => `<span>${escapeHtml(x)}</span>`).join('')}</div>` : ''}
      </main>
    </div>
    ${footer}
${scripts}</body>
</html>
`;
}

function indexPageHtml(posts, lang) {
  const t = T[lang];
  const file = `${outDir(lang)}/index.html`;
  const url = `${SITE_URL}/${file}`;
  const langLinks = {};
  LANGS.forEach((l) => (langLinks[l] = rel(file, `${outDir(l)}/index.html`)));
  const alternates = LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${SITE_URL}/${outDir(l)}/index.html" />`).join('\n    ');
  const { header, footer, scripts } = chrome(lang, file, langLinks);
  const cards = posts
    .map(
      (p) => `        <a class="card" href="${p.slug}.html" style="display:block; text-decoration:none;">
          <h3>${escapeHtml(p.title)}</h3>
          <p class="post-meta" style="margin: 0 0 8px;">${fechaLarga(p.date, lang)}</p>
          <p>${escapeHtml(p.summary)}</p>
        </a>`
    )
    .join('\n');
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${url}#novedades`,
    name: `${t.name} — IHTML`,
    inLanguage: lang,
    isPartOf: { '@id': `${SITE_URL}/#website` },
    about: { '@id': `${SITE_URL}/#software` },
    hasPart: posts.map((p) => ({ '@type': 'BlogPosting', headline: p.title, datePublished: p.date, url: `${SITE_URL}/${outDir(lang)}/${p.slug}.html` }))
  };
  return `${head({
    lang,
    title: `${t.name} — IHTML (Interactive HTML)`,
    desc: t.desc,
    url,
    file,
    ogType: 'website',
    image: `${SITE_URL}/assets/og-image.png`,
    alternates,
    extra: `${STYLE}\n    <script type="application/ld+json">${JSON.stringify(ld)}</script>`
  })}
  <body>
    <a class="skip-link" href="#contenido">${t.skip}</a>
    ${header}
    <main id="contenido" class="centrado reveal visible" style="padding-top: 140px;">
      <p class="kicker">${t.name}</p>
      <h1 class="h-seccion">${t.h1}</h1>
      <p class="sub">${t.sub} <a href="feed.xml">RSS</a></p>
      <div class="grid" style="text-align:left; max-width: 900px; margin: 40px auto 0;">
${posts.length ? cards : `<p class="sub">${t.empty}</p>`}
      </div>
    </main>
    ${footer}
${scripts}</body>
</html>
`;
}

function rssXml(posts, lang) {
  const t = T[lang];
  const items = posts
    .map(
      (p) => `    <item>
      <title>${escapeHtml(p.title)}</title>
      <link>${SITE_URL}/${outDir(lang)}/${p.slug}.html</link>
      <guid>${SITE_URL}/${outDir(lang)}/${p.slug}.html</guid>
      <pubDate>${new Date(p.date + 'T12:00:00Z').toUTCString()}</pubDate>
      <description>${escapeHtml(p.summary)}</description>
    </item>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeHtml(t.name)} — IHTML</title>
    <link>${SITE_URL}/${outDir(lang)}/index.html</link>
    <description>${escapeHtml(t.desc)}</description>
    <language>${lang}</language>
${items}
  </channel>
</rss>
`;
}

// ---------------------------------------------------------------
// 3. sitemap.xml y llms.txt: se actualiza SOLO la parte de Novedades.
// ---------------------------------------------------------------

function updateSitemap(byLang) {
  const file = path.join(ROOT, 'sitemap.xml');
  let xml = fs.readFileSync(file, 'utf8');
  xml = xml.replace(/\n?\s*<url>\s*<loc>[^<]*\/novedades\/[\s\S]*?<\/url>/g, '');
  const today = new Date().toISOString().slice(0, 10);
  const entries = [];
  LANGS.forEach((lang) => {
    entries.push(`  <url>\n    <loc>${SITE_URL}/${outDir(lang)}/index.html</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>`);
    byLang[lang].forEach((p) =>
      entries.push(`  <url>\n    <loc>${SITE_URL}/${outDir(lang)}/${p.slug}.html</loc>\n    <lastmod>${p.date}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>`)
    );
  });
  xml = xml.replace('</urlset>', entries.join('\n') + '\n</urlset>');
  fs.writeFileSync(file, xml);
}

function updateLlmsTxt(posts) {
  const file = path.join(ROOT, 'llms.txt');
  let txt = fs.readFileSync(file, 'utf8');
  txt = txt.replace(/\n## (Novedades|Updates)\n[\s\S]*?(?=\n## |$)/, '');
  if (posts.length) {
    const lines = posts
      .slice(0, 8)
      .map((p) => `- [${p.title}](${SITE_URL}/${outDir('en')}/${p.slug}.html) (${p.date}): ${p.summary}`)
      .join('\n');
    const section = `\n## Updates\n\nLatest entries (${SITE_URL}/${outDir('en')}/index.html; also in es, pt, fr, de, it, ja, zh):\n\n${lines}\n`;
    txt = txt.trimEnd() + '\n' + section;
  }
  fs.writeFileSync(file, txt.trimEnd() + '\n');
}

// ---------------------------------------------------------------
// 4. Main
// ---------------------------------------------------------------

function main() {
  fs.mkdirSync(CONTENT_DIR, { recursive: true });
  const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.md'));
  const byLang = {};
  LANGS.forEach((l) => (byLang[l] = []));
  files.forEach((f) => {
    const m = f.match(/^(.*?)(?:\.(en|pt|fr|de|it|ja|zh))?\.md$/);
    const lang = m[2] || 'es';
    const post = parsePost(fs.readFileSync(path.join(CONTENT_DIR, f), 'utf8'), m[1] + '.md');
    byLang[lang].push(post);
  });
  LANGS.forEach((l) => byLang[l].sort((a, b) => (a.date < b.date ? 1 : -1)));
  const langsOf = (slug) => LANGS.filter((l) => byLang[l].some((p) => p.slug === slug));

  LANGS.forEach((lang) => {
    const dir = path.join(ROOT, outDir(lang));
    fs.mkdirSync(dir, { recursive: true });
    byLang[lang].forEach((post) => fs.writeFileSync(path.join(dir, `${post.slug}.html`), postPageHtml(post, lang, langsOf(post.slug))));
    // Borra páginas de entradas viejas que ya no tienen .md fuente.
    const valid = new Set(byLang[lang].map((p) => `${p.slug}.html`));
    fs.readdirSync(dir)
      .filter((f) => f.endsWith('.html') && f !== 'index.html')
      .forEach((f) => {
        if (!valid.has(f)) fs.unlinkSync(path.join(dir, f));
      });
    fs.writeFileSync(path.join(dir, 'index.html'), indexPageHtml(byLang[lang], lang));
    fs.writeFileSync(path.join(dir, 'feed.xml'), rssXml(byLang[lang], lang));
    console.log(`OK ${lang}: ${byLang[lang].length} entrada(s) en ${outDir(lang)}/`);
  });
  updateSitemap(byLang);
  updateLlmsTxt(byLang.en.length ? byLang.en : byLang.es);
}

main();
