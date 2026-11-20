/* IHTML - idioma automatico.
   Va en el <head> de TODAS las paginas, despues de los <link rel="alternate"
   hreflang>. Si el visitante no eligio idioma a mano, lo lleva a la misma
   pagina en su idioma:
     1. idioma del dispositivo/navegador (navigator.languages), si es uno de
        los 8 de la web (catalan, gallego, euskera -> espanol);
     2. si no, la zona horaria del equipo (su ubicacion aproximada, sin pedir
        permisos ni mandar la IP a nadie);
     3. si no, ingles.
   Tambien muestra un aviso informativo de privacidad (8 idiomas) hasta que se cierra.
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

  // Elegir idioma a mano en el menu = preferencia guardada.
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('.lang-switch-menu a[lang]') : null;
    if (a) set('localStorage', CHOICE, a.getAttribute('lang'));
  });

  var robot = /bot|crawl|spider|slurp|lighthouse|headless/i.test(navigator.userAgent || '') || navigator.webdriver;

  // Aviso informativo de privacidad (no hay cookies: solo idioma en localStorage
  // y el id de pestana de la analitica en sessionStorage). Se cierra una vez.
  var AVISO = {
    es: ['Esta web no usa cookies. Solo guarda en tu navegador el idioma elegido y un identificador anónimo de la pestaña que se borra al cerrarla.', 'Privacidad', 'Entendido'],
    en: ['This website uses no cookies. It only saves your chosen language in your browser and an anonymous tab identifier that is deleted when you close the tab.', 'Privacy', 'Got it'],
    pt: ['Este site não usa cookies. Só guarda no seu navegador o idioma escolhido e um identificador anônimo da aba, apagado ao fechá-la.', 'Privacidade', 'Entendi'],
    fr: ["Ce site n'utilise pas de cookies. Il enregistre seulement dans votre navigateur la langue choisie et un identifiant d'onglet anonyme, effacé à sa fermeture.", 'Confidentialité', 'Compris'],
    de: ['Diese Website verwendet keine Cookies. Sie speichert in deinem Browser nur die gewählte Sprache und eine anonyme Tab-Kennung, die beim Schließen des Tabs gelöscht wird.', 'Datenschutz', 'Verstanden'],
    it: ['Questo sito non usa cookie. Salva nel tuo browser solo la lingua scelta e un identificativo anonimo della scheda, cancellato alla sua chiusura.', 'Privacy', 'Ho capito'],
    ja: ['このサイトは Cookie を使用しません。ブラウザーには選択した言語と、タブを閉じると消える匿名のタブ識別子だけを保存します。', 'プライバシー', 'OK'],
    zh: ['本网站不使用 Cookie。只会在您的浏览器中保存所选语言，以及关闭标签页时即删除的匿名标签页标识符。', '隐私', '知道了']
  };
  function aviso() {
    if (robot || get('localStorage', 'ihtml-aviso-ok') || document.getElementById('ihtml-aviso')) return;
    var t = AVISO[norm(document.documentElement.lang) || 'en'];
    var priv = document.querySelector('.legal-links a[href*="priva"]');
    var css = document.createElement('style');
    css.textContent =
      '#ihtml-aviso{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:9999;box-sizing:border-box;width:calc(100% - 32px);max-width:620px;display:flex;align-items:center;gap:14px;padding:12px 14px 12px 18px;border-radius:16px;background:#1d1d1f;color:#f5f5f7;font:14px/1.45 Roboto,system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.25)}' +
      '#ihtml-aviso p{margin:0;flex:1}#ihtml-aviso a{color:#ffb38a;text-decoration:underline}' +
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
