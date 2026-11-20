// Idioma automatico (assets/idioma.js) + paginas en los 8 idiomas.
const { test, expect } = require('@playwright/test');

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
// Playwright marca navigator.webdriver y el UA "HeadlessChrome": idioma.js no
// redirige a robots. Aqui simulamos un visitante real.
async function visitante(browser, opts) {
  const ctx = await browser.newContext({ userAgent: UA, ...opts });
  await ctx.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
  return ctx;
}

test('navegador en aleman: la guia inglesa lleva a la alemana', async ({ browser }) => {
  const ctx = await visitante(browser, { locale: 'de-DE' });
  const page = await ctx.newPage();
  await page.goto('guide.html');
  await expect(page).toHaveURL(/\/de\/guide\.html$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await ctx.close();
});

test('idioma no soportado: decide la ubicacion (zona horaria de Madrid -> espanol)', async ({ browser }) => {
  const ctx = await visitante(browser, { locale: 'ru-RU', timezoneId: 'Europe/Madrid' });
  const page = await ctx.newPage();
  await page.goto('privacy.html');
  await expect(page).toHaveURL(/\/es\/privacidad\.html$/);
  await ctx.close();
});

test('idioma no soportado y zona horaria de Tokio -> japones', async ({ browser }) => {
  const ctx = await visitante(browser, { locale: 'ko-KR', timezoneId: 'Asia/Tokyo' });
  const page = await ctx.newPage();
  await page.goto('novedades/en/index.html');
  await expect(page).toHaveURL(/\/novedades\/ja\/index\.html$/);
  await ctx.close();
});

test('catalan -> espanol; portada en la raiz', async ({ browser }) => {
  const ctx = await visitante(browser, { locale: 'ca-ES' });
  const page = await ctx.newPage();
  await page.goto('index.html');
  await expect(page).toHaveURL(/\/es\/(index\.html)?$/);
  await ctx.close();
});

test('navegador en ingles se queda en ingles', async ({ browser }) => {
  const ctx = await visitante(browser, { locale: 'en-US', timezoneId: 'Europe/Berlin' });
  const page = await ctx.newPage();
  await page.goto('license.html');
  await page.waitForTimeout(400);
  await expect(page).toHaveURL(/\/license\.html$/);
  await ctx.close();
});

test('elegir idioma en el menu se respeta siempre', async ({ browser }) => {
  const ctx = await visitante(browser, { locale: 'de-DE' });
  const page = await ctx.newPage();
  await page.goto('de/license.html');
  await page.evaluate(() => document.querySelector('.lang-switch-menu a[lang="fr"]').click());
  await expect(page).toHaveURL(/\/fr\/license\.html$/);
  // Otra pagina en ingles: va al frances elegido, no al aleman del navegador.
  await page.goto('guide.html');
  await expect(page).toHaveURL(/\/fr\/guide\.html$/);
  // Elegir ingles lo deja en ingles.
  await page.evaluate(() => document.querySelector('.lang-switch-menu a[lang="en"]').click());
  await expect(page).toHaveURL(/\/guide\.html$/);
  await page.waitForTimeout(400);
  await expect(page).toHaveURL(/127\.0\.0\.1:8472\/guide\.html$/);
  await ctx.close();
});

test('robots (UA headless) no se redirigen', async ({ page }) => {
  await page.goto('guide.html');
  await page.waitForTimeout(300);
  await expect(page).toHaveURL(/\/guide\.html$/);
});

const PAGINAS = [
  'license.html', 'privacy.html', 'es/licencia.html', 'es/privacidad.html',
  ...['pt', 'fr', 'de', 'it', 'ja', 'zh'].flatMap((l) => [`${l}/license.html`, `${l}/privacy.html`, `novedades/${l}/index.html`, `novedades/${l}/2026-11-20-ihtml-1-1.html`]),
  'novedades/index.html', 'novedades/2026-11-20-ihtml-1-1.html', 'novedades/en/index.html', 'novedades/en/2026-11-20-ihtml-1-1.html'
];

test('legales y novedades: 8 idiomas en el menu y todos los enlaces existen', async ({ page, request }) => {
  const vistos = new Set();
  for (const p of PAGINAS) {
    const r = await page.goto(p);
    expect(r.status(), p).toBe(200);
    const links = await page.$$eval('.lang-switch-menu a[lang]', (as) => as.map((a) => [a.getAttribute('lang'), a.href]));
    expect(links.map((x) => x[0]).sort(), p).toEqual(['de', 'en', 'es', 'fr', 'it', 'ja', 'pt', 'zh']);
    const otros = await page.$$eval('header a[href], footer a[href]', (as) => as.map((a) => a.href));
    for (const [, href] of links) vistos.add(href.split('#')[0]);
    for (const href of otros) if (href.startsWith('http://127.0.0.1:8472/')) vistos.add(href.split('#')[0]);
  }
  for (const u of vistos) {
    const r = await request.get(u);
    expect(r.status(), u).toBe(200);
  }
});

test('textos traducidos: titulos en su idioma', async ({ page }) => {
  const esperado = {
    'de/license.html': 'IHTML-Lizenzvertrag',
    'ja/privacy.html': 'IHTML プライバシーポリシー',
    'novedades/fr/2026-11-20-ihtml-1-1.html': 'connexions entre éléments',
    'novedades/zh/index.html': 'IHTML 有哪些新变化',
    'novedades/en/2026-11-20-ihtml-1-1.html': 'element connections'
  };
  for (const [p, txt] of Object.entries(esperado)) {
    await page.goto(p);
    await expect(page.locator('h1')).toContainText(txt);
  }
  // El pie del aleman enlaza a sus propias paginas legales y novedades.
  await page.goto('de/index.html');
  await expect(page.locator('footer a[href="license.html"]')).toHaveCount(1);
  await expect(page.locator('header a[href="../novedades/de/index.html"]')).toHaveCount(1);
});
