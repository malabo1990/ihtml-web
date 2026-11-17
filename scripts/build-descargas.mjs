#!/usr/bin/env node
// IHTML — Genera la página "Descargas" en los 8 idiomas.
//
// Uso: node scripts/build-descargas.mjs
//
// Lee las Releases públicas de malabo1990/ihtml-releases (API de GitHub) y
// escribe una página estática por idioma con la lista completa de archivos:
//   downloads.html, es/descargas.html, pt|fr|de|it|ja|zh/downloads.html
// La cabecera y el pie se copian del index.html de cada idioma (mismo menú),
// así que esta página siempre queda igual al resto del sitio.
//
// La lista va incrustada en el HTML (funciona sin JS); en el navegador
// assets/descargas.js consulta la API y, si salió una versión más nueva,
// redibuja la lista con el mismo código. Correrlo de nuevo tras cada release
// mantiene el HTML al día (y el sitemap), pero no es obligatorio.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://malabo1990.github.io/ihtml-web/';
const REPO = 'malabo1990/ihtml-releases';

// Ruta de la página de descargas de cada idioma (relativa a la raíz del sitio).
export const DL_PATH = {
  en: 'downloads.html',
  es: 'es/descargas.html',
  pt: 'pt/downloads.html',
  fr: 'fr/downloads.html',
  de: 'de/downloads.html',
  it: 'it/downloads.html',
  ja: 'ja/downloads.html',
  zh: 'zh/downloads.html'
};
const INDEX_PATH = { en: 'index.html' };
for (const l of Object.keys(DL_PATH)) if (l !== 'en') INDEX_PATH[l] = l + '/index.html';

