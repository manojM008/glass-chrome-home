/* Glass Home — modern new tab */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const isExt = typeof chrome !== 'undefined' && !!(chrome.bookmarks && chrome.storage);
  const DAY = 864e5;

  /* ================= Settings & storage ================= */
  const DEFAULTS = {
    font: 'modern',      // clock style: modern | elegant | tech
    clock24: false,
    cat: 'space',        // wallpaper theme id, 'mix' or 'custom'
    rotate: 'never',     // never | tab | hour | day
    blur: 0,
    dim: 25,
    tile: 120,
    cols: 8,             // max icons per row
    align: 'auto',       // icon alignment: auto (follows position) | start | center | end
    panel: false,        // glass panel behind bookmarks
    labels: true,
    clockSize: 84,
    showDate: true,
    layout: { bookmarks: 'middle-center', clock: 'top-left', credit: 'bottom-left', settings: 'bottom-right' },
    show: { clock: true, credit: true },
    unpack: [],          // folder ids whose bookmarks show directly on the page
    sections: [{ id: 'main', name: 'Bookmarks' }],
    assign: {},          // bookmark id -> section id | 'hidden'
    collapsed: [],       // collapsed section ids
    order: []            // custom tile order (bookmark ids)
  };
  let S = { ...DEFAULTS };

  const store = {
    async get(k) {
      if (isExt) return (await chrome.storage.local.get(k))[k];
      try { return JSON.parse(localStorage.getItem(k)); } catch { return undefined; }
    },
    async set(k, v) {
      if (isExt) return chrome.storage.local.set({ [k]: v });
      try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
    },
    async del(k) {
      if (isExt) return chrome.storage.local.remove(k);
      localStorage.removeItem(k);
    }
  };
  let saveT;
  const save = () => { clearTimeout(saveT); saveT = setTimeout(() => store.set('settings', S), 150); };

  function applyVars() {
    const r = document.documentElement.style;
    r.setProperty('--blur', S.blur + 'px');
    r.setProperty('--dim', S.dim / 100);
    r.setProperty('--tile', S.tile + 'px');
    r.setProperty('--cols', S.cols);
    r.setProperty('--clock-size', S.clockSize + 'px');
    document.body.classList.toggle('bm-panel', !!S.panel);
    document.body.dataset.align = S.align || 'auto';
    document.body.classList.toggle('no-date', !S.showDate);
    document.body.classList.toggle('no-labels', !S.labels);
    document.body.dataset.font = S.font;
  }

  /* ================= Helpers ================= */
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function fetchT(url, ms = 6000, opts = {}) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), ms);
    try { return await fetch(url, { credentials: 'omit', ...opts, signal: ac.signal }); }
    finally { clearTimeout(t); }
  }
  const loadImg = (src, ms = 8000) => new Promise((res) => {
    const im = new Image();
    const t = setTimeout(() => res(null), ms);
    im.onload = () => { clearTimeout(t); res(im); };
    im.onerror = () => { clearTimeout(t); res(null); };
    im.src = src;
  });
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
  const originOf = (u) => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.origin : ''; } catch { return ''; } };

  function toast(msg) {
    let t = $('#toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast'; t.className = 'toast glass';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.remove('show'), 2800);
  }

  /* ================= Clock ================= */
  // Each digit is its own slot; when a digit changes it rolls up into place.
  let lastClock = '';
  function renderClock(force) {
    const now = new Date();
    let h = now.getHours();
    const m = String(now.getMinutes()).padStart(2, '0');
    let ampm = '';
    if (!S.clock24) { ampm = h < 12 ? 'AM' : 'PM'; h = h % 12 || 12; }
    const hh = S.clock24 ? String(h).padStart(2, '0') : String(h);
    const key = hh + ':' + m + ampm + S.clock24 + S.font;
    if (key === lastClock && !force) return;
    lastClock = key;

    const el = $('#clock');
    const digits = (s, cls) => [...s].map((d) => `<span class="slot ${cls}"><span class="d">${d}</span></span>`).join('');
    if (!el.firstChild || force || el.dataset.len !== String(hh.length) || el.dataset.ampm !== String(!!ampm)) {
      el.innerHTML =
        `<span class="hh">${digits(hh, 'h')}</span>` +
        `<span class="colon"><i></i><i></i></span>` +
        `<span class="mm">${digits(m, 'm')}</span>` +
        (ampm ? `<span class="ampm">${ampm}</span>` : '');
      el.dataset.len = hh.length; el.dataset.ampm = String(!!ampm);
    } else {
      const now2 = [...hh, ...m];
      el.querySelectorAll('.slot').forEach((slot, i) => {
        const cur = slot.querySelector('.d:last-child');
        if (cur.textContent === now2[i]) return;
        const nd = document.createElement('span');
        nd.className = 'd in'; nd.textContent = now2[i];
        cur.classList.add('out');
        slot.appendChild(nd);
        setTimeout(() => cur.remove(), 700);
      });
      const ap = el.querySelector('.ampm');
      if (ap) ap.textContent = ampm;
    }

    const wd = now.toLocaleDateString([], { weekday: 'long' });
    const dm = now.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
    $('#date').innerHTML = `<span class="wd">${wd}</span><span class="dot"></span><span class="dm">${dm}</span>`;
  }
  const tick = () => renderClock(false);

  /* ================= Wallpapers (Wikimedia Commons featured pictures) ================= */
  const CATS = [
    { id: 'space',     label: 'Space',     terms: ['nebula', 'galaxy', '"milky way"'] },
    { id: 'animals',   label: 'Animals',   terms: ['wildlife', 'mammal', 'bird'] },
    { id: 'nature',    label: 'Nature',    terms: ['landscape', 'waterfall', 'lake'] },
    { id: 'mountains', label: 'Mountains', terms: ['mountain', 'alps', 'glacier'] },
    { id: 'ocean',     label: 'Ocean',     terms: ['ocean', 'beach', 'coast'] },
    { id: 'cities',    label: 'Cities',    terms: ['cityscape', 'skyline', '"night view"'] },
    { id: 'forest',    label: 'Forest',    terms: ['forest', 'woodland'] },
    { id: 'flowers',   label: 'Flowers',   terms: ['flower', 'blossom'] },
    { id: 'sky',       label: 'Sky',       terms: ['sunset', 'aurora', 'clouds'] }
  ];
  const catById = (id) => CATS.find((c) => c.id === id);
  // Wikimedia keeps standard thumbnail widths ready; odd widths are rendered on demand (slow).
  const screenPx = screen.width * (devicePixelRatio || 1);
  const targetW = screenPx > 2600 ? 3840 : screenPx > 1920 ? 2560 : 1920;

  function thumbOf(url, w) {
    // https://upload.wikimedia.org/wikipedia/commons/a/ab/Name.jpg -> .../thumb/a/ab/Name.jpg/480px-Name.jpg
    if (url.includes('/thumb/')) return url.replace(/\/\d+px-([^/]+)$/, `/${w}px-$1`);
    const m = url.match(/^(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons)\/(\w\/\w\w)\/([^/]+)$/);
    return m ? `${m[1]}/thumb/${m[2]}/${m[3]}/${w}px-${m[3]}` : url;
  }
  const strip = (html) => (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

  async function searchCommons(term, offset, featured) {
    const q = `${term}${featured ? ' incategory:Featured_pictures_on_Wikimedia_Commons' : ''} filetype:bitmap`;
    const p = new URLSearchParams({
      action: 'query', format: 'json', origin: '*',
      generator: 'search', gsrnamespace: '6', gsrsearch: q, gsrlimit: '40', gsroffset: String(offset),
      prop: 'imageinfo', iiprop: 'url|size|extmetadata', iiurlwidth: String(targetW),
      iiextmetadatafilter: 'Artist|LicenseShortName|ObjectName'
    });
    const res = await fetchT('https://commons.wikimedia.org/w/api.php?' + p, 10000);
    const data = await res.json();
    return Object.values((data.query && data.query.pages) || {}).map((pg) => {
      const ii = pg.imageinfo && pg.imageinfo[0];
      if (!ii || ii.width < 1600 || ii.width / ii.height < 1.3) return null;
      const md = ii.extmetadata || {};
      const artist = strip(md.Artist && md.Artist.value).slice(0, 60) || 'Wikimedia Commons';
      const lic = strip(md.LicenseShortName && md.LicenseShortName.value) || 'Free licence';
      return {
        id: pg.pageid,
        src: ii.thumburl || ii.url,
        thumb: thumbOf(ii.thumburl || ii.url, 500),
        credit: `${artist} · ${lic}`,
        link: ii.descriptionurl
      };
    }).filter(Boolean);
  }

  async function fetchPool(cat, fresh) {
    const offset = fresh ? 40 * Math.floor(Math.random() * 4) : 0;
    const run = async (featured, off) => {
      const lists = await Promise.allSettled(cat.terms.map((t) => searchCommons(t, off, featured)));
      const seen = new Set();
      return lists.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])).filter((x) => !seen.has(x.id) && seen.add(x.id));
    };
    let items = await run(true, offset);
    if (items.length < 8 && offset) items = await run(true, 0);
    if (items.length < 8) items = items.concat(await run(false, offset));
    if (!items.length) throw new Error('No wallpapers found');
    return shuffle(items);
  }

  async function getPool(catId, fresh = false) {
    const key = 'pool3_' + catId;
    const cached = await store.get(key);
    if (!fresh && cached && cached.items && cached.items.length && Date.now() - cached.ts < 7 * DAY) return cached;
    const pool = { ts: Date.now(), items: await fetchPool(catById(catId), fresh), pos: -1 };
    await store.set(key, pool);
    return pool;
  }

  let activeLayer = 'A';
  let currentWp = null;
  let showSeq = 0;
  async function showWallpaper(src, credit, preview = false) {
    const seq = ++showSeq;
    const im = await loadImg(src, 30000);
    if (!im) return false;
    if (preview && seq !== showSeq) return false; // full image already took over
    if (!preview) showSeq++;                        // any pending preview is now stale
    const next = activeLayer === 'A' ? 'B' : 'A';
    const inc = $('#bg' + next), out = $('#bg' + activeLayer);
    inc.style.backgroundImage = `url("${src}")`;
    inc.classList.add('on');
    out.classList.remove('on');
    activeLayer = next;
    if (credit && credit.text) {
      $('#creditText').textContent = credit.text;
      $('#credit').href = credit.link || '#';
      $('#credit').hidden = false;
    } else {
      $('#credit').hidden = true;
    }
    return true;
  }

  async function nextFromPool(catId) {
    const id = catId === 'mix' ? CATS[Math.floor(Math.random() * CATS.length)].id : catId;
    const pool = await getPool(id);
    pool.pos = (pool.pos + 1) % pool.items.length;
    store.set('pool3_' + id, pool);
    const after = pool.items[(pool.pos + 1) % pool.items.length];
    if (after) setTimeout(() => loadImg(after.src, 60000), 2500); // warm the cache for the next tab
    return pool.items[pool.pos];
  }

  async function setWallpaperItem(item, catId) {
    currentWp = item;
    const credit = { text: item.credit, link: item.link };
    let full = false;
    const fullP = showWallpaper(item.src, credit).then((r) => (full = r));
    if (item.thumb && item.thumb !== item.src) {
      loadImg(item.thumb, 8000).then((im) => { if (im && !full && currentWp === item) showWallpaper(item.thumb, credit, true); });
    }
    const ok = await fullP;
    if (ok) {
      await store.set('wp', { cat: catId, item, ts: Date.now() });
      keepLocalCopy(item);
    }
    return ok;
  }

  // Save the chosen wallpaper inside the extension so it loads instantly and works offline.
  async function keepLocalCopy(item) {
    try {
      const blob = await (await fetchT(item.src, 30000)).blob();
      if (blob.size > 10e6) return;
      const data = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
      if (currentWp && currentWp.id === item.id) await store.set('wpData', { id: item.id, data });
    } catch {}
  }

  async function changeWallpaper() {
    const btn = $('#nextBtn');
    btn.classList.add('busy');
    try {
      if (S.cat === 'custom') {
        const img = await store.get('customImage');
        if (img) await showWallpaper(img, null);
        return;
      }
      for (let tries = 0; tries < 3; tries++) {
        const item = await nextFromPool(S.cat);
        if (await setWallpaperItem(item, S.cat)) return;
      }
    } catch (e) {
      console.warn('Wallpaper error', e);
      toast("Couldn't load wallpapers — check your connection.");
    } finally {
      btn.classList.remove('busy');
    }
  }

  function isDue(wp) {
    if (!wp || !wp.item) return true;
    if (wp.cat !== S.cat) return true;
    const age = Date.now() - wp.ts;
    switch (S.rotate) {
      case 'never': return false;
      case 'hour': return age > 36e5;
      case 'day': return new Date(wp.ts).toDateString() !== new Date().toDateString();
      default: return true;
    }
  }

  async function bootWallpaper() {
    if (S.cat === 'custom') {
      const img = await store.get('customImage');
      if (img) return showWallpaper(img, null);
      S.cat = 'space';
    }
    const wp = await store.get('wp');
    if (wp && wp.item && !isDue(wp)) {
      currentWp = wp.item;
      const local = await store.get('wpData');
      const src = local && local.id === wp.item.id ? local.data : wp.item.src;
      const credit = { text: wp.item.credit, link: wp.item.link };
      if (await showWallpaper(src, credit)) {
        if (src === wp.item.src) keepLocalCopy(wp.item);
        return;
      }
      if (S.rotate === 'never') return; // never swap the user's wallpaper on its own
    }
    changeWallpaper();
  }

  /* ================= Wallpaper themes (in Settings) ================= */
  function buildThemes() {
    const wrap = $('#themeChips');
    wrap.innerHTML = '';
    const list = [...CATS.map((c) => [c.id, c.label]), ['mix', 'Mix']];
    if (S.cat === 'custom') list.push(['custom', 'My image']);
    list.forEach(([id, label]) => {
      const b = document.createElement('button');
      b.className = 'tab'; b.dataset.id = id; b.textContent = label;
      b.classList.toggle('active', S.cat === id);
      b.onclick = () => {
        if (S.cat === id && id === 'custom') return;
        S.cat = id; save(); buildThemes(); changeWallpaper();
      };
      wrap.appendChild(b);
    });
  }
  $('#nextBtn').onclick = () => changeWallpaper();

  /* ================= Layout ================= */
  const WIDGETS = ['clock', 'bookmarks', 'credit', 'settings'];
  const SLOTS = ['top', 'middle', 'bottom'].flatMap((r) => ['left', 'center', 'right'].map((c) => `${r}-${c}`));
  const widgetEl = (w) => document.querySelector(`.widget[data-w="${w}"]`);

  function placeWidgets() {
    WIDGETS.forEach((w) => {
      const slot = SLOTS.includes(S.layout[w]) ? S.layout[w] : DEFAULTS.layout[w];
      $(`.cell[data-slot="${slot}"]`).appendChild(widgetEl(w));
      widgetEl(w).hidden = w in S.show && !S.show[w];
    });
    // keep a stable stacking order inside a slot
    document.querySelectorAll('.cell').forEach((sl) => {
      WIDGETS.forEach((w) => { const el = sl.querySelector(`.widget[data-w="${w}"]`); if (el) sl.appendChild(el); });
    });
    // a row with something in its centre keeps the centre truly centred
    document.querySelectorAll('.row').forEach((row) => {
      const filled = (c) => [...row.querySelector(`[data-col="${c}"]`).children].some((x) => !x.hidden);
      row.classList.toggle('has-center', filled('center'));
      row.classList.toggle('empty', !['left', 'center', 'right'].some(filled));
    });
    syncPickers();
  }

  function syncPickers() {
    document.querySelectorAll('.pos-picker').forEach((pk) => {
      const w = pk.dataset.w;
      pk.querySelectorAll('button').forEach((b) => {
        b.classList.toggle('active', b.dataset.slot === S.layout[w]);
        const others = WIDGETS.filter((o) => o !== w && S.layout[o] === b.dataset.slot && !(o in S.show && !S.show[o]));
        b.classList.toggle('taken', others.length > 0);
        b.title = b.dataset.slot.replace('-', ' ') + (others.length ? ` (shared with ${others.join(', ')})` : '');
      });
    });
  }
  document.querySelectorAll('.pos-picker').forEach((pk) => {
    pk.querySelectorAll('button').forEach((b) => {
      b.onclick = () => { S.layout = { ...S.layout, [pk.dataset.w]: b.dataset.slot }; save(); placeWidgets(); };
    });
  });
  $('#resetLayout').onclick = () => { S.layout = { ...DEFAULTS.layout }; S.show = { ...DEFAULTS.show }; save(); placeWidgets(); syncInputs(); };

  /* ---------- edit layout on the page (drag widgets into slots) ---------- */
  function setEditing(on) {
    document.body.classList.toggle('editing', on);
    $('#editBar').hidden = !on;
    if (on) toggleSettings(false);
  }
  $('#editLayout').onclick = () => setEditing(true);
  $('#editDone').onclick = () => setEditing(false);

  WIDGETS.forEach((w) => {
    const el = widgetEl(w);
    el.addEventListener('pointerdown', (e) => {
      if (!document.body.classList.contains('editing') || e.button !== 0) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const ghost = el.cloneNode(true);
      ghost.classList.add('ghost');
      ghost.removeAttribute('data-w');
      ghost.querySelectorAll('[id]').forEach((x) => x.removeAttribute('id'));
      Object.assign(ghost.style, { width: r.width + 'px', left: r.left + 'px', top: r.top + 'px' });
      document.body.appendChild(ghost);
      el.classList.add('lifting');
      const dx = e.clientX - r.left, dy = e.clientY - r.top;
      let target = null;
      const move = (ev) => {
        ghost.style.left = ev.clientX - dx + 'px';
        ghost.style.top = ev.clientY - dy + 'px';
        const hit = document.elementsFromPoint(ev.clientX, ev.clientY).find((x) => x.classList && x.classList.contains('cell'));
        if (hit !== target) {
          if (target) target.classList.remove('over');
          target = hit || null;
          if (target) target.classList.add('over');
        }
      };
      const up = () => {
        removeEventListener('pointermove', move);
        removeEventListener('pointerup', up);
        ghost.remove();
        el.classList.remove('lifting');
        if (target) {
          target.classList.remove('over');
          S.layout = { ...S.layout, [w]: target.dataset.slot };
          save(); placeWidgets();
        }
      };
      addEventListener('pointermove', move);
      addEventListener('pointerup', up);
    });
  });

  /* ================= Site icons (pulled from each bookmark's own website) ================= */
  let ICONS = {};
  let iconsSaveT;
  const saveIcons = () => { clearTimeout(iconsSaveT); iconsSaveT = setTimeout(() => store.set('icons', ICONS), 400); };

  const ICON_V = 2;   // bump to re-resolve icons cached by an older, less careful picker
  function validIcon(rec) {
    if (!rec || rec.v !== ICON_V) return false;
    const ttl = rec.data ? 14 * DAY : 2 * DAY;
    return Date.now() - rec.ts < ttl;
  }

  async function rasterize(href) {
    try {
      let src = href, revoke = null, isSvg = /\.svg(\?|$)/i.test(href);
      if (!href.startsWith('data:')) {
        const res = await fetchT(href, 6000);
        if (!res.ok) return null;
        const blob = await res.blob();
        if (blob.size < 60 || blob.size > 2e6) return null;
        if (blob.type && !/image|octet-stream|icon/i.test(blob.type)) return null;
        isSvg = isSvg || /svg/i.test(blob.type);
        src = revoke = URL.createObjectURL(blob);
      }
      const img = await loadImg(src, 6000);
      if (revoke) URL.revokeObjectURL(revoke);
      if (!img) return null;
      let w = img.naturalWidth, h = img.naturalHeight;
      if (isSvg && (!w || w < 96)) { w = h = 256; }
      if (!w || w < 16) return null;
      const n = Math.min(256, Math.max(w, h));
      const c = document.createElement('canvas');
      c.width = c.height = n;
      const x = c.getContext('2d', { willReadFrequently: true });
      const sc = Math.min(n / w, n / h);
      x.imageSmoothingQuality = 'high';
      x.drawImage(img, (n - w * sc) / 2, (n - h * sc) / 2, w * sc, h * sc);
      const px = (xx, yy) => x.getImageData(xx, yy, 1, 1).data[3];
      const k = Math.max(1, Math.round(n * .04));
      const opaque = [px(k, k), px(n - 1 - k, k), px(k, n - 1 - k), px(n - 1 - k, n - 1 - k)].every((a) => a > 245);
      return { data: c.toDataURL('image/png'), full: opaque && n >= 96, w: n };
    } catch { return null; }
  }

  const sizeOf = (s) => {
    if (!s) return 0;
    if (/any/i.test(s)) return 512;
    return Math.max(0, ...s.split(/\s+/).map((p) => parseInt(p, 10) || 0));
  };

  async function iconCandidates(url) {
    const origin = originOf(url);
    const cands = [];
    try {
      const res = await fetchT(url, 7000, { headers: { Accept: 'text/html' } });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('html')) {
        const html = (await res.text()).slice(0, 400000);
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const base = (doc.querySelector('base[href]') && new URL(doc.querySelector('base').getAttribute('href'), res.url).href) || res.url;
        doc.querySelectorAll('link[rel][href]').forEach((l) => {
          const rel = l.getAttribute('rel').toLowerCase();
          if (!rel.includes('icon') || rel.includes('mask')) return;
          const href = new URL(l.getAttribute('href'), base).href;
          const size = sizeOf(l.getAttribute('sizes'));
          const svg = /svg/i.test(l.getAttribute('type') || '') || /\.svg(\?|$)/i.test(href);
          let score = size || 32;
          if (rel.includes('apple-touch-icon')) score = 1000 + (size || 180);
          else if (rel.includes('fluid-icon')) score = 900;
          else if (svg) score = 700;
          cands.push({ href, score });
        });
        const man = doc.querySelector('link[rel="manifest"][href]');
        if (man) {
          try {
            const mUrl = new URL(man.getAttribute('href'), base).href;
            const mj = await (await fetchT(mUrl, 4000)).json();
            (mj.icons || []).forEach((ic) => {
              if (!ic.src) return;
              const size = sizeOf(ic.sizes);
              if (size < 96) return;
              cands.push({ href: new URL(ic.src, mUrl).href, score: 800 + Math.min(size, 512) / 10 - (/maskable/.test(ic.purpose || '') ? 50 : 0) });
            });
          } catch {}
        }
      }
    } catch {}
    if (origin) {
      cands.push({ href: origin + '/apple-touch-icon.png', score: 600 });
      cands.push({ href: origin + '/apple-touch-icon-precomposed.png', score: 590 });
      cands.push({ href: origin + '/favicon.ico', score: 10 });
    }
    const seen = new Set();
    return cands.sort((a, b) => b.score - a.score).filter((c) => !seen.has(c.href) && seen.add(c.href)).slice(0, 7);
  }

  let defaultFav;
  async function chromeFavicon(url) {
    if (!isExt) return null;
    const fav = (u) => chrome.runtime.getURL('/_favicon/') + '?pageUrl=' + encodeURIComponent(u) + '&size=64';
    if (defaultFav === undefined) {
      const d = await rasterize(fav('https://no-such-site.invalid/'));
      defaultFav = d ? d.data : null;
    }
    const r = await rasterize(fav(url));
    if (!r || r.data === defaultFav) return null;
    return { ...r, full: false };
  }

  async function resolveIcon(url) {
    if (!isExt) {
      // Preview mode (page opened directly): browsers block reading other sites, so use a public icon service.
      const host = hostOf(url);
      const im = host && await loadImg(`https://www.google.com/s2/favicons?domain=${host}&sz=128`);
      return im ? { data: im.src, full: false, w: im.naturalWidth } : null;
    }
    // Take the sharpest icon found, not just the first that loads (stop early once one is big enough).
    let best = null;
    for (const c of await iconCandidates(url)) {
      const r = await rasterize(c.href);
      if (r && (!best || r.w > best.w)) best = r;
      if (best && best.w >= 128) break;
    }
    return best || chromeFavicon(url);
  }

  // small concurrency-limited queue
  const queue = []; let running = 0; const pending = {};
  function iconFor(url) {
    const origin = originOf(url);
    if (!origin) return Promise.resolve(null);
    if (validIcon(ICONS[origin])) return Promise.resolve(ICONS[origin].data ? ICONS[origin] : null);
    if (pending[origin]) return pending[origin];
    pending[origin] = new Promise((resolve) => {
      queue.push(async () => {
        const r = await resolveIcon(url);
        ICONS[origin] = r ? { ...r, ts: Date.now(), v: ICON_V } : { data: null, ts: Date.now(), v: ICON_V };
        saveIcons();
        delete pending[origin];
        resolve(r);
      });
      pump();
    });
    return pending[origin];
  }
  function pump() {
    while (running < 5 && queue.length) {
      const job = queue.shift();
      running++;
      job().finally(() => { running--; pump(); });
    }
  }

  function paintLetter(el, node) {
    const host = hostOf(node.url) || node.title || '?';
    const hue = [...host].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 11);
    el.style.background = `linear-gradient(140deg, hsl(${hue} 85% 64% / .9), hsl(${(hue + 35) % 360} 80% 46% / .9))`;
    const l = document.createElement('span');
    l.className = 'letter';
    l.textContent = (node.title || host).trim().charAt(0).toUpperCase() || '•';
    el.appendChild(l);
  }

  function paintIcon(el, node) {
    const apply = (rec) => {
      el.classList.remove('loading');
      if (rec && rec.data) {
        const img = new Image();
        img.alt = ''; img.draggable = false; img.src = rec.data;
        if (rec.full) el.classList.add('full');
        else {
          if (rec.w < 48) el.classList.add('small');
          img.style.setProperty('--iw', (rec.w * 1.6 / (devicePixelRatio || 1)) + 'px');   // never stretch past ~1.6x: keeps small icons crisp
        }
        el.appendChild(img);
      } else {
        paintLetter(el, node);
      }
    };
    const origin = originOf(node.url);
    const rec = ICONS[origin];
    if (rec && validIcon(rec)) return apply(rec.data ? rec : null);
    if (rec && rec.data) { apply(rec); iconFor(node.url); return; } // stale: show old, refresh quietly
    el.classList.add('loading');
    iconFor(node.url).then(apply);
  }

  /* ================= Bookmarks bar ================= */
  const DEMO = [
    { id: 'd1', title: 'Gmail', url: 'https://mail.google.com' },
    { id: 'd2', title: 'YouTube', url: 'https://www.youtube.com' },
    { id: 'd3', title: 'GitHub', url: 'https://github.com' },
    { id: 'd4', title: 'LinkedIn', url: 'https://www.linkedin.com' },
    { id: 'd5', title: 'Jira', url: 'https://www.atlassian.com' },
    { id: 'd6', title: 'Work', children: [
      { id: 'd61', title: 'Slack', url: 'https://slack.com' },
      { id: 'd62', title: 'Notion', url: 'https://www.notion.so' },
      { id: 'd63', title: 'Google Drive', url: 'https://drive.google.com' },
      { id: 'd64', title: 'Figma', url: 'https://www.figma.com' }
    ] },
    { id: 'd7', title: 'Amazon', url: 'https://www.amazon.in' },
    { id: 'd8', title: 'Wikipedia', url: 'https://www.wikipedia.org' },
    { id: 'd9', title: 'ChatGPT', url: 'https://chatgpt.com' },
    { id: 'd10', title: 'Netflix', url: 'https://www.netflix.com' }
  ];
  async function children(id) {
    if (!isExt) {
      if (id === '1') return DEMO;
      const f = DEMO.find((b) => b.id === id);
      return (f && f.children) || [];
    }
    try { return await chrome.bookmarks.getChildren(id); } catch { return []; }
  }
  const isFolder = (n) => !n.url;

  // Items shown on the page: the Bookmarks bar, with "unpacked" folders replaced by their contents.
  let nodeMap = new Map();
  async function barItems() {
    const out = [];
    for (const n of await children('1')) {
      if (isFolder(n) && S.unpack.includes(n.id)) {
        (await children(n.id)).forEach((k) => out.push({ ...k, _from: n.id }));
      } else out.push(n);
    }
    nodeMap = new Map(out.map((n) => [n.id, n]));
    return out;
  }

  function ordered(nodes) {
    const idx = new Map(S.order.map((id, i) => [id, i]));
    return nodes
      .map((n, i) => ({ n, k: idx.has(n.id) ? idx.get(n.id) : 1e6 + i }))
      .sort((a, b) => a.k - b.k)
      .map((x) => x.n);
  }

  function ripple(e, icon) {
    const r = icon.getBoundingClientRect();
    const size = Math.max(r.width, r.height);
    const s = document.createElement('span');
    s.className = 'ripple';
    s.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
    icon.appendChild(s);
    setTimeout(() => s.remove(), 750);
  }

  function makeTile(node, i, { draggable = false } = {}) {
    const folder = isFolder(node);
    const el = document.createElement(folder ? 'button' : 'a');
    el.className = 'tile';
    el.dataset.id = node.id;
    el.style.setProperty('--d', Math.min(i * 40, 800) + 'ms');
    el.title = node.title || node.url || '';
    el._node = node;

    const icon = document.createElement('div');
    icon.className = 'icon glass';

    if (folder) {
      el.type = 'button';
      const g = document.createElement('div');
      g.className = 'folder-grid';
      icon.appendChild(g);
      children(node.id).then((kids) => {
        kids.filter((k) => k.url).slice(0, 9).forEach((k) => {
          const m = document.createElement('div');
          m.className = 'mini';
          g.appendChild(m);
          paintIcon(m, k);
        });
      });
      el.addEventListener('click', (e) => { ripple(e, icon); setTimeout(() => openFolder(node), 140); });
    } else {
      el.href = node.url;
      paintIcon(icon, node);
      el.addEventListener('click', (e) => {
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        ripple(e, icon);
        setTimeout(() => { location.href = node.url; }, 170);
      });
    }

    const label = document.createElement('div');
    label.className = 'label';
    label.textContent = node.title || hostOf(node.url);
    el.append(icon, label);

    // 3D tilt + glare
    el.addEventListener('pointermove', (e) => {
      const r = icon.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      icon.style.setProperty('--ry', ((px - .5) * 18).toFixed(2) + 'deg');
      icon.style.setProperty('--rx', ((.5 - py) * 18).toFixed(2) + 'deg');
      icon.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
      icon.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
    });
    el.addEventListener('pointerleave', () => {
      icon.style.setProperty('--rx', '0deg');
      icon.style.setProperty('--ry', '0deg');
    });

    if (draggable) wireDrag(el);
    return el;
  }

  const secOf = (id) => {
    const valid = (a) => a === 'hidden' || S.sections.some((x) => x.id === a);
    const a = S.assign[id];
    if (valid(a)) return a;
    const n = nodeMap.get(id);
    if (n && n._from && valid(S.assign[n._from])) return S.assign[n._from]; // inherits its folder's section
    return S.sections[0].id;
  };

  async function renderGrid({ animate = true } = {}) {
    const wrap = $('#sections');
    const all = ordered(await barItems());
    wrap.classList.toggle('static', !animate);
    wrap.innerHTML = '';
    if (!all.length) {
      wrap.innerHTML = '<div class="empty glass">Your Bookmarks bar is empty.<br>Press <b>Ctrl + D</b> on any site and save it to the <b>Bookmarks bar</b>.</div>';
      return;
    }
    if (all.every((n) => secOf(n.id) === 'hidden')) {
      wrap.innerHTML = '<div class="empty glass">All bookmarks are hidden — choose sections for them in Settings.</div>';
      return;
    }
    const single = S.sections.length === 1;
    let i = 0;
    S.sections.forEach((sec) => {
      const items = all.filter((n) => secOf(n.id) === sec.id);
      const el = document.createElement('section');
      el.className = 'section';
      el.dataset.sec = sec.id;
      if (S.collapsed.includes(sec.id) && !single) el.classList.add('collapsed');

      if (!single) {
        const head = document.createElement('button');
        head.className = 'sec-head';
        head.innerHTML = '<span class="line"></span><span class="sec-name"></span><span class="sec-count"></span><span class="chev"></span><span class="line r"></span>';
        head.querySelector('.sec-name').textContent = sec.name || 'Untitled';
        head.querySelector('.sec-count').textContent = items.length;
        head.onclick = () => {
          S.collapsed = S.collapsed.includes(sec.id) ? S.collapsed.filter((x) => x !== sec.id) : [...S.collapsed, sec.id];
          el.classList.toggle('collapsed');
          save();
        };
        el.appendChild(head);
      }

      const grid = document.createElement('div');
      grid.className = 'grid sec-grid';
      grid.dataset.sec = sec.id;
      if (!items.length) {
        const h = document.createElement('div');
        h.className = 'drop-hint';
        h.textContent = 'Drag bookmarks here, or assign them in Settings';
        grid.appendChild(h);
      }
      items.forEach((n) => grid.appendChild(makeTile(n, i++, { draggable: true })));
      wireZone(grid);
      el.appendChild(grid);
      wrap.appendChild(el);
    });
  }

  /* ---------- drag to reorder / move between sections ---------- */
  let dragId = null;
  async function placeDragged(secId, targetId, after) {
    const moving = dragId; // capture now: dragend clears dragId before this async work finishes
    if (!moving) return;
    const ids = ordered(await barItems()).map((n) => n.id).filter((id) => id !== moving);
    if (targetId) {
      ids.splice(ids.indexOf(targetId) + (after ? 1 : 0), 0, moving);
    } else {
      let last = -1;
      ids.forEach((id, k) => { if (secOf(id) === secId) last = k; });
      ids.splice(last >= 0 ? last + 1 : ids.length, 0, moving);
    }
    S.order = ids;
    S.assign = { ...S.assign, [moving]: secId };
    save();
    renderGrid({ animate: false });
    buildBmList();
  }
  const clearDrop = () => document.querySelectorAll('.drop-before,.drop-after,.drop-zone').forEach((t) => t.classList.remove('drop-before', 'drop-after', 'drop-zone'));

  function wireDrag(el) {
    el.draggable = true;
    el.addEventListener('dragstart', (e) => {
      dragId = el.dataset.id;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', dragId);
      document.body.classList.add('is-dragging');
      requestAnimationFrame(() => el.classList.add('dragging'));
    });
    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      document.body.classList.remove('is-dragging');
      clearDrop();
      dragId = null;
    });
    el.addEventListener('dragover', (e) => {
      if (!dragId || dragId === el.dataset.id) return;
      e.preventDefault(); e.stopPropagation();
      const r = el.getBoundingClientRect();
      const after = e.clientX > r.left + r.width / 2;
      el.classList.toggle('drop-after', after);
      el.classList.toggle('drop-before', !after);
    });
    el.addEventListener('dragleave', () => el.classList.remove('drop-before', 'drop-after'));
    el.addEventListener('drop', (e) => {
      e.preventDefault(); e.stopPropagation();
      const after = el.classList.contains('drop-after');
      clearDrop();
      if (!dragId || dragId === el.dataset.id) return;
      placeDragged(el.closest('.sec-grid').dataset.sec, el.dataset.id, after);
    });
  }

  function wireZone(grid) {
    grid.addEventListener('dragover', (e) => {
      if (!dragId) return;
      e.preventDefault();
      if (e.target === grid || e.target.classList.contains('drop-hint')) grid.classList.add('drop-zone');
    });
    grid.addEventListener('dragleave', (e) => { if (e.target === grid) grid.classList.remove('drop-zone'); });
    grid.addEventListener('drop', (e) => {
      e.preventDefault();
      clearDrop();
      if (dragId) placeDragged(grid.dataset.sec, null, false);
    });
  }

  /* ---------- folder sheet ---------- */
  const stack = [];
  async function openFolder(node, push = true) {
    if (push) stack.push(node);
    $('#modalTitle').textContent = node.title || 'Folder';
    $('#backBtn').hidden = stack.length < 2;
    $('#unpackBtn').hidden = node.parentId !== '1' && !String(node.id).startsWith('d');
    const g = $('#modalGrid');
    g.innerHTML = '';
    const kids = await children(node.id);
    if (!kids.length) g.innerHTML = '<div class="empty">This folder is empty.</div>';
    $('#modalHint').hidden = !kids.some((k) => k.url);
    kids.forEach((k, i) => {
      const t = makeTile(k, i);
      if (k.url) {
        const mv = document.createElement('span');
        mv.className = 'tile-act'; mv.textContent = '↗'; mv.title = 'Move out of this folder to the Bookmarks bar';
        mv.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); moveOut(k, node); });
        t.appendChild(mv);
      }
      g.appendChild(t);
    });
    open('#modal');
  }

  // Really moves the bookmark in Chrome: from its folder onto the Bookmarks bar.
  async function moveOut(bm, folder) {
    if (isExt) {
      await chrome.bookmarks.move(bm.id, { parentId: '1' });
    } else {
      const f = DEMO.find((b) => b.id === folder.id);
      if (f) { f.children = f.children.filter((c) => c.id !== bm.id); DEMO.push({ ...bm }); }
    }
    if (folder.id !== '1') S.assign = { ...S.assign, [bm.id]: secOf(folder.id) === 'hidden' ? S.sections[0].id : secOf(folder.id) };
    save();
    toast(`Moved “${bm.title || hostOf(bm.url)}” to the Bookmarks bar`);
    openFolder(folder, false);
    renderGrid({ animate: false });
  }

  $('#unpackBtn').onclick = () => {
    const f = stack[stack.length - 1];
    if (!f) return;
    if (!S.unpack.includes(f.id)) S.unpack = [...S.unpack, f.id];
    save(); stack.length = 0; close('#modal');
    renderGrid(); buildBmList();
    toast(`“${f.title}” bookmarks now show on the home screen — undo in Settings`);
  };
  function open(sel) { $(sel).classList.remove('hidden'); }
  function close(sel) { $(sel).classList.add('hidden'); }
  $('#closeModal').onclick = () => { stack.length = 0; close('#modal'); };
  $('#backBtn').onclick = () => { stack.pop(); openFolder(stack[stack.length - 1], false); };
  ['#modal', '#gallery'].forEach((sel) => $(sel).addEventListener('click', (e) => {
    if (e.target === $(sel)) { stack.length = 0; close(sel); }
  }));

  /* ================= Wallpaper gallery ================= */
  let galleryCat = 'space';
  function openGallery() {
    galleryCat = catById(S.cat) ? S.cat : (currentWp && S.cat === 'mix' ? 'space' : 'space');
    const tabs = $('#galleryTabs');
    tabs.innerHTML = '';
    CATS.forEach((c) => {
      const t = document.createElement('button');
      t.className = 'tab'; t.textContent = c.label; t.dataset.id = c.id;
      t.onclick = () => { galleryCat = c.id; markTabs(); renderThumbs(); };
      tabs.appendChild(t);
    });
    markTabs();
    $('#galleryGrid').style.minHeight = '';
    renderThumbs();
    open('#gallery');
  }
  const markTabs = () => document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.id === galleryCat));

  async function renderThumbs(fresh = false) {
    const g = $('#galleryGrid');
    // Keep the sheet at the size it already is (never taller than it can show), so loading or a smaller
    // set doesn't shrink it and re-grow. Reset when the gallery is reopened.
    const sh = g.closest('.sheet');
    const fill = sh.clientHeight - (sh.scrollHeight - g.offsetHeight);
    g.style.minHeight = Math.max(parseFloat(g.style.minHeight) || 0, Math.min(g.offsetHeight, fill)) + 'px';
    g.innerHTML = '<div class="status">Loading wallpapers…</div>';
    const cat = galleryCat;
    try {
      const pool = await getPool(cat, fresh);
      if (cat !== galleryCat) return;
      g.innerHTML = '';
      pool.items.forEach((it, i) => {
        const b = document.createElement('button');
        b.className = 'thumb';
        b.style.setProperty('--d', Math.min(i * 25, 600) + 'ms');
        if (currentWp && currentWp.id === it.id) b.classList.add('current');
        const img = new Image();
        img.alt = ''; img.loading = 'lazy'; img.src = it.thumb;
        img.onload = () => img.classList.add('in');
        const c = document.createElement('span');
        c.className = 't-credit'; c.textContent = it.credit;
        b.append(img, c);
        b.onclick = async () => {
          document.querySelectorAll('.thumb.current').forEach((t) => t.classList.remove('current'));
          b.classList.add('current');
          S.cat = cat; S.rotate = 'never'; save();
          $('#setRotate').value = 'never';
          buildThemes();
          if (await setWallpaperItem(it, cat)) toast('Wallpaper set — it will stay until you change it');
        };
        g.appendChild(b);
      });
    } catch {
      g.innerHTML = '<div class="status">Couldn’t load wallpapers. Check your internet connection.</div>';
    }
  }
  $('#galleryBtn').onclick = openGallery;
  $('#closeGallery').onclick = () => close('#gallery');
  $('#galleryMore').onclick = () => renderThumbs(true);

  /* ================= Settings ================= */
  function toggleSettings(openIt) {
    const p = $('#settings');
    p.classList.toggle('open', openIt);
    p.setAttribute('aria-hidden', String(!openIt));
    if (openIt) { buildSecList(); buildBmList(); }
  }
  $('#settingsBtn').onclick = () => toggleSettings(!$('#settings').classList.contains('open'));
  $('#closeSettings').onclick = () => toggleSettings(false);
  $('#settings').addEventListener('click', (e) => { if (e.target.id === 'settings') toggleSettings(false); });

  // unblur the page behind Settings (remembered)
  function setClearBg(on) {
    $('#settings').classList.toggle('clear', on);
    $('#clearBg').setAttribute('aria-pressed', String(on));
    $('#clearBg span').textContent = on ? 'Blur background' : 'Unblur background';
    try { localStorage.setItem('gh_clear', on ? '1' : ''); } catch {}
  }
  $('#clearBg').onclick = () => setClearBg(!$('#settings').classList.contains('clear'));
  try { setClearBg(localStorage.getItem('gh_clear') === '1'); } catch { setClearBg(false); }

  // sidebar tabs
  let settingsTab = 'layout';
  function showTab(tab) {
    settingsTab = tab;
    document.querySelectorAll('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.pane').forEach((p) => p.classList.toggle('active', p.dataset.tab === tab));
    $('.content').scrollTop = 0;
    try { localStorage.setItem('gh_tab', tab); } catch {}
  }
  document.querySelectorAll('.nav-item').forEach((b) => { b.onclick = () => showTab(b.dataset.tab); });

  try { settingsTab = localStorage.getItem('gh_tab') || 'layout'; } catch {}
  showTab(settingsTab);

  function buildSecList() {
    const list = $('#secList');
    list.innerHTML = '';
    S.sections.forEach((sec, k) => {
      const row = document.createElement('div');
      row.className = 'sec-row';
      const inp = document.createElement('input');
      inp.type = 'text'; inp.value = sec.name; inp.placeholder = 'Section name';
      inp.oninput = () => { sec.name = inp.value; save(); clearTimeout(inp._t); inp._t = setTimeout(() => { renderGrid({ animate: false }); buildBmList(); }, 300); };
      const up = document.createElement('button');
      up.className = 'mini-btn'; up.title = 'Move up'; up.textContent = '↑'; up.disabled = k === 0;
      up.onclick = () => { [S.sections[k - 1], S.sections[k]] = [S.sections[k], S.sections[k - 1]]; save(); buildSecList(); buildBmList(); renderGrid({ animate: false }); };
      const del = document.createElement('button');
      del.className = 'mini-btn'; del.title = 'Delete section'; del.textContent = '✕'; del.disabled = S.sections.length === 1;
      del.onclick = () => {
        S.sections = S.sections.filter((x) => x.id !== sec.id);
        const a = { ...S.assign };
        Object.keys(a).forEach((id) => { if (a[id] === sec.id) delete a[id]; }); // its bookmarks move to the first section
        S.assign = a;
        save(); buildSecList(); buildBmList(); renderGrid({ animate: false });
      };
      row.append(inp, up, del);
      list.appendChild(row);
    });
  }
  $('#addSection').onclick = () => {
    const sec = { id: 's' + Date.now().toString(36), name: S.sections.length === 1 && S.sections[0].name === 'Bookmarks' ? 'Work' : 'New section' };
    if (S.sections.length === 1 && S.sections[0].name === 'Bookmarks') S.sections[0].name = 'Personal';
    S.sections = [...S.sections, sec];
    save(); buildSecList(); buildBmList(); renderGrid({ animate: false });
    const inputs = $('#secList').querySelectorAll('input');
    inputs[inputs.length - 1].select();
  };

  function bmRow(n, { child = false } = {}) {
    const row = document.createElement('div');
    row.className = 'bm-item' + (child ? ' child' : '');
    const ico = document.createElement('span');
    ico.className = 'bm-ico';
    if (isFolder(n)) {
      ico.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';
    } else {
      const rec = ICONS[originOf(n.url)];
      if (rec && rec.data) { const im = new Image(); im.src = rec.data; ico.appendChild(im); }
      else ico.textContent = (n.title || hostOf(n.url)).charAt(0).toUpperCase();
    }
    const name = document.createElement('span');
    name.className = 'bm-name';
    name.textContent = n.title || hostOf(n.url) || 'Untitled';
    row.append(ico, name);

    if (isFolder(n) && !child) {
      const unpacked = S.unpack.includes(n.id);
      const b = document.createElement('button');
      b.className = 'pill-btn' + (unpacked ? ' on' : '');
      b.textContent = unpacked ? 'Unpacked' : 'Unpack';
      b.title = unpacked ? 'Show as a folder tile again' : "Show this folder's bookmarks directly on the home screen";
      b.onclick = () => {
        S.unpack = unpacked ? S.unpack.filter((x) => x !== n.id) : [...S.unpack, n.id];
        save(); buildBmList(); renderGrid({ animate: false });
      };
      row.appendChild(b);
    }

    const sel = document.createElement('select');
    [...S.sections.map((x) => [x.id, x.name || 'Untitled']), ['hidden', 'Hidden']].forEach(([v, t]) => {
      const o = document.createElement('option'); o.value = v; o.textContent = t; sel.appendChild(o);
    });
    sel.value = secOf(n.id);
    row.classList.toggle('off', sel.value === 'hidden');
    sel.onchange = () => {
      S.assign = { ...S.assign, [n.id]: sel.value };
      save(); renderGrid({ animate: false }); buildBmList();
    };
    row.appendChild(sel);
    return row;
  }

  async function buildBmList() {
    const list = $('#bmList');
    const top = await children('1');
    await barItems();
    const pos = new Map(S.order.map((id, k) => [id, k]));
    const key = (n) => (pos.has(n.id) ? pos.get(n.id) : 1e6);
    const sorted = [...top].sort((a, b) => key(a) - key(b));
    list.innerHTML = top.length ? '' : '<div class="fine">No bookmarks on your Bookmarks bar yet.</div>';
    for (const n of sorted) {
      list.appendChild(bmRow(n));
      if (isFolder(n) && S.unpack.includes(n.id)) {
        ordered(await children(n.id)).forEach((k) => list.appendChild(bmRow(k, { child: true })));
      }
    }
  }

  function syncInputs() {
    $('#setFont').value = S.font;
    $('#setClock').checked = S.clock24;
    $('#setRotate').value = S.rotate;
    $('#setBlur').value = S.blur; $('#outBlur').textContent = S.blur + 'px';
    $('#setDim').value = S.dim; $('#outDim').textContent = S.dim + '%';
    $('#setTile').value = S.tile; $('#outTile').textContent = S.tile + 'px';
    $('#setLabels').checked = S.labels;
    $('#setCols').value = S.cols; $('#outCols').textContent = S.cols;
    $('#setPanel').checked = !!S.panel;
    document.querySelectorAll('#setAlign button').forEach((b) => b.classList.toggle('active', b.dataset.v === (S.align || 'auto')));
    $('#setDate').checked = !!S.showDate;
    $('#setClockSize').value = S.clockSize; $('#outClockSize').textContent = S.clockSize + 'px';
    $('#showClock').checked = S.show.clock !== false;
    $('#showCredit').checked = S.show.credit !== false;
    syncPickers();
    store.get('customImage').then((c) => { $('#removeCustom').hidden = !c; });
  }

  $('#setFont').onchange = (e) => { S.font = e.target.value; applyVars(); save(); renderClock(true); };
  $('#setClock').onchange = (e) => { S.clock24 = e.target.checked; save(); renderClock(true); };
  $('#setRotate').onchange = (e) => { S.rotate = e.target.value; save(); };
  $('#setBlur').oninput = (e) => { S.blur = +e.target.value; $('#outBlur').textContent = S.blur + 'px'; applyVars(); save(); };
  $('#setDim').oninput = (e) => { S.dim = +e.target.value; $('#outDim').textContent = S.dim + '%'; applyVars(); save(); };
  $('#setTile').oninput = (e) => { S.tile = +e.target.value; $('#outTile').textContent = S.tile + 'px'; applyVars(); save(); };
  $('#setLabels').onchange = (e) => { S.labels = e.target.checked; applyVars(); save(); };
  $('#setCols').oninput = (e) => { S.cols = +e.target.value; $('#outCols').textContent = S.cols; applyVars(); save(); };
  $('#setPanel').onchange = (e) => { S.panel = e.target.checked; applyVars(); save(); };
  document.querySelectorAll('#setAlign button').forEach((b) => {
    b.onclick = () => { S.align = b.dataset.v; applyVars(); save(); syncInputs(); };
  });
  $('#setDate').onchange = (e) => { S.showDate = e.target.checked; applyVars(); save(); };
  $('#setClockSize').oninput = (e) => { S.clockSize = +e.target.value; $('#outClockSize').textContent = S.clockSize + 'px'; applyVars(); save(); };
  $('#showClock').onchange = (e) => { S.show = { ...S.show, clock: e.target.checked }; save(); placeWidgets(); };
  $('#showCredit').onchange = (e) => { S.show = { ...S.show, credit: e.target.checked }; save(); placeWidgets(); };

  $('#refreshIcons').onclick = async () => { ICONS = {}; await store.del('icons'); renderGrid(); toast('Fetching fresh icons…'); };
  $('#resetOrder').onclick = () => { S.order = []; save(); renderGrid(); buildBmList(); };

  $('#setUpload').onchange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = async () => {
      // downscale very large photos so the tab stays fast
      const img = await loadImg(reader.result);
      let data = reader.result;
      if (img && img.naturalWidth > 3200) {
        const c = document.createElement('canvas');
        c.width = 3200; c.height = Math.round(img.naturalHeight * 3200 / img.naturalWidth);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        data = c.toDataURL('image/jpeg', .9);
      }
      await store.set('customImage', data);
      S.cat = 'custom'; save();
      buildThemes(); syncInputs();
      showWallpaper(data, null);
    };
    reader.readAsDataURL(f);
  };
  $('#removeCustom').onclick = async () => {
    await store.del('customImage');
    if (S.cat === 'custom') S.cat = 'space';
    save(); buildThemes(); syncInputs(); changeWallpaper();
  };

  $('#resetBtn').onclick = async () => {
    S = { ...DEFAULTS }; await store.set('settings', S);
    applyVars(); tick(); syncInputs(); buildThemes(); renderGrid(); buildSecList(); buildBmList();
  };

  /* ================= Right-click menu on a bookmark ================= */
  const ctx = $('#ctx');
  function hideCtx() { ctx.hidden = true; ctx.innerHTML = ''; }

  // Updates bookmarks in Chrome (or the sample data in preview mode)
  const bm = {
    async update(n, changes) {
      if (isExt) return chrome.bookmarks.update(n.id, changes);
      const find = (list) => { for (const x of list) { if (x.id === n.id) return x; if (x.children) { const f = find(x.children); if (f) return f; } } };
      Object.assign(find(DEMO) || {}, changes);
    },
    async remove(n) {
      if (isExt) return isFolder(n) ? chrome.bookmarks.removeTree(n.id) : chrome.bookmarks.remove(n.id);
      const drop = (list) => { const k = list.findIndex((x) => x.id === n.id); if (k >= 0) return list.splice(k, 1); list.forEach((x) => x.children && drop(x.children)); };
      drop(DEMO);
    }
  };
  async function afterBookmarkChange() {
    await renderGrid({ animate: false });
    buildBmList();
    const f = stack[stack.length - 1];
    if (f && !$('#modal').classList.contains('hidden')) openFolder(f, false);
  }

  function showCtx(n, x, y, inFolder) {
    const folder = isFolder(n);
    const sec = secOf(n.id);
    const items = [];
    if (!folder) {
      items.push({ label: 'Open in new tab', icon: '↗', run: () => window.open(n.url, '_blank', 'noopener') });
    } else {
      items.push({ label: 'Open folder', icon: '▢', run: () => openFolder(n) });
    }
    items.push({ label: folder ? 'Rename folder…' : 'Edit name & URL…', icon: '✎', run: () => openEdit(n) });
    if (!inFolder && S.sections.length > 1) {
      items.push({ sep: true });
      S.sections.forEach((s) => items.push({
        label: `Move to ${s.name || 'Untitled'}`, icon: s.id === sec ? '●' : '○', disabled: s.id === sec,
        run: () => { S.assign = { ...S.assign, [n.id]: s.id }; save(); afterBookmarkChange(); }
      }));
    }
    if (!inFolder) items.push({ label: 'Hide from home screen', icon: '⊘', run: () => { S.assign = { ...S.assign, [n.id]: 'hidden' }; save(); afterBookmarkChange(); toast('Hidden — show it again in Settings → Sections & folders'); } });
    if (!folder) items.push({ label: 'Refresh icon', icon: '↻', run: () => { delete ICONS[originOf(n.url)]; saveIcons(); afterBookmarkChange(); } });
    items.push({ sep: true });
    items.push({ label: folder ? 'Delete folder…' : 'Delete bookmark…', icon: '🗑', danger: true, confirm: true, run: async () => {
      await bm.remove(n); toast(`Deleted “${n.title || hostOf(n.url)}”`); afterBookmarkChange();
    } });

    ctx.innerHTML = '';
    const head = document.createElement('div');
    head.className = 'ctx-head';
    head.textContent = n.title || hostOf(n.url) || 'Bookmark';
    ctx.appendChild(head);
    items.forEach((it) => {
      if (it.sep) { const s = document.createElement('div'); s.className = 'ctx-sep'; ctx.appendChild(s); return; }
      const b = document.createElement('button');
      b.className = 'ctx-item' + (it.danger ? ' danger' : '');
      b.disabled = !!it.disabled;
      b.innerHTML = `<span class="ci"></span><span class="cl"></span>`;
      b.querySelector('.ci').textContent = it.icon;
      b.querySelector('.cl').textContent = it.label;
      b.onclick = (e) => {
        e.stopPropagation();
        if (it.confirm && !b.classList.contains('armed')) {        // in-page confirm: click twice to delete
          b.classList.add('armed');
          b.querySelector('.cl').textContent = isFolder(n) ? 'Click again to delete folder + contents' : 'Click again to delete';
          return;
        }
        hideCtx(); it.run();
      };
      ctx.appendChild(b);
    });
    ctx.hidden = false;
    const r = ctx.getBoundingClientRect();
    ctx.style.left = Math.min(x, innerWidth - r.width - 10) + 'px';
    ctx.style.top = Math.min(y, innerHeight - r.height - 10) + 'px';
  }

  document.addEventListener('contextmenu', (e) => {
    const tile = e.target.closest('.tile');
    if (!tile || !tile._node || document.body.classList.contains('editing')) { hideCtx(); return; }
    e.preventDefault();
    showCtx(tile._node, e.clientX, e.clientY, !!tile.closest('#modalGrid'));
  });
  document.addEventListener('pointerdown', (e) => { if (!ctx.hidden && !ctx.contains(e.target)) hideCtx(); });
  addEventListener('blur', hideCtx);
  $('#stage').addEventListener('scroll', hideCtx);

  /* ---------- edit dialog ---------- */
  let editing = null;
  function openEdit(n) {
    editing = n;
    const folder = isFolder(n);
    $('#editTitle').textContent = folder ? 'Rename folder' : 'Edit bookmark';
    $('#editName').value = n.title || '';
    $('#editUrl').value = n.url || '';
    $('#editUrlRow').hidden = folder;
    $('#editErr').hidden = true;
    open('#editDlg');
    setTimeout(() => $('#editName').select(), 60);
  }
  $('#editCancel').onclick = () => close('#editDlg');
  $('#editDlg').addEventListener('click', (e) => { if (e.target.id === 'editDlg') close('#editDlg'); });
  $('#editForm').onsubmit = async (e) => {
    e.preventDefault();
    if (!editing) return;
    const changes = { title: $('#editName').value.trim() };
    if (!isFolder(editing)) {
      let u = $('#editUrl').value.trim();
      if (u && !/^[a-z][\w+.-]*:/i.test(u)) u = 'https://' + u;
      try { new URL(u); } catch { $('#editErr').textContent = 'That URL doesn’t look right.'; $('#editErr').hidden = false; return; }
      changes.url = u;
    }
    try { await bm.update(editing, changes); }
    catch (err) { $('#editErr').textContent = 'Couldn’t save: ' + (err.message || err); $('#editErr').hidden = false; return; }
    close('#editDlg');
    toast('Bookmark updated');
    afterBookmarkChange();
  };

  /* ================= Global interactions ================= */
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('#ctx').hidden) hideCtx();
    else if (!$('#editDlg').classList.contains('hidden')) close('#editDlg');
    else if (document.body.classList.contains('editing')) setEditing(false);
    else if (!$('#gallery').classList.contains('hidden')) close('#gallery');
    else if (!$('#modal').classList.contains('hidden')) { stack.length = 0; close('#modal'); }
    else toggleSettings(false);
  });


  if (isExt) {
    let t;
    const refresh = () => { clearTimeout(t); t = setTimeout(() => { renderGrid({ animate: false }); buildBmList(); }, 250); };
    ['onCreated', 'onRemoved', 'onChanged', 'onMoved', 'onChildrenReordered'].forEach((ev) => chrome.bookmarks[ev].addListener(refresh));
  }

  /* ================= Boot ================= */
  (async () => {
    const [saved, icons] = await Promise.all([store.get('settings'), store.get('icons')]);
    S = { ...DEFAULTS, ...(saved || {}) };
    if (saved && !saved.v) {                    // upgrade from v2
      S.rotate = 'never';
      (saved.hidden || []).forEach((id) => { S.assign[id] = 'hidden'; });
      delete S.hidden; delete S.name;
    }
    S.v = 3;
    if (!Array.isArray(S.sections) || !S.sections.length) S.sections = [...DEFAULTS.sections];
    S.layout = { ...DEFAULTS.layout, ...(S.layout || {}) };
    S.show = { ...DEFAULTS.show, ...(S.show || {}) };
    if (!Array.isArray(S.unpack)) S.unpack = [];
    if (!saved || !saved.v) save();
    if (!isExt) {
      const b = document.createElement('div');
      b.className = 'preview-badge glass';
      b.textContent = 'Preview mode · sample bookmarks';
      document.body.appendChild(b);
    }
    ICONS = icons || {};
    applyVars();
    placeWidgets();
    $('#widgets').remove();
    tick();
    setInterval(tick, 1000);
    syncInputs();
    buildThemes();
    renderGrid();
    bootWallpaper();
  })();
})();
