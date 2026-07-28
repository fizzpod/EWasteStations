/* ===========================================================
   FIREBASE SETUP
=========================================================== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot,
  collection, query, orderBy, limit, arrayUnion
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCcMhEPSxrb2OPxJx-9bCPX6RH6m2wzC_E",
  authDomain: "circuitback-fizz.firebaseapp.com",
  projectId: "circuitback-fizz",
  storageBucket: "circuitback-fizz.firebasestorage.app",
  messagingSenderId: "1015578673409",
  appId: "1:1015578673409:web:85abad75255d0e8f775b00"
};
const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
const db = getFirestore(fbApp);

/* ===========================================================
   STATIC DATA
=========================================================== */
const CATS = {
  ict:        { label:'ICT equipment',        desc:'Laptops, PCs, printers, phones, tablets, routers, monitors', pts:30 },
  mobility:   { label:'Electric mobility',     desc:'PMDs, power-assisted bicycles, e-scooters',                 pts:40 },
  large:      { label:'Large appliances',      desc:'Fridges, washing machines, aircon units, dryers',           pts:50 },
  small:      { label:'Small appliances',      desc:'Rice cookers, kettles, fans, gaming consoles, audio gear',  pts:15 },
  batteries:  { label:'Batteries',             desc:'AA/AAA/D/C, 9V, button cell — tape the terminals first',    pts:5  },
  bulbs:      { label:'Bulbs & lamps',         desc:'Light bulbs and compact lamps (not long tubes)',            pts:5  },
};

const CAT_ICONS = {
  ict: '<svg viewBox="0 0 24 24" fill="none" stroke="#2F6F5E" stroke-width="1.6"><rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16v4"/></svg>',
  mobility: '<svg viewBox="0 0 24 24" fill="none" stroke="#7A5C9E" stroke-width="1.6"><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M6 18l4-10h4l4 10M10 8h4"/></svg>',
  large: '<svg viewBox="0 0 24 24" fill="none" stroke="#C97B3F" stroke-width="1.6"><rect x="5" y="2" width="14" height="20" rx="1.5"/><path d="M8 7h8M8 12h8M8 17h4"/></svg>',
  small: '<svg viewBox="0 0 24 24" fill="none" stroke="#D9A441" stroke-width="1.6"><rect x="4" y="8" width="16" height="11" rx="1.5"/><path d="M8 8V6a4 4 0 018 0v2"/></svg>',
  batteries: '<svg viewBox="0 0 24 24" fill="none" stroke="#B84A3E" stroke-width="1.6"><rect x="3" y="7" width="16" height="10" rx="1.5"/><path d="M19 10v4M8 7V5h4v2"/></svg>',
  bulbs: '<svg viewBox="0 0 24 24" fill="none" stroke="#E4C05C" stroke-width="1.6"><path d="M9 18h6M10 21h4"/><circle cx="12" cy="10" r="6"/><path d="M12 4V2"/></svg>',
};

const PROFILES = {
  full:     { label:'ICT + Batteries + Lamps (self-service bin)',      color:'#2F6F5E' },
  battlamp: { label:'Batteries + Lamps (self-service bin)',            color:'#C97B3F' },
  battonly: { label:'Batteries only (self-service bin)',               color:'#E4C05C' },
  ictbatt:  { label:'ICT + Batteries (staff-assisted)',                color:'#7A5C9E' },
  small:    { label:'Small appliances & non-regulated e-waste',        color:'#3E6FA8' },
  drive:    { label:'Temporary collection drive (all regulated items)',color:'#B84A3E' },
  other:    { label:'Other collection point',                          color:'#5a6a60' },
};

const REWARDS = [
  { id:'r5',  name:'$5 e-Shop Voucher',              cost:100 },
  { id:'tote',name:'Recycled-material Tote Bag',      cost:150 },
  { id:'r10', name:'$10 Grab Voucher',                cost:250 },
  { id:'tree',name:'A Tree Planted In Your Name',     cost:400 },
  { id:'r20', name:'$20 NTUC Voucher',                cost:600 },
  { id:'top', name:'Top Recycler Badge + $30 Voucher',cost:1000 },
];