const T = {
  en: {
    locale: 'en-US', title: 'Download IHTML — all versions', h1: 'Download IHTML', kicker: 'Downloads',
    metaDesc: 'Download IHTML, the visual HTML/CSS animation editor, for Windows, macOS and Linux, and IHTML Mirror for Android. Every file and version in one list.',
    sub: 'Pick your system and format. Every file downloads directly — no account, no sign-up.',
    ultima: 'Latest version', publicada: 'released on', anteriores: 'Previous versions',
    editorNombre: 'IHTML Editor', editorDesc: 'The full editor: design, animate and export. Desktop.',
    mirrorNombre: 'IHTML Mirror', mirrorDesc: 'Free player: opens and runs .ihtml files. Desktop and Android.',
    colSistema: 'System', colFormato: 'Format', colTam: 'Size', descargar: 'Download', tuSistema: 'your system',
    vacio: 'No versions have been published yet.',
    fmt: { exe: 'Installer (recommended)', msi: 'MSI package (IT / managed installs)', dmg: 'Apple Silicon + Intel', appimage: 'Portable, any distro', deb: 'Debian / Ubuntu / Mint', rpm: 'Fedora / openSUSE / RHEL', apk: 'Android 7+' },
    ayudaTit: 'Which one should I pick?',
    ayuda: [
      '<b>Windows:</b> the <code>.exe</code> installer is the simplest. The <code>.msi</code> is for companies that deploy software centrally.',
      '<b>Linux:</b> the <code>AppImage</code> runs on any distribution without installing (make it executable and open it). Use <code>.deb</code> on Debian/Ubuntu and <code>.rpm</code> on Fedora/openSUSE to install it system-wide.',
      '<b>IHTML Mirror</b> is only needed to open <code>.ihtml</code> files. To publish on the web, the Editor exports plain HTML that runs in any browser.'
    ],
    volver: 'Back to home'
  },
  es: {
    locale: 'es-ES', title: 'Descargar IHTML — todas las versiones', h1: 'Descargá IHTML', kicker: 'Descargas',
    metaDesc: 'Descargá IHTML, el editor visual de animaciones HTML/CSS, para Windows, macOS y Linux, e IHTML Mirror para Android. Todos los archivos y versiones en una lista.',
    sub: 'Elegí tu sistema y formato. Cada archivo se descarga directo: sin cuenta y sin registro.',
    ultima: 'Última versión', publicada: 'publicada el', anteriores: 'Versiones anteriores',
    editorNombre: 'IHTML Editor', editorDesc: 'El editor completo: diseñar, animar y exportar. Escritorio.',
    mirrorNombre: 'IHTML Mirror', mirrorDesc: 'Visor gratis: abre y ejecuta archivos .ihtml. Escritorio y Android.',
    colSistema: 'Sistema', colFormato: 'Formato', colTam: 'Tamaño', descargar: 'Descargar', tuSistema: 'tu sistema',
    vacio: 'Todavía no hay versiones publicadas.', decimal: ',',
    fmt: { exe: 'Instalador (recomendado)', msi: 'Paquete MSI (empresas / IT)', dmg: 'Apple Silicon + Intel', appimage: 'Portable, cualquier distro', deb: 'Debian / Ubuntu / Mint', rpm: 'Fedora / openSUSE / RHEL', apk: 'Android 7+' },
    ayudaTit: '¿Cuál elijo?',
    ayuda: [
      '<b>Windows:</b> el instalador <code>.exe</code> es lo más simple. El <code>.msi</code> es para empresas que instalan software de forma centralizada.',
      '<b>Linux:</b> el <code>AppImage</code> funciona en cualquier distribución sin instalar (dale permiso de ejecución y abrilo). Usá <code>.deb</code> en Debian/Ubuntu y <code>.rpm</code> en Fedora/openSUSE para instalarlo en el sistema.',
      '<b>IHTML Mirror</b> solo hace falta para abrir archivos <code>.ihtml</code>. Para publicar en la web, el Editor exporta HTML normal que funciona en cualquier navegador.'
    ],
    volver: 'Volver al inicio'
  },
  pt: {
    locale: 'pt-BR', title: 'Baixar IHTML — todas as versões', h1: 'Baixe o IHTML', kicker: 'Downloads',
    metaDesc: 'Baixe o IHTML, o editor visual de animações HTML/CSS, para Windows, macOS e Linux, e o IHTML Mirror para Android. Todos os arquivos e versões em uma lista.',
    sub: 'Escolha seu sistema e formato. Cada arquivo é baixado diretamente — sem conta e sem cadastro.',
    ultima: 'Última versão', publicada: 'publicada em', anteriores: 'Versões anteriores',
    editorNombre: 'IHTML Editor', editorDesc: 'O editor completo: criar, animar e exportar. Desktop.',
    mirrorNombre: 'IHTML Mirror', mirrorDesc: 'Visualizador grátis: abre e executa arquivos .ihtml. Desktop e Android.',
    colSistema: 'Sistema', colFormato: 'Formato', colTam: 'Tamanho', descargar: 'Baixar', tuSistema: 'seu sistema',
    vacio: 'Ainda não há versões publicadas.', decimal: ',',
    fmt: { exe: 'Instalador (recomendado)', msi: 'Pacote MSI (empresas / TI)', dmg: 'Apple Silicon + Intel', appimage: 'Portátil, qualquer distro', deb: 'Debian / Ubuntu / Mint', rpm: 'Fedora / openSUSE / RHEL', apk: 'Android 7+' },
    ayudaTit: 'Qual eu escolho?',
    ayuda: [
      '<b>Windows:</b> o instalador <code>.exe</code> é o mais simples. O <code>.msi</code> é para empresas que instalam software de forma centralizada.',
      '<b>Linux:</b> o <code>AppImage</code> funciona em qualquer distribuição sem instalar (dê permissão de execução e abra). Use <code>.deb</code> no Debian/Ubuntu e <code>.rpm</code> no Fedora/openSUSE para instalar no sistema.',
      '<b>IHTML Mirror</b> só é necessário para abrir arquivos <code>.ihtml</code>. Para publicar na web, o Editor exporta HTML comum que funciona em qualquer navegador.'
    ],
    volver: 'Voltar ao início'
  },
  fr: {
    locale: 'fr-FR', title: 'Télécharger IHTML — toutes les versions', h1: 'Télécharger IHTML', kicker: 'Téléchargements',
    metaDesc: 'Téléchargez IHTML, l’éditeur visuel d’animations HTML/CSS, pour Windows, macOS et Linux, et IHTML Mirror pour Android. Tous les fichiers et versions dans une liste.',
    sub: 'Choisissez votre système et votre format. Chaque fichier se télécharge directement — sans compte ni inscription.',
    ultima: 'Dernière version', publicada: 'publiée le', anteriores: 'Versions précédentes',
    editorNombre: 'IHTML Editor', editorDesc: 'L’éditeur complet : concevoir, animer et exporter. Ordinateur.',
    mirrorNombre: 'IHTML Mirror', mirrorDesc: 'Lecteur gratuit : ouvre et exécute les fichiers .ihtml. Ordinateur et Android.',
    colSistema: 'Système', colFormato: 'Format', colTam: 'Taille', descargar: 'Télécharger', tuSistema: 'votre système',
    vacio: 'Aucune version publiée pour le moment.', decimal: ',',
    fmt: { exe: 'Installateur (recommandé)', msi: 'Paquet MSI (entreprises / IT)', dmg: 'Apple Silicon + Intel', appimage: 'Portable, toute distribution', deb: 'Debian / Ubuntu / Mint', rpm: 'Fedora / openSUSE / RHEL', apk: 'Android 7+' },
    ayudaTit: 'Lequel choisir ?',
    ayuda: [
      '<b>Windows :</b> l’installateur <code>.exe</code> est le plus simple. Le <code>.msi</code> sert aux entreprises qui déploient les logiciels de façon centralisée.',
      '<b>Linux :</b> l’<code>AppImage</code> fonctionne sur toute distribution sans installation (rendez-le exécutable et ouvrez-le). Utilisez <code>.deb</code> sur Debian/Ubuntu et <code>.rpm</code> sur Fedora/openSUSE pour l’installer sur le système.',
      '<b>IHTML Mirror</b> n’est nécessaire que pour ouvrir les fichiers <code>.ihtml</code>. Pour publier sur le web, l’Editor exporte du HTML standard lisible dans tout navigateur.'
    ],
    volver: 'Retour à l’accueil'
  },
  de: {
    locale: 'de-DE', title: 'IHTML herunterladen — alle Versionen', h1: 'IHTML herunterladen', kicker: 'Downloads',
    metaDesc: 'Lade IHTML, den visuellen HTML/CSS-Animationseditor, für Windows, macOS und Linux herunter, sowie IHTML Mirror für Android. Alle Dateien und Versionen in einer Liste.',
    sub: 'Wähle dein System und Format. Jede Datei wird direkt heruntergeladen — ohne Konto, ohne Anmeldung.',
    ultima: 'Neueste Version', publicada: 'veröffentlicht am', anteriores: 'Frühere Versionen',
    editorNombre: 'IHTML Editor', editorDesc: 'Der komplette Editor: gestalten, animieren, exportieren. Desktop.',
    mirrorNombre: 'IHTML Mirror', mirrorDesc: 'Kostenloser Player: öffnet und startet .ihtml-Dateien. Desktop und Android.',
    colSistema: 'System', colFormato: 'Format', colTam: 'Größe', descargar: 'Download', tuSistema: 'dein System',
    vacio: 'Noch keine Versionen veröffentlicht.', decimal: ',',
    fmt: { exe: 'Installer (empfohlen)', msi: 'MSI-Paket (Firmen / IT)', dmg: 'Apple Silicon + Intel', appimage: 'Portabel, jede Distribution', deb: 'Debian / Ubuntu / Mint', rpm: 'Fedora / openSUSE / RHEL', apk: 'Android 7+' },
    ayudaTit: 'Welche Datei brauche ich?',
    ayuda: [
      '<b>Windows:</b> Der <code>.exe</code>-Installer ist am einfachsten. Das <code>.msi</code> ist für Firmen, die Software zentral verteilen.',
      '<b>Linux:</b> Das <code>AppImage</code> läuft ohne Installation auf jeder Distribution (ausführbar machen und öffnen). Für eine Systeminstallation <code>.deb</code> unter Debian/Ubuntu und <code>.rpm</code> unter Fedora/openSUSE.',
      '<b>IHTML Mirror</b> brauchst du nur zum Öffnen von <code>.ihtml</code>-Dateien. Fürs Web exportiert der Editor normales HTML, das in jedem Browser läuft.'
    ],
    volver: 'Zur Startseite'
  },
  it: {
    locale: 'it-IT', title: 'Scarica IHTML — tutte le versioni', h1: 'Scarica IHTML', kicker: 'Download',
    metaDesc: 'Scarica IHTML, l’editor visuale di animazioni HTML/CSS, per Windows, macOS e Linux, e IHTML Mirror per Android. Tutti i file e le versioni in un’unica lista.',
    sub: 'Scegli sistema e formato. Ogni file si scarica direttamente — senza account e senza registrazione.',
    ultima: 'Ultima versione', publicada: 'pubblicata il', anteriores: 'Versioni precedenti',
    editorNombre: 'IHTML Editor', editorDesc: 'L’editor completo: progettare, animare ed esportare. Desktop.',
    mirrorNombre: 'IHTML Mirror', mirrorDesc: 'Lettore gratuito: apre ed esegue i file .ihtml. Desktop e Android.',
    colSistema: 'Sistema', colFormato: 'Formato', colTam: 'Dimensione', descargar: 'Scarica', tuSistema: 'il tuo sistema',
    vacio: 'Non ci sono ancora versioni pubblicate.', decimal: ',',
    fmt: { exe: 'Installer (consigliato)', msi: 'Pacchetto MSI (aziende / IT)', dmg: 'Apple Silicon + Intel', appimage: 'Portatile, qualsiasi distro', deb: 'Debian / Ubuntu / Mint', rpm: 'Fedora / openSUSE / RHEL', apk: 'Android 7+' },
    ayudaTit: 'Quale scelgo?',
    ayuda: [
      '<b>Windows:</b> l’installer <code>.exe</code> è il più semplice. Il <code>.msi</code> è per le aziende che distribuiscono software in modo centralizzato.',
      '<b>Linux:</b> l’<code>AppImage</code> funziona su qualsiasi distribuzione senza installazione (rendilo eseguibile e aprilo). Usa <code>.deb</code> su Debian/Ubuntu e <code>.rpm</code> su Fedora/openSUSE per installarlo nel sistema.',
      '<b>IHTML Mirror</b> serve solo per aprire i file <code>.ihtml</code>. Per pubblicare sul web, l’Editor esporta HTML standard che funziona in qualsiasi browser.'
    ],
    volver: 'Torna alla home'
  },
  ja: {
    locale: 'ja-JP', title: 'IHTML ダウンロード — 全バージョン', h1: 'IHTML をダウンロード', kicker: 'ダウンロード',
    metaDesc: 'HTML/CSS アニメーションのビジュアルエディター IHTML(Windows・macOS・Linux)と Android 用 IHTML Mirror をダウンロード。すべてのファイルとバージョンを一覧で。',
    sub: 'お使いのシステムと形式を選んでください。アカウント登録なしで、ファイルを直接ダウンロードできます。',
    ultima: '最新バージョン', publicada: '公開日', anteriores: '以前のバージョン',
    editorNombre: 'IHTML Editor', editorDesc: 'デザイン・アニメーション・書き出しができるフル機能のエディター(デスクトップ)。',
    mirrorNombre: 'IHTML Mirror', mirrorDesc: '.ihtml ファイルを開いて再生する無料ビューアー(デスクトップ・Android)。',
    colSistema: 'システム', colFormato: '形式', colTam: 'サイズ', descargar: 'ダウンロード', tuSistema: 'お使いのシステム',
    vacio: '公開されたバージョンはまだありません。',
    fmt: { exe: 'インストーラー(推奨)', msi: 'MSI パッケージ(企業・IT 向け)', dmg: 'Apple Silicon + Intel', appimage: 'ポータブル版(全ディストリ)', deb: 'Debian / Ubuntu / Mint', rpm: 'Fedora / openSUSE / RHEL', apk: 'Android 7 以降' },
    ayudaTit: 'どれを選べばいい?',
    ayuda: [
      '<b>Windows:</b> <code>.exe</code> インストーラーがいちばん簡単です。<code>.msi</code> はソフトを一括配布する企業向けです。',
      '<b>Linux:</b> <code>AppImage</code> はインストール不要でどのディストリでも動きます(実行権限を付けて開くだけ)。システムにインストールするなら Debian/Ubuntu は <code>.deb</code>、Fedora/openSUSE は <code>.rpm</code> を。',
      '<b>IHTML Mirror</b> は <code>.ihtml</code> ファイルを開くときだけ必要です。Web 公開には、エディターがどのブラウザーでも動く通常の HTML を書き出します。'
    ],
    volver: 'ホームに戻る'
  },
  zh: {
    locale: 'zh-CN', title: '下载 IHTML — 全部版本', h1: '下载 IHTML', kicker: '下载',
    metaDesc: '下载 IHTML —— HTML/CSS 动画可视化编辑器(Windows、macOS、Linux),以及 Android 版 IHTML Mirror。所有文件和版本一览。',
    sub: '选择你的系统和格式。每个文件都可直接下载,无需账号或注册。',
    ultima: '最新版本', publicada: '发布于', anteriores: '历史版本',
    editorNombre: 'IHTML Editor', editorDesc: '完整编辑器:设计、制作动画并导出。桌面端。',
    mirrorNombre: 'IHTML Mirror', mirrorDesc: '免费播放器:打开并运行 .ihtml 文件。桌面端和 Android。',
    colSistema: '系统', colFormato: '格式', colTam: '大小', descargar: '下载', tuSistema: '你的系统',
    vacio: '暂无已发布的版本。',
    fmt: { exe: '安装程序(推荐)', msi: 'MSI 安装包(企业 / IT)', dmg: 'Apple Silicon + Intel', appimage: '便携版,适用所有发行版', deb: 'Debian / Ubuntu / Mint', rpm: 'Fedora / openSUSE / RHEL', apk: 'Android 7+' },
    ayudaTit: '该选哪个?',
    ayuda: [
      '<b>Windows:</b><code>.exe</code> 安装程序最简单。<code>.msi</code> 适合集中部署软件的企业。',
      '<b>Linux:</b><code>AppImage</code> 无需安装即可在任何发行版运行(赋予执行权限后打开)。如需安装到系统,Debian/Ubuntu 用 <code>.deb</code>,Fedora/openSUSE 用 <code>.rpm</code>。',
      '<b>IHTML Mirror</b> 仅用于打开 <code>.ihtml</code> 文件。发布到网页时,编辑器会导出可在任何浏览器运行的普通 HTML。'
    ],
    volver: '返回首页'
  }
};

