// ─── API Helper ───────────────────────────────────────────────────────────────
const API = {
  get base() { return S.apiBase; },
  async post(path, body) {
    const res = await fetch(`${this.base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error("API error " + res.status);
    return res.json();
  },
  async get(path) {
    const res = await fetch(`${this.base}${path}`);
    if (!res.ok) throw new Error("API error " + res.status);
    return res.json();
  }
};

// ─── Global State ─────────────────────────────────────────────────────────────
const S = {
  apiBase: 'http://localhost:8000',
  userId:  'user_123',
  pending:   [],
  delivered: [],
  bypassed:  [],
  stats: { pending: 0, delivered: 0, deferred: 0, bypass: 0 }
};

// ─── Route ────────────────────────────────────────────────────────────────────
const ROUTE = [
  {name:'Home',     sig:3, zone:'always_deliver', pct:0},
  {name:'Ring Rd',  sig:3, zone:'always_deliver', pct:13},
  {name:'Tunnel',   sig:0, zone:'defer',           pct:25},
  {name:'Suburb',   sig:1, zone:'defer',           pct:38},
  {name:'Highway',  sig:3, zone:'always_deliver',  pct:51},
  {name:'Metro',    sig:2, zone:'critical_only',   pct:64},
  {name:'Mall',     sig:3, zone:'always_deliver',  pct:78},
  {name:'Office',   sig:3, zone:'always_deliver',  pct:100}
];

// ─── Drive State ──────────────────────────────────────────────────────────────
const DS = {
  running: false, prog: 0,
  ivl: null, nivl: null,
  pQ: [], dQ: [], bQ: [],
  stats: { p: 0, d: 0, b: 0 },
  rain: []
};

// ─── Lookups ──────────────────────────────────────────────────────────────────
const CATICON = {otp:'🔐', transactional:'💳', social:'💬', marketing:'📢', alert:'⚠️'};
const CATBG   = {
  otp:           'background:var(--red-soft)',
  transactional: 'background:var(--amber-soft)',
  social:        'background:var(--green-soft)',
  marketing:     'background:rgba(127,127,160,0.1)',
  alert:         'background:var(--amber-soft)'
};
const PCLS  = {critical:'p-c', high:'p-h', normal:'p-n', low:'p-l'};
const GEOIC = {home:'🏠', office:'🏢', subway:'🚇', gym:'🏋️', hospital:'🏥', airport:'✈️', default:'📍'};

// ─── Init ─────────────────────────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
  document.getElementById('api-disp').textContent = S.apiBase.replace('http://','');
  updConn();
  updStats();
  loadGeo();
});

// ─── Navigation ──────────────────────────────────────────────────────────────
function showPage(id, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  if (el) el.classList.add('active');
  const T = {
    dashboard:'Dashboard', inbox:'Inbox', drive:'Drive Simulator',
    notify:'Send Notification', beacon:'Beacon Emitter',
    geo:'Geo Zones', logic:'Logic Diagram', settings:'Settings'
  };
  document.getElementById('page-title').textContent = T[id] || id;
  if (id === 'geo')   loadGeo();
  if (id === 'drive') initDriveUI();
  if (id === 'inbox') renderInbox();
}

// ─── Toast & Log ─────────────────────────────────────────────────────────────
function toast(msg, t='ok') {
  const el = document.getElementById('toast');
  el.textContent = msg; el.className = 'show t' + t;
  setTimeout(() => el.className = '', 2600);
}

function addLog(msg, t='info') {
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

// ─── Stats ────────────────────────────────────────────────────────────────────
function updStats() {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('s-p',     S.stats.pending);
  set('s-d',     S.stats.delivered);
  set('s-df',    S.stats.deferred);
  set('s-b',     S.stats.bypass);
  set('nav-qc',  S.pending.length);
  set('tcc-p',   S.pending.length);
  set('tcc-d',   S.delivered.length);
  set('tcc-b',   S.bypassed.length);
}

// ─── Notification Card ───────────────────────────────────────────────────────
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
    <div class="qic" style="${CATBG[cat] || 'background:var(--surface2)'}">${CATICON[cat] || '📩'}</div>
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

// ─── Inbox ────────────────────────────────────────────────────────────────────
let curTab = 'p';

function switchTab(t) {
  curTab = t;
  ['p','d','b'].forEach(x => document.getElementById('tab-' + x).classList.toggle('active', x === t));
  renderInbox();
}

function renderInbox() {
  const c    = document.getElementById('inbox-c');
  c.innerHTML = '';
  const list = curTab === 'p' ? S.pending : curTab === 'd' ? S.delivered : S.bypassed;
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

// ─── Send Notify Page ─────────────────────────────────────────────────────────
const PRESETS = {
  otp:     {sender:'bankapp',  content:'Your OTP is 7394. Valid for 5 minutes. Do not share.'},
  payment: {sender:'paytm',   content:'INR 2,500 debited from your account ending 4821. Ref: TXN20260418.'},
  social:  {sender:'twitter', content:'@techbro liked your post: "Just shipped the new feature"'},
  spam:    {sender:'promo',   content:'CONGRATULATIONS! You WON a FREE iPhone! Click here to claim your discount offer!'},
  alert:   {sender:'security',content:'New login from Chrome on Windows in Mumbai. Secure your account immediately.'}
};

function setPreset(k) {
  document.getElementById('n-content').value = PRESETS[k].content;
  document.getElementById('n-sender').value  = PRESETS[k].sender;
}

// Local guesses used only if backend returns no category/priority
function guessC(c) {
  const t = c.toLowerCase();
  if (/otp|\b\d{4,6}\b/.test(t))                        return 'otp';
  if (/debit|credit|payment|transaction/.test(t))        return 'transactional';
  if (/offer|sale|discount|win|free|click/.test(t))      return 'marketing';
  if (/login|security|alert|breach|server|cpu/.test(t))  return 'alert';
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
  if (!content.trim()) { toast('Enter a message first', 'err'); return; }

  const rbox = document.getElementById('n-result');
  rbox.textContent = 'Analyzing with Mistral…';

  try {
    const res = await API.post("/api/notify/", { recipient_id, content });
    rbox.textContent = JSON.stringify(res, null, 2);
    procResp(res, content, recipient_id, rbox);
  } catch(e) {
    rbox.textContent = 'Error: ' + e.message;
    toast('Backend error', 'err');
  }
}

function procResp(data, content, rid, el) {
  const ts  = new Date().toLocaleTimeString();
  const cat = data.category || guessC(content);
  const pri = data.priority  || guessP(content);

  if (data.status === 'dropped_spam') {
    el.className = 'rbox err';
    addActivity({content, cat, pri:'low', status:'pending', ts, userId:rid, summary:'🚫 spam blocked'});
    S.stats.pending++;
    toast('🚫 Spam dropped', 'err');

  } else if (data.status === 'sent_immediately') {
    el.className = 'rbox ok';
    const m = {content, cat, pri:'critical', status:'bypassed', bypass:true, ts, userId:rid, summary:data.summary};
    S.bypassed.push(m);
    addActivity(m);
    S.stats.bypass++;
    S.stats.delivered++;
    toast('⚡ Sent immediately', 'ok');

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
    (data.is_spam ? '<span class="ptag" style="background:var(--red-soft);color:var(--red);border:1px solid rgba(255,107,107,.25);font-size:9px;">🚫 spam</span>' : '');
  document.getElementById('ana-det').textContent =
    `is_spam:      ${data.is_spam ?? false}\nconfidence:   ${data.confidence ?? '—'}\npriority:     ${p}\ncategory:     ${cat}\nsummary:      ${data.summary || '—'}\nshould_bypass:${data.should_bypass_deferral ?? false}`;
}

// ─── Beacon Page ─────────────────────────────────────────────────────────────
function updConn() {
  const v = parseInt(document.getElementById('b-conn')?.value || 3);
  const L = ['Offline (0)','2G (1)','3G (2)','4G/WiFi (3)'];
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
    const res = await API.post("/api/beacon/", {user_id, lat, lng, connectivity_score});
    document.getElementById('b-result').textContent = JSON.stringify(res, null, 2);

    if (res.messages && res.messages.length) {
      const ts = new Date().toLocaleTimeString();
      res.messages.forEach(m => {
        const msg = {...m, status:'delivered', deliveredAt:ts, userId:user_id};
        // Move from pending → delivered
        const idx = S.pending.findIndex(p => p.content === m.content);
        if (idx !== -1) S.pending.splice(idx, 1);
        S.delivered.push(msg);
        S.stats.delivered++;
        addActivity(msg);
      });
      S.stats.pending = S.pending.length;
      updStats();
      toast(`✓ ${res.messages.length} message(s) delivered`, 'ok');
    } else {
      toast('Beacon processed — nothing deliverable');
    }
  } catch(e) {
    toast('Beacon failed', 'err');
  }
}

function showZone(label, type) {
  const t   = type || 'always_deliver';
  const cls = {always_deliver:'za', defer:'zd', critical_only:'zc'}[t] || 'za';
  const zb  = document.getElementById('b-zone');
  if (zb) zb.innerHTML = `<span class="zbadge ${cls}">◎ zone: ${label} — ${t}</span>`;
  const tz  = document.getElementById('tbar-zone');
  if (tz) { tz.innerHTML = `<span class="zbadge ${cls}" style="font-size:10px;padding:3px 10px;">◎ ${label}</span>`; tz.style.display='flex'; }
}

function useGPS() {
  if (!navigator.geolocation) { toast('Geolocation unavailable','err'); return; }
  navigator.geolocation.getCurrentPosition(
    p => {
      document.getElementById('b-lat').value = p.coords.latitude.toFixed(4);
      document.getElementById('b-lng').value = p.coords.longitude.toFixed(4);
      toast('✓ GPS updated');
    },
    () => toast('Location denied','err')
  );
}

// ─── Geo Zones ────────────────────────────────────────────────────────────────
async function loadGeo() {
  try {
    const res       = await API.get(`/api/geo/${S.userId}`);
    const container = document.getElementById("geo-cards");
    if (!container) return;
    container.innerHTML = "";
    if (!res.profiles || !res.profiles.length) {
      container.innerHTML = '<div class="empty"><div class="empty-icon">◎</div><div class="empty-title">No zones yet</div><div class="empty-sub">Add a geo zone below</div></div>';
      return;
    }
    res.profiles.forEach(p => {
      const div = document.createElement("div");
      div.className = "gc";
      const icon = GEOIC[p.label] || GEOIC.default;
      const cls  = {always_deliver:'za', defer:'zd', critical_only:'zc'}[p.zone_type] || 'za';
      div.innerHTML = `
        <div class="glbl">${icon} ${p.label}</div>
        <div class="gco">${parseFloat(p.lat).toFixed(4)}, ${parseFloat(p.lng).toFixed(4)}</div>
        <div class="gco">radius: ${p.radius_meters}m</div>
        <div class="gco"><span class="zbadge ${cls}" style="font-size:10px;">${p.zone_type}</span></div>`;
      container.appendChild(div);
    });
  } catch(e) { console.warn('loadGeo failed:', e); }
}

async function addGeo() {
  const data = {
    user_id:       S.userId,
    label:         document.getElementById("gl").value,
    lat:           parseFloat(document.getElementById("glat").value),
    lng:           parseFloat(document.getElementById("glng").value),
    radius_meters: parseInt(document.getElementById("gr").value),
    zone_type:     document.getElementById("gt").value
  };
  if (!data.label || isNaN(data.lat) || isNaN(data.lng)) { toast('Fill all fields','err'); return; }
  await API.post("/api/geo/create", data);
  toast("Zone added ✓");
  loadGeo();
}

// ─── Inbox (DB) ───────────────────────────────────────────────────────────────
async function loadMessages() {
  try {
    const res  = await API.get(`/api/messages/${S.userId}`);
    const msgs = res.messages || [];
    // All DB messages are historical delivered messages
    S.delivered = msgs.map(m => ({
      ...m,
      status:      'delivered',
      cat:          m.category,
      pri:          m.priority,
      ts:           m.created_at ? new Date(m.created_at).toLocaleTimeString() : new Date().toLocaleTimeString(),
      userId:       S.userId
    }));
    updStats();
    renderInbox();
  } catch(e) { console.warn('loadMessages failed:', e); }
}

// ─── Settings ────────────────────────────────────────────────────────────────
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

// ─── Drive Simulator ──────────────────────────────────────────────────────────
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
  const L   = ['Offline','2G','3G','4G/WiFi'];
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

  DS.nivl = setInterval(() => injectNotif(), 2000);
}

function stopDrive() {
  DS.running = false;
  clearInterval(DS.ivl); clearInterval(DS.nivl);
  document.getElementById('dr-btn').textContent = '▶ Resume';
}

function moveCar(pct) {
  const rt  = document.getElementById('rt');
  const car = document.getElementById('dr-car');
  if (!rt || !car) return;
  const pad = 30;
  car.style.left = ((pct / 100) * (rt.offsetWidth - 2*pad) + pad) + 'px';
}

function updDriveMsg(seg) {
  const msgs = {
    0:'No signal — all messages queued.',
    1:'Weak 2G — deferring non-critical.',
    2:'3G — delivering messages now.',
    3:'Strong 4G — messages delivered in real time.'
  };
  const zl = seg.zone === 'defer'         ? ' ◉ defer zone'
           : seg.zone === 'critical_only' ? ' ◉ critical_only zone'
           :                                ' ◉ always_deliver';
  const msgEl = document.getElementById('dr-msg');
  const zEl   = document.getElementById('dr-z');
  if (msgEl) msgEl.textContent = (msgs[seg.sig] || '') + zl;
  if (zEl)   zEl.textContent   = seg.name;

  // Flush pending queue if conditions allow
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
      addLog(`✓ Flushed ${toFlush.length} msg(s) at ${seg.name}`, 'ok');
      toast(`✓ ${toFlush.length} msgs delivered at ${seg.name}`, 'ok');
      updStats();
      updDrivePanels();
    }
  }
}

async function injectNotif() {
  if (!DS.running) return;
  const seg = getSeg(DS.prog);
  try {
    const gen = await API.get("/api/generate/");
    const res = await API.post("/api/notify/", {recipient_id: S.userId, content: gen.content});

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
      addLog(`🚫 spam dropped: ${gen.content.slice(0,35)}…`, 'warn');
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
      addLog(`⚡ bypass: ${gen.content.slice(0,35)}…`, 'ok');
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
        addLog(`✓ delivered: ${gen.content.slice(0,35)}…`, 'ok');
        addRain(dMsg, 'nri-d', false);
      } else {
        DS.pQ.push(msg);
        DS.stats.p = DS.pQ.length;
        S.pending.push({...msg});
        S.stats.pending++;
        S.stats.deferred++;
        addActivity({...msg, status:'pending'});
        addLog(`⏸ deferred: ${gen.content.slice(0,35)}…`, 'warn');
        addRain(msg, 'nri-p', true);
      }
    }

    updStats();
    updDrivePanels();

    // Sync server queue with beacon
    await API.post("/api/beacon/", {
      user_id: S.userId,
      lat: 13.0827 + Math.random() * 0.01,
      lng: 80.2707 + Math.random() * 0.01,
      connectivity_score: seg.sig
    });

  } catch(e) {
    addLog("❌ backend error: " + e.message, "err");
  }
}

function addRain(m, cls, blocked) {
  const rain = document.getElementById('nrain');
  if (!rain) return;
  const el  = document.createElement('div');
  el.className = `nri ${cls}`;
  el.style.left = (Math.random() * 55 + 5) + '%';
  el.textContent = (blocked ? '⏸ ' : '') + (m.content || '').slice(0, 34) + '…';
  rain.appendChild(el);
  DS.rain.push(el);
  requestAnimationFrame(() => { el.style.top = (15 + Math.random() * 50) + '%'; });
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 500); }, 3200);
  if (DS.rain.length > 14) DS.rain.shift()?.remove();
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
    c.innerHTML = `<div style="padding:10px;text-align:center;font-size:11px;color:var(--text-dim);font-family:'DM Mono',monospace;">empty</div>`;
    return;
  }
  c.innerHTML = '';
  [...arr].reverse().slice(0, 10).forEach(m => {
    const d   = document.createElement('div');
    d.className = 'dqitem';
    const pri = m.pri || m.priority || 'normal';
    const cat = m.cat || m.category || 'social';
    d.innerHTML = `
      <div class="dqdot" style="background:${color}"></div>
      <div style="flex:1;">
        <div class="dqmsg">${(m.content||'').slice(0,55)}${(m.content||'').length>55?'…':''}</div>
        <div class="dqinfo">
          <span class="ptag ${PCLS[pri]||'p-l'}" style="font-size:9px;padding:1px 5px;">${pri}</span>
          <span>${cat}</span>
          ${m.deliveredAt ? `<span style="color:var(--green)">@${m.deliveredAt}</span>` : ''}
        </div>
      </div>
      <div class="dqts">${m.ts||''}</div>`;
    c.appendChild(d);
  });
}

function finishDrive() {
  document.getElementById('dr-btn').textContent = '▶ Start Drive';
  const msgEl = document.getElementById('dr-msg');
  if (msgEl) msgEl.textContent = `Drive complete! Delivered:${DS.stats.d} Bypassed:${DS.stats.b} Still pending:${DS.stats.p}`;
  addLog(`Finished — Delivered:${DS.stats.d} Bypassed:${DS.stats.b} Pending:${DS.stats.p}`, 'ok');
  toast('🏁 Drive complete!');
}

function resetDrive() {
  stopDrive();
  DS.prog=0; DS.pQ=[]; DS.dQ=[]; DS.bQ=[];
  DS.stats={p:0,d:0,b:0}; DS.rain.forEach(e=>e.remove()); DS.rain=[];
  const btn = document.getElementById('dr-btn');
  const msg = document.getElementById('dr-msg');
  const car = document.getElementById('dr-car');
  if (btn) btn.textContent = '▶ Start Drive';
  if (msg) msg.textContent = 'Press Start to begin.';
  if (car) car.style.left  = '30px';
  updDrivePanels();
  document.querySelectorAll('.wpa').forEach(e => e.classList.remove('wpa'));
  updSigUI(3);
  addLog('Drive reset','warn');
}