const PERKS = [
  { id:'p250',  threshold:250,  type:'title',      value:'Field Recruit' },
  { id:'p1000', threshold:1000, type:'multiplier', value:2, hours:24 },
  { id:'p2000', threshold:2000, type:'title',      value:'Circuit Master' },
  { id:'p4000', threshold:4000, type:'multiplier', value:3, hours:24 },
  { id:'p8000', threshold:8000, type:'title',      value:'Grid Legend' },
];

/* ===========================================================
   STATE
=========================================================== */
let STATIONS = [];
let STATIONS_BY_ID = {};
let userLoc = null;
let userMarker = null;
let traceLine = null;
let activeProfiles = new Set(Object.keys(PROFILES));
let itemFilter = 'any';
let currentUser = null;
let userDocUnsub = null;
let userData = null;

/* ===========================================================
   MAP SETUP
=========================================================== */
const map = L.map('map', { zoomControl:true }).setView([1.3521, 103.8198], 11.4);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors', maxZoom: 19
}).addTo(map);

const clusterGroup = L.markerClusterGroup({
  iconCreateFunction: cluster => L.divIcon({
    html: `<div class="marker-cluster-custom" style="width:${34+Math.min(cluster.getChildCount(),40)}px;height:${34+Math.min(cluster.getChildCount(),40)}px;">${cluster.getChildCount()}</div>`,
    className:'', iconSize:[38,38]
  })
});
map.addLayer(clusterGroup);

const userIcon = L.divIcon({
  className:'',
  html:`<div style="width:18px;height:18px;border-radius:50%;background:#12231C;border:3px solid #E4C05C;box-shadow:0 0 0 6px rgba(228,192,92,0.25)"></div>`,
  iconSize:[18,18], iconAnchor:[9,9]
});

function profileKey(s){
  if(s.mode === 'drive') return 'drive';
  const set = s.accepts.slice().sort().join(',');
  if(set === 'batteries,bulbs,ict') return 'full';
  if(set === 'batteries,bulbs') return 'battlamp';
  if(set === 'batteries') return 'battonly';
  if(set === 'batteries,ict') return 'ictbatt';
  if(set === 'small') return 'small';
  return 'other';
}

function stationIcon(profile, shape){
  const color = PROFILES[profile].color;
  const radius = shape === 'square' ? '3px' : '50%';
  return L.divIcon({
    className:'',
    html:`<div style="width:14px;height:14px;border-radius:${radius};background:${color};border:2px solid #F7F8F3;box-shadow:0 1px 4px rgba(0,0,0,0.35)"></div>`,
    iconSize:[14,14], iconAnchor:[7,7]
  });
}

function passesFilters(s){
  const p = profileKey(s);
  if(!activeProfiles.has(p)) return false;
  if(itemFilter !== 'any' && !s.accepts.includes(itemFilter)) return false;
  return true;
}