function rel(fromFile, toFile) {
  const r = path.posix.relative(path.posix.dirname(fromFile), toFile);
  return r || path.posix.basename(toFile);
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

function pick(html, re, what, file) {
  const m = html.match(re);
  if (!m) throw new Error(`${file}: no encontré ${what}`);
  return m[0];
}

// Cabecera / pie del index del idioma, adaptados a esta página.
function adaptar(fragment, lang) {
  const dl = DL_PATH[lang];
  const idx = INDEX_PATH[lang];
  return (
    fragment
      // anclas de la portada -> index.html#ancla
      .replace(/href="#([a-z-]+)"/g, (m, a) => `href="${rel(dl, idx)}#${a}"`)
      // "Inicio" ya no es la página activa
      .replace(/(<nav class="island-menu">[\s\S]*?)<a href="index\.html" class="is-activo">/, '$1<a href="index.html">')
      // selector de idioma y enlaces de idioma del pie -> la página de descargas de ese idioma
      .replace(/<a href="[^"]*"( class="is-activo")? lang="([a-z]{2})"/g, (m, act, l) =>
        DL_PATH[l] ? `<a href="${rel(dl, DL_PATH[l])}"${act || ''} lang="${l}"` : m
      )
  );
}

function marcarActivo(header, lang) {
  const self = path.posix.basename(DL_PATH[lang]);
  return header.replace(`<a href="${self}">`, `<a href="${self}" class="is-activo">`);
}

