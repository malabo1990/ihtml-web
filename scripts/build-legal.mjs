// Genera las paginas legales (licencia y privacidad, en los 8 idiomas) desde
// content/legal/*.md con la cabecera y el pie reales de la guia.
//   node scripts/build-legal.mjs
// Fuente: legal/*.md del repo de la app (copiar aca al cambiarlos).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BASE = 'https://ihtml.eu/';
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
// Une lineas de un parrafo: con espacio, salvo entre caracteres CJK (japones/
// chino no separan palabras: el espacio se veia como un hueco).
const CJK = /[　-ヿ㐀-鿿＀-￯]/;
export function joinLines(lines) {
  return lines.reduce((acc, l) => (!acc ? l : CJK.test(acc.replace(/[*_\])`]+$/, '').slice(-1)) && CJK.test(l.replace(/^[*_[`(]+/, '')[0] || '') ? acc + l : acc + ' ' + l), '');
}
// Markdown minimo: # / ## / parrafos / listas - y 1. (con lineas de continuacion).
export function md(src) {
  const out = [];
  let title = '';
  let para = [];
  let list = null;
  const flushP = () => {
    if (para.length) out.push(`<p>${inline(joinLines(para))}</p>`);
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
      list.items[list.items.length - 1] = joinLines([list.items[list.items.length - 1], line.trim()]);
    } else {
      flushL();
      para.push(line.trim());
    }
  }
  flushP();
  flushL();
  return { title, html: out.join('\n') };
}

// 8 idiomas. Ingles en la raiz, espanol con nombres propios, el resto en <lang>/.
const LANGS = ['en', 'es', 'pt', 'fr', 'de', 'it', 'ja', 'zh'];
const NAMES = { en: 'English', es: 'Español', pt: 'Português', fr: 'Français', de: 'Deutsch', it: 'Italiano', ja: '日本語', zh: '中文' };
const FILE = {
  license: { en: 'license.html', es: 'es/licencia.html' },
  privacy: { en: 'privacy.html', es: 'es/privacidad.html' }
};
const outPath = (kind, lang) => FILE[kind][lang] || `${lang}/${kind}.html`;
const guidePath = (lang) => (lang === 'en' ? 'guide.html' : lang === 'es' ? 'es/guia-usuario.html' : `${lang}/guide.html`);
const SKIP = { en: 'Skip to content', es: 'Saltar al contenido', pt: 'Pular para o conteúdo', fr: 'Aller au contenu', de: 'Zum Inhalt springen', it: 'Vai al contenuto', ja: 'コンテンツへスキップ', zh: '跳到内容' };
const DESC = {
  license: {
    en: 'IHTML license agreement: proprietary software with a Free license and a Pro subscription (rental of the right to use).',
    es: 'Licencia de uso de IHTML: software propietario con licencia Free y suscripción Pro (alquiler del derecho de uso).',
    pt: 'Contrato de licença do IHTML: software proprietário com licença Free e assinatura Pro (aluguel do direito de uso).',
    fr: "Contrat de licence d'IHTML : logiciel propriétaire avec une licence Free et un abonnement Pro (location du droit d'utilisation).",
    de: 'IHTML-Lizenzvertrag: proprietäre Software mit Free-Lizenz und Pro-Abonnement (Miete des Nutzungsrechts).',
    it: "Contratto di licenza di IHTML: software proprietario con licenza Free e abbonamento Pro (noleggio del diritto d'uso).",
    ja: 'IHTML ライセンス契約: Free ライセンスと Pro サブスクリプション（使用権の賃貸）を備えたプロプライエタリソフトウェア。',
    zh: 'IHTML 许可协议：提供 Free 许可和 Pro 订阅（使用权租用）的专有软件。'
  },
  privacy: {
    en: 'IHTML privacy policy: cookieless website, Stripe payments, licenses and apps.',
    es: 'Política de privacidad de IHTML: web sin cookies, pagos con Stripe, licencias y apps.',
    pt: 'Política de privacidade do IHTML: site sem cookies, pagamentos com Stripe, licenças e aplicativos.',
    fr: "Politique de confidentialité d'IHTML : site sans cookies, paiements Stripe, licences et applications.",
    de: 'IHTML-Datenschutzerklärung: Website ohne Cookies, Zahlungen mit Stripe, Lizenzen und Apps.',
    it: 'Informativa sulla privacy di IHTML: sito senza cookie, pagamenti con Stripe, licenze e app.',
    ja: 'IHTML プライバシーポリシー: Cookie を使わないウェブサイト、Stripe による支払い、ライセンスとアプリ。',
    zh: 'IHTML 隐私政策：无 Cookie 的网站、Stripe 付款、许可和应用。'
  }
};
const SRC = { license: 'eula', privacy: 'privacy' };

