#!/usr/bin/env node
// IHTML — Genera la página "Showreel" (trabajos hechos con IHTML) en 8 idiomas.
//
// Uso: node scripts/build-showreel.mjs
//
// Lee content/showreel/obras.json y escribe:
//   showreel.html, es/galeria.html, pt|fr|de|it|ja|zh/showreel.html
// El nombre visible cambia por idioma (NOMBRE): Showreel solo en inglés.
// Cada obra es un HTML EXPORTADO con IHTML (Export HTML) guardado en
// showreel/obras/<archivo>.html: se muestra VIVO en un <iframe> (es HTML
// real, no video). Cabecera y pie se copian del index.html de cada idioma.
//
// Formato de cada obra en obras.json:
//   {
//     "archivo": "showreel/obras/mi-obra.html",
//     "ancho": 1280, "alto": 720,                 // proporción del marco
//     "titulo": { "es": "...", "en": "..." },     // falta un idioma -> en -> es
//     "descripcion": { "es": "...", "en": "..." },
//     "autor": "Nombre (opcional)"
//   }

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://ihtml.eu/';
const FORO = 'https://github.com/malabo1990/ihtml-releases/discussions';

const SR_PATH = { en: 'showreel.html' };
const INDEX_PATH = { en: 'index.html' };
for (const l of ['es', 'pt', 'fr', 'de', 'it', 'ja', 'zh']) {
  SR_PATH[l] = l + (l === 'es' ? '/galeria.html' : '/showreel.html');
  INDEX_PATH[l] = l + '/index.html';
}

// Nombre de la página en el menú/pie/título de cada idioma.
export const NOMBRE = { en: 'Showreel', es: 'Galería', pt: 'Galeria', fr: 'Galerie', de: 'Galerie', it: 'Galleria', ja: '作品集', zh: '作品集' };

