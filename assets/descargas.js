/* IHTML — lista de descargas.
 *
 * Una sola fuente para dibujar la lista: la usa scripts/build-descargas.mjs
 * (HTML estático que ya viene en la página, funciona sin JS) y el navegador
 * (si hay una versión más nueva que la del HTML, vuelve a dibujar la lista).
 *
 * Los botones bajan el archivo directo (browser_download_url); la página
 * nunca manda al visitante a la web de GitHub. */
(function (root) {
  'use strict';

  // <App>_<version>_<plataforma>.<ext>  ->  { mirror, plat, ext }
  function infoDe(nombre) {
    var m = /^(IHTML(?:-Mirror)?)_[^_]+_([a-z-]+)\.(exe|msi|dmg|appimage|deb|rpm|apk)$/i.exec(nombre);
    if (!m) return null;
    var p = m[2].toLowerCase();
    var plat =
      p.indexOf('windows') === 0 ? 'windows'
      : p.indexOf('macos') === 0 ? 'macos'
      : p.indexOf('linux') === 0 ? 'linux'
      : p.indexOf('android') === 0 ? 'android'
      : null;
    return plat ? { mirror: /mirror/i.test(m[1]), plat: plat, ext: m[3].toLowerCase() } : null;
  }

  var PLATS = ['windows', 'macos', 'linux', 'android'];
  var PLAT_NOMBRE = { windows: 'Windows', macos: 'macOS', linux: 'Linux', android: 'Android' };
  var EXT_NOMBRE = { exe: '.exe', msi: '.msi', dmg: '.dmg', appimage: 'AppImage', deb: '.deb', rpm: '.rpm', apk: '.apk' };
  var ORDEN = { exe: 0, msi: 1, dmg: 0, appimage: 0, deb: 1, rpm: 2, apk: 0 };

  // Solo lo que hace falta de la API (también es lo que va incrustado).
  function normalizar(releases) {
    return (releases || [])
      .filter(function (r) {
        return r && !r.draft && r.tag_name;
      })
      .map(function (r) {
        return {
          tag: r.tag_name,
          fecha: (r.published_at || r.created_at || '').slice(0, 10),
          pre: !!r.prerelease,
          assets: (r.assets || [])
            .map(function (a) {
              var i = infoDe(a.name);
              return i ? { app: i.mirror ? 'mirror' : 'editor', plat: i.plat, ext: i.ext, name: a.name, size: a.size, url: a.browser_download_url } : null;
            })
            .filter(Boolean)
        };
      })
      .filter(function (r) {
        return r.assets.length;
      });
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function tam(bytes, T) {
    if (!bytes) return '';
    var mb = bytes / 1048576;
    return (mb >= 10 ? Math.round(mb) : mb.toFixed(1)).toString().replace('.', T.decimal || '.') + ' MB';
  }

  function fecha(iso, T) {
    if (!iso) return '';
    try {
      return new Date(iso + 'T12:00:00Z').toLocaleDateString(T.locale, { year: 'numeric', month: 'long', day: 'numeric' });
    } catch (e) {
      return iso;
    }
  }

  function filas(rel, app) {
    return rel.assets
      .filter(function (a) {
        return a.app === app;
      })
      .sort(function (a, b) {
        return PLATS.indexOf(a.plat) - PLATS.indexOf(b.plat) || ORDEN[a.ext] - ORDEN[b.ext];
      });
  }

  function tablaApp(rel, app, T, compacta) {
    var lista = filas(rel, app);
    if (!lista.length) return '';
    var h = '';
    if (!compacta) {
      h +=
        '<div class="dl-app" id="' + app + '"><div class="dl-app-cab"><h2>' + esc(T[app + 'Nombre']) + '</h2><p>' + esc(T[app + 'Desc']) + '</p></div>';
    } else {
      h += '<h3>' + esc(T[app + 'Nombre']) + '</h3>';
    }
    h += '<div class="tabla-wrap dl-tabla"><table><thead><tr><th scope="col">' + esc(T.colSistema) + '</th><th scope="col">' + esc(T.colFormato) +
      '</th><th scope="col" class="dl-col-tam">' + esc(T.colTam) + '</th><th scope="col"><span class="sr-only">' + esc(T.descargar) + '</span></th></tr></thead><tbody>';
    lista.forEach(function (a) {
      h +=
        '<tr data-plat="' + a.plat + '"><td><b>' + PLAT_NOMBRE[a.plat] + '</b>' +
        (a.ver ? ' <small class="dl-ver">' + esc(a.ver.replace(/^v/, '')) + '</small>' : '') + '</td><td><span class="dl-ext">' + EXT_NOMBRE[a.ext] +
        '</span> <span class="dl-uso">' + esc(T.fmt[a.ext] || '') + '</span></td><td class="dl-col-tam">' + tam(a.size, T) +
        '</td><td class="dl-col-btn"><a class="btn" href="' + esc(a.url) + '" download aria-label="' + esc(T.descargar + ' — ' + T[app + 'Nombre'] + ' ' + PLAT_NOMBRE[a.plat] + ' ' + EXT_NOMBRE[a.ext]) +
        '">' + esc(T.descargar) + '</a></td></tr>';
    });
    h += '</tbody></table></div>';
    if (!compacta) h += '</div>';
    return h;
  }

  function render(releases, T) {
    var rels = normalizar(releases);
    if (!rels.length) return '<p class="dl-vacio">' + esc(T.vacio) + '</p>';
    var estables = rels.filter(function (r) {
      return !r.pre;
    });
    var ult = estables[0] || rels[0];
    // Una plataforma que todavia no esta en la ultima version (p. ej. macOS
    // se compila aparte): se ofrece la mas reciente que la tenga, con su
    // numero de version al lado, en vez de dejar ese sistema sin descarga.
    var extra = [];
    ['editor', 'mirror'].forEach(function (app) {
      PLATS.forEach(function (plat) {
        var tiene = function (r) {
          return r.assets.some(function (a) {
            return a.app === app && a.plat === plat;
          });
        };
        if (tiene(ult)) return;
        var prev = (estables.length ? estables : rels).filter(function (r) {
          return r !== ult && tiene(r);
        })[0];
        if (!prev) return;
        prev.assets.forEach(function (a) {
          if (a.app === app && a.plat === plat) extra.push(Object.assign({}, a, { ver: prev.tag }));
        });
      });
    });
    if (extra.length) ult = Object.assign({}, ult, { assets: ult.assets.concat(extra), orig: ult });
    var h =
      '<p class="dl-version"><b>' + esc(T.ultima) + ' ' + esc(ult.tag.replace(/^v/, '')) + '</b> · ' + esc(T.publicada) + ' ' + esc(fecha(ult.fecha, T)) + '</p>';
    h += tablaApp(ult, 'editor', T) + tablaApp(ult, 'mirror', T);
    var viejas = rels.filter(function (r) {
      return r !== ult && r !== ult.orig;
    });
    if (viejas.length) {
      h += '<div class="dl-anteriores"><h2>' + esc(T.anteriores) + '</h2>';
      viejas.forEach(function (r) {
        h += '<details class="dl-vieja"><summary>' + esc(r.tag.replace(/^v/, '')) + ' <small>' + esc(fecha(r.fecha, T)) + '</small></summary>' +
          tablaApp(r, 'editor', T, true) + tablaApp(r, 'mirror', T, true) + '</details>';
      });
      h += '</div>';
    }
    return h;
  }

  function osActual(ua) {
    if (/Android/i.test(ua)) return 'android';
    if (/iPhone|iPad|iPod/i.test(ua)) return null;
    if (/Mac OS X|Macintosh/i.test(ua)) return 'macos';
    if (/Windows/i.test(ua)) return 'windows';
    if (/Linux|X11|CrOS/i.test(ua)) return 'linux';
    return null;
  }

  var api = { infoDe: infoDe, normalizar: normalizar, render: render, osActual: osActual };
  root.IHTMLDescargas = api;

  // ---- Navegador: marca tu sistema y busca una versión más nueva ----
  if (typeof document === 'undefined' || !document.getElementById) return;
  var cont = document.getElementById('dlLista');
  var T = root.IHTML_DL_T;
  if (!cont || !T) return;

  function marcarTuyo() {
    var os = osActual(navigator.userAgent || '');
    if (!os) return;
    cont.querySelectorAll('.dl-app tr[data-plat="' + os + '"]').forEach(function (tr) {
      tr.classList.add('es-tuyo');
      var td = tr.querySelector('td');
      if (td && !td.querySelector('.dl-tuyo')) td.insertAdjacentHTML('beforeend', ' <span class="dl-tuyo">' + esc(T.tuSistema) + '</span>');
    });
  }
  marcarTuyo();

  var tagHtml = cont.getAttribute('data-tag') || '';
  fetch('https://api.github.com/repos/malabo1990/ihtml-releases/releases?per_page=20', {
    headers: { accept: 'application/vnd.github+json' }
  })
    .then(function (r) {
      return r.ok ? r.json() : Promise.reject(r.status);
    })
    .then(function (data) {
      var rels = normalizar(data);
      if (!rels.length || rels[0].tag === tagHtml) return;
      cont.innerHTML = render(data, T);
      cont.setAttribute('data-tag', rels[0].tag);
      marcarTuyo();
    })
    .catch(function () {
      /* sin red o límite de la API: se queda la lista incrustada */
    });
})(typeof window !== 'undefined' ? window : globalThis);
