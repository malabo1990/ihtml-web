// Tests de UI del sitio IHTML: showreel, descargas, isla (menú) y enlaces.
const { test, expect } = require('@playwright/test');

const LANGS = {
  en: { index: 'index.html', dl: 'downloads.html' },
  es: { index: 'es/index.html', dl: 'es/descargas.html' },
  pt: { index: 'pt/index.html', dl: 'pt/downloads.html' },
  fr: { index: 'fr/index.html', dl: 'fr/downloads.html' },
  de: { index: 'de/index.html', dl: 'de/downloads.html' },
  it: { index: 'it/index.html', dl: 'it/downloads.html' },
  ja: { index: 'ja/index.html', dl: 'ja/downloads.html' },
  zh: { index: 'zh/index.html', dl: 'zh/downloads.html' }
};

const UA = {
  linux: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36',
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36'
};

function asset(name, size = 1000000) {
  return { name, size, browser_download_url: 'https://github.com/malabo1990/ihtml-releases/releases/download/v/' + name };
}
function release(ver, date) {
  const a = [];
  for (const app of ['IHTML', 'IHTML-Mirror']) {
    a.push(asset(`${app}_${ver}_windows.exe`), asset(`${app}_${ver}_windows.msi`), asset(`${app}_${ver}_macos.dmg`));
    a.push(asset(`${app}_${ver}_linux.AppImage`), asset(`${app}_${ver}_linux-deb.deb`), asset(`${app}_${ver}_linux-rpm.rpm`));
  }
  a.push(asset(`IHTML-Mirror_${ver}_android.apk`));
  return { tag_name: 'v' + ver, published_at: date + 'T10:00:00Z', draft: false, prerelease: false, assets: a };
}

// Red: nada externo real. La API de GitHub se simula (ok / caída).
async function red(page, api = 'ok', releases = [release('1.0.1', '2026-11-16'), release('1.0.0', '2026-11-15')]) {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => {
    const url = route.request().url();
    if (url.startsWith('https://api.github.com/')) {
      if (api !== 'ok') return route.fulfill({ status: 503, body: '' });
      const latest = url.includes('/releases/latest');
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(latest ? releases[0] : releases) });
    }
    return route.abort();
  });
}

function sinErrores(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  return errs;
}

// ---------------------------------------------------------------- Showreel
test.describe('showreel', () => {
  for (const [lang, p] of Object.entries(LANGS)) {
    test(`${lang}: el showreel es la imagen principal y se reproduce al abrir la página`, async ({ page }) => {
      const errs = sinErrores(page);
      await red(page);
      await page.goto(p.index);
      // está ARRIBA, en el hero (lo primero que se ve), no en una sección de abajo
      const v = page.locator('.hero .mock.showreel video.showreel-video');
      await expect(v).toHaveCount(1);
      await expect(page.locator('.hero .mock img')).toHaveCount(0);
      await expect(page.locator('section#showreel')).toHaveCount(0);
      await expect(v).toBeInViewport();
      for (const src of await v.locator('source').evaluateAll((s) => s.map((x) => x.src))) {
        expect((await page.request.get(src)).status(), src).toBe(200);
      }
      expect((await page.request.get(await v.evaluate((x) => x.poster))).status()).toBe(200);
      expect(await v.getAttribute('aria-label')).toBeTruthy();
      // se reproduce sin tocar nada
      await expect.poll(() => v.evaluate((x) => !x.paused && x.readyState >= 2 && x.currentTime > 0), { timeout: 8000 }).toBe(true);
      expect(await v.evaluate((x) => x.videoWidth)).toBe(1280);
      // fuera de pantalla se pausa
      await page.locator('footer').scrollIntoViewIfNeeded();
      await expect.poll(() => v.evaluate((x) => x.paused), { timeout: 4000 }).toBe(true);
      expect(errs).toEqual([]);
    });
  }

  test('con "reducir movimiento" no se reproduce solo y muestra controles', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await red(page);
    await page.goto('es/index.html');
    await page.waitForTimeout(1200);
    const v = page.locator('.showreel-video');
    expect(await v.evaluate((x) => x.paused)).toBe(true);
    expect(await v.evaluate((x) => x.controls)).toBe(true);
    await ctx.close();
  });
});