async function obtenerReleases() {
  const r = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=20`, {
    headers: { accept: 'application/vnd.github+json', 'user-agent': 'ihtml-web-build' }
  });
  if (!r.ok) throw new Error(`API de GitHub: HTTP ${r.status}`);
  return r.json();
}

function cargarRender() {
  const ctx = { globalThis: {} };
  ctx.window = ctx.globalThis;
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'assets/descargas.js'), 'utf8'), ctx);
  return ctx.globalThis.IHTMLDescargas;
}

async function main() {
  const D = cargarRender();
  const data = await obtenerReleases();
  // Solo lo necesario para dibujar (lo mismo que normalizar() conserva).
  const releases = data
    .filter((r) => !r.draft)
    .map((r) => ({
      tag_name: r.tag_name,
      published_at: r.published_at,
      prerelease: r.prerelease,
      assets: r.assets.map((a) => ({ name: a.name, size: a.size, browser_download_url: a.browser_download_url }))
    }));
  const tag = (D.normalizar(releases)[0] || {}).tag || '';

  for (const [lang, file] of Object.entries(DL_PATH)) {
    const t = T[lang];
    const idxFile = INDEX_PATH[lang];
    const idx = fs.readFileSync(path.join(ROOT, idxFile), 'utf8');
    const skip = pick(idx, /<a class="skip-link"[^>]*>[^<]*<\/a>/, 'skip-link', idxFile);
    let header = adaptar(pick(idx, /<header class="island">[\s\S]*?<\/header>/, '<header>', idxFile), lang);
    header = marcarActivo(header, lang);
    const footer = adaptar(pick(idx, /<footer>[\s\S]*?<\/footer>/, '<footer>', idxFile), lang);
    const uiScript = pick(idx, /<script>\s*const rv = [\s\S]*?<\/script>/, 'script de la isla', idxFile);
    const analytics = (idx.match(/<script defer src="https:\/\/ihtml-analytics[^"]*"><\/script>/) || [''])[0];
    const base = rel(file, 'assets/x').replace(/x$/, '');
    const alternates = Object.entries(DL_PATH)
      .map(([l, p]) => `    <link rel="alternate" hreflang="${l}" href="${SITE}${p}" />`)
      .join('\n');
    const tJson = JSON.stringify(t).replace(/</g, '\\u003c');
    const lista = D.render(releases, t);

    const html = `<!doctype html>
<html lang="${lang}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(t.title)}</title>
    <meta name="description" content="${esc(t.metaDesc)}" />
    <meta name="robots" content="index, follow" />
    <meta name="theme-color" content="#14161a" />
    <link rel="canonical" href="${SITE}${file}" />
${alternates}
    <link rel="alternate" hreflang="x-default" href="${SITE}${DL_PATH.en}" />
    <link rel="icon" type="image/svg+xml" href="${base}favicon.svg" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="IHTML · Interactive HTML" />
    <meta property="og:title" content="${esc(t.title)}" />
    <meta property="og:description" content="${esc(t.metaDesc)}" />
    <meta property="og:url" content="${SITE}${file}" />
    <meta property="og:image" content="${SITE}assets/og-image.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="${base}estilos.css" />
  </head>
  <body>
    ${skip}
    ${header}

    <main id="contenido" class="dl-page">
      <div class="dl-hero">
        <p class="kicker">${esc(t.kicker)}</p>
        <h1>${esc(t.h1)}</h1>
        <p class="sub">${esc(t.sub)}</p>
      </div>

      <div id="dlLista" class="dl-lista" data-tag="${esc(tag)}">
${lista}
      </div>

      <div class="dl-ayuda">
        <h2>${esc(t.ayudaTit)}</h2>
        <ul>
${t.ayuda.map((p) => `          <li>${p}</li>`).join('\n')}
        </ul>
        <p><a class="btn" href="index.html">${esc(t.volver)}</a></p>
      </div>
    </main>

    ${footer}

    ${uiScript}
    <script>
      window.IHTML_DL_T = ${tJson};
    </script>
    <script src="${base}descargas.js"></script>
    ${analytics}
  </body>
</html>
`;
    fs.writeFileSync(path.join(ROOT, file), html);
    console.log('escrito', file);
  }

  // sitemap.xml: agrega las páginas de descargas si faltan.
  const smPath = path.join(ROOT, 'sitemap.xml');
  let sm = fs.readFileSync(smPath, 'utf8');
  const hoy = new Date().toISOString().slice(0, 10);
  const nuevas = Object.values(DL_PATH)
    .filter((p) => !sm.includes(`<loc>${SITE}${p}</loc>`))
    .map((p) => `  <url>\n    <loc>${SITE}${p}</loc>\n    <lastmod>${hoy}</lastmod>\n    <changefreq>weekly</changefreq>\n  </url>\n`)
    .join('');
  if (nuevas) {
    sm = sm.replace('</urlset>', nuevas + '</urlset>');
    fs.writeFileSync(smPath, sm);
    console.log('sitemap.xml actualizado');
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