const T = {
  en: { locale: 'en', title: 'Showreel — made with IHTML', kicker: 'Made with IHTML', sub: 'Animations and interactive pieces made with IHTML. Everything here runs live in your browser: real HTML exported from the editor, not video.', abrir: 'Open full screen', por: 'by', vacioTit: 'The first works are on their way', vacio: 'We are preparing the first animations made with IHTML. Made something yourself? Share it in the forum and it could be featured here.', foro: 'Share in the forum', meta: 'Showreel of animations and interactive pieces made with IHTML, the visual HTML/CSS animation editor. They run live: real exported HTML.' },
  es: { locale: 'es', title: 'Galería — hecho con IHTML', kicker: 'Hecho con IHTML', sub: 'Animaciones y piezas interactivas hechas con IHTML. Todo lo que ves corre en vivo en tu navegador: HTML real exportado desde el editor, no video.', abrir: 'Abrir a pantalla completa', por: 'por', vacioTit: 'Los primeros trabajos están en camino', vacio: 'Estamos preparando las primeras animaciones hechas con IHTML. ¿Hiciste algo vos? Compartilo en el foro y puede aparecer acá.', foro: 'Compartir en el foro', meta: 'Galería de animaciones y piezas interactivas hechas con IHTML, el editor visual de animaciones HTML/CSS. Corren en vivo: HTML real exportado.' },
  pt: { locale: 'pt', title: 'Galeria — feito com IHTML', kicker: 'Feito com IHTML', sub: 'Animações e peças interativas feitas com IHTML. Tudo aqui roda ao vivo no seu navegador: HTML real exportado do editor, não vídeo.', abrir: 'Abrir em tela cheia', por: 'por', vacioTit: 'Os primeiros trabalhos estão a caminho', vacio: 'Estamos preparando as primeiras animações feitas com IHTML. Fez algo? Compartilhe no fórum e pode aparecer aqui.', foro: 'Compartilhar no fórum', meta: 'Galeria de animações e peças interativas feitas com IHTML. Rodam ao vivo: HTML real exportado.' },
  fr: { locale: 'fr', title: 'Galerie — fait avec IHTML', kicker: 'Fait avec IHTML', sub: 'Animations et pièces interactives réalisées avec IHTML. Tout tourne en direct dans votre navigateur : du vrai HTML exporté depuis l’éditeur, pas de la vidéo.', abrir: 'Ouvrir en plein écran', por: 'par', vacioTit: 'Les premières créations arrivent', vacio: 'Nous préparons les premières animations réalisées avec IHTML. Vous avez créé quelque chose ? Partagez-le sur le forum, il pourrait apparaître ici.', foro: 'Partager sur le forum', meta: 'Galerie d’animations et de pièces interactives réalisées avec IHTML. Elles tournent en direct : du vrai HTML exporté.' },
  de: { locale: 'de', title: 'Galerie — gemacht mit IHTML', kicker: 'Gemacht mit IHTML', sub: 'Animationen und interaktive Arbeiten, gemacht mit IHTML. Alles läuft live in deinem Browser: echtes, aus dem Editor exportiertes HTML, kein Video.', abrir: 'Im Vollbild öffnen', por: 'von', vacioTit: 'Die ersten Arbeiten sind unterwegs', vacio: 'Wir bereiten die ersten mit IHTML gemachten Animationen vor. Selbst etwas gemacht? Teile es im Forum – vielleicht erscheint es hier.', foro: 'Im Forum teilen', meta: 'Galerie mit Animationen und interaktiven Arbeiten, gemacht mit IHTML. Sie laufen live: echtes exportiertes HTML.' },
  it: { locale: 'it', title: 'Galleria — fatto con IHTML', kicker: 'Fatto con IHTML', sub: 'Animazioni e pezzi interattivi realizzati con IHTML. Tutto gira dal vivo nel tuo browser: vero HTML esportato dall’editor, non video.', abrir: 'Apri a schermo intero', por: 'di', vacioTit: 'I primi lavori stanno arrivando', vacio: 'Stiamo preparando le prime animazioni fatte con IHTML. Hai creato qualcosa? Condividilo nel forum e potrebbe comparire qui.', foro: 'Condividi nel forum', meta: 'Galleria di animazioni e pezzi interattivi realizzati con IHTML. Girano dal vivo: vero HTML esportato.' },
  ja: { locale: 'ja', title: '作品集 — IHTML で制作', kicker: 'IHTML で制作', sub: 'IHTML で作ったアニメーションとインタラクティブ作品。ここにあるものはすべてブラウザーでライブ動作します。動画ではなく、エディターから書き出した本物の HTML です。', abrir: '全画面で開く', por: '制作:', vacioTit: '最初の作品を準備中です', vacio: 'IHTML で作った最初のアニメーションを準備しています。作品を作ったらフォーラムで共有してください。ここで紹介されるかもしれません。', foro: 'フォーラムで共有', meta: 'IHTML で制作したアニメーションとインタラクティブ作品の作品集。書き出した本物の HTML がライブで動きます。' },
  zh: { locale: 'zh', title: '作品集 — 用 IHTML 制作', kicker: '用 IHTML 制作', sub: '用 IHTML 制作的动画和交互作品。这里的一切都在浏览器中实时运行:从编辑器导出的真实 HTML,而不是视频。', abrir: '全屏打开', por: '作者', vacioTit: '首批作品即将上线', vacio: '我们正在准备首批用 IHTML 制作的动画。你也做了作品?在论坛分享,它可能会出现在这里。', foro: '在论坛分享', meta: '用 IHTML 制作的动画和交互作品集。实时运行:导出的真实 HTML。' }
};

const rel = (from, to) => path.posix.relative(path.posix.dirname(from), to) || path.posix.basename(to);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const txt = (o, l) => (o ? o[l] || o.en || o.es || '' : '');

function pick(html, re, what, file) {
  const m = html.match(re);
  if (!m) throw new Error(`${file}: no encontré ${what}`);
  return m[0];
}

