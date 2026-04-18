// ── API ───────────────────────────────────────────────────
const API = {
  get base() { return S.apiBase; },
  async post(path, body) {
    const r = await fetch(`${this.base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error('API ' + r.status);
    return r.json();
  },
  async get(path) {
    const r = await fetch(`${this.base}${path}`);
    if (!r.ok) throw new Error('API ' + r.status);
    return r.json();
  }
};

// ── STATE ─────────────────────────────────────────────────
const S = {
  apiBase: 'http://localhost:8000',
  userId:  'user_123',
  pending:   [],
  delivered: [],
  bypassed:  [],
  stats: { pending: 0, delivered: 0, deferred: 0, bypass: 0 }
};

// ── ROUTE ─────────────────────────────────────────────────
const ROUTE = [
  {name:'Home',    sig:3, zone:'always_deliver', pct:0},
  {name:'Ring Rd', sig:3, zone:'always_deliver', pct:13},
  {name:'Tunnel',  sig:0, zone:'defer',           pct:25},
  {name:'Suburb',  sig:1, zone:'defer',           pct:38},
  {name:'Highway', sig:3, zone:'always_deliver',  pct:51},
  {name:'Metro',   sig:2, zone:'critical_only',   pct:64},
  {name:'Mall',    sig:3, zone:'always_deliver',  pct:78},
  {name:'Office',  sig:3, zone:'always_deliver',  pct:100}
];

// ── DRIVE STATE ───────────────────────────────────────────
const DS = {
  running: false, prog: 0,
  ivl: null, nivl: null,
  pQ: [], dQ: [], bQ: [],
  stats: { p: 0, d: 0, b: 0 },
  rain: []
};

// ── LOOKUPS ───────────────────────────────────────────────
const CATICON = {otp:'🔐', transactional:'💳', social:'💬', marketing:'📢', alert:'⚠️'};
const CATBG   = {
  otp:           'background:var(--red-s)',
  transactional: 'background:var(--amber-s)',
  social:        'background:var(--green-s)',
  marketing:     'background:rgba(255,255,255,0.04)',
  alert:         'background:var(--amber-s)'
};
const PCLS = {critical:'p-c', high:'p-h', normal:'p-n', low:'p-l'};
const GEOIC = {home:'🏠', office:'🏢', subway:'🚇', gym:'🏋️', hospital:'🏥', airport:'✈️', default:'📍'};

// ── HARDCODED SEED ZONES (shown on map even without API) ──
const SEED_ZONES = [
  {label:'home',   lat:13.0827, lng:80.2707, radius_meters:200, zone_type:'always_deliver'},
  {label:'gym',    lat:13.0800, lng:80.2600, radius_meters:150, zone_type:'critical_only'}
];

// ── INIT ──────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('api-disp').textContent = S.apiBase.replace('http://','');
  updConn();
  updStats();
});

// ── NAV ───────────────────────────────────────────────────
function showPage(id, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.pn-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  if (el) el.classList.add('active');
  if (id === 'geo')   initGeoMap();
  if (id === 'drive') initDriveUI();
  if (id === 'inbox') { loadMessages(); renderInbox(); }
}

// ── TOAST & LOG ───────────────────────────────────────────
function toast(msg, t = 'ok') {
  const el = document.getElementById('toast');
  el.textContent = msg; el.className = 'show';
  setTimeout(() => el.className = '', 2600);
}

function addLog(msg, t = 'info') {
  const now = new Date();
  const tm  = [now.getHours(), now.getMinutes()].map(n => String(n).padStart(2,'0')).join(':');
  const el  = document.createElement('div');
  el.className = 'le';
  el.innerHTML = `<span class="lt">${tm}</span><span class="l${t}">${msg}</span>`;
  const s = document.getElementById('logstream');
  if (s) { s.appendChild(el); s.scrollTop = s.scrollHeight; }
}

function clearLog() {
  const s = document.getElementById('logstream');
  if (s) s.innerHTML = '';
}

// ── STATS ─────────────────────────────────────────────────
function updStats() {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('s-p',    S.stats.pending);
  set('s-d',    S.stats.delivered);
  set('s-df',   S.stats.deferred);
  set('s-b',    S.stats.bypass);
  set('nav-qc', S.pending.length);
  set('tcc-p',  S.pending.length);
  set('tcc-d',  S.delivered.length);
  set('tcc-b',  S.bypassed.length);
}

// ── NOTIFICATION CARD ─────────────────────────────────────
function makeQI(m) {
  const d   = document.createElement('div');
  const sc  = m.status === 'delivered' ? 'delivered' : m.status === 'bypassed' ? 'bypassed' : 'pending';
  d.className = `qi ${sc}`;
  const ts  = m.ts || new Date().toLocaleTimeString();
  const cat = m.cat || m.category || 'social';
  const pri = m.pri || m.priority || 'normal';
  const stHtml = m.status === 'delivered'
    ? `<span class="std">✓ delivered @ ${m.deliveredAt || ts}</span>`
    : m.status === 'bypassed'
    ? `<span class="stb">⚡ bypassed @ ${ts}</span>`
    : `<span class="stp">⏸ pending since ${ts}</span>`;
  d.innerHTML = `
    <div class="qic" style="${CATBG[cat] || 'background:var(--s2)'}">${CATICON[cat] || '📩'}</div>
    <div class="qb">
      <div class="qh">
        <span class="ptag ${PCLS[pri] || 'p-l'}">${pri}</span>
        <span class="ctag">${cat}</span>
        ${(m.bypass || m.should_bypass_deferral) ? '<span class="ptag p-c" style="font-size:9px;">⚡</span>' : ''}
      </div>
      <div class="qc">${m.content}</div>
      ${m.summary ? `<div class="qs">"${m.summary}"</div>` : ''}
      <div class="qm">${stHtml}<span>user:${m.userId || S.userId}</span></div>
    </div>`;
  return d;
}

function addActivity(m) {
  const c  = document.getElementById('dash-act');
  const em = c.querySelector('.empty');
  if (em) em.remove();
  c.insertBefore(makeQI(m), c.firstChild);
  if (c.children.length > 20) c.lastChild?.remove();
}

// ── INBOX ─────────────────────────────────────────────────
let curTab = 'p';

function switchTab(t) {
  curTab = t;
  ['p','d','b'].forEach(x => document.getElementById('tab-' + x).classList.toggle('active', x === t));
  renderInbox();
}

function renderInbox() {
  const c     = document.getElementById('inbox-c');
  c.innerHTML = '';
  const list  = curTab === 'p' ? S.pending : curTab === 'd' ? S.delivered : S.bypassed;
  if (!list.length) {
    const labels = {p:'Queue empty', d:'No delivered messages', b:'No bypassed messages'};
    const subs   = {p:'Send a notification or run Drive Sim', d:'Messages appear after delivery', b:'OTP / critical messages appear here'};
    c.innerHTML  = `<div class="empty"><div class="empty-icon">◎</div><div class="empty-title">${labels[curTab]}</div><div class="empty-sub">${subs[curTab]}</div></div>`;
    return;
  }
  [...list].reverse().forEach(m => c.appendChild(makeQI(m)));
  updStats();
}

function clearInbox() {
  S.pending = []; S.delivered = []; S.bypassed = [];
  S.stats   = {pending:0, delivered:0, deferred:0, bypass:0};
  updStats(); renderInbox(); toast('Inbox cleared');
}

// ── SEND NOTIFY ───────────────────────────────────────────
const PRESETS = {
  otp:     {sender:'bankapp',  content:'Your OTP is 7394. Valid for 5 minutes. Do not share.'},
  payment: {sender:'paytm',   content:'INR 2,500 debited from account ending 4821. Ref: TXN20260418.'},
  social:  {sender:'twitter', content:'@devguy liked your post: "Shipped the MVP!"'},
  spam:    {sender:'promo',   content:'CONGRATULATIONS! You WON a FREE iPhone! Click here now!'},
  alert:   {sender:'security',content:'New login from Chrome on Windows in Mumbai. Secure your account.'}
};

function setPreset(k) {
  document.getElementById('n-content').value = PRESETS[k].content;
  document.getElementById('n-sender').value  = PRESETS[k].sender;
}

// Local fallback classifiers (used only if backend returns nothing)
function guessC(c) {
  const t = c.toLowerCase();
  if (/otp|\b\d{4,6}\b/.test(t))                       return 'otp';
  if (/debit|credit|payment|transaction/.test(t))       return 'transactional';
  if (/offer|sale|discount|win|free|click/.test(t))     return 'marketing';
  if (/login|security|alert|breach|server|cpu/.test(t)) return 'alert';
  return 'social';
}
function guessP(c) {
  const t = c.toLowerCase();
  if (/otp|\b\d{4,6}\b|security|breach|emergency|server/.test(t)) return 'critical';
  if (/debit|credit|payment|meeting|taxi/.test(t))                  return 'high';
  if (/offer|sale|discount|free|win/.test(t))                       return 'low';
  return 'normal';
}

async function sendNotify() {
  const recipient_id = document.getElementById('n-rcpt').value;
  const content      = document.getElementById('n-content').value;
  if (!content.trim()) { toast('Enter a message first'); return; }

  const rbox = document.getElementById('n-result');
  rbox.textContent = 'Sending…';
  rbox.className   = 'rbox';

  try {
    const res = await API.post('/api/notify/', { recipient_id, content });
    rbox.textContent = JSON.stringify(res, null, 2);
    procResp(res, content, recipient_id, rbox);
  } catch(e) {
    rbox.textContent = 'Error: ' + e.message;
    rbox.className   = 'rbox err';
    toast('Backend error');
  }
}

function procResp(data, content, rid, el) {
  const ts  = new Date().toLocaleTimeString();
  const cat = data.category || guessC(content);
  const pri = data.priority  || guessP(content);

  if (data.status === 'dropped_spam') {
    el.className = 'rbox err';
    addActivity({content, cat, pri:'low', status:'pending', ts, userId:rid, summary:'spam blocked'});
    S.stats.pending++;
    toast('🚫 Spam dropped');

  } else if (data.status === 'sent_immediately') {
    el.className = 'rbox ok';
    const m = {content, cat, pri:'critical', status:'bypassed', bypass:true, ts, userId:rid, summary:data.summary};
    S.bypassed.push(m);
    addActivity(m);
    S.stats.bypass++;
    S.stats.delivered++;
    toast('⚡ Sent immediately');

  } else {
    el.className = 'rbox info';
    const m = {content, cat, pri, status:'pending', ts, userId:rid, summary:data.summary};
    S.pending.push(m);
    addActivity(m);
    S.stats.pending++;
    toast('📥 Queued');
  }

  showAna(data, content);
  updStats();
}

function showAna(data, content) {
  document.getElementById('ana-empty').style.display = 'none';
  document.getElementById('ana-prev').style.display  = 'block';
  const p   = data.priority || guessP(content);
  const cat = data.category || guessC(content);
  document.getElementById('ana-tags').innerHTML =
    `<span class="ptag ${PCLS[p] || 'p-l'}">${p}</span>` +
    `<span class="ctag">${cat}</span>` +
    (data.should_bypass_deferral ? '<span class="ptag p-c" style="font-size:9px;">⚡ bypass</span>' : '') +
    (data.is_spam ? '<span class="ptag p-c" style="font-size:9px;">🚫 spam</span>' : '');
  document.getElementById('ana-det').textContent =
    `is_spam:      ${data.is_spam ?? false}
confidence:   ${data.confidence ?? '—'}
priority:     ${p}
category:     ${cat}
summary:      ${data.summary || '—'}
bypass:       ${data.should_bypass_deferral ?? false}`;
}

// ── BEACON ────────────────────────────────────────────────
function updConn() {
  const v   = parseInt(document.getElementById('b-conn')?.value ?? 3);
  const L   = ['Offline (0)','2G (1)','3G (2)','4G/WiFi (3)'];
  const lbl = document.getElementById('conn-lbl');
  if (lbl) lbl.textContent = L[v];
  for (let i = 0; i < 4; i++) {
    const b = document.getElementById('cb' + i);
    if (b) b.className = 'cbar' + (i <= v ? ' c' + v : '');
  }
}

async function sendBeacon() {
  const user_id            = document.getElementById('b-uid').value;
  const lat                = parseFloat(document.getElementById('b-lat').value);
  const lng                = parseFloat(document.getElementById('b-lng').value);
  const connectivity_score = parseInt(document.getElementById('b-conn').value);

  try {
    const res = await API.post('/api/beacon/', {user_id, lat, lng, connectivity_score});
    document.getElementById('b-result').textContent = JSON.stringify(res, null, 2);

    if (res.messages && res.messages.length) {
      const ts = new Date().toLocaleTimeString();
      res.messages.forEach(m => {
        const msg = {...m, status:'delivered', deliveredAt:ts, userId:user_id, cat:m.category, pri:m.priority};
        const idx = S.pending.findIndex(p => p.content === m.content);
        if (idx !== -1) S.pending.splice(idx, 1);
        S.delivered.push(msg);
        S.stats.delivered++;
        addActivity(msg);
      });
      S.stats.pending = S.pending.length;
      updStats();
      const zb = document.getElementById('b-zone');
      if (res.zone) {
        const cls = {always_deliver:'za', defer:'zd', critical_only:'zc'}[res.zone.type] || 'za';
        if (zb) zb.innerHTML = `<span class="zbadge ${cls}">◎ ${res.zone.label} — ${res.zone.type}</span>`;
      }
      toast(`✓ ${res.messages.length} delivered`);
    } else {
      toast('Beacon — nothing deliverable');
    }
  } catch(e) {
    toast('Beacon failed');
  }
}

function useGPS() {
  if (!navigator.geolocation) { toast('Geolocation unavailable'); return; }
  navigator.geolocation.getCurrentPosition(
    p => {
      document.getElementById('b-lat').value = p.coords.latitude.toFixed(4);
      document.getElementById('b-lng').value = p.coords.longitude.toFixed(4);
      toast('✓ GPS updated');
    },
    () => toast('Location denied')
  );
}

// ── GEO MAP (LEAFLET) ─────────────────────────────────────
let geoMap = null;
let pendingPinLatLng = null;
let pendingPopup     = null;
const geoCircles     = [];
const geoMarkers     = [];

const ZONE_COLORS = {
  always_deliver: '#27ae60',
  defer:          '#e67e22',
  critical_only:  '#c0392b'
};

function initGeoMap() {
  if (geoMap) { geoMap.invalidateSize(); loadGeoToMap(); return; }

  geoMap = L.map('geo-map', {
    center: [13.0827, 80.2707],
    zoom: 14,
    zoomControl: true,
    attributionControl: false
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(geoMap);

  // Click handler — drop a pin anywhere
  geoMap.on('click', (e) => {
    const { lat, lng } = e.latlng;
    openZonePicker(lat, lng);
  });

  loadGeoToMap();
}

function openZonePicker(lat, lng) {
  if (pendingPopup) { geoMap.closePopup(pendingPopup); }

  const container = document.createElement('div');
  container.innerHTML = `
    <div class="popup-label">📍 Pin Location</div>
    <div class="popup-coords">${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
    <input class="popup-input" id="pp-label" placeholder="Label (e.g. home, office)" />
    <input class="popup-input" id="pp-radius" type="number" value="200" placeholder="Radius (m)" />
    <button class="zone-btn za-btn" onclick="submitZone(${lat},${lng},'always_deliver')">✓ Always Deliver</button>
    <button class="zone-btn zd-btn" onclick="submitZone(${lat},${lng},'defer')">⏸ Defer</button>
    <button class="zone-btn zc-btn" onclick="submitZone(${lat},${lng},'critical_only')">⚡ Critical Only</button>
  `;

  pendingPopup = L.popup({maxWidth: 220, className: 'geo-popup'})
    .setLatLng([lat, lng])
    .setContent(container)
    .openOn(geoMap);
}

async function submitZone(lat, lng, zone_type) {
  const label  = document.getElementById('pp-label')?.value?.trim() || 'custom';
  const radius = parseInt(document.getElementById('pp-radius')?.value) || 200;

  geoMap.closePopup();

  try {
    await API.post('/api/geo/create', {
      user_id: S.userId, label, lat, lng,
      radius_meters: radius, zone_type
    });
    toast(`Zone "${label}" added`);
  } catch(e) {
    toast('Could not save zone (check backend)');
  }

  // Always render locally regardless of API success
  renderGeoZone({label, lat, lng, radius_meters: radius, zone_type});
  loadGeoCards();
}

function renderGeoZone(z) {
  const color = ZONE_COLORS[z.zone_type] || '#888';
  const icon  = GEOIC[z.label] || GEOIC.default;

  // Circle
  const circle = L.circle([z.lat, z.lng], {
    radius: z.radius_meters,
    color, fillColor: color,
    fillOpacity: 0.15, weight: 2
  }).addTo(geoMap);

  // Marker
  const divIcon = L.divIcon({
    className: '',
    html: `<div style="background:${color};width:32px;height:32px;border-radius:50%;border:2px solid #000;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,.5);">${icon}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });

  const marker = L.marker([z.lat, z.lng], {icon: divIcon})
    .addTo(geoMap)
    .bindPopup(`<strong>${icon} ${z.label}</strong><br/><span style="font-size:11px;color:#999;font-family:monospace;">${z.zone_type}</span><br/><span style="font-size:11px;color:#999;">r=${z.radius_meters}m</span>`);

  geoCircles.push(circle);
  geoMarkers.push(marker);
}

async function loadGeoToMap() {
  // Clear existing layers
  geoCircles.forEach(c => geoMap.removeLayer(c)); geoCircles.length = 0;
  geoMarkers.forEach(m => geoMap.removeLayer(m)); geoMarkers.length = 0;

  // Always show seed zones
  SEED_ZONES.forEach(z => renderGeoZone(z));

  // Try to load from API
  try {
    const res = await API.get(`/api/geo/${S.userId}`);
    (res.profiles || []).forEach(z => {
      // Skip if it's already a seed zone
      const isSeed = SEED_ZONES.some(s => s.label === z.label && s.lat == z.lat);
      if (!isSeed) renderGeoZone(z);
    });
  } catch(e) {
    console.warn('loadGeoToMap API failed — using seeds only');
  }

  loadGeoCards();
}

async function loadGeoCards() {
  const container = document.getElementById('geo-cards');
  if (!container) return;

  let zones = [...SEED_ZONES];
  try {
    const res = await API.get(`/api/geo/${S.userId}`);
    const api = (res.profiles || []).filter(z => !SEED_ZONES.some(s => s.label === z.label));
    zones = [...zones, ...api];
  } catch(e) {}

  if (!zones.length) {
    container.innerHTML = '<div class="empty"><div class="empty-icon">📍</div><div class="empty-title">No zones yet</div><div class="empty-sub">Click on the map to add one</div></div>';
    return;
  }

  container.innerHTML = '';
  zones.forEach(z => {
    const div = document.createElement('div');
    div.className = 'geo-card';
    const icon = GEOIC[z.label] || GEOIC.default;
    const cls  = {always_deliver:'za', defer:'zd', critical_only:'zc'}[z.zone_type] || 'za';
    div.innerHTML = `
      <div class="geo-card-label">${icon} ${z.label}</div>
      <div class="geo-card-coords">${parseFloat(z.lat).toFixed(4)}, ${parseFloat(z.lng).toFixed(4)}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <span class="zbadge ${cls}">${z.zone_type}</span>
        <span style="font-size:10px;color:var(--muted);font-family:'JetBrains Mono',monospace;">r=${z.radius_meters}m</span>
      </div>`;
    div.onclick = () => geoMap && geoMap.flyTo([z.lat, z.lng], 16);
    container.appendChild(div);
  });
}

// Legacy loadGeo alias used by other pages
async function loadGeo() { loadGeoCards(); }

// ── MESSAGES FROM DB ──────────────────────────────────────
async function loadMessages() {
  try {
    const res  = await API.get(`/api/messages/${S.userId}`);
    const msgs = res.messages || [];
    // DB messages are already delivered — populate delivered tab
    // but only add ones not already tracked in session
    msgs.forEach(m => {
      const already = S.delivered.some(d => d.content === m.content && d.ts === (m.created_at || ''));
      if (!already) {
        S.delivered.push({
          ...m, status:'delivered',
          cat: m.category, pri: m.priority,
          ts: m.created_at ? new Date(m.created_at).toLocaleTimeString() : '—',
          userId: S.userId
        });
      }
    });
    updStats();
  } catch(e) {
    console.warn('loadMessages failed:', e.message);
  }
}

// ── SETTINGS ──────────────────────────────────────────────
function saveSettings() {
  S.apiBase = document.getElementById('set-url').value;
  S.userId  = document.getElementById('set-uid').value;
  document.getElementById('api-disp').textContent = S.apiBase.replace('http://','');
  toast('Settings saved');
}

function resetSession() {
  S.pending=[]; S.delivered=[]; S.bypassed=[];
  S.stats={pending:0,delivered:0,deferred:0,bypass:0};
  updStats();
  const da = document.getElementById('dash-act');
  if (da) da.innerHTML = '<div class="empty"><div class="empty-icon">◎</div><div class="empty-title">No activity</div><div class="empty-sub">Send a notification to begin</div></div>';
  toast('Session reset');
}

// ── DRIVE SIMULATOR ───────────────────────────────────────
function getSeg(pct) {
  for (let i = ROUTE.length - 1; i >= 0; i--)
    if (pct >= ROUTE[i].pct) return ROUTE[i];
  return ROUTE[0];
}

function initDriveUI() {
  const segs = document.getElementById('tsegs');
  if (!segs) return;
  segs.innerHTML = '';
  for (let i = 0; i < ROUTE.length - 1; i++) {
    const w   = ROUTE[i+1].pct - ROUTE[i].pct;
    const cls = ROUTE[i].sig >= 2 ? 'seg-g' : ROUTE[i].sig === 1 ? 'seg-a' : 'seg-r';
    const s   = document.createElement('div');
    s.className = `seg ${cls}`; s.style.flex = w;
    segs.appendChild(s);
  }
  const wp = document.getElementById('wps');
  if (!wp) return;
  wp.innerHTML = '';
  ROUTE.forEach((r, i) => {
    const d = document.createElement('div');
    d.className = 'wp'; d.id = 'wp' + i;
    d.innerHTML = `<div class="wp-dot"></div><div class="wp-name">${r.name}</div>`;
    wp.appendChild(d);
  });
  updDrivePanels();
  updSigUI(3);
}

function updSigUI(score) {
  const L   = ['Offline','2G','3G','4G'];
  const lbl = document.getElementById('sig-lbl');
  if (lbl) lbl.textContent = L[score] ?? '4G';
  const C = ['s0','s1','s2','s3'];
  for (let i = 0; i < 4; i++) {
    const b = document.getElementById('sb' + i);
    if (b) b.className = 'sigb' + (i <= score ? ' ' + C[score] : '');
  }
}

function toggleDrive() { DS.running ? stopDrive() : startDrive(); }

function startDrive() {
  if (DS.prog >= 100) { resetDrive(); return; }
  DS.running = true;
  document.getElementById('dr-btn').textContent = '⏸ Pause';
  addLog('Drive started', 'ok');

  DS.ivl = setInterval(() => {
    const sp = parseInt(document.getElementById('dr-spd')?.value) || 3;
    DS.prog  = Math.min(100, DS.prog + sp * 0.35);
    moveCar(DS.prog);
    const seg = getSeg(DS.prog);
    updSigUI(seg.sig);
    updDriveMsg(seg);
    ROUTE.forEach((r,i) => document.getElementById('wp'+i)?.classList.toggle('wpa', DS.prog >= r.pct));
    if (DS.prog >= 100) { stopDrive(); finishDrive(); }
  }, 100);

  // Fire notifications every 2.5s (slightly slower = more deferral build-up)
  DS.nivl = setInterval(() => injectNotif(), 2500);
}

function stopDrive() {
  DS.running = false;
  clearInterval(DS.ivl); clearInterval(DS.nivl);
  const btn = document.getElementById('dr-btn');
  if (btn) btn.textContent = '▶ Resume';
}

function moveCar(pct) {
  const rt  = document.getElementById('tsegs');
  const car = document.getElementById('dr-car');
  if (!rt || !car) return;
  const pad = 20;
  car.style.left = ((pct / 100) * (rt.offsetWidth - 2*pad) + pad) + 'px';
}

function updDriveMsg(seg) {
  const msgs = {
    0: 'No signal — all messages queued.',
    1: 'Weak 2G — deferring non-critical.',
    2: '3G — delivering messages now.',
    3: 'Strong 4G — real-time delivery.'
  };
  const zl = seg.zone === 'defer'         ? ' ◉ defer zone'
           : seg.zone === 'critical_only' ? ' ◉ critical_only'
           :                                ' ◉ always_deliver';
  const msgEl = document.getElementById('dr-msg');
  const zEl   = document.getElementById('dr-z');
  if (msgEl) msgEl.textContent = (msgs[seg.sig] || '') + zl;
  if (zEl)   zEl.textContent   = seg.name;

  // Flush local queue when signal returns
  const can = seg.sig >= 2 && seg.zone !== 'defer';
  if (can && DS.pQ.length > 0) {
    const toFlush = seg.zone === 'critical_only'
      ? DS.pQ.filter(m => (m.pri || m.priority) === 'critical')
      : [...DS.pQ];
    const keep = seg.zone === 'critical_only'
      ? DS.pQ.filter(m => (m.pri || m.priority) !== 'critical')
      : [];

    if (toFlush.length) {
      const ts = new Date().toLocaleTimeString();
      toFlush.forEach(m => {
        const dm = {...m, status:'delivered', deliveredAt:ts};
        DS.dQ.push(dm);
        DS.stats.d++;
        S.delivered.push(dm);
        S.stats.delivered++;
        const idx = S.pending.findIndex(p => p.content === m.content);
        if (idx !== -1) S.pending.splice(idx, 1);
      });
      DS.pQ      = keep;
      DS.stats.p = DS.pQ.length;
      S.stats.pending = S.pending.length;
      addLog(`✓ Flushed ${toFlush.length} at ${seg.name}`, 'ok');
      toast(`✓ ${toFlush.length} delivered at ${seg.name}`);
      updStats();
      updDrivePanels();
    }
  }
}

async function injectNotif() {
  if (!DS.running) return;
  const seg = getSeg(DS.prog);
  try {
    const gen = await API.get('/api/generate/');
    const res = await API.post('/api/notify/', {recipient_id: S.userId, content: gen.content});

    const ts  = new Date().toLocaleTimeString();
    const cat = res.category || guessC(gen.content);
    const pri = res.priority  || guessP(gen.content);
    const msg = {
      content: gen.content, cat, pri,
      priority: pri, category: cat,
      summary: res.summary || '',
      status: 'pending', ts, userId: S.userId,
      should_bypass_deferral: res.should_bypass_deferral
    };

    if (res.status === 'dropped_spam') {
      addLog(`🚫 spam: ${gen.content.slice(0,30)}…`, 'warn');
      return;
    }

    if (res.status === 'sent_immediately') {
      const bMsg = {...msg, status:'bypassed', bypass:true, deliveredAt:ts};
      DS.bQ.push(bMsg);
      DS.stats.b++;
      S.bypassed.push(bMsg);
      S.stats.bypass++;
      S.stats.delivered++;
      addActivity(bMsg);
      addLog(`⚡ bypass: ${gen.content.slice(0,30)}…`, 'ok');
      addRain(bMsg, 'nri-b', false);
    } else {
      const can = seg.sig >= 2 && seg.zone !== 'defer';
      if (can) {
        const dMsg = {...msg, status:'delivered', deliveredAt:ts};
        DS.dQ.push(dMsg);
        DS.stats.d++;
        S.delivered.push(dMsg);
        S.stats.delivered++;
        addActivity(dMsg);
        addLog(`✓ delivered: ${gen.content.slice(0,30)}…`, 'ok');
        addRain(dMsg, 'nri-d', false);
      } else {
        DS.pQ.push(msg);
        DS.stats.p = DS.pQ.length;
        S.pending.push({...msg});
        S.stats.pending++;
        S.stats.deferred++;
        addActivity({...msg, status:'pending'});
        addLog(`⏸ deferred: ${gen.content.slice(0,30)}…`, 'warn');
        addRain(msg, 'nri-p', true);
      }
    }

    updStats();
    updDrivePanels();

    // Sync server queue
    API.post('/api/beacon/', {
      user_id: S.userId,
      lat: 13.0827 + Math.random() * 0.01,
      lng: 80.2707 + Math.random() * 0.01,
      connectivity_score: seg.sig
    }).catch(() => {}); // non-blocking, ignore errors

  } catch(e) {
    addLog('❌ ' + e.message, 'err');
  }
}

function addRain(m, cls, blocked) {
  const rain = document.getElementById('nrain');
  if (!rain) return;
  const el  = document.createElement('div');
  el.className = `nri ${cls}`;
  el.style.left = (Math.random() * 60 + 5) + '%';
  el.textContent = (blocked ? '⏸ ' : '') + (m.content || '').slice(0, 36) + '…';
  rain.appendChild(el);
  DS.rain.push(el);
  requestAnimationFrame(() => { el.style.top = (15 + Math.random() * 55) + '%'; });
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 500); }, 3000);
  if (DS.rain.length > 12) DS.rain.shift()?.remove();
}

