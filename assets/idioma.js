/* IHTML - idioma automatico.
   Va en el <head> de TODAS las paginas, despues de los <link rel="alternate"
   hreflang>. Si el visitante no eligio idioma a mano, lo lleva a la misma
   pagina en su idioma:
     1. idioma del dispositivo/navegador (navigator.languages), si es uno de
        los 8 de la web (catalan, gallego, euskera -> espanol);
     2. si no, la zona horaria del equipo (su ubicacion aproximada, sin pedir
        permisos ni mandar la IP a nadie);
     3. si no, ingles.
   Tambien aplica el tema claro/oscuro (boton en la isla) y muestra un aviso informativo de privacidad (8 idiomas) hasta que se cierra.
   Elegir un idioma en el menu lo guarda y se respeta siempre. Nunca redirige
   a buscadores ni en bucle. */
(function () {
  var LANGS = ['en', 'es', 'pt', 'fr', 'de', 'it', 'ja', 'zh'];
  var CHOICE = 'ihtml-lang-choice';
  var ALIAS = { ca: 'es', gl: 'es', eu: 'es', ast: 'es' };
  var TZ = {
    es: /^(Europe\/Madrid|Atlantic\/Canary|Africa\/(Ceuta|Malabo)|America\/(Mexico_City|Monterrey|Merida|Cancun|Chihuahua|Hermosillo|Mazatlan|Tijuana|Bahia_Banderas|Matamoros|Ojinaga|Bogota|Lima|Santiago|Punta_Arenas|Buenos_Aires|Argentina\/.*|Cordoba|Mendoza|Caracas|Guatemala|Havana|Montevideo|Asuncion|La_Paz|Guayaquil|Panama|Costa_Rica|El_Salvador|Tegucigalpa|Managua|Santo_Domingo|Puerto_Rico)|Pacific\/(Easter|Galapagos))$/,
    pt: /^(Europe\/Lisbon|Atlantic\/(Azores|Madeira)|America\/(Sao_Paulo|Fortaleza|Recife|Bahia|Belem|Maceio|Araguaina|Manaus|Cuiaba|Campo_Grande|Porto_Velho|Boa_Vista|Rio_Branco|Eirunepe|Santarem|Noronha)|Africa\/(Luanda|Maputo|Bissau|Sao_Tome)|Atlantic\/Cape_Verde|Asia\/Dili)$/,
    fr: /^(Europe\/(Paris|Monaco)|Africa\/(Dakar|Abidjan|Douala|Libreville|Kinshasa|Lubumbashi|Brazzaville|Bamako|Niamey|Ouagadougou|Lome|Porto-Novo|Conakry|Bangui|Ndjamena|Tunis|Algiers)|Indian\/(Reunion|Mayotte)|America\/(Guadeloupe|Martinique|Cayenne|Port-au-Prince)|Pacific\/(Noumea|Tahiti))$/,
    de: /^Europe\/(Berlin|Vienna|Zurich|Busingen|Vaduz)$/,
    it: /^Europe\/(Rome|San_Marino|Vatican)$/,
    ja: /^Asia\/Tokyo$/,
    zh: /^Asia\/(Shanghai|Chongqing|Chungking|Harbin|Urumqi|Hong_Kong|Macau|Taipei)$/
  };

  function norm(tag) {
    var l = String(tag || '').toLowerCase().split('-')[0];
    l = ALIAS[l] || l;
    return LANGS.indexOf(l) >= 0 ? l : null;
  }

  function detect() {
    var list = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || navigator.userLanguage]) || [];
    for (var i = 0; i < list.length; i++) {
      var l = norm(list[i]);
      if (l) return l;
    }
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      for (var k in TZ) if (TZ[k].test(tz)) return k;
    } catch (e) {
      /* sin Intl */
    }
    return 'en';
  }

  function get(store, key) {
    try {
      return window[store].getItem(key);
    } catch (e) {
      return null;
    }
  }
  function set(store, key, val) {
    try {
      window[store].setItem(key, val);
    } catch (e) {
      /* modo privado, almacenamiento bloqueado */
    }
  }

  // ---- Tema claro/oscuro: sin eleccion sigue al sistema (CSS); el boton de la
  // isla lo fija en <html data-theme> y lo recuerda en localStorage.
  var THEME = 'ihtml-theme';
  var root = document.documentElement;
  var savedTheme = get('localStorage', THEME);
  if (savedTheme === 'dark' || savedTheme === 'light') root.setAttribute('data-theme', savedTheme);
  function isDark() {
    var t = root.getAttribute('data-theme');
    if (t) return t === 'dark';
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }
  var THEME_LABEL = {
    es: ['Modo oscuro', 'Modo claro'], en: ['Dark mode', 'Light mode'], pt: ['Modo escuro', 'Modo claro'],
    fr: ['Mode sombre', 'Mode clair'], de: ['Dunkelmodus', 'Hellmodus'], it: ['Modalità scura', 'Modalità chiara'],
    ja: ['ダークモード', 'ライトモード'], zh: ['深色模式', '浅色模式']
  };
  var MOON = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
  var SUN = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></svg>';
  function themeButton() {
    var island = document.querySelector('header.island');
    if (!island || island.querySelector('.theme-btn')) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'theme-btn';
    function paint() {
      var lab = THEME_LABEL[norm(root.lang) || 'en'];
      var dark = isDark();
      b.innerHTML = dark ? SUN : MOON;
      b.setAttribute('aria-label', dark ? lab[1] : lab[0]);
      b.title = dark ? lab[1] : lab[0];
    }
    b.addEventListener('click', function () {
      var next = isDark() ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      set('localStorage', THEME, next);
      paint();
    });
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq.addEventListener) mq.addEventListener('change', paint);
    }
    paint();
    island.appendChild(b);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', themeButton);
  else themeButton();

  // Elegir idioma a mano en el menu = preferencia guardada.
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('.lang-switch-menu a[lang]') : null;
    if (a) set('localStorage', CHOICE, a.getAttribute('lang'));
  });

  var robot = /bot|crawl|spider|slurp|lighthouse|headless/i.test(navigator.userAgent || '') || navigator.webdriver;

  // Aviso informativo de privacidad (no hay cookies: solo idioma en localStorage
  // y el id de pestana de la analitica en sessionStorage). Se cierra una vez.
  var AVISO = {
    es: ['Esta web no usa cookies. Solo guarda en tu navegador el idioma y el tema (claro u oscuro) elegidos y un identificador anónimo de la pestaña que se borra al cerrarla.', 'Privacidad', 'Entendido'],
    en: ['This website uses no cookies. It only saves your chosen language and theme (light or dark) in your browser and an anonymous tab identifier that is deleted when you close the tab.', 'Privacy', 'Got it'],
    pt: ['Este site não usa cookies. Só guarda no seu navegador o idioma e o tema (claro ou escuro) escolhidos e um identificador anônimo da aba, apagado ao fechá-la.', 'Privacidade', 'Entendi'],
    fr: ["Ce site n'utilise pas de cookies. Il enregistre seulement dans votre navigateur la langue et le thème (clair ou sombre) choisis et un identifiant d'onglet anonyme, effacé à sa fermeture.", 'Confidentialité', 'Compris'],
    de: ['Diese Website verwendet keine Cookies. Sie speichert in deinem Browser nur die gewählte Sprache und das Design (hell oder dunkel) sowie eine anonyme Tab-Kennung, die beim Schließen des Tabs gelöscht wird.', 'Datenschutz', 'Verstanden'],
    it: ['Questo sito non usa cookie. Salva nel tuo browser solo la lingua e il tema (chiaro o scuro) scelti e un identificativo anonimo della scheda, cancellato alla sua chiusura.', 'Privacy', 'Ho capito'],
    ja: ['このサイトは Cookie を使用しません。ブラウザーには選択した言語とテーマ（ライト/ダーク）、タブを閉じると消える匿名のタブ識別子だけを保存します。', 'プライバシー', 'OK'],
    zh: ['本网站不使用 Cookie。只会在您的浏览器中保存所选语言和主题（浅色或深色），以及关闭标签页时即删除的匿名标签页标识符。', '隐私', '知道了']
  };
  function aviso() {
    if (robot || get('localStorage', 'ihtml-aviso-ok') || document.getElementById('ihtml-aviso')) return;
    var t = AVISO[norm(document.documentElement.lang) || 'en'];
    var priv = document.querySelector('.legal-links a[href*="priva"]');
    var css = document.createElement('style');
    css.textContent =
      '#ihtml-aviso{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:9999;box-sizing:border-box;width:calc(100% - 32px);max-width:620px;display:flex;align-items:center;gap:14px;padding:12px 14px 12px 18px;border-radius:16px;background:var(--island-bg,#1d1d1f);color:var(--island-ink,#f5f5f7);border:1px solid var(--island-line,transparent);-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);font:14px/1.45 Roboto,system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.25)}' +
      '#ihtml-aviso p{margin:0;flex:1}#ihtml-aviso a{color:var(--island-link,#ffb38a);text-decoration:underline}' +
      '#ihtml-aviso button{flex:none;border:0;border-radius:999px;padding:8px 16px;background:#f16529;color:#fff;font:600 14px Roboto,system-ui,sans-serif;cursor:pointer}' +
      '#ihtml-aviso button:focus-visible{outline:2px solid #fff;outline-offset:2px}' +
      '@media (max-width:520px){#ihtml-aviso{flex-direction:column;align-items:stretch;text-align:left}#ihtml-aviso button{width:100%}}';
    var box = document.createElement('div');
    box.id = 'ihtml-aviso';
    box.setAttribute('role', 'region');
    box.setAttribute('aria-label', t[1]);
    var p = document.createElement('p');
    p.textContent = t[0] + ' ';
    if (priv) {
      var a = document.createElement('a');
      a.href = priv.getAttribute('href');
      a.textContent = t[1];
      p.appendChild(a);
    }
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = t[2];
    b.addEventListener('click', function () {
      set('localStorage', 'ihtml-aviso-ok', '1');
      box.remove();
    });
    box.appendChild(p);
    box.appendChild(b);
    document.head.appendChild(css);
    document.body.appendChild(box);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', aviso);
  else aviso();

  if (robot) return;
  var here = norm(document.documentElement.lang) || 'en';
  var want = norm(get('localStorage', CHOICE)) || detect();
  if (want === here) return;

  var alt = document.querySelector('link[rel="alternate"][hreflang="' + want + '"]');
  if (!alt) return;
  var url;
  try {
    url = new URL(alt.getAttribute('href'), location.href);
  } catch (e) {
    return;
  }
  // Las paginas viejas apuntan a github.io/ihtml-web/: quedarse en este dominio.
  var p = url.pathname.replace(/^\/ihtml-web(\/|$)/, '/');
  if (p === location.pathname || (p === '/' && /\/index\.html$/.test(location.pathname) && location.pathname.split('/').length === 2)) return;
  // Sin bucles: si ya intentamos ir ahi en esta pestana y seguimos aca, parar.
  if (get('sessionStorage', 'ihtml-lang-redirected') === p) return;
  set('sessionStorage', 'ihtml-lang-redirected', p);
  location.replace(p + location.hash);
})();