function adaptar(fragment, lang) {
  const me = SR_PATH[lang];
  return fragment
    .replace(/href="#([a-z-]+)"/g, (m, a) => `href="${rel(me, INDEX_PATH[lang])}#${a}"`)
    .replace(/(<nav class="island-menu">[\s\S]*?)<a href="index\.html" class="is-activo">/, '$1<a href="index.html">')
    .replace(/<a href="[^"]*"( class="is-activo")? lang="([a-z]{2})"/g, (m, act, l) =>
      SR_PATH[l] ? `<a href="${rel(me, SR_PATH[l])}"${act || ''} lang="${l}"` : m
    );
}

function obraHtml(o, lang, t, file) {
  const titulo = txt(o.titulo, lang);
  const desc = txt(o.descripcion, lang);
  const src = rel(file, o.archivo);
  const ratio = `${o.ancho || 16} / ${o.alto || 9}`;
  return `        <article class="sr-obra">
          <div class="sr-marco" style="aspect-ratio: ${ratio}" data-ancho="${o.ancho || 1280}" data-alto="${o.alto || 720}">
            <iframe src="${esc(src)}" title="${esc(titulo)}" loading="lazy" sandbox="allow-scripts"></iframe>
          </div>
          <div class="sr-info">
            <h2>${esc(titulo)}</h2>
            ${desc ? `<p>${esc(desc)}</p>` : ''}
            ${o.autor ? `<p class="sr-autor">${esc(t.por)} ${esc(o.autor)}</p>` : ''}
            <a class="sr-abrir" href="${esc(src)}" target="_blank" rel="noopener">${esc(t.abrir)} ↗</a>
          </div>
        </article>`;
}

// Datos estructurados de la pagina (SEO/GEO): WebPage + migas, enlazados al
// SoftwareApplication y al WebSite de la portada (mismos @id).
function pageLd(site, lang, file, name, desc, kind) {
  const home = lang === 'en' ? site : `${site}${lang}/`;
  const page = {
    '@type': kind === 'gallery' ? 'CollectionPage' : 'WebPage',
    '@id': `${site}${file}#page`,
    url: `${site}${file}`,
    name,
    description: desc,
    inLanguage: lang,
    isPartOf: { '@id': `${site}#website` },
    about: { '@id': `${site}#software` },
    publisher: { '@id': `${site}#org` }
  };
  if (kind === 'download') page.mainEntity = { '@id': `${site}#software` };
  const crumbs = {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'IHTML', item: home },
      { '@type': 'ListItem', position: 2, name, item: `${site}${file}` }
    ]
  };
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': [page, crumbs] }).replace(/</g, '\\u003c');
}

