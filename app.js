/* ============================================
   Travel Pocket — 日本旅遊記帳（多旅程版）
   資料只存 localStorage，斷網可用
   結構：S.trips[] 每個旅程各自有名稱/日期區間/換匯/記錄
   ============================================ */
(() => {
'use strict';

/* ---------- 分類定義（順序固定，圖表顏色不可循環） ---------- */
const CATS = [
  { id: 'food',    name: '餐飲', hex: '#C7522A' },
  { id: 'transit', name: '交通', hex: '#0E93A6' },
  { id: 'shop',    name: '購物', hex: '#B58300' },
  { id: 'stay',    name: '住宿', hex: '#7B5EA7' },
  { id: 'ticket',  name: '娛樂', hex: '#35854A' }, // id 沿用 ticket，舊記錄不受影響
  { id: 'other',   name: '其他', hex: '#2E77BE' },
];

/* ---------- 支援的當地貨幣（fb＝離線時的保底匯率，連網後會被真實牌價蓋掉；dec＝有小數） ---------- */
const CURS = [
  { code: 'JPY', sym: '¥',   name: '日圓',     dec: false, fb: 0.21 },
  { code: 'KRW', sym: '₩',   name: '韓元',     dec: false, fb: 0.023 },
  { code: 'USD', sym: '$',   name: '美元',     dec: true,  fb: 32 },
  { code: 'EUR', sym: '€',   name: '歐元',     dec: true,  fb: 35 },
  { code: 'GBP', sym: '£',   name: '英鎊',     dec: true,  fb: 41 },
  { code: 'THB', sym: '฿',   name: '泰銖',     dec: true,  fb: 0.95 },
  { code: 'VND', sym: '₫',   name: '越南盾',   dec: false, fb: 0.0013 },
  { code: 'CNY', sym: '¥',   name: '人民幣',   dec: true,  fb: 4.5 },
  { code: 'HKD', sym: 'HK$', name: '港幣',     dec: true,  fb: 4.2 },
  { code: 'SGD', sym: 'S$',  name: '新加坡幣', dec: true,  fb: 24 },
  { code: 'AUD', sym: 'A$',  name: '澳幣',     dec: true,  fb: 21 },
  { code: 'MYR', sym: 'RM',  name: '令吉',     dec: true,  fb: 7.5 },
  { code: 'IDR', sym: 'Rp',  name: '印尼盾',   dec: false, fb: 0.002 },
  { code: 'PHP', sym: '₱',   name: '披索',     dec: true,  fb: 0.56 },
];
const curOf = code => CURS.find(c => c.code === code) || CURS[0];

/* ---------- 細線條 icon ---------- */
const STROKE = 'fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
const ICONS = {
  food:    `<svg viewBox="0 0 24 24" ${STROKE}><path d="M4 3v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V3M7 3v18"/><path d="M20 14V3a4 4 0 0 0-4 4v5a2 2 0 0 0 2 2h2Zm0 0v7"/></svg>`,
  transit: `<svg viewBox="0 0 24 24" ${STROKE}><rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14M9.5 21l-1.5-4M14.5 21l1.5-4"/><path d="M9 14h.01M15 14h.01"/></svg>`,
  shop:    `<svg viewBox="0 0 24 24" ${STROKE}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18M16 10a4 4 0 0 1-8 0"/></svg>`,
  stay:    `<svg viewBox="0 0 24 24" ${STROKE}><path d="M2 5v15M2 12h18a2 2 0 0 1 2 2v6M2 16h20"/><circle cx="6.5" cy="8.5" r="1.6"/></svg>`,
  ticket:  `<svg viewBox="0 0 24 24" ${STROKE}><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 6v2M13 11v2M13 16v2"/></svg>`,
  other:   `<svg viewBox="0 0 24 24" ${STROKE}><circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/></svg>`,
  home:    `<svg viewBox="0 0 24 24" ${STROKE}><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/></svg>`,
  stats:   `<svg viewBox="0 0 24 24" ${STROKE}><path d="M6 20v-5M12 20V9M18 20V4"/></svg>`,
  settings:`<svg viewBox="0 0 24 24" ${STROKE}><path d="M21 5h-6M9 5H3M21 12h-4M11 12H3M21 19h-9M6 19H3"/><path d="M12 3v4M14 10v4M9 17v4"/></svg>`,
  trip:    `<svg viewBox="0 0 24 24" ${STROKE}><rect x="4.5" y="7" width="15" height="14" rx="2.5"/><path d="M9.5 7V5a2 2 0 0 1 2-2h1a2 2 0 0 1 2 2v2M8.5 7v14M15.5 7v14"/></svg>`,
};

/* ---------- 資料存取 ---------- */
const KEY = 'pocketbill.v1';
const todayStr = (d = new Date()) => {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const newTrip = (name, start, end, exTwd, exJpy, cur) => ({
  id: uid(), name: name || '日本旅遊', start: start || todayStr(),
  end: end || null,        // 回程日（選填）
  cur: cur || 'JPY',       // 當地貨幣代碼
  exTwd: exTwd || null,    // 換匯：付了多少台幣
  exJpy: exJpy || null,    // 換匯：拿到多少當地貨幣（欄位名沿用 jpy）
  entries: []              // { id, date, time, jpy(當地金額), cat, note, pay:'cash'|'card' }
});

let S = (() => {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(KEY)); } catch { /* 壞資料就重來 */ }
  if (!d) {
    const t = newTrip('日本旅遊');
    return { trips: [t], active: t.id, rates: {} };
  }
  if (!d.trips) {
    // 舊版單旅程格式 → 自動搬進第一個旅程，舊記錄付款方式預設現金
    const t = newTrip('日本旅遊', d.tripStart);
    t.entries = (d.entries || []).map(e => ({ ...e, pay: e.pay || 'cash' }));
    d = { trips: [t], active: t.id, rate: d.rate };
  }
  // 匯率改成「每種貨幣一份」：舊的單一匯率搬到 JPY 底下
  if (!d.rates) d.rates = { JPY: d.rate || { auto: null, ts: 0, manual: null } };
  delete d.rate;
  for (const t of d.trips) if (!t.cur) t.cur = 'JPY';
  if (d.cardFee === undefined) d.cardFee = 1.5; // 刷卡手續費 %（台灣多數卡 1.5）
  return d;
})();
const save = () => localStorage.setItem(KEY, JSON.stringify(S));
save(); // 立即寫回（讓格式升級生效）

const T = () => S.trips.find(t => t.id === S.active) || S.trips[0]; // 目前旅程
const E = () => T().entries;
const CUR = () => curOf(T().cur);            // 目前旅程的貨幣
const R = code => (S.rates[code] ||= { auto: null, ts: 0, manual: null }); // 該貨幣的匯率紀錄

/* ---------- 匯率 ----------
   現金：本旅程實際換匯匯率 > 該貨幣手動設定 > 自動抓取 > 保底值
   刷卡：牌價（手動 > 自動 > 保底）×（1 + 手續費%），不吃換匯匯率 */
const tripRate = () => (T().exTwd && T().exJpy) ? T().exTwd / T().exJpy : null;
const rateFor = code => {
  const r = R(code);
  return r.manual || r.auto || curOf(code).fb;
};
const cashRate = () => tripRate() || rateFor(T().cur);
const cardRate = () => rateFor(T().cur) * (1 + (S.cardFee || 0) / 100);
const rate = () => cashRate(); // 一般顯示用現金匯率
const payRate = pay => (pay === 'card' ? cardRate() : cashRate());
// 一筆記錄換算台幣：依付款方式用不同匯率
const entryTwd = e => e.jpy * payRate(e.pay);
const sumTwd = list => Math.round(list.reduce((s, e) => s + entryTwd(e), 0));

async function fetchRate(force = false, code = null) {
  code = code || T().cur;
  const r = R(code);
  if (!force && r.auto && Date.now() - r.ts < 12 * 3600e3) return;
  if (!navigator.onLine) return;
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${code}`);
    const j = await res.json();
    if (j && j.rates && j.rates.TWD) {
      r.auto = j.rates.TWD;
      r.ts = Date.now();
      save(); renderAll();
    }
  } catch { /* 離線或失敗就沿用舊值 */ }
}

/* ---------- 小工具 ---------- */
const $ = id => document.getElementById(id);
const fmt = n => Math.round(n).toLocaleString('en-US');
// 當地貨幣顯示：有小數的貨幣最多顯示 2 位小數
const fmtLoc = n => Number(n).toLocaleString('en-US', { maximumFractionDigits: CUR().dec ? 2 : 0 });
const twd = jpy => Math.round(jpy * rate());
const dateOfDay = n => {
  const d = new Date(T().start + 'T00:00:00');
  d.setDate(d.getDate() + n - 1);
  return todayStr(d);
};
const dayOfDate = ds => {
  const a = new Date(T().start + 'T00:00:00'), b = new Date(ds + 'T00:00:00');
  return Math.round((b - a) / 864e5) + 1;
};
const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
const prettyDate = ds => {
  const d = new Date(ds + 'T00:00:00');
  return `${d.getMonth() + 1}月${d.getDate()}日 週${WEEK[d.getDay()]}`;
};
const shortDate = ds => {
  const d = new Date(ds + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
};
// 旅程天數：有回程日就用日期區間，並延伸涵蓋超出範圍的記錄；沒有就到今天
function tripDayCount() {
  let n = T().end ? dayOfDate(T().end) : dayOfDate(todayStr());
  for (const e of E()) n = Math.max(n, dayOfDate(e.date));
  return Math.max(1, n);
}
const entriesOf = ds => E().filter(e => e.date === ds).sort((a, b) => (a.time < b.time ? 1 : -1));
const sumJpy = list => list.reduce((s, e) => s + e.jpy, 0);
const cashSpent = () => sumJpy(E().filter(e => e.pay !== 'card'));
const clampSelected = () => {
  const d = dayOfDate(selectedDate);
  if (d < 1) selectedDate = T().start;
  else if (d > tripDayCount()) selectedDate = dateOfDay(tripDayCount());
};

/* ---------- 全域狀態 ---------- */
let selectedDate = todayStr();
let editingId = null;
let sheetAmount = '';
let sheetCat = 'food';
let sheetCur = 'jpy';   // 輸入幣別
let sheetPay = 'cash';  // 付款方式
let openedRow = null;
let donutFocus = null;
let barFocus = null;

/* ---------- 畫面切換 ---------- */
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === id));
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === id));
  $('fabAdd').style.display = id === 'view-home' ? '' : 'none';
  document.querySelector('.tabbar').style.display = id === 'view-trips' ? 'none' : '';
  renderAll();
}

/* ---------- 旅程列表 ---------- */
function renderTrips() {
  const ul = $('tripList');
  ul.innerHTML = '';
  for (const t of S.trips) {
    const cs = curOf(t.cur); // 這個旅程自己的貨幣
    const total = sumJpy(t.entries);
    // 這個旅程的台幣總額：現金用換匯匯率、刷卡用牌價＋手續費
    const cashR = (t.exTwd && t.exJpy) ? t.exTwd / t.exJpy : rateFor(t.cur);
    const cardR = rateFor(t.cur) * (1 + (S.cardFee || 0) / 100);
    const twdTotal = Math.round(t.entries.reduce((s, e) => s + e.jpy * (e.pay === 'card' ? cardR : cashR), 0));
    const range = t.end ? `${shortDate(t.start)} – ${shortDate(t.end)}` : `${shortDate(t.start)} 出發`;
    const days = t.end
      ? Math.round((new Date(t.end + 'T00:00:00') - new Date(t.start + 'T00:00:00')) / 864e5) + 1
      : null;
    const cashLeft = t.exJpy ? t.exJpy - sumJpy(t.entries.filter(e => e.pay !== 'card')) : null;
    const li = document.createElement('li');
    li.className = 'entry-row';
    li.innerHTML = `
      <button class="entry-del" aria-label="刪除旅程">刪除</button>
      <div class="entry trip-card">
        <span class="t-name">${escapeHtml(t.name)}${t.id === S.active ? '<span class="t-badge">使用中</span>' : ''}</span>
        <span class="t-total">
          <div class="t-jpy">${cs.sym}${fmt(total)}</div>
          <div class="e-twd">NT$${fmt(twdTotal)}</div>
        </span>
        <div class="t-meta">${cs.name}${days ? ` · ${days} 天` : ''} · ${range} · ${t.entries.length} 筆${cashLeft !== null ? ` · 現金剩 ${cs.sym}${fmt(cashLeft)}` : ''}</div>
      </div>`;
    const el = li.querySelector('.entry');
    attachSwipe(li, el);
    li.querySelector('.entry-del').onclick = () => {
      if (!confirm(`刪除「${t.name}」？這個旅程的 ${t.entries.length} 筆記錄會一起刪除，無法復原`)) return;
      S.trips = S.trips.filter(x => x.id !== t.id);
      if (!S.trips.length) S.trips = [newTrip('日本旅遊')]; // 永遠保留至少一個旅程
      if (S.active === t.id) S.active = S.trips[0].id;
      clampSelected(); save(); renderAll();
    };
    el.addEventListener('click', () => {
      if (li._swiped) { li._swiped = false; return; }
      if (openedRow) { closeRow(openedRow); return; }
      S.active = t.id;
      selectedDate = todayStr(); clampSelected();
      save(); showView('view-home');
      fetchRate(); // 切換旅程後補抓該貨幣的牌價
    });
    ul.appendChild(li);
  }
}

/* ---------- 提醒橫幅：旅程結束提醒備份 > 昨天沒記提醒補記 ---------- */
function renderBanner() {
  const box = $('homeBanner');
  const today = todayStr();
  const y = new Date(); y.setDate(y.getDate() - 1);
  const yest = todayStr(y);

  // 旅程已結束且有記錄 → 提醒匯出備份（每個旅程提醒一次）
  if (T().end && today > T().end && E().length && !T().bakReminded) {
    box.hidden = false;
    box.innerHTML = `<div class="banner">
      <span class="banner-text">旅程結束了，建議匯出一份備份留存（資料只在這支手機上）</span>
      <button class="btn-small" id="bnExport">匯出</button>
      <button class="banner-x" id="bnClose" aria-label="關閉">✕</button></div>`;
    $('bnExport').onclick = () => { $('btnExport').click(); T().bakReminded = true; save(); renderHome(); };
    $('bnClose').onclick = () => { T().bakReminded = true; save(); renderHome(); };
    return;
  }
  // 昨天在旅程範圍內卻一筆都沒記 → 提醒補記（一天只問一次）
  const inRange = yest >= T().start && (!T().end || yest <= T().end);
  if (inRange && E().length && !entriesOf(yest).length && S.askedBackfill !== today) {
    box.hidden = false;
    box.innerHTML = `<div class="banner">
      <span class="banner-text">昨天（${shortDate(yest)}）沒有任何記錄，要補記嗎？</span>
      <button class="btn-small" id="bnFill">補記</button>
      <button class="banner-x" id="bnClose" aria-label="關閉">✕</button></div>`;
    $('bnFill').onclick = () => {
      S.askedBackfill = today; save();
      selectedDate = yest; renderHome(); openSheet();
    };
    $('bnClose').onclick = () => { S.askedBackfill = today; save(); renderHome(); };
    return;
  }
  box.hidden = true; box.innerHTML = '';
}

/* ---------- 主頁 ---------- */
function renderHome() {
  clampSelected();
  renderBanner();
  const isToday = selectedDate === todayStr();
  const dayN = dayOfDate(selectedDate);
  const n = tripDayCount();
  const list = entriesOf(selectedDate);
  const total = sumJpy(list);

  $('homeSubtitle').textContent = `${T().name} · Day ${dayN}${T().end ? ` / ${n}` : ''} · ${prettyDate(selectedDate)}`;
  $('heroDayLabel').textContent = isToday ? '今日支出' : `Day ${dayN} 支出`;
  $('heroYen').textContent = CUR().sym;
  $('heroJpy').textContent = fmtLoc(total);
  $('heroTwdChip').textContent = `≈ NT$${fmt(sumTwd(list))}`;
  $('heroCountChip').textContent = `${list.length} 筆`;

  // 現金餘額（有填換匯才顯示）
  const cashChip = $('heroCashChip');
  if (T().exJpy) {
    cashChip.hidden = false;
    cashChip.textContent = `現金剩 ${CUR().sym}${fmtLoc(T().exJpy - cashSpent())}`;
  } else cashChip.hidden = true;

  // 天數列
  const chips = $('dayChips');
  chips.innerHTML = '';
  for (let i = 1; i <= n; i++) {
    const ds = dateOfDay(i);
    const b = document.createElement('button');
    b.className = 'day-chip' + (ds === selectedDate ? ' active' : '');
    b.innerHTML = `Day ${i}<small>${shortDate(ds)}</small>`;
    b.onclick = () => { selectedDate = ds; renderHome(); };
    chips.appendChild(b);
  }
  const act = chips.querySelector('.active');
  if (act) act.scrollIntoView({ inline: 'center', block: 'nearest' });

  // 清單
  const ul = $('entryList');
  ul.innerHTML = '';
  openedRow = null;
  if (!list.length) {
    ul.innerHTML = `<li class="empty">這天還沒有記錄<br>按右下角 + 記第一筆</li>`;
    return;
  }
  for (const e of list) {
    const cat = CATS.find(c => c.id === e.cat) || CATS[5];
    const li = document.createElement('li');
    li.className = 'entry-row';
    li.innerHTML = `
      <button class="entry-del" aria-label="刪除這筆">刪除</button>
      <div class="entry">
        <span class="e-icon">${ICONS[cat.id]}</span>
        <span class="e-main">
          <div class="e-note">${e.note ? escapeHtml(e.note) : cat.name}</div>
          <div class="e-time">${cat.name} · ${e.time}${e.pay === 'card' ? ' · 刷卡' : ''}</div>
        </span>
        <span class="e-amount">
          <div class="e-jpy">${CUR().sym}${fmtLoc(e.jpy)}</div>
          <div class="e-twd">NT$${fmt(entryTwd(e))}</div>
        </span>
      </div>`;
    const entryEl = li.querySelector('.entry');
    attachSwipe(li, entryEl);
    li.querySelector('.entry-del').onclick = () => {
      T().entries = E().filter(x => x.id !== e.id);
      save(); renderAll();
    };
    entryEl.addEventListener('click', () => {
      if (li._swiped) { li._swiped = false; return; }
      if (openedRow) { closeRow(openedRow); return; }
      openSheet(e);
    });
    ul.appendChild(li);
  }
}
const escapeHtml = s => s.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

/* 左滑手勢：跟著手指位移，滑超過 40px 就展開刪除鈕 */
const OPEN_X = -80;
function closeRow(row) {
  row.querySelector('.entry').style.transform = '';
  row._open = false;
  if (openedRow === row) openedRow = null;
}
function attachSwipe(row, el) {
  let sx = 0, sy = 0, dx = 0, mode = null;
  el.addEventListener('touchstart', ev => {
    sx = ev.touches[0].clientX; sy = ev.touches[0].clientY;
    dx = 0; mode = null;
    el.style.transition = 'none';
    if (openedRow && openedRow !== row) closeRow(openedRow);
  }, { passive: true });
  el.addEventListener('touchmove', ev => {
    const tx = ev.touches[0].clientX - sx, ty = ev.touches[0].clientY - sy;
    if (!mode) mode = Math.abs(tx) > Math.abs(ty) + 4 ? 'h' : (Math.abs(ty) > 6 ? 'v' : null);
    if (mode !== 'h') return;
    dx = Math.min(0, Math.max(OPEN_X - 16, tx + (row._open ? OPEN_X : 0)));
    el.style.transform = `translateX(${dx}px)`;
  }, { passive: true });
  el.addEventListener('touchend', () => {
    el.style.transition = '';
    if (mode !== 'h') return;
    row._swiped = true;
    setTimeout(() => { row._swiped = false; }, 350);
    if (dx < -40) {
      el.style.transform = `translateX(${OPEN_X}px)`;
      row._open = true; openedRow = row;
    } else {
      closeRow(row);
    }
  });
}

/* ---------- 統計 ---------- */
function renderStats() {
  const total = sumJpy(E());
  const n = tripDayCount();
  $('totalYen').textContent = CUR().sym;
  $('totalJpy').textContent = fmtLoc(total);
  $('totalTwdChip').textContent = `≈ NT$${fmt(sumTwd(E()))}`;
  $('totalDaysChip').textContent = `${n} 天`;
  $('avgDayChip').textContent = `日均 ${CUR().sym}${fmtLoc(n ? total / n : 0)}`;
  $('statsSubtitle').textContent = `${T().name} · ${prettyDate(T().start)} 出發 · 共 ${E().length} 筆`;

  // 現金／刷卡各花多少
  const cash = cashSpent(), card = total - cash;
  const split = $('paySplitChip');
  if (card > 0) { split.hidden = false; split.textContent = `現金 ${CUR().sym}${fmtLoc(cash)} · 刷卡 ${CUR().sym}${fmtLoc(card)}`; }
  else split.hidden = true;

  renderDonut(total);
  renderBars(n);
}

/* 圓環圖 */
function renderDonut(total) {
  const svg = $('donutSvg');
  svg.innerHTML = '';
  const data = CATS.map(c => ({ ...c, v: sumJpy(E().filter(e => e.cat === c.id)) })).filter(d => d.v > 0);
  const cx = 100, cy = 100, R = 88, r = 62;

  if (!data.length) {
    svg.innerHTML = `<circle cx="100" cy="100" r="75" fill="none" stroke="var(--line)" stroke-width="24"/>`;
    $('donutCenterName').textContent = '尚無資料';
    $('donutCenterVal').textContent = '';
    $('catLegend').innerHTML = '';
    return;
  }
  const TAU = Math.PI * 2, pad = data.length > 1 ? 0.035 : 0;
  let a = -Math.PI / 2;
  for (const d of data) {
    const span = (d.v / total) * TAU;
    const a0 = a + pad / 2, a1 = a + span - pad / 2;
    a += span;
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    el.setAttribute('d', arcPath(cx, cy, R, r, a0, Math.max(a1, a0 + 0.01)));
    el.setAttribute('fill', d.hex);
    el.setAttribute('class', 'donut-seg' + (donutFocus && donutFocus !== d.id ? ' dim' : ''));
    el.onclick = () => { donutFocus = donutFocus === d.id ? null : d.id; renderStats(); };
    svg.appendChild(el);
  }
  const f = donutFocus ? data.find(d => d.id === donutFocus) : null;
  $('donutCenterName').textContent = f ? f.name : '全部';
  $('donutCenterVal').textContent = `${CUR().sym}${fmtLoc(f ? f.v : total)}`;

  const lg = $('catLegend');
  lg.innerHTML = '';
  for (const d of data.slice().sort((x, y) => y.v - x.v)) {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="l-dot" style="background:${d.hex}"></span>
      <span class="l-icon">${ICONS[d.id]}</span>
      <span class="l-name">${d.name}</span>
      <span class="l-val">${CUR().sym}${fmtLoc(d.v)}</span>
      <span class="l-pct">${Math.round(d.v / total * 100)}%</span>`;
    li.onclick = () => { donutFocus = donutFocus === d.id ? null : d.id; renderStats(); };
    lg.appendChild(li);
  }
}
function arcPath(cx, cy, R, r, a0, a1) {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const x0 = cx + R * Math.cos(a0), y0 = cy + R * Math.sin(a0);
  const x1 = cx + R * Math.cos(a1), y1 = cy + R * Math.sin(a1);
  const x2 = cx + r * Math.cos(a1), y2 = cy + r * Math.sin(a1);
  const x3 = cx + r * Math.cos(a0), y3 = cy + r * Math.sin(a0);
  return `M${x0} ${y0}A${R} ${R} 0 ${large} 1 ${x1} ${y1}L${x2} ${y2}A${r} ${r} 0 ${large} 0 ${x3} ${y3}Z`;
}