// ------------------------------------------------- Botones de la portada
test.describe('botones de descarga de la portada', () => {
  for (const [lang, p] of Object.entries(LANGS)) {
    test(`${lang}: ningún enlace a la página de releases de GitHub`, async ({ page }) => {
      await red(page, 'down');
      await page.goto(p.index);
      const malos = await page.$$eval('a[href]', (as) =>
        as.map((a) => a.href).filter((h) => /github\.com\/[^/]+\/[^/]+\/releases(\/?$|\/tag|\/latest)/.test(h))
      );
      expect(malos).toEqual([]);
    });

    test(`${lang}: API ok -> cada botón baja el archivo directo`, async ({ page }) => {
      await red(page, 'ok');
      await page.goto(p.index);
      const btn = (plat) => page.locator(`.plataforma[data-plat="${plat}"] a[data-dl]`);
      await expect(btn('windows')).toHaveAttribute('href', /\/releases\/download\/v\/IHTML_1\.0\.1_windows\.exe$/);
      await expect(btn('macos')).toHaveAttribute('href', /IHTML_1\.0\.1_macos\.dmg$/);
      await expect(btn('linux')).toHaveAttribute('href', /IHTML_1\.0\.1_linux\.AppImage$/);
      await expect(btn('android')).toHaveAttribute('href', /IHTML-Mirror_1\.0\.1_android\.apk$/);
      await expect(page.locator('.plataforma[data-plat="windows"] a[data-dl-mirror]')).toBeVisible();
      await expect(page.locator('#dlVer')).toContainText('1.0.1');
    });

    test(`${lang}: API caída -> los botones van a la página de descargas del sitio`, async ({ page }) => {
      await red(page, 'down');
      await page.goto(p.index);
      await page.waitForTimeout(300);
      const hrefs = await page.$$eval('.plataforma a[data-dl]', (as) => as.map((a) => a.getAttribute('href')));
      expect(hrefs.length).toBe(4);
      const dlFile = p.dl.split('/').pop();
      for (const h of hrefs) expect(h).toBe(dlFile);
      await expect(page.locator('a.dl-todas')).toHaveAttribute('href', dlFile);
    });
  }
});