function haversine(lat1, lng1, lat2, lng2){
  const R = 6371;
  const dLat = (lat2-lat1) * Math.PI/180;
  const dLng = (lng2-lng1) * Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function rebuildMapMarkers(){
  clusterGroup.clearLayers();
  const layers = [];
  STATIONS.forEach(s => {
    if(!passesFilters(s)) return;
    const profile = profileKey(s);
    const shape = s.mode === 'drive' ? 'square' : 'circle';
    const m = L.marker([s.lat, s.lng], { icon: stationIcon(profile, shape) });
    m.bindPopup(`<b>${s.name}</b><br>${PROFILES[profile].label}<br><span style="color:#5a6a60">${s.addr}</span>`);
    m.on('click', () => focusStation(s));
    layers.push(m);
  });
  clusterGroup.addLayers(layers);
}

function renderStationList(){
  const listEl = document.getElementById('stationList');
  let items = STATIONS.filter(passesFilters);

  if(userLoc){
    items = items.map(s => ({...s, dist: haversine(userLoc.lat, userLoc.lng, s.lat, s.lng)}));
    items.sort((a,b)=>a.dist-b.dist);
    items = items.slice(0, 10);
  } else {
    items = items.slice(0, 10);
  }

  listEl.innerHTML = '';

  if(userLoc && itemFilter !== 'any' && items.length){
    const hint = document.createElement('div');
    hint.className = 'status-line';
    hint.style.marginBottom = '2px';
    hint.textContent = `Nearest station accepting ${CATS[itemFilter].label}: ${items[0].dist.toFixed(2)} km away`;
    listEl.appendChild(hint);
  }

  items.forEach(s => {
    const profile = profileKey(s);
    const card = document.createElement('div');
    card.className = 'station-card';
    const distHtml = s.dist !== undefined ? `<span class="dist">${s.dist.toFixed(2)} km</span>` : '';
    card.innerHTML = `
      <div class="top"><span class="name">${s.name}</span>${distHtml}</div>
      <div class="addr">${s.addr}</div>
      <div class="tags">
        <span class="tag" style="color:${PROFILES[profile].color}">${PROFILES[profile].label}</span>
        ${s.mode === 'manned' ? '<span class="tag">Staff-assisted</span>' : ''}
        ${s.mode === 'drive' ? '<span class="tag">Temporary drive</span>' : ''}
      </div>
      <a class="directions" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}">Get directions →</a>
    `;
    card.addEventListener('click', (e)=>{ if(e.target.tagName!=='A') focusStation(s); });
    listEl.appendChild(card);
  });

  if(items.length === 0){
    listEl.innerHTML = '<div class="empty-hint">No stations match your filters. Try widening the search.</div>';
  }
}

function focusStation(s){
  map.setView([s.lat, s.lng], 16, { animate:true });
  if(userLoc) drawTrace(s);
}

function drawTrace(station){
  if(traceLine) map.removeLayer(traceLine);
  traceLine = L.polyline([[userLoc.lat,userLoc.lng],[station.lat,station.lng]], {
    color:'#C97B3F', weight:2.5, dashArray:'1 9', className:'trace-line'
  }).addTo(map);
}

/* ---------------- Geolocation ---------------- */
const statusLine = document.getElementById('statusLine');

document.getElementById('locateBtn').addEventListener('click', () => {
  if(!navigator.geolocation){
    statusLine.textContent = 'Geolocation not supported on this browser — click the map instead.';
    return;
  }
  statusLine.textContent = 'Requesting location…';
  navigator.geolocation.getCurrentPosition(
    pos => setUserLocation(pos.coords.latitude, pos.coords.longitude, 'GPS'),
    () => { statusLine.textContent = 'Location denied — click anywhere on the map to set a pin instead.'; },
    { enableHighAccuracy:true, timeout:8000 }
  );
});

map.on('click', e => setUserLocation(e.latlng.lat, e.latlng.lng, 'map click'));

function setUserLocation(lat, lng, source){
  userLoc = { lat, lng };
  if(userMarker) map.removeLayer(userMarker);
  userMarker = L.marker([lat,lng], { icon:userIcon }).addTo(map).bindPopup('You are here').openPopup();
  map.setView([lat,lng], 13);
  statusLine.textContent = `Location set via ${source}. Distances updated below.`;
  renderStationList();

  const candidates = STATIONS.filter(passesFilters)
    .map(s=>({...s, dist:haversine(lat,lng,s.lat,s.lng)}))
    .sort((a,b)=>a.dist-b.dist);
  if(candidates[0]) drawTrace(candidates[0]);
}

/* ---------------- Item filter + legend ---------------- */
const itemFilterSelect = document.getElementById('itemFilter');
Object.entries(CATS).forEach(([key,c]) => {
  const opt = document.createElement('option');
  opt.value = key;
  opt.textContent = c.label;
  itemFilterSelect.appendChild(opt);
});
itemFilterSelect.addEventListener('change', () => {
  itemFilter = itemFilterSelect.value;
  rebuildMapMarkers();
  renderStationList();
});

const legendEl = document.getElementById('legend');
Object.entries(PROFILES).forEach(([key, p]) => {
  const row = document.createElement('div');
  row.className = 'legend-row';
  row.style.cursor = 'pointer';
  row.innerHTML = `<span class="legend-sw" style="background:${p.color}"></span><span>${p.label}</span>`;
  row.addEventListener('click', () => {
    if(activeProfiles.has(key)){ activeProfiles.delete(key); row.style.opacity = 0.35; }
    else { activeProfiles.add(key); row.style.opacity = 1; }
    rebuildMapMarkers();
    renderStationList();
  });
  legendEl.appendChild(row);
});

/* ---------------- Load stations.json ---------------- */
fetch('./stations.json')
  .then(r => r.json())
  .then(data => {
    STATIONS = data;
    STATIONS_BY_ID = Object.fromEntries(data.map(s => [String(s.id), s]));
    document.getElementById('statCount').textContent = STATIONS.length;
    rebuildMapMarkers();
    renderStationList();
  })
  .catch(() => {
    statusLine.textContent = 'Could not load station data (stations.json). If you opened this file directly, serve it over a local server or GitHub Pages instead.';
  });

/* ===========================================================
   LEARN SECTION
=========================================================== */
const catGrid = document.getElementById('catGrid');
Object.entries(CATS).forEach(([key, c]) => {
  const el = document.createElement('div');
  el.className = 'cat-card';
  el.innerHTML = `
    <div class="cat-icon">${CAT_ICONS[key]}</div>
    <h3>${c.label}</h3>
    <p>${c.desc}</p>
    <span class="pts">+${c.pts} pts per item</span>
  `;
  catGrid.appendChild(el);
});

/* ===========================================================
   AUTH UI
=========================================================== */
const authGate = document.getElementById('authGate');
const rewardsApp = document.getElementById('rewardsApp');
const navAuthBtn = document.getElementById('navAuthBtn');
const navTitle = document.getElementById('navTitle');

function renderAuthGate(mode){
  authGate.innerHTML = `
    <div class="auth-card">
      <h3>${mode === 'signup' ? 'Create your profile' : 'Sign in'}</h3>
      <p class="hint">${mode === 'signup' ? 'Use the same email a recycling station has on file so your drop-offs sync automatically.' : 'Sign in to see your points, perks and progress.'}</p>
      <div class="auth-field"><label>Email</label><input type="email" id="authEmail" placeholder="you@example.com" /></div>
      <div class="auth-field"><label>Password</label><input type="password" id="authPassword" placeholder="At least 6 characters" /></div>
      <button class="btn btn-primary btn-block" id="authSubmit">${mode === 'signup' ? 'Create profile' : 'Sign in'}</button>
      <div class="auth-error" id="authError"></div>
      <div class="auth-switch">
        ${mode === 'signup' ? "Already have a profile? <button id='authSwitch'>Sign in</button>" : "New here? <button id='authSwitch'>Create a profile</button>"}
      </div>
    </div>
  `;
  document.getElementById('authSwitch').addEventListener('click', () => renderAuthGate(mode === 'signup' ? 'signin' : 'signup'));
  document.getElementById('authSubmit').addEventListener('click', async () => {
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    const errEl = document.getElementById('authError');
    errEl.textContent = '';
    try{
      if(mode === 'signup'){
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    }catch(e){
      errEl.textContent = e.message.replace('Firebase: ','').replace(/\(auth\/|\)\.?/g,'');
    }
  });
}
renderAuthGate('signin');

navAuthBtn.addEventListener('click', () => {
  if(currentUser){
    signOut(auth);
  } else {
    document.getElementById('rewards').scrollIntoView();
  }
});

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if(userDocUnsub){ userDocUnsub(); userDocUnsub = null; }

  if(!user){
    authGate.style.display = '';
    rewardsApp.style.display = 'none';
    navAuthBtn.textContent = 'Sign in';
    navTitle.textContent = '';
    document.getElementById('navPoints').textContent = '0';
    return;
  }

  navAuthBtn.textContent = `Sign out (${user.email.split('@')[0]})`;
  authGate.style.display = 'none';
  rewardsApp.style.display = '';

  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if(!snap.exists()){
    await setDoc(ref, {
      email: user.email,
      displayName: user.email.split('@')[0],
      lifetimePoints: 0,
      spendablePoints: 0,
      processedLogIds: [],
      title: '',
      unlockedPerks: [],
      multiplierUntil: 0,
      multiplierValue: 1,
      history: [],
      createdAt: Date.now()
    });
  }

  userDocUnsub = onSnapshot(ref, async (docSnap) => {
    userData = docSnap.data();
    await checkAndUnlockPerks(ref, userData);
    renderRewards();
  });
});