/* 每日長條圖 */
function renderBars(n) {
  const svg = $('barsSvg');
  const sums = [];
  for (let i = 1; i <= n; i++) sums.push({ day: i, ds: dateOfDay(i), v: sumJpy(entriesOf(dateOfDay(i))) });
  const max = Math.max(...sums.map(s => s.v), 1);
  const bw = 20, gap = 14, H = 150, top = 22, bottom = 20;
  const W = Math.max(n * (bw + gap) + gap, 300);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', W); svg.setAttribute('height', H);
  svg.innerHTML = '';
  const ns = 'http://www.w3.org/2000/svg';
  const maxIdx = sums.reduce((m, s, i) => (s.v > sums[m].v ? i : m), 0);

  sums.forEach((s, i) => {
    const x = gap + i * (bw + gap);
    const h = Math.max(s.v / max * (H - top - bottom), s.v > 0 ? 3 : 0);
    const y = H - bottom - h;
    if (s.v > 0) {
      const p = document.createElementNS(ns, 'path');
      const rr = Math.min(4, h);
      p.setAttribute('d', `M${x} ${H - bottom}V${y + rr}Q${x} ${y} ${x + rr} ${y}H${x + bw - rr}Q${x + bw} ${y} ${x + bw} ${y + rr}V${H - bottom}Z`);
      p.setAttribute('fill', barFocus === s.day ? 'var(--accent)' : 'var(--ink)');
      p.setAttribute('class', 'bar-rect');
      p.onclick = () => {
        barFocus = barFocus === s.day ? null : s.day;
        $('barsTip').textContent = barFocus ? `Day ${s.day} · ${shortDate(s.ds)} · ${CUR().sym}${fmtLoc(s.v)}（NT$${fmt(sumTwd(entriesOf(s.ds)))}）` : '';
        renderBars(n);
      };
      svg.appendChild(p);
      if (i === maxIdx) {
        const t = document.createElementNS(ns, 'text');
        t.setAttribute('x', x + bw / 2); t.setAttribute('y', y - 7);
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('font-size', '10'); t.setAttribute('fill', 'var(--ink-2)');
        t.textContent = `${CUR().sym}${fmtLoc(s.v)}`;
        svg.appendChild(t);
      }
    }
    const t = document.createElementNS(ns, 'text');
    t.setAttribute('x', x + bw / 2); t.setAttribute('y', H - 5);
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('font-size', '9'); t.setAttribute('fill', 'var(--muted)');
    t.textContent = `D${s.day}`;
    svg.appendChild(t);
  });
  const base = document.createElementNS(ns, 'line');
  base.setAttribute('x1', gap / 2); base.setAttribute('x2', W - gap / 2);
  base.setAttribute('y1', H - bottom); base.setAttribute('y2', H - bottom);
  base.setAttribute('stroke', 'var(--line)');
  svg.appendChild(base);
}