function main() {
  const obrasPath = path.join(ROOT, 'content/showreel/obras.json');
  const obras = JSON.parse(fs.readFileSync(obrasPath, 'utf8'));
  for (const o of obras) {
    if (!o.archivo || !fs.existsSync(path.join(ROOT, o.archivo))) throw new Error(`obras.json: no existe ${o.archivo}`);
  }

  for (const [lang, file] of Object.entries(SR_PATH)) {
    const t = T[lang];
    const idxFile = INDEX_PATH[lang];
    const idx = fs.readFileSync(path.join(ROOT, idxFile), 'utf8');
    const skip = pick(idx, /<a class="skip-link"[^>]*>[^<]*<\/a>/, 'skip-link', idxFile);
    let header = adaptar(pick(idx, /<header class="island">[\s\S]*?<\/header>/, '<header>', idxFile), lang);
    const self = path.posix.basename(file);
    header = header.replace(`<a href="${self}">`, `<a href="${self}" class="is-activo">`);
    const footer = adaptar(pick(idx, /<footer>[\s\S]*?<\/footer>/, '<footer>', idxFile), lang);
    const uiScript = pick(idx, /<script>\s*const rv = [\s\S]*?<\/script>/, 'script de la isla', idxFile);
    const analytics = (idx.match(/<script defer src="https:\/\/ihtml-analytics[^"]*"><\/script>/) || [''])[0];
    const base = rel(file, 'assets/x').replace(/x$/, '');
    const alternates = Object.entries(SR_PATH)
      .map(([l, p]) => `    <link rel="alternate" hreflang="${l}" href="${SITE}${p}" />`)
      .join('\n');

    const cuerpo = obras.length
      ? `      <div class="sr-grid">\n${obras.map((o) => obraHtml(o, lang, t, file)).join('\n')}\n      </div>`
      : `      <div class="sr-vacio">
        <h2>${esc(t.vacioTit)}</h2>
        <p>${esc(t.vacio)}</p>
        <a class="btn primario" href="${FORO}" target="_blank" rel="noopener">${esc(t.foro)}</a>
      </div>`;

    const html = `<!doctype html>
<html lang="${lang}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(t.title)}</title>
    <meta name="description" content="${esc(t.meta)}" />
    <meta name="robots" content="index, follow" />
    <meta name="theme-color" content="#14161a" />
    <link rel="canonical" href="${SITE}${file}" />
${alternates}
    <link rel="alternate" hreflang="x-default" href="${SITE}${SR_PATH.en}" />
    <link rel="icon" type="image/svg+xml" href="${base}favicon.svg" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="IHTML · Interactive HTML" />
    <meta property="og:title" content="${esc(t.title)}" />
    <meta property="og:description" content="${esc(t.meta)}" />
    <meta property="og:url" content="${SITE}${file}" />
    <meta property="og:image" content="${SITE}assets/og-image.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="${base}estilos.css" />
    <script src="${base}idioma.js"></script>
    <script type="application/ld+json">${pageLd(SITE, lang, file, t.title, t.meta, 'gallery')}</script>
  </head>
  <body>
    ${skip}
    ${header}

    <main id="contenido" class="sr-page">
      <div class="dl-hero">
        <p class="kicker">${esc(t.kicker)}</p>
        <h1>${esc(NOMBRE[lang])}</h1>
        <p class="sub">${esc(t.sub)}</p>
      </div>

${cuerpo}
    </main>

    ${footer}

    ${uiScript}
    <script>
      /* Cada obra se dibuja a su tamaño REAL (ancho x alto con que se exportó)
         y se escala para entrar entera en el marco - si no, una obra de
         1920x1080 en un marco de 500px saldría recortada. Sin JS: iframe al
         100% del marco (puede recortar, pero se ve). */
      (function () {
        var marcos = document.querySelectorAll('.sr-marco[data-ancho]');
        function ajustar(m) {
          var f = m.querySelector('iframe');
          var aw = +m.dataset.ancho;
          var ah = +m.dataset.alto;
          f.style.width = aw + 'px';
          f.style.height = ah + 'px';
          f.style.transform = 'scale(' + m.clientWidth / aw + ')';
          m.classList.add('sr-escalado');
        }
        marcos.forEach(ajustar);
        if ('ResizeObserver' in window) {
          var ro = new ResizeObserver(function (es) { es.forEach(function (e) { ajustar(e.target); }); });
          marcos.forEach(function (m) { ro.observe(m); });
        }
      })();
    </script>
    ${analytics}
  </body>
</html>
`;
    fs.writeFileSync(path.join(ROOT, file), html);
    console.log('escrito', file, `(${obras.length} obras)`);
  }

  const smPath = path.join(ROOT, 'sitemap.xml');
  let sm = fs.readFileSync(smPath, 'utf8');
  const hoy = new Date().toISOString().slice(0, 10);
  const nuevas = Object.values(SR_PATH)
    .filter((p) => !sm.includes(`<loc>${SITE}${p}</loc>`))
    .map((p) => `  <url>\n    <loc>${SITE}${p}</loc>\n    <lastmod>${hoy}</lastmod>\n    <changefreq>weekly</changefreq>\n  </url>\n`)
    .join('');
  if (nuevas) {
    fs.writeFileSync(smPath, sm.replace('</urlset>', nuevas + '</urlset>'));
    console.log('sitemap.xml actualizado');
  }
}

main();