/* ===========================================================
   PERKS / XP
=========================================================== */
async function checkAndUnlockPerks(ref, data){
  const unlocked = new Set(data.unlockedPerks || []);
  const newlyUnlocked = PERKS.filter(p => data.lifetimePoints >= p.threshold && !unlocked.has(p.id));
  if(newlyUnlocked.length){
    await updateDoc(ref, { unlockedPerks: arrayUnion(...newlyUnlocked.map(p=>p.id)) });
  }
}

async function activateMultiplier(perk){
  const ref = doc(db, 'users', currentUser.uid);
  await updateDoc(ref, {
    multiplierUntil: Date.now() + perk.hours * 3600 * 1000,
    multiplierValue: perk.value
  });
}

async function equipTitle(title){
  const ref = doc(db, 'users', currentUser.uid);
  await updateDoc(ref, { title });
}

/* ===========================================================
   CSV SYNC (simulated station scan log)
=========================================================== */
function parseCSV(text){
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(',').map(h=>h.trim());
  return lines.slice(1).map(line => {
    const vals = line.split(',');
    const obj = {};
    headers.forEach((h,i) => obj[h] = (vals[i]||'').trim());
    return obj;
  });
}

document.getElementById('syncBtn').addEventListener('click', syncDisposalLog);

async function syncDisposalLog(){
  if(!currentUser || !userData) return;
  const btn = document.getElementById('syncBtn');
  btn.disabled = true;
  btn.textContent = 'Syncing…';
  try{
    const res = await fetch('./disposal_log.csv');
    const text = await res.text();
    const rows = parseCSV(text);
    const already = new Set(userData.processedLogIds || []);
    const myEmail = currentUser.email.toLowerCase();
    const newRows = rows.filter(r => r.user_email && r.user_email.toLowerCase() === myEmail && !already.has(r.log_id));

    if(newRows.length === 0){
      btn.textContent = 'No new activity found';
      setTimeout(()=>{ btn.textContent = 'Sync my disposal history'; btn.disabled = false; }, 2200);
      return;
    }

    const now = Date.now();
    const multActive = userData.multiplierUntil && userData.multiplierUntil > now;
    const multVal = multActive ? (userData.multiplierValue || 1) : 1;

    let totalPts = 0;
    const idsAdd = [];
    const histAdds = [];
    newRows.forEach(r => {
      const cat = CATS[r.item_category];
      if(!cat) return;
      const pts = cat.pts * multVal;
      totalPts += pts;
      idsAdd.push(r.log_id);
      const station = STATIONS_BY_ID[r.station_id];
      histAdds.push({
        label: `${cat.label} — ${station ? station.name : 'Station #'+r.station_id}`,
        pts, ts: new Date(r.timestamp.replace(' ','T')).getTime() || now
      });
    });

    const newHistory = [...(userData.history||[]), ...histAdds].slice(-50);
    const ref = doc(db, 'users', currentUser.uid);
    await updateDoc(ref, {
      lifetimePoints: userData.lifetimePoints + totalPts,
      spendablePoints: userData.spendablePoints + totalPts,
      processedLogIds: arrayUnion(...idsAdd),
      history: newHistory
    });

    btn.textContent = `Synced ${newRows.length} record(s), +${totalPts} pts`;
  }catch(e){
    btn.textContent = 'Sync failed — try again';
  }
  setTimeout(()=>{ btn.textContent = 'Sync my disposal history'; btn.disabled = false; }, 2400);
}