/* ---------- 設定 ---------- */
function renderSettings() {
  $('tripNameInput').value = T().name;
  $('tripCurSelect').value = T().cur;
  $('tripStartInput').value = T().start;
  $('tripEndInput').value = T().end || '';
  $('tripExTwdInput').value = T().exTwd || '';
  $('tripExJpyInput').value = T().exJpy || '';
  const r = R(T().cur), tr = tripRate();
  $('rateCardLabel').textContent = `匯率 · ${CUR().name} → 台幣`;
  $('autoRateShow').textContent = (tr ? `${tr.toFixed(4)}（本旅程換匯）` : (r.auto ? r.auto.toFixed(4) : '—'));
  $('rateUpdatedAt').textContent = tr
    ? '正在使用你的實際換匯匯率'
    : (r.ts
        ? `更新於 ${new Date(r.ts).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
        : '尚未取得（連網後自動抓）');
  $('manualRateInput').value = r.manual || '';
  const cr = cardRate();
  $('cardRateShow').textContent = cr.toFixed(cr >= 1 ? 2 : 4);
  $('cardFeeInput').value = S.cardFee;
  $('entryCount').textContent = E().length;
}

/* ---------- 輸入面板 ---------- */
function openSheet(entry = null) {
  editingId = entry ? entry.id : null;
  sheetAmount = entry ? String(entry.jpy) : '';
  sheetCat = entry ? entry.cat : 'food';
  sheetPay = entry ? (entry.pay || 'cash') : 'cash';
  if (entry) setSheetCur('jpy'); // 編輯舊記錄一律回到當地貨幣顯示（存的是當地金額）
  $('noteInput').value = entry ? entry.note : '';
  $('btnDelete').hidden = !entry;
  $('btnSave').textContent = entry ? '儲存修改' : '記一筆';
  // 幣別切換鈕跟著旅程貨幣走
  document.querySelector('#curToggle [data-cur="jpy"]').textContent = `${CUR().sym} ${CUR().name}`;
  // 有小數的貨幣，「00」鍵變成小數點
  const dotKey = $('keypad').querySelector('[data-k="00"], [data-k="."]');
  dotKey.dataset.k = CUR().dec ? '.' : '00';
  dotKey.textContent = CUR().dec ? '.' : '00';
  renderSheetAmount();
  renderCatChips();
  renderPayToggle();
  renderQuickChips(entry);
  $('sheetMask').classList.add('show');
  $('entrySheet').classList.add('show');
}
/* 最近記過的項目：一鍵帶入金額＋分類＋備註（編輯模式不顯示） */
function renderQuickChips(editing) {
  const box = $('quickChips');
  box.innerHTML = '';
  if (editing) return;
  const seen = new Set(), picks = [];
  // 從最新往回找，同樣的「分類＋備註＋金額」只留一個，取 3 筆
  const sorted = E().slice().sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1));
  for (const e of sorted) {
    const key = `${e.cat}|${e.note}|${e.jpy}`;
    if (seen.has(key)) continue;
    seen.add(key); picks.push(e);
    if (picks.length >= 3) break;
  }
  for (const e of picks) {
    const cat = CATS.find(c => c.id === e.cat) || CATS[5];
    const b = document.createElement('button');
    b.className = 'quick-chip';
    b.innerHTML = `${escapeHtml(e.note || cat.name)} <b>${CUR().sym}${fmtLoc(e.jpy)}</b>`;
    b.onclick = () => {
      sheetAmount = String(e.jpy); sheetCat = e.cat; sheetPay = e.pay || 'cash';
      $('noteInput').value = e.note || '';
      renderSheetAmount(); renderCatChips(); renderPayToggle();
    };
    box.appendChild(b);
  }
}
function closeSheets() {
  $('sheetMask').classList.remove('show');
  $('entrySheet').classList.remove('show');
  $('tripSheet').classList.remove('show');
  $('noteInput').blur();
}
function renderSheetAmount() {
  const v = Number(sheetAmount || 0);
  // 顯示輸入中的數字：整數部分加千分位，小數照打的保留（讓「12.」的點看得到）
  const [int, dec] = (sheetAmount || '0').split('.');
  $('amountShow').textContent = fmt(Number(int)) + (dec !== undefined ? '.' + dec : '');
  const r = payRate(sheetPay); // 現金／刷卡各用各的匯率
  const rd = r >= 1 ? 2 : 4;   // 大額貨幣（美元等）匯率顯示 2 位就夠
  const tag = sheetPay === 'card' ? '刷卡匯率' : '匯率';
  if (sheetCur === 'jpy') {
    $('curSymbol').textContent = CUR().sym;
    $('amountTwd').textContent = `≈ NT$${fmt(v * r)} · ${tag} ${r.toFixed(rd)}`;
  } else {
    $('curSymbol').textContent = 'NT$';
    $('amountTwd').textContent = `≈ ${CUR().sym}${fmtLoc(v / r)} · ${tag} ${r.toFixed(rd)}`;
  }
}
function setSheetCur(cur) {
  sheetCur = cur;
  document.querySelectorAll('#curToggle button').forEach(b => {
    b.classList.toggle('active', b.dataset.cur === cur);
    b.setAttribute('aria-checked', b.dataset.cur === cur);
  });
  renderSheetAmount();
}
function renderPayToggle() {
  document.querySelectorAll('#payToggle button').forEach(b => {
    b.classList.toggle('active', b.dataset.pay === sheetPay);
    b.setAttribute('aria-checked', b.dataset.pay === sheetPay);
  });
}
function renderCatChips() {
  const box = $('catChips');
  box.innerHTML = '';
  for (const c of CATS) {
    const b = document.createElement('button');
    b.className = 'cat-chip' + (c.id === sheetCat ? ' active' : '');
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', c.id === sheetCat);
    b.innerHTML = `${ICONS[c.id]}<span>${c.name}</span>`;
    b.onclick = () => { sheetCat = c.id; renderCatChips(); };
    box.appendChild(b);
  }
}

/* ---------- 新增旅程面板 ---------- */
function openTripSheet() {
  $('newTripName').value = '';
  $('newTripCur').value = 'JPY';
  $('newTripStart').value = todayStr();
  $('newTripEnd').value = '';
  $('newTripExTwd').value = '';
  $('newTripExJpy').value = '';
  $('sheetMask').classList.add('show');
  $('tripSheet').classList.add('show');
}

/* ---------- 事件 ---------- */
document.querySelectorAll('.tab').forEach(tab => {
  tab.onclick = () => showView(tab.dataset.view);
});
document.querySelectorAll('.tab-icon').forEach(el => { el.innerHTML = ICONS[el.dataset.icon]; });
$('btnTrips').onclick = () => showView('view-trips');
$('btnNewTrip').onclick = openTripSheet;

// 建立旅程
$('btnCreateTrip').onclick = () => {
  const name = $('newTripName').value.trim() || '日本旅遊';
  const start = $('newTripStart').value || todayStr();
  let end = $('newTripEnd').value || null;
  if (end && end < start) end = null; // 回程比去程早就當沒填
  const exTwd = parseInt($('newTripExTwd').value, 10) || null;
  const exJpy = parseInt($('newTripExJpy').value, 10) || null;
  const t = newTrip(name, start, end, exTwd, exJpy, $('newTripCur').value);
  S.trips.unshift(t);
  S.active = t.id;
  selectedDate = todayStr(); clampSelected();
  save(); closeSheets(); showView('view-home');
  fetchRate(); // 抓這個貨幣的牌價
};

// 鍵盤
$('keypad').onclick = ev => {
  const k = ev.target.closest('button')?.dataset.k;
  if (!k) return;
  if (k === 'del') sheetAmount = sheetAmount.slice(0, -1);
  else if (k === '.') {
    // 小數點：台幣輸入不用小數；一個金額只能有一個點；最多兩位小數由後面的規則擋
    if (sheetCur !== 'jpy' || sheetAmount.includes('.')) return;
    sheetAmount = (sheetAmount === '' ? '0' : sheetAmount) + '.';
  } else if (sheetAmount.length < 9) {
    if (sheetAmount === '' && (k === '0' || k === '00')) return;
    const dec = sheetAmount.split('.')[1];
    if (dec !== undefined && dec.length + k.length > 2) return; // 小數最多 2 位
    sheetAmount += k;
  }
  renderSheetAmount();
};

// 幣別／付款方式切換
document.querySelectorAll('#curToggle button').forEach(b => {
  b.onclick = () => setSheetCur(b.dataset.cur);
});
document.querySelectorAll('#payToggle button').forEach(b => {
  b.onclick = () => { sheetPay = b.dataset.pay; renderPayToggle(); renderSheetAmount(); };
});

// 儲存（一律換算成當地貨幣存；有小數的貨幣保留 2 位）
$('btnSave').onclick = () => {
  const v = Number(sheetAmount || 0);
  const raw = sheetCur === 'jpy' ? v : v / payRate(sheetPay);
  const jpy = CUR().dec ? Math.round(raw * 100) / 100 : Math.round(raw);
  if (jpy <= 0) return;
  const note = $('noteInput').value.trim();
  if (editingId) {
    const e = E().find(x => x.id === editingId);
    if (e) { e.jpy = jpy; e.cat = sheetCat; e.note = note; e.pay = sheetPay; }
  } else {
    const now = new Date();
    E().push({
      id: uid(),
      date: selectedDate,
      time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      jpy, cat: sheetCat, note, pay: sheetPay
    });
  }
  save(); closeSheets(); renderAll();
};

// 刪除（編輯面板內）
$('btnDelete').onclick = () => {
  if (!editingId) return;
  if (!confirm('刪除這筆記錄？')) return;
  T().entries = E().filter(e => e.id !== editingId);
  save(); closeSheets(); renderAll();
};

$('fabAdd').onclick = () => openSheet();
$('sheetMask').onclick = closeSheets;

// 設定：目前旅程
$('tripNameInput').onchange = ev => {
  T().name = ev.target.value.trim() || T().name;
  ev.target.value = T().name;
  save(); renderAll();
};
$('tripCurSelect').onchange = ev => {
  T().cur = ev.target.value;
  T().exTwd = T().exJpy = null; // 換匯金額是舊貨幣的數字，換幣別後清掉重填
  save(); renderAll();
  fetchRate(); // 抓新貨幣的牌價
};
$('tripStartInput').onchange = ev => {
  if (!ev.target.value) return;
  T().start = ev.target.value;
  clampSelected(); save(); renderAll();
};
$('tripEndInput').onchange = ev => {
  T().end = ev.target.value || null;
  if (T().end && T().end < T().start) T().end = null;
  clampSelected(); save(); renderAll();
};
$('tripExTwdInput').onchange = ev => {
  T().exTwd = parseInt(ev.target.value, 10) || null;
  save(); renderAll();
};
$('tripExJpyInput').onchange = ev => {
  T().exJpy = parseInt(ev.target.value, 10) || null;
  save(); renderAll();
};
// 設定：手動匯率（跟著目前貨幣存，本旅程有換匯匯率時優先用換匯）
$('manualRateInput').onchange = ev => {
  const v = parseFloat(ev.target.value);
  R(T().cur).manual = (v && v > 0) ? v : null;
  ev.target.value = R(T().cur).manual || '';
  save(); renderAll();
};
$('btnRefreshRate').onclick = () => fetchRate(true);
// 刷卡手續費
$('cardFeeInput').onchange = ev => {
  const v = parseFloat(ev.target.value);
  S.cardFee = (v >= 0 && v <= 20) ? v : 1.5;
  ev.target.value = S.cardFee;
  save(); renderAll();
};

// 匯出 JSON（全部旅程）
$('btnExport').onclick = () => {
  const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `pocket-bill-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
};
// 匯入 JSON（從備份檔還原，會覆蓋目前資料）
$('btnImport').onclick = () => $('importFile').click();
$('importFile').onchange = async ev => {
  const file = ev.target.files[0];
  ev.target.value = ''; // 讓同一個檔可以重選
  if (!file) return;
  let j = null;
  try { j = JSON.parse(await file.text()); } catch { alert('這個檔案不是有效的備份檔'); return; }
  // 支援新格式（trips）與最早的單旅程格式（entries）
  if (!j || (!Array.isArray(j.trips) && !Array.isArray(j.entries))) {
    alert('這個檔案不是 Travel Pocket 的備份檔'); return;
  }
  if (Array.isArray(j.entries)) { // 最早格式 → 包成一個旅程
    const t = newTrip('日本旅遊', j.tripStart);
    t.entries = j.entries.map(e => ({ ...e, pay: e.pay || 'cash' }));
    j = { trips: [t], active: t.id, rates: { JPY: j.rate || { auto: null, ts: 0, manual: null } } };
  }
  // 補齊預設值，防備份來自舊版
  for (const t of j.trips) { if (!t.cur) t.cur = 'JPY'; for (const e of t.entries || []) if (!e.pay) e.pay = 'cash'; }
  if (!j.rates) j.rates = {};
  if (j.cardFee === undefined) j.cardFee = 1.5;
  if (!j.trips.find(t => t.id === j.active)) j.active = j.trips[0]?.id;
  if (!j.trips.length) { alert('備份檔裡沒有任何旅程'); return; }
  const nowCount = S.trips.reduce((s, t) => s + t.entries.length, 0);
  const newCount = j.trips.reduce((s, t) => s + t.entries.length, 0);
  if (!confirm(`匯入 ${j.trips.length} 個旅程、${newCount} 筆記錄？\n目前的 ${S.trips.length} 個旅程、${nowCount} 筆會被覆蓋`)) return;
  S = j;
  window.PB.state = S;
  selectedDate = todayStr();
  save(); clampSelected(); renderAll();
  alert('匯入完成');
};
// 清除目前旅程的記錄
$('btnClear').onclick = () => {
  if (!confirm(`清空「${T().name}」的 ${E().length} 筆記錄？無法復原`)) return;
  T().entries = [];
  save(); renderAll();
};

/* ---------- 總渲染 ---------- */
function renderAll() {
  renderHome(); renderStats(); renderSettings(); renderTrips();
}

/* ---------- 對外掛鉤：console 即時調參 ---------- */
window.PB = {
  state: S,
  setVar: (k, v) => document.documentElement.style.setProperty(k, v),
  rerender: renderAll,
};

/* ---------- 啟動 ---------- */
// 填入貨幣下拉選單（設定頁＋新增旅程面板）
for (const id of ['tripCurSelect', 'newTripCur']) {
  $(id).innerHTML = CURS.map(c => `<option value="${c.code}">${c.name} ${c.code}</option>`).join('');
}
clampSelected();
renderAll();
fetchRate();
window.addEventListener('online', () => fetchRate());
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
// 向系統申請「永久儲存」：降低 iOS 空間吃緊時自動清掉記帳資料的風險
if (navigator.storage && navigator.storage.persist) navigator.storage.persist();

})();