function updDrivePanels() {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('dr-p',  DS.stats.p);
  set('dr-d',  DS.stats.d);
  set('dr-b',  DS.stats.b);
  set('dqpc',  DS.pQ.length);
  set('dqdc',  DS.dQ.length);
  set('dqbc',  DS.bQ.length);
  renderDQL('dqpl', DS.pQ, 'var(--amber)');
  renderDQL('dqdl', DS.dQ, 'var(--green)');
  renderDQL('dqbl', DS.bQ, 'var(--red)');
}

function renderDQL(id, arr, color) {
  const c = document.getElementById(id);
  if (!c) return;
  if (!arr.length) {
    c.innerHTML = `<div style="text-align:center;padding:8px;font-size:10px;color:var(--dim);font-family:'JetBrains Mono',monospace;">empty</div>`;
    return;
  }
  c.innerHTML = '';
  [...arr].reverse().slice(0, 8).forEach(m => {
    const d   = document.createElement('div');
    d.className = 'dqitem';
    const pri = m.pri || m.priority || 'normal';
    const cat = m.cat || m.category || 'social';
    d.innerHTML = `
      <div class="dqdot" style="background:${color}"></div>
      <div class="dqmsg">${(m.content||'').slice(0,42)}${(m.content||'').length>42?'…':''}</div>
      <div class="dqinfo">
        <span class="ptag ${PCLS[pri]||'p-l'}" style="font-size:9px;padding:1px 4px;">${pri}</span>
        ${m.deliveredAt ? `<span style="color:var(--green)">✓</span>` : ''}
      </div>`;
    c.appendChild(d);
  });
}