/* ===========================================================
   REWARDS RENDER
=========================================================== */
function nextRewardTier(spendable){
  return REWARDS.find(r => r.cost > spendable) || null;
}

function renderRewards(){
  if(!userData) return;
  const { lifetimePoints, spendablePoints, title, multiplierUntil, unlockedPerks = [] } = userData;

  document.getElementById('navPoints').textContent = spendablePoints;
  navTitle.textContent = title ? ` · ${title}` : '';
  document.getElementById('bigPoints').textContent = spendablePoints;
  document.getElementById('lifetimeLine').textContent = `Lifetime total: ${lifetimePoints} pts`;

  const nt = nextRewardTier(spendablePoints);
  const progFill = document.getElementById('progFill');
  const progLabel = document.getElementById('progLabel');
  if(nt){
    const prevTier = [...REWARDS].reverse().find(r => r.cost <= spendablePoints);
    const base = prevTier ? prevTier.cost : 0;
    const pct = Math.min(100, ((spendablePoints-base)/(nt.cost-base))*100);
    progFill.style.width = pct + '%';
    progLabel.textContent = `${spendablePoints} / ${nt.cost} pts to "${nt.name}"`;
  } else {
    progFill.style.width = '100%';
    progLabel.textContent = `${spendablePoints} pts — every reward unlocked!`;
  }

  const catalog = document.getElementById('rewardsCatalog');
  catalog.innerHTML = '';
  REWARDS.forEach(r => {
    const unlocked = spendablePoints >= r.cost;
    const el = document.createElement('div');
    el.className = 'reward-item' + (unlocked ? '' : ' locked');
    el.innerHTML = `
      <div class="rname">${r.name}</div>
      <div class="rcost">${r.cost} pts</div>
      <button class="redeem-btn" ${unlocked ? '' : 'disabled'}>${unlocked ? 'Redeem' : 'Locked'}</button>
    `;
    el.querySelector('button').addEventListener('click', () => redeem(r));
    catalog.appendChild(el);
  });

  const histEl = document.getElementById('historyList');
  const hist = userData.history || [];
  if(hist.length === 0){
    histEl.innerHTML = '<div class="empty-hint">Nothing logged yet — hit "Sync my disposal history" above.</div>';
  } else {
    histEl.innerHTML = hist.slice().reverse().slice(0,8).map(h =>
      `<div class="hist-row"><span>${h.label}</span><span class="hp">${h.pts>=0?'+':''}${h.pts} pts</span></div>`
    ).join('');
  }

  renderXP(lifetimePoints, unlockedPerks, title, multiplierUntil);
  renderLeaderboard();
}

