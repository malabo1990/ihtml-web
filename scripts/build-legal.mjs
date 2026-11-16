// Genera las paginas legales (licencia y privacidad, es + en) desde
// content/legal/*.md con la cabecera y el pie reales de la guia.
//   node scripts/build-legal.mjs
// Fuente: legal/*.md del repo de la app (copiar aca al cambiarlos).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BASE = 'https://malabo1990.github.io/ihtml-web/';
const read = (p) => readFileSync(ROOT + p, 'utf-8');

// Datos del titular (LSSI): van AL FINAL de las paginas legales, en letra
// pequena y gris. Vienen de content/legal/titular.json (si no existe, no se
// muestran): { "es": "Titular: ...", "en": "Owner: ..." }
let TITULAR = null;
try {
  TITULAR = JSON.parse(read('content/legal/titular.json'));
} catch {
  TITULAR = null;
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => {
      const ext = /^https?:/.test(u) ? ' target="_blank" rel="noopener"' : '';
      return `<a href="${u.replace(/"/g, '&quot;')}"${ext}>${t}</a>`;
    })
    .replace(/(^|[\s(])_([^_]+)_(?=[\s).,;:]|$)/g, '$1<i>$2</i>');
}
// Markdown minimo: # / ## / parrafos / listas - y 1. (con lineas de continuacion).
export function md(src) {
  const out = [];
  let title = '';
  let para = [];
  let list = null;
  const flushP = () => {
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`);
    para = [];
  };
  const flushL = () => {
    if (list) out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`);
    list = null;
  };
  for (const raw of src.split('\n')) {
    const line = raw.trimEnd();
    let m;
    if (!line.trim()) {
      flushP();
      flushL();
    } else if ((m = /^# (.+)/.exec(line))) {
      flushP();
      flushL();
      title = m[1];
    } else if ((m = /^## (.+)/.exec(line))) {
      flushP();
      flushL();
      const id = m[1]
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      out.push(`<h2 id="${id}">${inline(m[1])}</h2>`);
    } else if ((m = /^(-|\d+\.) (.+)/.exec(line))) {
      flushP();
      const tag = m[1] === '-' ? 'ul' : 'ol';
      if (!list || list.tag !== tag) {
        flushL();
        list = { tag, items: [] };
      }
      list.items.push(m[2]);
    } else if (list && /^\s+\S/.test(raw)) {
      list.items[list.items.length - 1] += ' ' + line.trim();
    } else {
      flushL();
      para.push(line.trim());
    }
  }
  flushP();
  flushL();
  return { title, html: out.join('\n') };
}

const PAGES = [
  { src: 'content/legal/eula.es.md', out: 'es/licencia.html', lang: 'es', other: 'license.html', kind: 'license' },
  { src: 'content/legal/privacy.es.md', out: 'es/privacidad.html', lang: 'es', other: 'privacy.html', kind: 'privacy' },
  { src: 'content/legal/eula.en.md', out: 'license.html', lang: 'en', other: 'es/licencia.html', kind: 'license' },
  { src: 'content/legal/privacy.en.md', out: 'privacy.html', lang: 'en', other: 'es/privacidad.html', kind: 'privacy' }
];

// Cabecera / pie / scripts de la guia del mismo idioma (asi el diseno no diverge).
function chrome(lang) {
  const g = read(lang === 'es' ? 'es/guia-usuario.html' : 'guide.html');
  const header = /<header class="island">[\s\S]*?<\/header>/.exec(g)[0].replace(/ class="is-activo"/g, '');
  const footer = /<footer>[\s\S]*?<\/footer>/.exec(g)[0];
  const scripts = /<\/footer>([\s\S]*?)<\/body>/.exec(g)[1];
  return { header, footer, scripts };
}

for (const p of PAGES) {
  const { title, html } = md(read(p.src));
  const { header, footer, scripts } = chrome(p.lang);
  const up = p.lang === 'es' ? '../' : '';
  const otherHref = p.lang === 'es' ? '../' + p.other : p.other;
  // Selector de idioma: solo es / en para estas paginas.
  const langMenu =
    p.lang === 'es'
      ? `<a href="${otherHref}" lang="en">English</a>\n          <a href="${p.out.split('/').pop()}" class="is-activo" lang="es">Español</a>`
      : `<a href="${p.out}" class="is-activo" lang="en">English</a>\n          <a href="${otherHref}" lang="es">Español</a>`;
  const hdr = header.replace(/<div class="lang-switch-menu">[\s\S]*?<\/div>/, `<div class="lang-switch-menu">\n          ${langMenu}\n        </div>`);
  const enUrl = BASE + (p.lang === 'en' ? p.out : p.other);
  const esUrl = BASE + (p.lang === 'es' ? p.out : p.other);
  const desc =
    p.kind === 'license'
      ? p.lang === 'es'
        ? 'Licencia de uso de IHTML: software propietario con licencia Free y suscripción Pro (alquiler del derecho de uso).'
        : 'IHTML license agreement: proprietary software with a Free license and a Pro subscription (rental of the right to use).'
      : p.lang === 'es'
        ? 'Política de privacidad de IHTML: web sin cookies, pagos con Stripe, licencias y apps.'
        : 'IHTML privacy policy: cookieless website, Stripe payments, licenses and apps.';
  const page = `<!doctype html>
<html lang="${p.lang}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(title)} — IHTML</title>
    <meta name="description" content="${esc(desc)}" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${BASE + p.out}" />
    <link rel="alternate" hreflang="en" href="${enUrl}" />
    <link rel="alternate" hreflang="es" href="${esUrl}" />
    <link rel="alternate" hreflang="x-default" href="${enUrl}" />
    <link rel="icon" type="image/svg+xml" href="${up}assets/favicon.svg" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="IHTML · Interactive HTML" />
    <meta property="og:title" content="${esc(title)} — IHTML" />
    <meta property="og:description" content="${esc(desc)}" />
    <meta property="og:url" content="${BASE + p.out}" />
    <meta property="og:image" content="${BASE}assets/og-image.png" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="${up}assets/estilos.css" />
  </head>
  <body>
    <a class="skip-link" href="#contenido">${p.lang === 'es' ? 'Saltar al contenido' : 'Skip to content'}</a>
    ${hdr}

    <div class="layout-guia layout-legal">
      <main id="contenido" class="guia legal">
        <h1>${inline(title)}</h1>
        ${html}
        ${TITULAR && TITULAR[p.lang] ? `<p class="legal-owner">${inline(TITULAR[p.lang])}</p>` : ''}
      </main>
    </div>

    ${footer}
${scripts}</body>
</html>
`;
  writeFileSync(ROOT + p.out, page);
  console.log('ok', p.out);
}