function finishDrive() {
  const btn = document.getElementById('dr-btn');
  const msg = document.getElementById('dr-msg');
  if (btn) btn.textContent = '▶ Start Drive';
  if (msg) msg.textContent = `Complete — Delivered:${DS.stats.d}  Bypassed:${DS.stats.b}  Pending:${DS.stats.p}`;
  addLog(`Done · D:${DS.stats.d} B:${DS.stats.b} P:${DS.stats.p}`, 'ok');
  toast('🏁 Drive complete!');
}

function resetDrive() {
  stopDrive();
  DS.prog=0; DS.pQ=[]; DS.dQ=[]; DS.bQ=[];
  DS.stats={p:0,d:0,b:0};
  DS.rain.forEach(e => e.remove()); DS.rain=[];
  const btn = document.getElementById('dr-btn');
  const msg = document.getElementById('dr-msg');
  const car = document.getElementById('dr-car');
  if (btn) btn.textContent = '▶ Start Drive';
  if (msg) msg.textContent = 'Press Start — notifications queue in dead zones and flush when signal returns.';
  if (car) car.style.left  = '20px';
  updDrivePanels();
  document.querySelectorAll('.wpa').forEach(e => e.classList.remove('wpa'));
  updSigUI(3);
  addLog('Drive reset', 'warn');
}