async function redeem(reward){
  if(!userData || userData.spendablePoints < reward.cost) return;
  const ref = doc(db, 'users', currentUser.uid);
  const newHistory = [...(userData.history||[]), { label:`Redeemed: ${reward.name}`, pts:-reward.cost, ts:Date.now() }].slice(-50);
  await updateDoc(ref, {
    spendablePoints: userData.spendablePoints - reward.cost,
    history: newHistory
  });
}

/* ---------------- XP meter ---------------- */
function renderXP(lifetimePoints, unlockedPerks, equippedTitle, multiplierUntil){
  const nextPerk = PERKS.find(p => p.threshold > lifetimePoints);
  const level = PERKS.filter(p => lifetimePoints >= p.threshold).length;
  document.getElementById('xpLevelLabel').textContent = `Level ${level}`;

  const prevThresh = level > 0 ? PERKS[level-1].threshold : 0;
  const nextThresh = nextPerk ? nextPerk.threshold : prevThresh;
  const pct = nextPerk ? Math.min(100, ((lifetimePoints-prevThresh)/(nextThresh-prevThresh))*100) : 100;
  document.getElementById('xpFill').style.width = pct + '%';
  document.getElementById('xpLabel').textContent = nextPerk
    ? `${lifetimePoints} / ${nextThresh} lifetime pts to next perk`
    : `${lifetimePoints} lifetime pts — max level reached`;

  const now = Date.now();
  const multActive = multiplierUntil && multiplierUntil > now;

  const perkGrid = document.getElementById('perkGrid');
  perkGrid.innerHTML = '';
  PERKS.forEach(p => {
    const unlocked = (unlockedPerks||[]).includes(p.id) || lifetimePoints >= p.threshold;
    const el = document.createElement('div');
    el.className = 'perk-item' + (unlocked ? '' : ' locked');
    let actionHtml = '';
    if(p.type === 'title'){
      const equipped = equippedTitle === p.value;
      actionHtml = `<button class="perk-btn" ${(!unlocked || equipped) ? 'disabled' : ''}>${equipped ? 'Equipped' : 'Equip title'}</button>`;
    } else {
      actionHtml = `<button class="perk-btn" ${(!unlocked || multActive) ? 'disabled' : ''}>${multActive ? 'Active' : `Activate ${p.value}× (24h)`}</button>`;
    }
    el.innerHTML = `
      <div class="pname">${p.type === 'title' ? `Title: "${p.value}"` : `${p.value}× points multiplier`}</div>
      <div class="pthresh">${p.threshold.toLocaleString()} lifetime pts</div>
      ${actionHtml}
    `;
    const btn = el.querySelector('button');
    if(btn && !btn.disabled){
      btn.addEventListener('click', () => p.type === 'title' ? equipTitle(p.value) : activateMultiplier(p));
    }
    perkGrid.appendChild(el);
  });
}