// Cabecera / pie / scripts de la guia del mismo idioma (asi el diseno no diverge).
function chrome(lang) {
  const g = read(guidePath(lang));
  const header = /<header class="island">[\s\S]*?<\/header>/.exec(g)[0].replace(/ class="is-activo"/g, '');
  const footer = /<footer>[\s\S]*?<\/footer>/.exec(g)[0];
  const scripts = /<\/footer>([\s\S]*?)<\/body>/.exec(g)[1];
  return { header, footer, scripts };
}

// Ruta relativa de `from` (archivo) a `to` (archivo), ambos desde la raiz.
function rel(from, to) {
  const depth = from.split('/').length - 1;
  return '../'.repeat(depth) + to;
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

for (const kind of ['license', 'privacy']) {
  for (const lang of LANGS) {
    const out = outPath(kind, lang);
    const { title, html } = md(read(`content/legal/${SRC[kind]}.${lang}.md`));
    const { header, footer, scripts } = chrome(lang);
    const up = out.includes('/') ? '../' : '';
    const langMenu = LANGS.map(
      (l) => `<a href="${rel(out, outPath(kind, l))}"${l === lang ? ' class="is-activo"' : ''} lang="${l}">${NAMES[l]}</a>`
    ).join('\n          ');
    const hdr = header.replace(/<div class="lang-switch-menu">[\s\S]*?<\/div>/, `<div class="lang-switch-menu">\n          ${langMenu}\n        </div>`);
    const alternates = LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${BASE + outPath(kind, l)}" />`).join('\n    ');
    const desc = DESC[kind][lang];
    const page = `<!doctype html>
<html lang="${lang}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(title)} — IHTML</title>
    <meta name="description" content="${esc(desc)}" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${BASE + out}" />
    ${alternates}
    <link rel="alternate" hreflang="x-default" href="${BASE + outPath(kind, 'en')}" />
    <link rel="icon" type="image/svg+xml" href="${up}assets/favicon.svg" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="IHTML · Interactive HTML" />
    <meta property="og:title" content="${esc(title)} — IHTML" />
    <meta property="og:description" content="${esc(desc)}" />
    <meta property="og:url" content="${BASE + out}" />
    <meta property="og:image" content="${BASE}assets/og-image.png" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="${up}assets/estilos.css" />
    <script src="${up}assets/idioma.js"></script>
    <script type="application/ld+json">${pageLd(BASE, lang, out, title, desc, 'legal')}</script>
  </head>
  <body>
    <a class="skip-link" href="#contenido">${SKIP[lang]}</a>
    ${hdr}

    <div class="layout-guia layout-legal">
      <main id="contenido" class="guia legal">
        <h1>${inline(title)}</h1>
        ${html}
        ${TITULAR && TITULAR[lang] ? `<p class="legal-owner">${inline(TITULAR[lang])}</p>` : ''}
      </main>
    </div>

    ${footer}
${scripts}</body>
</html>
`;
    writeFileSync(ROOT + out, page);
    console.log('ok', out);
  }
}
