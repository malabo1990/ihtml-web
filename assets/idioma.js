/* IHTML - idioma automatico.
   Va en el <head> de TODAS las paginas, despues de los <link rel="alternate"
   hreflang>. Si el visitante no eligio idioma a mano, lo lleva a la misma
   pagina en su idioma:
     1. idioma del dispositivo/navegador (navigator.languages), si es uno de
        los 8 de la web (catalan, gallego, euskera -> espanol);
     2. si no, la zona horaria del equipo (su ubicacion aproximada, sin pedir
        permisos ni mandar la IP a nadie);
     3. si no, ingles.
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

  if (/bot|crawl|spider|slurp|lighthouse|headless/i.test(navigator.userAgent || '') || navigator.webdriver) return;
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