/* ===========================================================
   LIVE LEADERBOARD
=========================================================== */
const boardQuery = query(collection(db, 'users'), orderBy('lifetimePoints', 'desc'), limit(50));
onSnapshot(boardQuery, (snap) => {
  const rows = snap.docs.map(d => ({ id:d.id, ...d.data() }));
  renderLeaderboard(rows);
}, () => {
  document.getElementById('board').innerHTML = '<div class="board-row"><span></span><span class="empty-hint">Leaderboard unavailable — check your Firestore rules.</span><span></span></div>';
});

let lastBoardRows = [];
function renderLeaderboard(rows){
  if(rows) lastBoardRows = rows;
  const boardEl = document.getElementById('board');
  const data = lastBoardRows;
  if(!data.length){
    boardEl.innerHTML = '<div class="board-row"><span></span><span class="empty-hint">No recyclers yet — be the first!</span><span></span></div>';
    return;
  }
  boardEl.innerHTML = `
    <div class="board-row head"><span>Rank</span><span>Recycler</span><span style="text-align:right">Lifetime pts</span></div>
    ${data.map((r,i)=>`
      <div class="board-row ${currentUser && r.id===currentUser.uid ? 'me' : ''}">
        <span class="rank ${i===0?'r1':''}">#${i+1}</span>
        <span class="name-cell"><span class="avatar" style="background:${currentUser && r.id===currentUser.uid ? '#C97B3F':'#2F6F5E'}"></span>${r.displayName || (r.email||'').split('@')[0]}${r.title ? ` <span class="equipped-title">${r.title}</span>` : ''}</span>
        <span class="board-pts">${r.lifetimePoints || 0}</span>
      </div>
    `).join('')}
  `;
}
