/* ETERNIA · MODO DEMO
 * Solo se usa cuando config.js no tiene API_URL.
 * Simula el servidor guardando todo en ESTE navegador (localStorage), para que la página
 * y el "Panel demo" (admin-demo.html) compartan diseños, pedidos, logo y galería.
 * Nada sale de tu computadora. Cuando conectes la API real, este archivo deja de usarse.
 */
(function () {
  'use strict';
  var KEY = 'eternia_demo_v2';
  var STATUSES = ['Recibido', 'En proceso', 'Confirmado', 'Entregado', 'Cancelado'];

  function svgUri(svg) { return 'data:image/svg+xml,' + encodeURIComponent(svg); }
  function tote(bag, dot, bg, label, ink, ratio) {
    var hgt = Math.round(400 * ratio);
    return svgUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 ' + hgt + '">' +
      '<rect width="400" height="' + hgt + '" fill="' + bg + '"/>' +
      '<g transform="translate(110 ' + (hgt / 2 - 120) + ')">' +
      '<path d="M60 70V45a40 40 0 0 1 80 0v25" fill="none" stroke="' + bag + '" stroke-width="9"/>' +
      '<rect x="0" y="66" width="180" height="190" rx="8" fill="' + bag + '"/>' +
      '<circle cx="45" cy="115" r="14" fill="' + dot + '"/><circle cx="140" cy="215" r="18" fill="' + dot + '"/>' +
      '<text x="90" y="170" text-anchor="middle" font-family="sans-serif" font-size="22" font-weight="700" fill="' + ink + '">' + label + '</text></g></svg>');
  }
  function happy(bg, bag, skin) {
    return svgUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"><rect width="300" height="300" fill="' + bg + '"/>' +
      '<circle cx="150" cy="95" r="38" fill="' + skin + '"/><path d="M80 300c0-70 30-120 70-120s70 50 70 120z" fill="#1F2620"/>' +
      '<path d="M175 190v-18a22 22 0 0 1 44 0v18" fill="none" stroke="' + bag + '" stroke-width="7"/>' +
      '<rect x="160" y="186" width="74" height="84" rx="5" fill="' + bag + '"/><circle cx="182" cy="212" r="7" fill="#4C9141"/></svg>');
  }
  var LOGO = svgUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#4C9141"/>' +
    '<path d="M22 26v-5a10 10 0 0 1 20 0v5" fill="none" stroke="#fff" stroke-width="4"/><rect x="15" y="25" width="34" height="27" rx="3" fill="#fff"/>' +
    '<text x="32" y="45" text-anchor="middle" font-family="sans-serif" font-size="15" font-weight="700" fill="#4C9141">e</text></svg>');

  function seed() {
    var now = Date.now();
    var D = [
      ['D1', 'Flores de domingo', 'Florales', '#FFFFFF', '#E8A0B4', '#F4EFE6', 'flores', '#3F7D36', 1.25],
      ['D2', 'Hecho con calma', 'Frases', '#F4EFE6', '#4C9141', '#E4EEDF', 'con calma', '#1F2620', 1.0],
      ['D3', 'Siempre verde', 'Minimal', '#4C9141', '#F4EFE6', '#F4EFE6', 'siempre', '#FFFFFF', 1.4],
      ['D4', 'Mercado local', 'Frases', '#1F2620', '#E9C46A', '#F4EFE6', 'mercado', '#FFFFFF', 1.1],
      ['D5', 'Lunares suaves', 'Minimal', '#FFFFFF', '#1F2620', '#E4EEDF', '· · ·', '#1F2620', 1.3],
      ['D6', 'Café y libros', 'Frases', '#EADBC8', '#7A5230', '#F4EFE6', 'café', '#4A3220', 1.15],
      ['D7', 'Hoja de olivo', 'Florales', '#FFFFFF', '#4C9141', '#F4EFE6', 'olivo', '#3F7D36', 1.05],
      ['D8', 'Tu logo aquí', 'Personalizadas', '#F4EFE6', '#3F7D36', '#E4EEDF', 'TU LOGO', '#3F7D36', 1.25]
    ];
    return {
      logo: LOGO,
      designs: D.map(function (x, i) { return { id: x[0], title: x[1], category: x[2], img: tote(x[3], x[4], x[5], x[6], x[7], x[8]), visible: true, created: now - i * 1000 }; }),
      orders: [],
      gallery: [
        { id: 'G1', name: 'Mariana', text: 'La uso diario para el súper, ¡me encanta!', img: happy('#F4EFE6', '#FFFFFF', '#C99A78'), status: 'Aprobada', date: now - 86400000 * 3, mine: false },
        { id: 'G2', name: 'Sofía', text: 'Quedó perfecta con el logo de mi cafetería.', img: happy('#E4EEDF', '#F4EFE6', '#8D5B3E'), status: 'Aprobada', date: now - 86400000 * 6, mine: false },
        { id: 'G3', name: 'Daniela', text: 'Regalo perfecto para mis amigas.', img: happy('#F4EFE6', '#4C9141', '#E3B48F'), status: 'Aprobada', date: now - 86400000 * 9, mine: false }
      ],
      user: null,
      saved: []
    };
  }

  function load() {
    try { var v = JSON.parse(localStorage.getItem(KEY)); if (v && v.designs) return v; } catch (_) {}
    var s = seed(); save(s); return s;
  }
  function save(db) {
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch (_) { throw err('El demo se quedó sin espacio en este navegador. Borra algunas fotos de prueba.'); }
  }
  function err(msg, code) { var e = new Error(msg); e.code = code || ''; return e; }
  function later(fn) {
    return new Promise(function (res, rej) { setTimeout(function () { try { res(fn()); } catch (e) { rej(e); } }, 220); });
  }
  function needUser(db) { if (!db.user) throw err('Tu sesión terminó. Vuelve a entrar.', 'AUTH'); return db.user; }
  function pub(u) { return { name: u.name, email: u.email, photo: u.photo || '', contactType: u.contactType || '', contact: u.contact || '' }; }
  function findDesign(db, id) { return db.designs.filter(function (d) { return d.id === id && d.visible; })[0]; }

  function contactOf(type, value) {
    value = String(value || '').trim();
    if (type === 'whatsapp') {
      var d = value.replace(/\D/g, '');
      if (d.length < 10 || d.length > 15) throw err('Escribe tu WhatsApp a 10 dígitos');
      return { type: 'whatsapp', value: d };
    }
    if (type === 'instagram') {
      var h = value.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/.*$/, '');
      if (!/^[A-Za-z0-9._]{1,30}$/.test(h)) throw err('Escribe tu usuario de Instagram, ej. @eternia');
      return { type: 'instagram', value: '@' + h };
    }
    throw err('Elige WhatsApp o Instagram');
  }

  /* ----- API pública simulada (misma forma que la real) ----- */
  function api(action, p) {
    return later(function () {
      var db = load(), u;
      switch (action) {
        case 'catalog':
          return {
            logo: db.logo || '',
            designs: db.designs.filter(function (d) { return d.visible; }).sort(function (a, b) { return b.created - a.created; })
              .map(function (d) { return { id: d.id, t: d.title, c: d.category, img: d.img }; }),
            gallery: db.gallery.filter(function (g) { return g.status === 'Aprobada'; }).sort(function (a, b) { return b.date - a.date; })
              .map(function (g) { return { n: g.name, img: g.img, txt: g.text }; })
          };
        case 'login':
          if (!db.user) db.user = { name: 'Cliente Demo', email: 'demo@ejemplo.com', photo: '', contactType: '', contact: '' };
          save(db);
          return { token: 'd'.repeat(64), expires: Date.now() + 864e5, user: pub(db.user), saved: db.saved };
        case 'me': u = needUser(db); return { user: pub(u), saved: db.saved };
        case 'toggleSave':
          needUser(db);
          if (!findDesign(db, p.designId)) throw err('Ese diseño ya no está disponible');
          var i = db.saved.indexOf(p.designId);
          if (i >= 0) db.saved.splice(i, 1); else db.saved.push(p.designId);
          save(db); return { saved: db.saved };
        case 'updateContact':
          u = needUser(db); var c = contactOf(p.type, p.value);
          u.contactType = c.type; u.contact = c.value; save(db); return { user: pub(u) };
        case 'createOrder':
          u = needUser(db);
          if (!u.contact) throw err('Dinos cómo prefieres que te contactemos', 'CONTACT');
          if (p.hp) throw err('No pudimos enviar tu pedido');
          var id = 'P-DEMO-' + (db.orders.length + 1);
          db.orders.unshift({
            id: id, date: Date.now(), client: u.name, email: u.email, contactType: u.contactType, contact: u.contact, status: 'Recibido', mine: true,
            items: p.items.map(function (it) { var d = findDesign(db, it.designId); if (!d) throw err('Uno de los diseños ya no está disponible'); return { title: d.title, qty: it.qty, note: it.note, due: it.due }; })
          });
          save(db); return { orderId: id, date: Date.now() };
        case 'myOrders':
          needUser(db);
          return db.orders.filter(function (o) { return o.mine; }).map(function (o) {
            return { id: o.id, date: o.date, status: o.status, items: o.items.map(function (it) { return { title: it.title, qty: it.qty, note: it.note, due: it.due }; }) };
          });
        case 'updateProfile': u = needUser(db); u.name = String(p.name).slice(0, 60); save(db); return { user: pub(u) };
        case 'uploadAvatar': u = needUser(db); u.photo = 'data:image/jpeg;base64,' + p.data; save(db); return { user: pub(u) };
        case 'sharePhoto':
          u = needUser(db);
          if (!db.orders.some(function (o) { return o.mine; })) throw err('Podrás compartir tu foto después de tu primer pedido');
          db.gallery.unshift({ id: 'G' + Date.now(), name: u.name.split(' ')[0], text: String(p.text || '').slice(0, 200), img: 'data:image/jpeg;base64,' + p.data, status: 'Pendiente', date: Date.now(), mine: true });
          save(db); return { done: true };
        case 'logout': return { done: true };
        case 'deleteAccount':
          db.user = null; db.saved = [];
          db.gallery = db.gallery.filter(function (g) { return !g.mine; });
          db.orders.forEach(function (o) { if (o.mine) { o.mine = false; o.client = 'Cuenta eliminada'; o.email = ''; o.contact = ''; o.contactType = ''; } });
          save(db); return { done: true };
        default: throw err('Acción no válida');
      }
    });
  }

  /* ----- Panel admin simulado (mismas funciones que google.script.run) ----- */
  var ADMIN = {
    adminGetDashboard: function () {
      var db = load();
      return {
        designs: db.designs.slice().sort(function (a, b) { return b.created - a.created; }),
        orders: db.orders, logo: db.logo, statuses: STATUSES,
        gallery: db.gallery.slice().sort(function (a, b) { return b.date - a.date; })
      };
    },
    adminUploadDesign: function (x) {
      var db = load();
      if (!x || String(x.title).trim().length < 2) throw err('Escribe un título');
      if (String(x.category).trim().length < 2) throw err('Escribe una categoría');
      db.designs.push({ id: 'D' + Date.now(), title: String(x.title).trim().slice(0, 80), category: String(x.category).trim().slice(0, 40), img: 'data:image/jpeg;base64,' + x.data, visible: true, created: Date.now() });
      save(db); return ADMIN.adminGetDashboard();
    },
    adminUpdateDesign: function (x) {
      var db = load();
      db.designs.forEach(function (d) { if (d.id === x.id) { d.title = String(x.title).trim().slice(0, 80); d.category = String(x.category).trim().slice(0, 40); d.visible = x.visible === true; } });
      save(db); return ADMIN.adminGetDashboard();
    },
    adminDeleteDesign: function (id) {
      var db = load(); db.designs = db.designs.filter(function (d) { return d.id !== id; });
      save(db); return ADMIN.adminGetDashboard();
    },
    adminSetOrderStatus: function (id, status) {
      var db = load(); db.orders.forEach(function (o) { if (o.id === id) o.status = status; });
      save(db); return ADMIN.adminGetDashboard();
    },
    adminUploadLogo: function (data) {
      var db = load(); db.logo = 'data:image/png;base64,' + data;
      save(db); return ADMIN.adminGetDashboard();
    },
    adminSetGalleryStatus: function (x) {
      var db = load();
      if (x.action === 'Eliminar') db.gallery = db.gallery.filter(function (g) { return g.id !== x.id; });
      else db.gallery.forEach(function (g) { if (g.id === x.id) g.status = x.action; });
      save(db); return ADMIN.adminGetDashboard();
    }
  };

  function runner(ok, fail) {
    var r = {
      withSuccessHandler: function (f) { return runner(f, fail); },
      withFailureHandler: function (f) { return runner(ok, f); }
    };
    Object.keys(ADMIN).forEach(function (k) {
      r[k] = function () {
        var args = arguments;
        later(function () { return ADMIN[k].apply(null, args); })
          .then(function (v) { if (ok) ok(v); }, function (e) { if (fail) fail(e); });
      };
    });
    return r;
  }

  window.EterniaDemo = Object.freeze({
    api: api,
    reset: function () { try { localStorage.removeItem(KEY); } catch (_) {} },
    googleShim: { script: { run: runner(null, null) } }
  });
})();