// ------------------------------------------------- Página de descargas
test.describe('página de descargas', () => {
  for (const [lang, p] of Object.entries(LANGS)) {
    test(`${lang}: lista completa, enlaces directos, menú activo e idiomas`, async ({ page }) => {
      const errs = sinErrores(page);
      await red(page, 'down'); // la lista incrustada tiene que bastar sola
      await page.goto(p.dl);
      await expect(page.locator('html')).toHaveAttribute('lang', lang);
      await expect(page.locator('h1')).not.toBeEmpty();
      await expect(page.locator('.dl-app#editor tbody tr')).toHaveCount(6);
      await expect(page.locator('.dl-app#mirror tbody tr')).toHaveCount(7);
      const hrefs = await page.$$eval('#dlLista a.btn', (as) => as.map((a) => a.href));
      expect(hrefs.length).toBeGreaterThanOrEqual(13);
      for (const h of hrefs) expect(h).toMatch(/^https:\/\/github\.com\/malabo1990\/ihtml-releases\/releases\/download\//);
      // el menú marca "Descargar" como activo y apunta a esta página
      const activo = page.locator('.island-menu a.is-activo');
      await expect(activo).toHaveCount(1);
      await expect(activo).toHaveAttribute('href', p.dl.split('/').pop());
      // el selector de idioma lleva a la página de descargas de cada idioma, y existen
      const langs = await page.$$eval('.lang-switch-menu a', (as) => as.map((a) => a.href));
      expect(langs.length).toBe(8);
      for (const h of langs) {
        expect(h).toMatch(/(downloads|descargas)\.html$/);
        expect((await page.request.get(h)).status(), h).toBe(200);
      }
      expect(errs).toEqual([]);
    });
  }

  for (const [os, ua, plat] of [['linux', UA.linux, 'linux'], ['windows', UA.windows, 'windows'], ['mac', UA.mac, 'macos']]) {
    test(`marca "tu sistema" según el navegador (${os})`, async ({ browser }) => {
      const ctx = await browser.newContext({ userAgent: ua });
      const page = await ctx.newPage();
      await red(page, 'down');
      await page.goto('es/descargas.html');
      const marcadas = page.locator('.dl-app tr.es-tuyo');
      await expect(marcadas.first()).toBeVisible();
      for (const p of await marcadas.evaluateAll((trs) => trs.map((t) => t.dataset.plat))) expect(p).toBe(plat);
      await expect(page.locator('.dl-app tr.es-tuyo .dl-tuyo').first()).toHaveText('tu sistema');
      await ctx.close();
    });
  }

  test('si sale una versión nueva, la lista se actualiza sola', async ({ page }) => {
    await red(page, 'ok', [release('9.9.9', '2027-01-02'), release('1.0.1', '2026-11-16')]);
    await page.goto('es/descargas.html');
    await expect(page.locator('.dl-version')).toContainText('9.9.9');
    await expect(page.locator('#dlLista')).toHaveAttribute('data-tag', 'v9.9.9');
    await expect(page.locator('.dl-app#editor a.btn').first()).toHaveAttribute('href', /IHTML_9\.9\.9_/);
    await expect(page.locator('.dl-vieja summary')).toContainText('1.0.1');
  });

  test('versiones anteriores se despliegan', async ({ page }) => {
    await red(page, 'down');
    await page.goto('es/descargas.html');
    const det = page.locator('.dl-vieja').first();
    await expect(det.locator('a.btn').first()).toBeHidden();
    await det.locator('summary').click();
    await expect(det.locator('a.btn').first()).toBeVisible();
  });
});

// ------------------------------------------------- Isla (menú superior)
test.describe('isla de navegación', () => {
  for (const w of [1440, 1280, 1100, 1024, 900, 760, 390, 320]) {
    test(`${w}px: logo en una línea, isla dentro de la pantalla, menú sin recortes`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: 800 }, hasTouch: w < 800 });
      const page = await ctx.newPage();
      await red(page, 'down');
      for (const url of ['es/index.html', 'es/descargas.html', 'ja/index.html', 'fr/downloads.html']) {
        await page.goto(url);
        const logo = page.locator('.island .logo-text');
        const lh = await logo.evaluate((e) => parseFloat(getComputedStyle(e).lineHeight) || e.getBoundingClientRect().height);
        expect((await logo.boundingBox()).height, `${url}: logo en 2 líneas`).toBeLessThanOrEqual(lh * 1.3);
        // sin scroll horizontal
        expect(await page.evaluate(() => document.documentElement.scrollWidth), url).toBeLessThanOrEqual(w);
        // abrir el menú (botón de puntos) y comprobar que se ve TODO
        await page.locator('.island-dot').click();
        await page.waitForTimeout(800);
        const isla = await page.locator('.island').boundingBox();
        expect(isla.x, url).toBeGreaterThanOrEqual(0);
        expect(isla.x + isla.width, url).toBeLessThanOrEqual(w + 0.5);
        await expect(page.locator('.island-dot')).toBeInViewport({ ratio: 1 });
        const menu = page.locator('.island-menu');
        const recorte = await menu.evaluate((m) => m.scrollWidth - m.clientWidth);
        expect(recorte, `${url}: menú recortado`).toBeLessThanOrEqual(1);
        for (const a of await page.locator('.island-menu a').all()) {
          await expect(a, `${url}: ${await a.textContent()}`).toBeInViewport({ ratio: 1 });
        }
        await page.locator('.island-dot').click(); // cerrar
      }
      await ctx.close();
    });
  }
});

// ------------------------------------------------- Enlaces internos
test('ningún enlace interno roto en portadas y descargas', async ({ page }) => {
  await red(page, 'down');
  const vistos = new Set();
  const rotos = [];
  for (const p of Object.values(LANGS)) {
    for (const url of [p.index, p.dl]) {
      await page.goto(url);
      const hrefs = await page.$$eval('a[href]', (as) => as.map((a) => a.href));
      for (const h of hrefs) {
        const u = h.split('#')[0];
        if (!u.startsWith('http://127.0.0.1:8472/') || vistos.has(u)) continue;
        vistos.add(u);
        const st = (await page.request.get(u)).status();
        if (st !== 200) rotos.push(`${url} -> ${u} (${st})`);
      }
    }
  }
  expect(rotos).toEqual([]);
});
