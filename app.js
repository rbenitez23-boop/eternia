/* ETERNIA · aplicación web (JavaScript nativo, sin dependencias)
 * Seguridad: todo el contenido dinámico se inserta como TEXTO (textContent),
 * nunca como HTML, para evitar inyección de código (XSS).
 */
(function () {
  'use strict';

  var CFG = window.ETERNIA_CONFIG || {};
  var DEMO = !CFG.API_URL;
  var MAX_QTY = 500, MAX_NOTE = 300, MAX_ITEMS = 20;

  /* ---------- almacenamiento local (solo comodidad: sesión y carrito) ---------- */
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('eternia_' + k); return v ? JSON.parse(v) : d; } catch (_) { return d; } },
    set: function (k, v) { try { localStorage.setItem('eternia_' + k, JSON.stringify(v)); } catch (_) {} },
    del: function (k) { try { localStorage.removeItem('eternia_' + k); } catch (_) {} }
  };

  var state = {
    catalog: null, logo: '', gallery: [], loading: false, cat: 'Todos', q: '',
    token: null, user: null, saved: new Set(),
    cart: sanitizeCart(store.get('cart', [])),
    orders: null, profileTab: 'saved', lastOrder: null,
    cartOpenedAt: 0, afterLogin: null, homeNode: null, homeScroll: 0, route: ''
  };

  (function restoreSession() {
    var s = store.get('session', null);
    if (s && /^[a-f0-9]{64}$/.test(s.token) && Number(s.expires) > Date.now()) {
      state.token = s.token; state.user = s.user || null;
    } else store.del('session');
  })();

  /* ---------- utilidades DOM ---------- */
  var app = document.getElementById('app');
  var tabbar = document.getElementById('tabbar');
  var sheetRoot = document.getElementById('sheet-root');

  function h(tag, props) {
    var el = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'text') el.textContent = v;
      else if (k === 'class') el.className = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : String(v));
    });
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(el, x); }); return; }
    el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }

  var ICONS = {
    home: [['path', { d: 'M4 11l8-7 8 7v9H4z' }]],
    heart: [['path', { d: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z' }]],
    bag: [['path', { d: 'M5 8h14l-1 12H6L5 8z' }], ['path', { d: 'M9 8V6a3 3 0 0 1 6 0v2' }]],
    user: [['circle', { cx: 12, cy: 8, r: 4 }], ['path', { d: 'M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6' }]],
    search: [['circle', { cx: 11, cy: 11, r: 7 }], ['path', { d: 'M20 20l-4-4' }]],
    back: [['path', { d: 'M15 5l-7 7 7 7' }]],
    check: [['path', { d: 'M5 12l5 5 9-10' }]],
    camera: [['path', { d: 'M4 8h3l2-3h6l2 3h3v11H4z' }], ['circle', { cx: 12, cy: 13, r: 3.5 }]],
    trash: [['path', { d: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13' }]]
  };
  function icon(name, opt) {
    opt = opt || {};
    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    var size = opt.size || 22;
    svg.setAttribute('width', size); svg.setAttribute('height', size);
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('fill', opt.fill || 'none'); svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', opt.sw || 1.8);
    svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
    ICONS[name].forEach(function (p) {
      var el = document.createElementNS(NS, p[0]);
      Object.keys(p[1]).forEach(function (k) { el.setAttribute(k, p[1][k]); });
      svg.appendChild(el);
    });
    return svg;
  }
  function img(src, alt, cls) {
    var i = h('img', { src: safeImg(src), alt: alt || '', loading: 'lazy', decoding: 'async', class: cls });
    i.referrerPolicy = 'no-referrer';
    return i;
  }
  /** Solo se aceptan imágenes de Google Drive/Fotos de perfil o generadas localmente */
  function safeImg(src) {
    src = String(src || '');
    if (/^https:\/\/(lh\d\.googleusercontent\.com|drive\.google\.com)\//.test(src)) return src;
    if (/^data:image\/(svg\+xml|jpeg|png|webp)[;,]/.test(src)) return src;
    return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 5"><rect width="4" height="5" fill="#F4EFE6"/></svg>');
  }

  var toastTimer;
  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2800);
  }

  /* ---------- fechas ---------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function isoDay(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function today() { return isoDay(new Date()); }
  function addDays(n) { var d = new Date(); d.setDate(d.getDate() + n); return isoDay(d); }
  function fmtDate(v) {
    var d = typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v + 'T12:00:00') : new Date(v);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function validDue(v) { return /^\d{4}-\d{2}-\d{2}$/.test(v) && v >= today() && v <= addDays(365); }
  function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

  /* ---------- API ---------- */
  function api(action, payload, method) {
    if (DEMO) {
      if (!window.EterniaDemo) return Promise.reject(new Error('Falta demo.js'));
      return window.EterniaDemo.api(action, payload || {}).catch(function (e) { if (e.code === 'AUTH') clearSession(); throw e; });
    }
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 25000) : null;
    var opts = { method: method || 'POST', redirect: 'follow', credentials: 'omit', cache: 'no-store', signal: ctrl ? ctrl.signal : undefined };
    var url = CFG.API_URL;
    if (method === 'GET') url += '?action=' + encodeURIComponent(action);
    else {
      var body = { action: action };
      if (state.token) body.token = state.token;
      Object.keys(payload || {}).forEach(function (k) { body[k] = payload[k]; });
      opts.headers = { 'Content-Type': 'text/plain;charset=utf-8' }; // evita preflight CORS
      opts.body = JSON.stringify(body);
    }
    return fetch(url, opts)
      .then(function (r) { return r.json(); })
      .catch(function () { throw new Error('Sin conexión. Revisa tu internet e intenta de nuevo.'); })
      .then(function (res) {
        if (timer) clearTimeout(timer);
        if (!res || !res.ok) {
          if (res && res.code === 'AUTH') clearSession();
          var err = new Error((res && res.error) || 'Ocurrió un error. Intenta de nuevo.');
          err.code = (res && res.code) || '';
          throw err;
        }
        return res.data;
      });
  }

  function loadCatalog() {
    if (state.loading) return;
    state.loading = true;
    api('catalog', null, 'GET').then(function (data) {
      state.catalog = Array.isArray(data.designs) ? data.designs : [];
      state.logo = data.logo || '';
      state.gallery = Array.isArray(data.gallery) ? data.gallery : [];
      state.homeNode = null;
      state.cart = state.cart.filter(function (it) { return !!findDesign(it.designId); });
      saveCart();
    }).catch(function (e) {
      state.catalog = state.catalog || [];
      toast(e.message);
    }).then(function () { state.loading = false; render(); });
  }
  function findDesign(id) {
    if (!state.catalog) return null;
    for (var i = 0; i < state.catalog.length; i++) if (state.catalog[i].id === id) return state.catalog[i];
    return null;
  }

  /* ---------- sesión ---------- */
  function setSession(res) {
    state.token = res.token; state.user = res.user;
    state.saved = new Set(res.saved || []);
    state.orders = null;
    store.set('session', { token: res.token, expires: res.expires, user: res.user });
  }
  function clearSession() {
    state.token = null; state.user = null; state.saved = new Set(); state.orders = null;
    store.del('session');
    try { window.google && google.accounts && google.accounts.id.disableAutoSelect(); } catch (_) {}
    syncHearts();
  }
  function loggedIn() { return !!(state.token && state.user); }
  function requireLogin(fn) { if (loggedIn()) fn(); else openLogin(fn); }

  function refreshMe() {
    if (!state.token) return;
    api('me').then(function (res) {
      state.user = res.user; state.saved = new Set(res.saved || []);
      var s = store.get('session', null); if (s) { s.user = res.user; store.set('session', s); }
      syncHearts(); if (state.route === 'perfil' || state.route === 'guardados') render();
    }).catch(function () {});
  }

  /* ---------- guardados ---------- */
  function toggleSave(id) {
    var had = state.saved.has(id);
    if (had) state.saved.delete(id); else state.saved.add(id);
    syncHearts();
    if (!had) toast('Guardado en tus favoritos');
    api('toggleSave', { designId: id }).then(function (res) {
      state.saved = new Set(res.saved || []); syncHearts();
    }).catch(function (e) {
      if (had) state.saved.add(id); else state.saved.delete(id);
      syncHearts(); toast(e.message);
    });
  }
  function heartBtn(id, big) {
    var on = state.saved.has(id);
    return h('button', {
      class: 'heart' + (big ? ' big' : ''), type: 'button', 'data-heart': id,
      'aria-pressed': on ? 'true' : 'false', 'aria-label': on ? 'Quitar de guardados' : 'Guardar diseño',
      onclick: function (e) { e.preventDefault(); requireLogin(function () { toggleSave(id); }); }
    }, icon('heart', { size: big ? 22 : 20, fill: on ? 'currentColor' : 'none' }));
  }
  function syncHearts() {
    var scope = [document];
    if (state.homeNode && !state.homeNode.isConnected) scope.push(state.homeNode);
    scope.forEach(function (root) {
      root.querySelectorAll('[data-heart]').forEach(function (b) {
        var on = state.saved.has(b.getAttribute('data-heart'));
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        b.setAttribute('aria-label', on ? 'Quitar de guardados' : 'Guardar diseño');
        var svg = b.querySelector('svg'); if (svg) svg.setAttribute('fill', on ? 'currentColor' : 'none');
      });
    });
  }

  /* ---------- carrito ---------- */
  function sanitizeCart(list) {
    if (!Array.isArray(list)) return [];
    return list.filter(function (it) {
      return it && typeof it.designId === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(it.designId);
    }).slice(0, MAX_ITEMS).map(function (it) {
      return {
        key: String(it.key || Math.random().toString(36).slice(2)),
        designId: it.designId,
        qty: Math.min(MAX_QTY, Math.max(1, parseInt(it.qty, 10) || 1)),
        note: String(it.note || '').slice(0, MAX_NOTE),
        due: /^\d{4}-\d{2}-\d{2}$/.test(it.due) ? it.due : addDays(14)
      };
    });
  }
  function saveCart() { store.set('cart', state.cart); syncBadges(); }
  function cartCount() { return state.cart.length; }
  function syncBadges() {
    document.querySelectorAll('[data-cart-badge]').forEach(function (b) {
      var n = cartCount(); b.textContent = n; b.hidden = !n;
    });
  }
  function addToCart(item) {
    var same = state.cart.filter(function (x) { return x.designId === item.designId && x.note === item.note && x.due === item.due; })[0];
    if (same) same.qty = Math.min(MAX_QTY, same.qty + item.qty);
    else {
      if (state.cart.length >= MAX_ITEMS) { toast('Tu pedido puede tener hasta ' + MAX_ITEMS + ' diseños'); return false; }
      item.key = Math.random().toString(36).slice(2) + Date.now().toString(36);
      state.cart.push(item);
    }
    saveCart(); return true;
  }

  /* ---------- componentes ---------- */
  function stepper(value, onChange, small) {
    var input = h('input', { type: 'number', inputmode: 'numeric', min: 1, max: MAX_QTY, value: value, 'aria-label': 'Cantidad' });
    function set(v) { v = Math.min(MAX_QTY, Math.max(1, parseInt(v, 10) || 1)); input.value = v; onChange(v); }
    input.addEventListener('change', function () { set(input.value); });
    return h('div', { class: 'stepper' + (small ? ' sm' : '') },
      h('button', { type: 'button', 'aria-label': 'Quitar uno', onclick: function () { set((parseInt(input.value, 10) || 1) - 1); } }, '−'),
      input,
      h('button', { type: 'button', 'aria-label': 'Agregar uno', onclick: function () { set((parseInt(input.value, 10) || 0) + 1); } }, '+'));
  }
  function backBtn() {
    return h('a', {
      class: 'icon-btn back', href: '#/', 'aria-label': 'Regresar',
      onclick: function (e) { if (state.hadNav) { e.preventDefault(); history.back(); } }
    }, icon('back', { size: 20, sw: 2 }));
  }
  function brand() {
    return h('a', { class: 'brand', href: '#/', 'aria-label': 'Eternia, inicio' },
      state.logo ? img(state.logo, '', 'brand-logo') : null,
      h('span', { class: 'brand-name', text: 'eternia' }));
  }
  function cartButton() {
    var n = cartCount();
    return h('a', { class: 'icon-btn', href: '#/pedido', 'aria-label': 'Mi pedido' },
      icon('bag'), h('span', { class: 'badge', 'data-cart-badge': '', hidden: !n, text: String(n) }));
  }
  function pin(d) {
    return h('div', { class: 'pin' },
      h('a', { class: 'pin-img', href: '#/d/' + encodeURIComponent(d.id), 'aria-label': d.t }, img(d.img, d.t)),
      h('div', { class: 'pin-row' },
        h('a', { class: 'pin-title', href: '#/d/' + encodeURIComponent(d.id), text: d.t }),
        heartBtn(d.id)));
  }
  function emptyState(title, text, action) {
    return h('div', { class: 'empty' }, h('h2', { text: title }), text ? h('p', { text: text, style: null }) : null, action || null);
  }

  /* ---------- galería de clientes ---------- */
  function galleryStrip() {
    return h('section', { class: 'gallery', 'aria-label': 'Fotos de clientes' },
      h('div', { class: 'gallery-head' }, h('h2', { text: 'Clientes Eternia' }), h('span', { text: 'Así lucen sus bolsas' })),
      h('div', { class: 'gallery-row' }, state.gallery.map(function (g) {
        return h('button', { class: 'gcard', type: 'button', 'aria-label': 'Foto de ' + g.n, onclick: function () { openStory(g); } },
          img(g.img, 'Foto de ' + g.n), h('span', { class: 'gname', text: g.n }));
      })));
  }
  function openStory(g) {
    showSheet([
      h('div', { class: 'grabber' }),
      img(g.img, 'Foto de ' + g.n, 'story-img'),
      h('h2', { text: g.n }),
      g.txt ? h('p', { text: '“' + g.txt + '”' }) : null,
      h('button', { class: 'btn soft block', type: 'button', onclick: closeSheet }, 'Cerrar')
    ]);
  }
  function openShare() {
    var data = null;
    var preview = h('div', { class: 'share-preview' }, icon('camera', { size: 28 }), h('span', { text: 'Elegir foto' }));
    var file = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', hidden: true, 'aria-label': 'Elegir foto' });
    var pick = h('button', { class: 'share-pick', type: 'button', onclick: function () { file.click(); } }, preview);
    file.addEventListener('change', function () {
      var f = file.files[0]; if (!f) return;
      if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { toast('Solo fotos JPG, PNG o WebP'); return; }
      resizeImage(f, 1200, function (b64) {
        data = b64; clear(preview); preview.appendChild(img('data:image/jpeg;base64,' + b64, 'Tu foto'));
      });
    });
    var text = h('textarea', { class: 'textarea', rows: 2, maxlength: 200, placeholder: '¿Qué te pareció tu bolsa? (opcional)', 'aria-label': 'Comentario' });
    var send = h('button', {
      class: 'btn block', type: 'button', onclick: function () {
        if (!data) { toast('Elige una foto'); return; }
        if (data.length > 2000000) { toast('La foto es demasiado pesada'); return; }
        send.disabled = true; send.textContent = 'Enviando…';
        api('sharePhoto', { data: data, text: text.value.trim().slice(0, 200) }).then(function () {
          closeSheet(); toast('¡Gracias! La revisaremos y pronto aparecerá en la galería');
        }).catch(function (e) { toast(e.message); send.disabled = false; send.textContent = 'Compartir foto'; });
      }
    }, 'Compartir foto');
    showSheet([
      h('div', { class: 'grabber' }),
      h('h2', { text: 'Comparte tu foto' }),
      h('p', { text: 'Muéstranos tu bolsa Eternia. Al aprobarla aparecerá en la galería con tu nombre de pila.' }),
      pick, file, text, send,
      h('button', { class: 'text-btn', type: 'button', onclick: closeSheet }, 'Ahora no')
    ]);
  }

  /* ---------- contacto ---------- */
  function contactLabel(u) {
    if (!u || !u.contact) return '';
    return (u.contactType === 'instagram' ? 'Instagram ' : 'WhatsApp ') + u.contact;
  }
  function openContact(after) {
    var type = (state.user && state.user.contactType) || 'whatsapp';
    var input = h('input', { class: 'input', autocomplete: 'off', maxlength: 40, 'aria-label': 'Tu contacto' });
    if (state.user && state.user.contact) input.value = state.user.contact;
    var seg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Medio de contacto' });
    function paint() {
      clear(seg);
      [['whatsapp', 'WhatsApp'], ['instagram', 'Instagram']].forEach(function (o) {
        seg.appendChild(h('button', {
          class: 'seg-btn' + (type === o[0] ? ' on' : ''), type: 'button', role: 'radio', 'aria-checked': type === o[0] ? 'true' : 'false',
          onclick: function () { if (type !== o[0]) { type = o[0]; input.value = ''; paint(); input.focus(); } }
        }, o[1]));
      });
      input.type = type === 'whatsapp' ? 'tel' : 'text';
      input.setAttribute('inputmode', type === 'whatsapp' ? 'tel' : 'text');
      input.placeholder = type === 'whatsapp' ? 'Tu número a 10 dígitos' : '@tu_usuario';
    }
    paint();
    var save = h('button', {
      class: 'btn block', type: 'button', onclick: function () {
        var v = input.value.trim();
        if (!v) { toast(type === 'whatsapp' ? 'Escribe tu número' : 'Escribe tu usuario'); input.focus(); return; }
        save.disabled = true;
        api('updateContact', { type: type, value: v }).then(function (res) {
          updateUser(res.user); closeSheet(); toast('¡Listo! Te contactaremos por ' + (type === 'whatsapp' ? 'WhatsApp' : 'Instagram'));
          if (after) after(); else render();
        }).catch(function (e) { toast(e.message); save.disabled = false; });
      }
    }, 'Guardar');
    showSheet([
      h('div', { class: 'grabber' }),
      h('h2', { text: '¿Cómo te contactamos?' }),
      h('p', { text: 'Te escribiremos por aquí para confirmar los detalles de tu pedido.' }),
      seg, input, save,
      h('button', { class: 'text-btn', type: 'button', onclick: closeSheet }, 'Ahora no')
    ]);
  }

  /* ---------- vistas ---------- */
  function viewHome() {
    if (state.homeNode && state.catalog) return state.homeNode;
    var gridBox = h('div');
    var chipsBox = h('div', { class: 'chips', role: 'toolbar', 'aria-label': 'Categorías' });

    function renderChips() {
      clear(chipsBox);
      var cats = ['Todos'];
      (state.catalog || []).forEach(function (d) { if (d.c && cats.indexOf(d.c) < 0) cats.push(d.c); });
      cats.forEach(function (c) {
        chipsBox.appendChild(h('button', {
          class: 'chip' + (state.cat === c ? ' on' : ''), type: 'button', 'aria-pressed': state.cat === c ? 'true' : 'false',
          onclick: function () { state.cat = c; renderChips(); renderGrid(); }
        }, c));
      });
    }
    function renderGrid() {
      clear(gridBox);
      if (!state.catalog) {
        var sk = h('div', { class: 'masonry' });
        [220, 170, 250, 190, 230, 180].forEach(function (px) { var s = h('div', { class: 'pin skeleton' }); s.style.height = px + 'px'; sk.appendChild(s); });
        gridBox.appendChild(sk); return;
      }
      var q = norm(state.q);
      var list = state.catalog.filter(function (d) {
        return (state.cat === 'Todos' || d.c === state.cat) && (!q || norm(d.t + ' ' + d.c).indexOf(q) >= 0);
      });
      if (!list.length) {
        gridBox.appendChild(state.catalog.length
          ? emptyState('Sin resultados', 'Prueba con otra palabra o categoría.')
          : emptyState('Muy pronto', 'Estamos preparando los primeros diseños.'));
        return;
      }
      if (state.cat === 'Todos' && !q && state.gallery.length) gridBox.appendChild(galleryStrip());
      var m = h('div', { class: 'masonry' });
      list.forEach(function (d) { m.appendChild(pin(d)); });
      gridBox.appendChild(m);
    }

    var search = h('input', { type: 'search', placeholder: 'Busca un diseño', 'aria-label': 'Buscar diseño', maxlength: 60, value: state.q, autocomplete: 'off' });
    var t;
    search.addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { state.q = search.value; renderGrid(); }, 150); });

    var node = h('div', null,
      DEMO ? h('div', { class: 'demo-flag' }, 'Modo demo: todo se guarda solo en este navegador. ',
        h('a', { href: 'admin-demo.html', text: 'Abrir panel de admin (demo)' })) : null,
      h('header', { class: 'top' }, brand(), cartButton()),
      h('label', { class: 'search' }, icon('search', { size: 20 }), search),
      chipsBox, gridBox);
    renderChips(); renderGrid();
    if (state.catalog) state.homeNode = node;
    return node;
  }

  function viewDetail(id) {
    if (!state.catalog) return h('div', { class: 'detail' }, h('div', { class: 'detail-media skeleton' }));
    var d = findDesign(id);
    if (!d) return h('div', null, h('header', { class: 'top' }, backBtn()),
      emptyState('Este diseño ya no está disponible', null, h('a', { class: 'btn soft', href: '#/', text: 'Ver todos los diseños' })));

    var qty = 1, due = addDays(14);
    var note = h('textarea', { class: 'textarea', rows: 3, maxlength: MAX_NOTE, placeholder: 'Ej. con el nombre de mi tienda, en color negro…', id: 'nota' });
    var counter = h('div', { class: 'counter', text: '0/' + MAX_NOTE });
    note.addEventListener('input', function () { counter.textContent = note.value.length + '/' + MAX_NOTE; });
    var date = h('input', { type: 'date', class: 'input', min: today(), max: addDays(365), value: due, id: 'fecha' });

    var addBtn = h('button', {
      class: 'btn block', type: 'button',
      onclick: function () {
        if (!validDue(date.value)) { toast('Elige una fecha a partir de hoy'); date.focus(); return; }
        var ok = addToCart({ designId: d.id, qty: qty, note: note.value.trim().slice(0, MAX_NOTE), due: date.value });
        if (ok) { toast('Agregado a tu pedido'); location.hash = '#/pedido'; }
      }
    }, 'Agregar a mi pedido');

    return h('div', { class: 'detail' },
      h('div', { class: 'detail-media' }, backBtn(), heartBtn(d.id, true), img(d.img, d.t)),
      h('div', { class: 'detail-body' },
        d.c ? h('span', { class: 'pill', text: d.c }) : null,
        h('h1', { class: 'title', text: d.t }),
        h('div', { class: 'qty-row' }, h('span', { class: 'field-label', text: 'Cantidad' }), stepper(qty, function (v) { qty = v; })),
        h('div', { class: 'field' }, h('label', { class: 'field-label', for: 'nota' }, 'Nota ', h('small', { text: '(opcional)' })), note, counter),
        h('div', { class: 'field' }, h('label', { class: 'field-label', for: 'fecha', text: '¿Para cuándo lo necesitas?' }), date)),
      h('div', { class: 'actionbar' }, h('div', { class: 'actionbar-inner' }, addBtn)));
  }

  function viewCart() {
    if (state.lastOrder) return viewSuccess();
    if (!state.cartOpenedAt) state.cartOpenedAt = Date.now();
    var head = h('div', { class: 'page-head' }, backBtn(), h('h1', { text: 'Mi pedido' }));

    if (!state.cart.length) {
      return h('div', { class: 'list' }, head,
        emptyState('Tu pedido está vacío', 'Explora los diseños y agrega los que te gusten.',
          h('a', { class: 'btn soft', href: '#/', text: 'Ver diseños' })));
    }

    var summary = h('div', { class: 'summary' });
    function updateSummary() {
      clear(summary);
      var pcs = state.cart.reduce(function (a, it) { return a + it.qty; }, 0);
      summary.appendChild(h('span', null, loggedIn() ? ['Enviar como ', h('b', { text: state.user.name })] : 'Sin pago ni tarjeta'));
      if (loggedIn()) {
        summary.appendChild(h('span', { class: 'summary-contact' },
          state.user.contact ? 'Te contactaremos por ' + contactLabel(state.user) + ' · ' : '',
          h('button', { class: 'text-btn', type: 'button', onclick: function () { openContact(render); } }, state.user.contact ? 'Cambiar' : 'Agregar WhatsApp o Instagram')));
      }
      summary.appendChild(h('span', { text: state.cart.length + (state.cart.length === 1 ? ' diseño · ' : ' diseños · ') + pcs + (pcs === 1 ? ' pieza' : ' piezas') }));
    }

    var items = state.cart.map(function (it) {
      var d = findDesign(it.designId) || { t: 'Diseño', img: '' };
      var note = h('textarea', { class: 'textarea', rows: 2, maxlength: MAX_NOTE, placeholder: 'Nota (opcional)', 'aria-label': 'Nota para ' + d.t });
      note.value = it.note;
      note.addEventListener('input', function () { it.note = note.value.slice(0, MAX_NOTE); saveCart(); });
      var date = h('input', { type: 'date', class: 'input', min: today(), max: addDays(365), value: it.due, 'aria-label': 'Fecha en que lo necesitas' });
      date.addEventListener('change', function () { it.due = date.value; saveCart(); });
      return h('div', { class: 'item' },
        h('a', { class: 'item-img', href: '#/d/' + encodeURIComponent(it.designId) }, img(d.img, d.t)),
        h('div', { class: 'item-body' },
          h('div', { class: 'item-top' },
            h('span', { class: 'item-title', text: d.t }),
            h('button', {
              class: 'icon-btn', type: 'button', 'aria-label': 'Quitar ' + d.t + ' del pedido',
              onclick: function () { state.cart = state.cart.filter(function (x) { return x.key !== it.key; }); saveCart(); render(); }
            }, icon('trash', { size: 18 }))),
          stepper(it.qty, function (v) { it.qty = v; saveCart(); updateSummary(); }, true),
          note,
          h('label', { class: 'item-meta' }, 'Lo necesito para:'), date));
    });

    var hp = h('input', { class: 'hp', type: 'text', name: 'website', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true' });
    var sendBtn = h('button', { class: 'btn block', type: 'button', onclick: function () { requireLogin(function () { sendOrder(sendBtn, hp); }); } }, 'Enviar pedido');
    updateSummary();

    return h('div', { class: 'list' }, head, items,
      h('a', { href: '#/', class: 'text-btn', text: '+ Agregar otro diseño' }), hp,
      h('div', { class: 'actionbar' }, h('div', { class: 'actionbar-inner' },
        summary, sendBtn,
        h('p', { class: 'fine' }, 'No se cobra nada. Te contactamos para confirmar los detalles. Al enviar aceptas nuestro ',
          h('a', { href: 'aviso-privacidad.html', text: 'Aviso de privacidad' }), '.'))));
  }

  function sendOrder(btn, hp) {
    if (!state.user.contact) { openContact(function () { render(); }); return; }
    for (var i = 0; i < state.cart.length; i++) {
      var it = state.cart[i];
      if (!findDesign(it.designId)) { toast('Un diseño ya no está disponible, quítalo para continuar'); return; }
      if (!validDue(it.due)) { toast('Revisa la fecha de "' + findDesign(it.designId).t + '"'); return; }
    }
    btn.disabled = true; btn.textContent = 'Enviando…';
    api('createOrder', {
      items: state.cart.map(function (x) { return { designId: x.designId, qty: x.qty, note: x.note, due: x.due }; }),
      hp: hp.value, elapsed: Date.now() - state.cartOpenedAt
    }).then(function (res) {
      state.lastOrder = res; state.cart = []; state.orders = null; state.cartOpenedAt = 0;
      saveCart(); render(); window.scrollTo(0, 0);
    }).catch(function (e) {
      btn.disabled = false; btn.textContent = 'Enviar pedido';
      if (e.code === 'CONTACT') openContact(function () { render(); }); else toast(e.message);
    });
  }

  function viewSuccess() {
    var o = state.lastOrder;
    return h('div', { class: 'success' },
      h('div', { class: 'success-ic' }, icon('check', { size: 40, sw: 2.2 })),
      h('h1', { text: '¡Pedido enviado!' }),
      h('p', { text: 'Recibimos tu solicitud el ' + fmtDate(o.date) + ' con el folio ' + o.orderId + '. Te contactaremos pronto para confirmar tu pedido.' }),
      h('a', { class: 'btn soft', href: '#/perfil/pedidos', text: 'Ver mis pedidos' }),
      h('a', { class: 'text-btn', href: '#/', text: 'Seguir viendo diseños' }));
  }

  function viewProfile(tab) {
    if (tab) state.profileTab = tab;
    if (!loggedIn()) {
      return h('div', { class: 'welcome' },
        h('div', { class: 'success-ic' }, icon('heart', { size: 36 })),
        h('h1', { text: 'Tu espacio en Eternia' }),
        h('p', { text: 'Guarda tus diseños favoritos y sigue tus pedidos en un solo lugar.' }),
        h('button', { class: 'btn', type: 'button', onclick: function () { openLogin(render); } }, 'Entrar'),
        h('a', { class: 'text-btn', href: 'aviso-privacidad.html', text: 'Aviso de privacidad' }));
    }
    var u = state.user;
    var initials = String(u.name || '?').split(/\s+/).map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
    var file = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', hidden: true, 'aria-label': 'Subir foto de perfil' });
    file.addEventListener('change', function () { if (file.files[0]) uploadAvatar(file.files[0]); file.value = ''; });

    var nameBox = h('div', { class: 'me-name', text: u.name });
    var editBtn = h('button', { class: 'text-btn', type: 'button', onclick: function () { editName(nameBox, editBtn); } }, 'Editar nombre');

    var content = h('div');
    var tabs = h('div', { class: 'tabs', role: 'tablist' },
      h('button', { class: 'tab' + (state.profileTab === 'saved' ? ' on' : ''), type: 'button', role: 'tab', 'aria-selected': state.profileTab === 'saved' ? 'true' : 'false', onclick: function () { location.hash = '#/guardados'; } }, 'Guardados (' + state.saved.size + ')'),
      h('button', { class: 'tab' + (state.profileTab === 'orders' ? ' on' : ''), type: 'button', role: 'tab', 'aria-selected': state.profileTab === 'orders' ? 'true' : 'false', onclick: function () { location.hash = '#/perfil/pedidos'; } }, 'Mis pedidos'));

    if (state.profileTab === 'saved') {
      var list = (state.catalog || []).filter(function (d) { return state.saved.has(d.id); });
      if (!state.catalog) content.appendChild(h('div', { class: 'skeleton', text: '' }));
      else if (!list.length) content.appendChild(emptyState('Aún no guardas diseños', 'Toca el corazón en los diseños que te gusten.', h('a', { class: 'btn soft', href: '#/', text: 'Ver diseños' })));
      else { var m = h('div', { class: 'masonry' }); list.forEach(function (d) { m.appendChild(pin(d)); }); content.appendChild(m); }
    } else {
      if (!state.orders) {
        content.appendChild(h('div', { class: 'order-card skeleton', text: 'Cargando tus pedidos…' }));
        if (!state.ordersLoading) {
          state.ordersLoading = true;
          api('myOrders').then(function (res) { state.orders = res || []; })
            .catch(function (e) { toast(e.message); state.orders = []; })
            .then(function () { state.ordersLoading = false; if (state.route === 'perfil') render(); });
        }
      } else if (!state.orders.length) {
        content.appendChild(emptyState('Aún no tienes pedidos', 'Cuando envíes uno, aquí verás su estatus.'));
      } else {
        var wrap = h('div', { class: 'list' });
        wrap.appendChild(h('div', { class: 'share-card' },
          h('div', null, h('b', { text: '¿Ya tienes tu bolsa?' }), h('p', { text: 'Comparte una foto y aparece en la galería de clientes.' })),
          h('button', { class: 'btn small', type: 'button', onclick: openShare }, 'Compartir foto')));
        state.orders.forEach(function (o) {
          wrap.appendChild(h('div', { class: 'order-card' },
            h('div', { class: 'order-top' }, h('b', { text: 'Pedido ' + o.id }), h('span', { class: 'status ' + o.status, text: o.status })),
            h('ul', { class: 'order-lines' }, o.items.map(function (it) {
              return h('li', { text: it.title + ' × ' + it.qty + (it.note ? ' — ' + it.note : '') });
            })),
            h('div', { class: 'order-foot' },
              h('span', { text: 'Pedido: ' + fmtDate(o.date) }),
              h('span', { text: 'Entrega: ' + fmtDate(o.items[0] && o.items[0].due) }))));
        });
        content.appendChild(wrap);
      }
    }

    return h('div', { class: 'profile' },
      h('div', { class: 'me' },
        h('div', { class: 'avatar-wrap' },
          u.photo ? img(u.photo, 'Tu foto de perfil', 'avatar') : h('div', { class: 'avatar', 'aria-hidden': 'true', text: initials }),
          h('button', { class: 'cam', type: 'button', 'aria-label': 'Cambiar foto de perfil', onclick: function () { file.click(); } }, icon('camera', { size: 16, sw: 2 })),
          file),
        nameBox,
        h('div', { class: 'me-mail', text: u.email }),
        h('div', { class: 'me-contact' },
          u.contact ? h('span', { text: contactLabel(u) }) : null,
          h('button', { class: 'text-btn', type: 'button', onclick: function () { openContact(render); } }, u.contact ? 'Cambiar contacto' : 'Agrega tu WhatsApp o Instagram')),
        editBtn),
      tabs, content,
      h('div', { class: 'links' },
        h('a', { class: 'text-btn', href: 'aviso-privacidad.html', text: 'Aviso de privacidad' }),
        h('button', { class: 'text-btn', type: 'button', onclick: logout }, 'Cerrar sesión'),
        h('button', { class: 'text-btn danger', type: 'button', onclick: confirmDelete }, 'Eliminar mi cuenta')));
  }

  function editName(box, btn) {
    var input = h('input', { class: 'input', type: 'text', maxlength: 60, value: state.user.name, 'aria-label': 'Tu nombre' });
    var save = h('button', {
      class: 'btn small', type: 'button', onclick: function () {
        var v = input.value.trim();
        if (v.length < 2) { toast('Escribe tu nombre'); return; }
        save.disabled = true;
        api('updateProfile', { name: v }).then(function (res) { updateUser(res.user); toast('Nombre actualizado'); render(); })
          .catch(function (e) { toast(e.message); save.disabled = false; });
      }
    }, 'Guardar');
    var row = h('div', { class: 'name-edit' }, input, save);
    box.replaceWith(row); btn.hidden = true; input.focus();
  }
  function updateUser(u) {
    state.user = u;
    var s = store.get('session', null); if (s) { s.user = u; store.set('session', s); }
  }

  function uploadAvatar(f) {
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { toast('Solo fotos JPG, PNG o WebP'); return; }
    if (f.size > 15 * 1024 * 1024) { toast('La foto es demasiado pesada'); return; }
    resizeImage(f, 400, function (b64) {
      if (b64.length > 1400000) { toast('La foto es demasiado pesada'); return; }
      toast('Subiendo foto…');
      api('uploadAvatar', { data: b64 }).then(function (res) { updateUser(res.user); toast('Foto actualizada'); render(); })
        .catch(function (e) { toast(e.message); });
    });
  }
  function resizeImage(file, maxPx, cb) {
    var url = URL.createObjectURL(file);
    var im = new Image();
    im.onload = function () {
      var s = Math.min(1, maxPx / Math.max(im.width, im.height));
      var c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(im.width * s)); c.height = Math.max(1, Math.round(im.height * s));
      var ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      cb(c.toDataURL('image/jpeg', 0.85).split(',')[1]);
    };
    im.onerror = function () { URL.revokeObjectURL(url); toast('No pudimos leer la imagen'); };
    im.src = url;
  }

  function logout() {
    var t = state.token;
    clearSession();
    if (t) { state.token = t; api('logout').catch(function () {}); state.token = null; }
    toast('Cerraste sesión'); location.hash = '#/';
  }
  function confirmDelete() {
    var del = h('button', {
      class: 'btn', type: 'button', onclick: function () {
        del.disabled = true;
        api('deleteAccount').then(function () { closeSheet(); clearSession(); toast('Tu cuenta fue eliminada'); location.hash = '#/'; })
          .catch(function (e) { toast(e.message); del.disabled = false; });
      }
    }, 'Sí, eliminar');
    showSheet([
      h('div', { class: 'grabber' }),
      h('h2', { text: '¿Eliminar tu cuenta?' }),
      h('p', { text: 'Borraremos tu perfil, tu foto y tus guardados. Tus pedidos anteriores se conservan sin tus datos personales.' }),
      h('div', { class: 'sheet-actions' }, h('button', { class: 'btn soft', type: 'button', onclick: closeSheet }, 'Cancelar'), del)
    ]);
  }

  /* ---------- hoja inferior y login ---------- */
  var lastFocus = null;
  function showSheet(children) {
    closeSheet();
    lastFocus = document.activeElement;
    var sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' }, children);
    var ov = h('div', { class: 'overlay', onclick: function (e) { if (e.target === ov) closeSheet(); } }, sheet);
    ov.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); });
    sheetRoot.appendChild(ov);
    var f = sheet.querySelector('button, a, input'); if (f) f.focus();
  }
  function closeSheet() {
    clear(sheetRoot);
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (_) {} }
    lastFocus = null;
  }

  var gisReady = false;
  function openLogin(after) {
    state.afterLogin = after || null;
    var gbox = h('div', { class: 'gbtn', id: 'gbtn' });
    var children = [
      h('div', { class: 'grabber' }),
      state.logo ? img(state.logo, '', 'brand-logo') : null,
      h('h2', { text: 'Entra para guardar y pedir' }),
      h('p', { text: 'Usa tu cuenta de Google. Sin contraseñas, en un clic.' }),
      gbox,
      h('p', { class: 'fine' }, 'Al continuar aceptas nuestro ', h('a', { href: 'aviso-privacidad.html', text: 'Aviso de privacidad' }), '.'),
      h('button', { class: 'text-btn', type: 'button', onclick: closeSheet }, 'Ahora no')
    ];
    showSheet(children);

    if (DEMO) {
      gbox.appendChild(h('button', { class: 'btn', type: 'button', onclick: function () { onCredential({ credential: 'demo' }); } }, 'Entrar (modo demo)'));
      return;
    }
    if (!CFG.GOOGLE_CLIENT_ID) { gbox.appendChild(h('p', { text: 'El inicio de sesión aún no está configurado.' })); return; }
    gbox.appendChild(h('p', { class: 'fine', text: 'Cargando…' }));
    waitForGoogle(function (ok) {
      clear(gbox);
      if (!ok) { gbox.appendChild(h('p', { text: 'No pudimos cargar el botón de Google. Revisa tu conexión.' })); return; }
      if (!gisReady) {
        google.accounts.id.initialize({ client_id: CFG.GOOGLE_CLIENT_ID, callback: onCredential, auto_select: false, cancel_on_tap_outside: true, ux_mode: 'popup', itp_support: true });
        gisReady = true;
      }
      google.accounts.id.renderButton(gbox, { type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', shape: 'pill', locale: 'es', width: 300 });
    });
  }
  function waitForGoogle(cb) {
    var tries = 0;
    (function check() {
      if (window.google && google.accounts && google.accounts.id) return cb(true);
      if (++tries > 40) return cb(false);
      setTimeout(check, 200);
    })();
  }
  function onCredential(resp) {
    if (!resp || !resp.credential) { toast('No se pudo iniciar sesión'); return; }
    api('login', { credential: resp.credential }).then(function (res) {
      setSession(res); closeSheet(); syncHearts();
      toast('¡Hola, ' + String(res.user.name || '').split(' ')[0] + '!');
      var fn = state.afterLogin; state.afterLogin = null;
      if (fn) fn(); else render();
    }).catch(function (e) { toast(e.message); });
  }

  /* ---------- barra inferior ---------- */
  function renderTabbar(active, show) {
    tabbar.hidden = !show;
    if (!show) return;
    clear(tabbar);
    var n = cartCount();
    var items = [
      ['home', '#/', 'Inicio', 'home'], ['heart', '#/guardados', 'Guardados', 'guardados'],
      ['bag', '#/pedido', 'Mi pedido', 'pedido'], ['user', '#/perfil', 'Perfil', 'perfil']
    ];
    tabbar.appendChild(h('div', { class: 'tabbar-inner' }, items.map(function (it) {
      var on = active === it[3];
      return h('a', { href: it[1], class: on ? 'on' : null, 'aria-current': on ? 'page' : null },
        icon(it[0]), it[2],
        it[3] === 'pedido' ? h('span', { class: 'badge', 'data-cart-badge': '', hidden: !n, text: String(n) }) : null);
    })));
  }

  /* ---------- enrutador ---------- */
  function parseRoute() {
    var parts = location.hash.replace(/^#\/?/, '').split('/');
    var r = parts[0] || '', arg = parts[1] || '';
    if (r === 'd' && /^[A-Za-z0-9_-]{1,40}$/.test(decodeURIComponent(arg))) return { name: 'detail', arg: decodeURIComponent(arg) };
    if (r === 'pedido') return { name: 'pedido' };
    if (r === 'guardados') return { name: 'guardados' };
    if (r === 'perfil') return { name: 'perfil', arg: arg === 'pedidos' ? 'orders' : '' };
    return { name: '' };
  }

  function render() {
    var r = parseRoute();
    if (state.route === '' && r.name !== '' && app.firstChild) state.homeScroll = window.scrollY;
    if (r.name !== 'pedido' && state.lastOrder) state.lastOrder = null;
    if (r.name !== 'pedido') state.cartOpenedAt = 0;
    var prev = state.route;
    state.route = r.name === 'guardados' ? 'perfil' : r.name;

    var view;
    if (r.name === 'detail') view = viewDetail(r.arg);
    else if (r.name === 'pedido') view = viewCart();
    else if (r.name === 'guardados') view = viewProfile('saved');
    else if (r.name === 'perfil') view = viewProfile(r.arg || state.profileTab);
    else view = viewHome();

    clear(app); app.appendChild(view);
    var noNav = r.name === 'detail' || r.name === 'pedido';
    app.classList.toggle('no-nav', noNav);
    renderTabbar(r.name === 'guardados' ? 'guardados' : (r.name === 'perfil' ? 'perfil' : r.name === '' ? 'home' : r.name), !noNav);
    syncHearts(); syncBadges();

    document.title = r.name === 'detail' && findDesign(r.arg) ? findDesign(r.arg).t + ' · Eternia' : 'Eternia · Tote bags';
    if (r.name === '' && prev !== '') window.scrollTo(0, state.homeScroll || 0);
    else if (prev !== state.route || r.name === 'detail') window.scrollTo(0, 0);
  }

  window.addEventListener('hashchange', function () { state.hadNav = true; render(); });

  /* ---------- arranque ---------- */
  render();
  loadCatalog();
  refreshMe();
})();
