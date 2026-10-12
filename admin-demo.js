/* ETERNIA · Panel de administrador en MODO DEMO
 * Es el mismo panel real, pero usa datos guardados solo en este navegador (demo.js).
 * El panel real vive en tu enlace privado de Google Apps Script ("Solo yo").
 */
(function () {
  'use strict';
  var cfg = window.ETERNIA_CONFIG || {};
  if (cfg.API_URL) {
    document.body.textContent = 'La tienda ya está conectada. Tu panel real está en tu enlace privado de Google Apps Script.';
    throw new Error('demo desactivado');
  }
  window.google = window.EterniaDemo.googleShim;
})();
(function () {
  'use strict';
  var S = { data: null, view: 'designs', filter: 'Todos', galFilter: 'Pendiente', upData: null, editing: null };
  var $ = function (id) { return document.getElementById(id); };

  // Construye nodos con texto seguro (nunca innerHTML con datos)
  function h(tag, props) {
    var el = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (k === 'text') el.textContent = v;
      else if (k === 'class') el.className = v;
      else if (k.indexOf('on') === 0) el.addEventListener(k.slice(2), v);
      else if (v !== null && v !== undefined && v !== false) el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c === null || c === undefined || c === false) continue;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return el;
  }
  function img(src, alt) { var i = h('img', { src: src, alt: alt || '', loading: 'lazy' }); i.referrerPolicy = 'no-referrer'; return i; }
  function toast(msg) { var t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, 2600); }
  function fmt(ms, withTime) {
    var d = typeof ms === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(ms) ? new Date(ms + 'T12:00:00') : new Date(ms);
    if (isNaN(d)) return '—';
    var o = { day: 'numeric', month: 'short', year: 'numeric' };
    if (withTime) { o.hour = '2-digit'; o.minute = '2-digit'; }
    return d.toLocaleString('es-MX', o);
  }

  function call(fn, arg, done, btn) {
    if (btn) btn.disabled = true;
    google.script.run
      .withSuccessHandler(function (res) { if (btn) btn.disabled = false; S.data = res; render(); if (done) done(); })
      .withFailureHandler(function (err) { if (btn) btn.disabled = false; toast(err && err.message ? err.message : 'Error'); })[fn](arg);
  }
  function call2(fn, a, b) {
    google.script.run
      .withSuccessHandler(function (res) { S.data = res; render(); toast('Estatus actualizado'); })
      .withFailureHandler(function (err) { toast(err.message || 'Error'); })[fn](a, b);
  }

  // Reduce la imagen en el navegador antes de subirla
  function resize(file, maxPx, mime, cb) {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { toast('Solo JPG, PNG o WebP'); return; }
    if (file.size > 15 * 1024 * 1024) { toast('La imagen pesa demasiado'); return; }
    var fr = new FileReader();
    fr.onload = function () {
      var im = new Image();
      im.onload = function () {
        var s = Math.min(1, maxPx / Math.max(im.width, im.height));
        var c = document.createElement('canvas');
        c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
        var ctx = c.getContext('2d');
        if (mime === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
        ctx.drawImage(im, 0, 0, c.width, c.height);
        var url = c.toDataURL(mime, 0.86);
        cb(url.split(',')[1], url);
      };
      im.onerror = function () { toast('No pude leer la imagen'); };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  }

  function render() {
    var d = S.data; if (!d) return;
    // Logo
    var lb = $('logoBox'); lb.textContent = '';
    if (d.logo) lb.appendChild(img(d.logo, 'Logo')); else lb.textContent = 'LOGO';
    // Categorías sugeridas
    var cats = {}; d.designs.forEach(function (x) { cats[x.category] = 1; });
    var dl = $('catList'); dl.textContent = '';
    Object.keys(cats).sort().forEach(function (c) { dl.appendChild(h('option', { value: c })); });
    // Contadores
    $('designCount').textContent = d.designs.filter(function (x) { return x.visible; }).length + ' publicados · ' + d.designs.length + ' en total';
    var nuevos = d.orders.filter(function (o) { return o.status === 'Recibido'; }).length;
    $('newCount').hidden = !nuevos; $('newCount').textContent = nuevos;

    // Diseños
    var g = $('grid'); g.textContent = '';
    if (!d.designs.length) g.appendChild(h('div', { class: 'card empty', text: 'Aún no hay diseños. Sube el primero.' }));
    d.designs.forEach(function (x) {
      g.appendChild(h('div', { class: 'card d' },
        h('div', { class: 'ph' }, img(x.img, x.title)),
        !x.visible ? h('span', { class: 'tag-off', text: 'Oculto' }) : null,
        h('div', { class: 't', text: x.title }),
        h('div', { class: 'c', text: x.category }),
        h('button', { class: 'btn ghost', type: 'button', style: 'height:36px;font-size:13px', onclick: function () { openEdit(x); } }, 'Editar')
      ));
    });

    renderGallery();

    // Pedidos
    var chips = $('statusChips'); chips.textContent = '';
    ['Todos'].concat(d.statuses).forEach(function (s) {
      chips.appendChild(h('button', { class: 'chip' + (S.filter === s ? ' on' : ''), type: 'button', onclick: function () { S.filter = s; render(); } }, s));
    });
    var box = $('orders'); box.textContent = '';
    var list = d.orders.filter(function (o) { return S.filter === 'Todos' || o.status === S.filter; });
    if (!list.length) box.appendChild(h('div', { class: 'card empty', text: 'No hay pedidos en esta vista.' }));
    list.forEach(function (o) {
      var sel = h('select', { 'aria-label': 'Estatus del pedido ' + o.id, onchange: function (e) { call2('adminSetOrderStatus', o.id, e.target.value); } });
      d.statuses.forEach(function (s) { var op = h('option', { value: s, text: s }); if (s === o.status) op.selected = true; sel.appendChild(op); });
      var tb = h('tbody');
      o.items.forEach(function (it) {
        tb.appendChild(h('tr', null,
          h('td', { text: it.title }), h('td', { text: String(it.qty) }),
          h('td', { text: it.note || '—' }), h('td', { text: fmt(it.due) })));
      });
      var mail = o.email ? h('a', { href: 'mailto:' + encodeURIComponent(o.email).replace(/%40/g, '@'), text: o.email }) : h('span', { text: '—' });
      var contact = contactLink(o.contactType, o.contact);
      box.appendChild(h('div', { class: 'card order' },
        h('div', { class: 'order-h' },
          h('div', null, h('b', { text: o.id }), h('div', { class: 'muted' }, 'Pedido el ' + fmt(o.date, true))),
          sel),
        h('div', { style: 'display:flex;flex-wrap:wrap;gap:10px;align-items:center' }, h('b', { text: o.client }), h('span', { class: 'muted' }, mail), contact),
        h('div', { class: 'tbl' }, h('table', null,
          h('thead', null, h('tr', null, h('th', { text: 'Modelo' }), h('th', { text: 'Cant.' }), h('th', { text: 'Nota' }), h('th', { text: 'Lo necesita' }))),
          tb))
      ));
    });
  }

  function contactLink(type, value) {
    value = String(value || '');
    if (type === 'whatsapp' && /^\d{10,15}$/.test(value)) {
      var num = value.length === 10 ? '52' + value : value;
      return h('a', { class: 'contact', href: 'https://wa.me/' + num, target: '_blank', rel: 'noopener noreferrer' }, 'WhatsApp ' + value);
    }
    if (type === 'instagram' && /^@[A-Za-z0-9._]{1,30}$/.test(value)) {
      return h('a', { class: 'contact', href: 'https://instagram.com/' + value.slice(1), target: '_blank', rel: 'noopener noreferrer' }, 'Instagram ' + value);
    }
    return null;
  }

  function renderGallery() {
    var d = S.data, list = d.gallery || [];
    var pend = list.filter(function (g) { return g.status === 'Pendiente'; }).length;
    $('galCount').hidden = !pend; $('galCount').textContent = pend;
    var chips = $('galChips'); chips.textContent = '';
    ['Pendiente', 'Aprobada', 'Rechazada'].forEach(function (s) {
      var label = s === 'Pendiente' ? 'Por revisar' : s === 'Aprobada' ? 'Publicadas' : 'Rechazadas';
      chips.appendChild(h('button', { class: 'chip' + (S.galFilter === s ? ' on' : ''), type: 'button', onclick: function () { S.galFilter = s; render(); } }, label));
    });
    var g = $('galGrid'); g.textContent = '';
    var items = list.filter(function (x) { return x.status === S.galFilter; });
    if (!items.length) g.appendChild(h('div', { class: 'card empty', text: S.galFilter === 'Pendiente' ? 'No hay fotos por revisar.' : 'Nada por aquí.' }));
    items.forEach(function (x) {
      function act(a) { return function (e) { if (a === 'Eliminar' && !confirm('¿Eliminar esta foto?')) return; call('adminSetGalleryStatus', { id: x.id, action: a }, function () { toast(a === 'Aprobada' ? 'Foto publicada' : 'Listo'); }, e.target); }; }
      g.appendChild(h('div', { class: 'card g' },
        h('div', { class: 'ph' }, x.img ? img(x.img, 'Foto de ' + x.name) : null),
        h('span', { class: 'st ' + x.status, text: x.status }),
        h('div', { class: 't' }, h('b', { text: x.name }), h('span', { class: 'muted' }, ' · ' + fmt(x.date))),
        x.text ? h('div', { class: 'muted', text: '“' + x.text + '”' }) : null,
        h('div', { class: 'row2' },
          x.status !== 'Aprobada' && x.status !== 'Rechazada' ? h('button', { class: 'btn', type: 'button', onclick: act('Aprobada') }, 'Aprobar') : null,
          x.status === 'Pendiente' ? h('button', { class: 'btn ghost', type: 'button', onclick: act('Rechazada') }, 'Rechazar') : null,
          x.status !== 'Pendiente' ? h('button', { class: 'btn danger', type: 'button', onclick: act('Eliminar') }, 'Eliminar') : null)));
    });
  }

  function openEdit(x) {
    S.editing = x;
    $('edTitle').value = x.title; $('edCat').value = x.category; $('edVisible').checked = x.visible;
    $('editDlg').showModal();
  }

  // Eventos
  document.querySelectorAll('.nav').forEach(function (b) {
    b.addEventListener('click', function () {
      S.view = b.getAttribute('data-view');
      document.querySelectorAll('.nav').forEach(function (n) { n.classList.toggle('on', n === b); });
      $('vDesigns').hidden = S.view !== 'designs'; $('vOrders').hidden = S.view !== 'orders'; $('vGallery').hidden = S.view !== 'gallery';
    });
  });

  $('upFile').addEventListener('change', function (e) {
    var f = e.target.files[0]; if (!f) return;
    resize(f, 1400, 'image/jpeg', function (b64, url) {
      S.upData = b64;
      var t = $('dropTxt'); t.textContent = ''; t.appendChild(img(url, 'Vista previa'));
    });
  });

  $('upForm').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!S.upData) return toast('Elige una foto');
    var title = $('upTitle').value.trim(), cat = $('upCat').value.trim();
    if (title.length < 2) return toast('Escribe un título');
    if (cat.length < 2) return toast('Escribe una categoría');
    call('adminUploadDesign', { title: title, category: cat, data: S.upData }, function () {
      S.upData = null; $('upForm').reset();
      var t = $('dropTxt'); t.textContent = ''; t.appendChild(h('b', { text: 'Elige la foto' }));
      toast('Diseño publicado');
    }, $('upBtn'));
  });

  $('logoBtn').addEventListener('click', function () { $('logoFile').click(); });
  $('logoFile').addEventListener('change', function (e) {
    var f = e.target.files[0]; if (!f) return;
    resize(f, 600, 'image/png', function (b64) { call('adminUploadLogo', b64, function () { toast('Logo actualizado'); }); });
  });

  $('edSave').addEventListener('click', function () {
    var x = S.editing; if (!x) return;
    call('adminUpdateDesign', { id: x.id, title: $('edTitle').value, category: $('edCat').value, visible: $('edVisible').checked },
      function () { $('editDlg').close(); toast('Cambios guardados'); }, $('edSave'));
  });
  $('edDelete').addEventListener('click', function () {
    var x = S.editing; if (!x) return;
    if (!confirm('¿Eliminar "' + x.title + '"? No se puede deshacer.')) return;
    call('adminDeleteDesign', x.id, function () { $('editDlg').close(); toast('Diseño eliminado'); }, $('edDelete'));
  });

  google.script.run
    .withSuccessHandler(function (res) { S.data = res; render(); })
    .withFailureHandler(function (err) { toast(err.message || 'Error al cargar'); })
    .adminGetDashboard();
})();
