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
  { code: 'TWD', sym: 'NT$', name: '台幣',     dec: false, fb: 1 },
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
  cal:     `<svg viewBox="0 0 24 24" ${STROKE}><rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>`,
  chev:    `<svg viewBox="0 0 24 24" ${STROKE}><path d="M9 5l7 7-7 7"/></svg>`,
  pen:     `<svg class="pen" viewBox="0 0 24 24" ${STROKE}><path d="M4 20h4L20.5 7.5a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="M14.5 5.5l4 4"/></svg>`,
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
  cur: cur || 'TWD',       // 主貨幣代碼（預設台幣）
  budget: null,            // 旅程總預算（台幣，含刷卡）
  exTwd: exTwd || null,    // 換匯：付了多少台幣
  exJpy: exJpy || null,    // 換匯：拿到多少當地貨幣（欄位名沿用 jpy）
  entries: []              // { id, date, time, jpy(當地金額), cat, note, pay:'cash'|'card' }
});

let S = (() => {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(KEY)); } catch { /* 壞資料就重來 */ }
  if (!d) {
    // 全新狀態：不提早 return，讓下面的預設值（cardFee、recentCurs…）一併補齊
    // needsSetup＝第一次打開，引導先建立自己的旅程
    const t = newTrip('我的旅程');
    d = { trips: [t], active: t.id, rates: {}, needsSetup: true };
  }
  if (!d.trips) {
    // 舊版單旅程格式 → 自動搬進第一個旅程，舊記錄付款方式預設現金
    const t = newTrip('日本旅遊', d.tripStart, null, null, null, 'JPY');
    t.entries = (d.entries || []).map(e => ({ ...e, pay: e.pay || 'cash' }));
    d = { trips: [t], active: t.id, rate: d.rate };
  }
  // 匯率改成「每種貨幣一份」：舊的單一匯率搬到 JPY 底下
  if (!d.rates) d.rates = { JPY: d.rate || { auto: null, ts: 0, manual: null } };
  delete d.rate;
  for (const t of d.trips) if (!t.cur) t.cur = 'JPY';
  if (d.cardFee === undefined) d.cardFee = 1.5; // 刷卡手續費 %（台灣多數卡 1.5）
  if (!Array.isArray(d.recentCurs)) d.recentCurs = []; // 最近用過的輸入幣別
  if (!d.display) d.display = 'TWD'; // 畫面顯示幣別：'TWD' 或 'LOCAL'（記錄一律存記帳貨幣）
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
  if (code === 'TWD') return 1; // 台幣對台幣永遠是 1，不查牌價
  const r = R(code);
  return r.manual || r.auto || curOf(code).fb;
};
const isTwdTrip = () => T().cur === 'TWD'; // 主貨幣就是台幣時，很多換算欄位是多餘的
const cashRate = () => tripRate() || rateFor(T().cur);
const cardRate = () => isTwdTrip() ? 1 : rateFor(T().cur) * (1 + (S.cardFee || 0) / 100);
const rate = () => cashRate(); // 一般顯示用現金匯率
const payRate = pay => (pay === 'card' ? cardRate() : cashRate());
// 一筆記錄換算台幣：依付款方式用不同匯率
const entryTwd = e => e.jpy * payRate(e.pay);
const sumTwd = list => Math.round(list.reduce((s, e) => s + entryTwd(e), 0));

/* ---------- 顯示幣別 ----------
   記錄永遠存記帳貨幣（e.jpy），這組工具只負責「畫面上要顯示成什麼」 */
const showTwd = () => S.display !== 'LOCAL' && !isTwdTrip();
const dSym = () => showTwd() ? 'NT$' : CUR().sym;
const dOne = e => showTwd() ? fmt(entryTwd(e)) : fmtLoc(e.jpy);           // 單筆
const dSum = list => showTwd() ? fmt(sumTwd(list)) : fmtLoc(sumJpy(list)); // 一組記錄合計

/* ---------- 輸入幣別（可以是台幣或任何貨幣）的小工具 ---------- */
const symOf = code => code === 'TWD' ? 'NT$' : curOf(code).sym;
const nameOf = code => code === 'TWD' ? '台幣' : curOf(code).name;
const decOf = code => code === 'TWD' ? false : curOf(code).dec;
// 第三方幣別 → 旅程主貨幣（走市場牌價交叉換算）
const toMain = (v, code) => v * rateFor(code) / rateFor(T().cur);
// 牌價幾天前抓的（沒抓過回 null；手動設定視為永遠新鮮）
const rateAgeDays = code => {
  const r = R(code);
  if (r.manual) return 0;
  if (!r.ts) return null;
  return Math.floor((Date.now() - r.ts) / 864e5);
};

async function fetchRate(force = false, code = null) {
  code = code || T().cur;
  if (code === 'TWD') return; // 不需要查台幣兌台幣
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
let sheetCur = 'JPY';   // 輸入幣別（'TWD' 或任一貨幣代碼，預設＝旅程主貨幣）
let sheetPay = 'cash';  // 付款方式
let sheetDate = null;   // 這筆記到哪一天（日期字串）
let openedRow = null;
let donutFocus = null;
let barFocus = null;

/* ---------- 畫面切換 ---------- */
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === id));
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === id));
  $('fabAdd').style.display = id === 'view-home' ? '' : 'none';
  const bare = id === 'view-trips' || id === 'view-onboard'; // 這兩頁不要分頁列
  document.querySelector('.tabbar').style.display = bare ? 'none' : '';
  if (id === 'view-onboard') $('fabAdd').style.display = 'none';
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
        <div class="t-meta">${cs.name} · ${range} · ${t.entries.length} 筆${cashLeft !== null ? ` · 現金剩 ${cs.sym}${fmt(cashLeft)}` : ''}</div>
      </div>`;
    const el = li.querySelector('.entry');
    attachSwipe(li, el);
    li.querySelector('.entry-del').onclick = () => {
      if (!confirm(`刪除「${t.name}」？這個旅程的 ${t.entries.length} 筆記錄會一起刪除，無法復原`)) return;
      S.trips = S.trips.filter(x => x.id !== t.id);
      if (!S.trips.length) { // 刪光了就回到第一次使用的引導頁
        S.trips = [newTrip('我的旅程')];
        S.needsSetup = true;
      }
      if (S.active === t.id) S.active = S.trips[0].id;
      clampSelected(); save();
      if (S.needsSetup) showView('view-onboard'); else renderAll();
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

  // 標題＝旅程名（點了可改），副標只留 Day 與日期
  $('tripTitle').innerHTML = `<span class="t-text">${escapeHtml(T().name)}<span class="dot">.</span></span>${ICONS.pen}`;
  // Day N 只在天數列出現一次，副標與大數字標籤都不再重複
  $('homeSubtitle').textContent = prettyDate(selectedDate);
  $('heroDayLabel').textContent = isToday ? '今日支出' : '這天支出';
  $('heroYen').textContent = dSym();
  $('heroJpy').textContent = dSum(list);
  $('heroTwdChip').hidden = isTwdTrip() || total === 0;
  // 副 chip 顯示另一種幣別，兩個數字都看得到
  $('heroTwdChip').textContent = showTwd()
    ? `${CUR().sym}${fmtLoc(total)}`
    : `≈ NT$${fmt(sumTwd(list))}`;
  $('heroCountChip').hidden = !list.length; // 空清單下面已經有說明了
  $('heroCountChip').textContent = `${list.length} 筆`;

  // 現金餘額（有填換匯才顯示）
  const cashChip = $('heroCashChip');
  if (T().exJpy) {
    cashChip.hidden = false;
    // 現金是實際拿在手上的鈔票，一律用記帳貨幣顯示，不跟著「畫面顯示」走
    cashChip.textContent = `現金剩 ${CUR().sym}${fmtLoc(T().exJpy - cashSpent())}`;
  } else cashChip.hidden = true;

  // 預算餘額（含刷卡，用台幣算）
  const budChip = $('heroBudgetChip');
  if (T().budget) {
    const left = T().budget - sumTwd(E());
    budChip.hidden = false;
    budChip.textContent = left >= 0 ? `預算剩 NT$${fmt(left)}` : `超出預算 NT$${fmt(-left)}`;
  } else budChip.hidden = true;

  // 日預算／續航提示：有總預算就優先用它（刷卡也算得到），否則退回現金
  const hint = $('cashHint');
  hint.hidden = true;
  if (T().budget) {
    const left = T().budget - sumTwd(E());
    const today = todayStr(), dToday = dayOfDate(today);
    if (left < 0) {
      hint.hidden = false;
      hint.innerHTML = `已超出預算 <b>NT$${fmt(-left)}</b>`;
    } else if (T().end && today >= T().start && today <= T().end) {
      const daysLeft = dayOfDate(T().end) - dToday + 1;
      hint.hidden = false;
      hint.innerHTML = `到回程還 ${daysLeft} 天，每天可花 <b>NT$${fmt(left / daysLeft)}</b>`;
    }
  } else if (T().exJpy) {
    const cashLeft = T().exJpy - cashSpent();
    const today = todayStr();
    const dToday = dayOfDate(today);
    if (T().end && today >= T().start && today <= T().end && cashLeft > 0) {
      // 有回程日：剩餘現金 ÷ 剩餘天數 ＝ 每天還可以花多少
      const daysLeft = dayOfDate(T().end) - dToday + 1;
      hint.hidden = false;
      hint.innerHTML = `到回程還 ${daysLeft} 天，現金每天可花 <b>${CUR().sym}${fmtLoc(cashLeft / daysLeft)}</b>`;
    } else if (!T().end && dToday >= 1 && cashLeft > 0) {
      // 沒回程日：照目前燒錢速度估現金還能撐幾天
      const burn = cashSpent() / Math.max(dToday, 1);
      if (burn > 0) {
        hint.hidden = false;
        hint.innerHTML = `照目前速度，現金還能撐約 <b>${Math.floor(cashLeft / burn)} 天</b>`;
      }
    } else if (cashLeft <= 0) {
      hint.hidden = false;
      hint.innerHTML = `現金已用完，超支 <b>${CUR().sym}${fmtLoc(-cashLeft)}</b>`;
    }
  }

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
  // Day 列最後的「日期」鈕：直接改旅程日期，不用進設定
  const edit = document.createElement('button');
  edit.className = 'day-chip day-chip-edit';
  edit.setAttribute('aria-label', '設定旅程日期');
  edit.innerHTML = `${ICONS.cal}<small>日期</small>`;
  edit.onclick = openDateSheet;
  chips.appendChild(edit);
  const act = chips.querySelector('.active');
  if (act) act.scrollIntoView({ inline: 'center', block: 'nearest' });

  // 清單
  const ul = $('entryList');
  ul.innerHTML = '';
  ul.classList.remove('scrolled'); // 重建清單後捲動位置歸零
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
          <div class="e-time">${e.note ? `${cat.name} · ` : ''}${e.time}${e.pay === 'card' ? ' · 刷卡' : ''}${e.oc ? ` · 原 ${symOf(e.oc)}${Number(e.oa).toLocaleString('en-US', { maximumFractionDigits: 2 })}` : ''}</div>
        </span>
        <span class="e-amount">
          <div class="e-jpy">${dSym()}${dOne(e)}</div>
          ${isTwdTrip() ? '' : `<div class="e-twd">${showTwd() ? `${CUR().sym}${fmtLoc(e.jpy)}` : `NT$${fmt(entryTwd(e))}`}</div>`}
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
  $('totalYen').textContent = dSym();
  $('totalJpy').textContent = dSum(E());
  $('totalTwdChip').hidden = isTwdTrip();
  $('totalTwdChip').textContent = showTwd()
    ? `${CUR().sym}${fmtLoc(total)}`
    : `≈ NT$${fmt(sumTwd(E()))}`;
  $('totalDaysChip').textContent = `${n} 天`;
  const avg = showTwd() ? sumTwd(E()) / (n || 1) : total / (n || 1);
  $('avgDayChip').textContent = `日均 ${dSym()}${showTwd() ? fmt(avg) : fmtLoc(avg)}`;
  $('statsSubtitle').textContent = `${T().name} · 共 ${E().length} 筆`;

  // 現金／刷卡各花多少
  const cashList = E().filter(e => e.pay !== 'card'), cardList = E().filter(e => e.pay === 'card');
  const split = $('paySplitChip');
  if (cardList.length) {
    split.hidden = false;
    split.textContent = `現金 ${dSym()}${dSum(cashList)} · 刷卡 ${dSym()}${dSum(cardList)}`;
  } else split.hidden = true;

  renderDonut(total);
  renderBars(n);
}

/* 圓環圖 */
function renderDonut(total) {
  const svg = $('donutSvg');
  svg.innerHTML = '';
  const data = CATS.map(c => {
    const l = E().filter(e => e.cat === c.id);
    return { ...c, v: showTwd() ? sumTwd(l) : sumJpy(l) }; // v＝顯示幣別的金額
  }).filter(d => d.v > 0);
  total = data.reduce((a, d) => a + d.v, 0); // 佔比跟著顯示幣別算
  const cx = 100, cy = 100, R = 88, r = 62;

  if (!data.length) {
    svg.innerHTML = `<circle cx="100" cy="100" r="75" fill="none" stroke="var(--line)" stroke-width="24"/>`;
    $('donutCenterName').textContent = '尚無資料';
    $('donutCenterVal').textContent = '';
    $('donutCenterPct').textContent = '';
    $('catLegend').innerHTML = '';
    return;
  }
  const TAU = Math.PI * 2, pad = data.length > 1 ? 0.035 : 0;
  if (data.length === 1) {
    // 單一分類＝整個圓，用描邊畫，避免滿圈弧線退化
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', cx); c.setAttribute('cy', cy);
    c.setAttribute('r', (R + r) / 2);
    c.setAttribute('fill', 'none');
    c.setAttribute('stroke', data[0].hex);
    c.setAttribute('stroke-width', R - r);
    svg.appendChild(c);
  }
  let a = -Math.PI / 2;
  for (const d of data) {
    if (data.length === 1) break;
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
  // 中心：未選取顯示總計，選取後顯示該分類金額與佔比
  const f = donutFocus ? data.find(d => d.id === donutFocus) : null;
  $('donutCenterName').textContent = f ? f.name : '全部';
  $('donutCenterVal').textContent = `${dSym()}${showTwd() ? fmt(f ? f.v : total) : fmtLoc(f ? f.v : total)}`;
  $('donutCenterPct').textContent = f ? `${Math.round(f.v / total * 100)}%` : '';

  // 分類列＝可點按鈕，展開時明細直接接在它底下
  const lg = $('catLegend');
  lg.innerHTML = '';
  for (const d of data.slice().sort((x, y) => y.v - x.v)) {
    const open = donutFocus === d.id;
    const li = document.createElement('li');
    li.className = 'cat-item' + (open ? ' open' : '');
    li.innerHTML = `
      <button class="cat-row">
        <span class="l-dot" style="background:${d.hex}"></span>
        <span class="l-icon">${ICONS[d.id]}</span>
        <span class="l-name">${d.name}</span>
        <span class="l-val">${dSym()}${showTwd() ? fmt(d.v) : fmtLoc(d.v)}</span>
        <span class="chev">${ICONS.chev}</span>
      </button>`;
    li.querySelector('.cat-row').onclick = () => {
      donutFocus = open ? null : d.id; renderStats();
    };
    if (open) {
      // 明細：左邊日期、右邊金額；點一下跳到那一天
      const sub = document.createElement('ul');
      sub.className = 'cat-sub';
      const list = E().filter(e => e.cat === d.id)
        .sort((a, b) => ((a.date + a.time) < (b.date + b.time) ? 1 : -1));
      for (const e of list) {
        const row = document.createElement('li');
        // 顯示台幣時，前面帶一個淡灰的原幣金額
        const orig = showTwd() ? `${CUR().sym}${fmtLoc(e.jpy)}` : '';
        row.innerHTML = `
          <span class="ce-day">Day ${dayOfDate(e.date)} · ${shortDate(e.date)}</span>
          <span class="ce-orig">${orig}</span>
          <span class="ce-amt">${dSym()}${dOne(e)}</span>`;
        row.onclick = () => { selectedDate = e.date; showView('view-home'); };
        sub.appendChild(row);
      }
      li.appendChild(sub);
    }
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
  for (let i = 1; i <= n; i++) {
    const l = entriesOf(dateOfDay(i));
    sums.push({ day: i, ds: dateOfDay(i), v: showTwd() ? sumTwd(l) : sumJpy(l) });
  }
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
        $('barsTip').textContent = barFocus
          ? `Day ${s.day} · ${shortDate(s.ds)} · ${dSym()}${showTwd() ? fmt(s.v) : fmtLoc(s.v)}` : '';
        renderBars(n);
      };
      svg.appendChild(p);
      if (i === maxIdx) {
        const t = document.createElementNS(ns, 'text');
        t.setAttribute('x', x + bw / 2); t.setAttribute('y', y - 7);
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('font-size', '10'); t.setAttribute('fill', 'var(--ink-2)');
        t.textContent = `${dSym()}${showTwd() ? fmt(s.v) : fmtLoc(s.v)}`;
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
  $('tripInfoShow').textContent = `${T().name} · ${shortDate(T().start)}${T().end ? ` – ${shortDate(T().end)}` : ''}`;
  $('tripCurSelect').value = T().cur;
  $('tripBudgetInput').value = T().budget || '';
  $('tripExTwdInput').value = T().exTwd || '';
  $('tripExJpyInput').value = T().exJpy || '';
  // 主貨幣是台幣時：沒有換匯也沒有匯率可言，只留「現金預算」
  $('rowExTwd').hidden = isTwdTrip();
  $('rowDisplay').hidden = isTwdTrip(); // 記帳貨幣已是台幣就沒得換
  $('displaySelect').value = S.display;
  $('rateCard').hidden = isTwdTrip();
  $('labelExJpy').innerHTML = isTwdTrip()
    ? '現金預算<br><span class="muted small">帶了多少現金</span>'
    : '換到當地貨幣<br><span class="muted small">實際拿到的金額</span>';
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
  sheetCur = T().cur; // 每次打開回到旅程主貨幣（編輯時存的就是主貨幣金額）
  sheetDate = entry ? entry.date : selectedDate; // 這筆記到哪一天
  renderSheetDayBtn();
  $('noteInput').value = entry ? entry.note : '';
  $('btnDelete').hidden = !entry;
  $('btnSave').textContent = entry ? '儲存修改' : '記一筆';
  renderCurBtn();
  updateDotKey();
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
      sheetCur = T().cur; // 快速帶入的金額是主貨幣
      $('noteInput').value = e.note || '';
      renderCurBtn(); updateDotKey(); renderSheetAmount(); renderCatChips(); renderPayToggle();
    };
    box.appendChild(b);
  }
}
function closeSheets() {
  $('sheetMask').classList.remove('show');
  $('entrySheet').classList.remove('show');
  $('tripSheet').classList.remove('show');
  $('curSheet').classList.remove('show');
  $('dateSheet').classList.remove('show');
  $('daySheet').classList.remove('show');
  $('noteInput').blur();
}
function renderSheetAmount() {
  const v = Number(sheetAmount || 0);
  // 顯示輸入中的數字：整數部分加千分位，小數照打的保留（讓「12.」的點看得到）
  const [int, dec] = (sheetAmount || '0').split('.');
  $('amountShow').textContent = fmt(Number(int)) + (dec !== undefined ? '.' + dec : '');
  $('curSymbol').textContent = symOf(sheetCur);
  const r = payRate(sheetPay); // 現金／刷卡各用各的匯率
  const rd = r >= 1 ? 2 : 4;
  const tag = sheetPay === 'card' ? '刷卡匯率' : '匯率';
  // 牌價過期標示：只有真的在用「自動牌價」時才顯示（現金用換匯匯率就不標）
  const thirdCur = sheetCur !== T().cur && sheetCur !== 'TWD';
  const usingMarket = thirdCur || sheetPay === 'card' || !tripRate();
  const age = rateAgeDays(sheetCur === 'TWD' ? T().cur : sheetCur);
  const stale = (usingMarket && age !== null && age >= 1) ? `（${age} 天前的牌價）` : '';
  if (sheetCur === T().cur && isTwdTrip()) {
    // 台幣旅程用台幣輸入，沒有東西要換算
    $('amountTwd').textContent = '';
  } else if (sheetCur === T().cur) {
    // 主貨幣輸入 → 顯示台幣
    $('amountTwd').textContent = `≈ NT$${fmt(v * r)} · ${tag} ${r.toFixed(rd)}${stale}`;
  } else if (sheetCur === 'TWD') {
    // 台幣輸入 → 顯示主貨幣
    $('amountTwd').textContent = `≈ ${CUR().sym}${fmtLoc(v / r)} · ${tag} ${r.toFixed(rd)}${stale}`;
  } else {
    // 第三方幣別輸入 → 同時顯示主貨幣與台幣
    const mv = toMain(v, sheetCur);
    $('amountTwd').textContent = `≈ ${CUR().sym}${fmtLoc(mv)} · NT$${fmt(mv * r)}${stale}`;
  }
}
/* 記到哪一天：按鈕與選擇面板 */
function renderSheetDayBtn() {
  $('sheetDayBtn').innerHTML = `記到 <b>Day ${dayOfDate(sheetDate)}</b> · ${shortDate(sheetDate)} <span class="caret">▼</span>`;
}
function openDaySheet() {
  const grid = $('dayGrid');
  grid.innerHTML = '';
  const n = tripDayCount();
  for (let i = 1; i <= n; i++) {
    const ds = dateOfDay(i);
    const b = document.createElement('button');
    b.className = ds === sheetDate ? 'active' : '';
    b.innerHTML = `<b>Day ${i}</b>${shortDate(ds)}`;
    b.onclick = () => {
      sheetDate = ds;
      renderSheetDayBtn();
      $('daySheet').classList.remove('show');
    };
    grid.appendChild(b);
  }
  $('daySheet').classList.add('show');
}

/* 幣別按鈕與選擇面板 */
function renderCurBtn() {
  $('curBtn').innerHTML = `${symOf(sheetCur)} ${nameOf(sheetCur)} <span class="caret">▼</span>`;
}
function updateDotKey() {
  // 有小數的幣別，「00」鍵變成小數點
  const dotKey = $('keypad').querySelector('[data-k="00"], [data-k="."]');
  dotKey.dataset.k = decOf(sheetCur) ? '.' : '00';
  dotKey.textContent = decOf(sheetCur) ? '.' : '00';
}
function setSheetCur(code) {
  sheetCur = code;
  // 換幣別時把已輸入的小數修掉（避免整數幣別殘留小數）
  if (!decOf(code) && sheetAmount.includes('.')) sheetAmount = sheetAmount.split('.')[0];
  if (code !== T().cur && code !== 'TWD') {
    fetchRate(false, code); // 補抓這個幣別的牌價
    S.recentCurs = [code, ...S.recentCurs.filter(c => c !== code)].slice(0, 4);
    save();
  }
  renderCurBtn(); updateDotKey(); renderSheetAmount();
}
function openCurSheet() {
  const grid = $('curGrid');
  grid.innerHTML = '';
  // 順序：旅程主貨幣 → 台幣 → 最近用過 → 其他
  const codes = [...new Set([T().cur, 'TWD',
    ...S.recentCurs.filter(c => c !== T().cur && c !== 'TWD'),
    ...CURS.map(c => c.code).filter(c => c !== T().cur && c !== 'TWD' && !S.recentCurs.includes(c))])];
  for (const code of codes) {
    const b = document.createElement('button');
    b.className = code === sheetCur ? 'active' : '';
    b.innerHTML = `<b>${symOf(code)}</b>${nameOf(code)}${code === T().cur ? '<span class="cur-tag">主要</span>' : ''}`;
    b.onclick = () => { setSheetCur(code); $('curSheet').classList.remove('show'); };
    grid.appendChild(b);
  }
  $('curSheet').classList.add('show');
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

/* ---------- 第一次使用的引導頁 ---------- */
$('obGo').onclick = () => {
  const name = $('obName').value.trim() || $('obName').placeholder;
  const start = $('obStart').value || todayStr();
  let end = $('obEnd').value || null;
  if (end && end < start) end = null;
  const cash = parseInt($('obCash').value, 10) || null;
  const t = newTrip(name, start, end, null, cash, $('obCur').value);
  t.budget = parseInt($('obBudget').value, 10) || null;
  if (t.cur === 'TWD') t.exTwd = t.exJpy; // 台幣旅程換算比率固定為 1
  // 取代一開始自動生出來的空白旅程
  S.trips = [t, ...S.trips.filter(x => x.entries.length > 0)];
  S.active = t.id;
  S.needsSetup = false;
  selectedDate = todayStr(); clampSelected();
  save(); showView('view-home');
  fetchRate();
};
// 現金欄的範例金額跟著選的貨幣變
function obCashHint() {
  const c = curOf($('obCur').value);
  const eg = { TWD: '10,000', JPY: '118,000', KRW: '400,000', VND: '5,000,000', IDR: '4,000,000' }[c.code] || '500';
  $('obCash').placeholder = `${c.sym} ${eg}`;
}
$('obCur').onchange = obCashHint;
// 按 Enter 直接開始
$('obName').addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); $('obGo').click(); } });

/* ---------- 旅程日期面板（主頁直接開） ---------- */
function openDateSheet() {
  $('dateSheetName').value = T().name;
  $('dateSheetStart').value = T().start;
  $('dateSheetEnd').value = T().end || '';
  $('sheetMask').classList.add('show');
  $('dateSheet').classList.add('show');
}

/* ---------- 新增旅程面板 ---------- */
function openTripSheet() {
  $('newTripName').value = '';
  $('newTripCur').value = 'TWD';
  $('newTripStart').value = todayStr();
  $('newTripEnd').value = '';
  $('newTripBudget').value = '';
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
$('tripTitle').onclick = openDateSheet;
$('entryList').addEventListener('scroll', ev => {
  ev.target.classList.toggle('scrolled', ev.target.scrollTop > 4);
}, { passive: true });
$('btnNewTrip').onclick = openTripSheet;

// 旅程資訊面板：完成（名稱＋日期一起存）
$('btnDateSave').onclick = () => {
  T().name = $('dateSheetName').value.trim() || T().name;
  const start = $('dateSheetStart').value;
  let end = $('dateSheetEnd').value || null;
  if (start) T().start = start;
  if (end && end < T().start) end = null; // 回程比去程早就當沒填
  T().end = end;
  clampSelected(); save(); closeSheets(); renderAll();
};

// 建立旅程
$('btnCreateTrip').onclick = () => {
  const name = $('newTripName').value.trim() || '日本旅遊';
  const start = $('newTripStart').value || todayStr();
  let end = $('newTripEnd').value || null;
  if (end && end < start) end = null; // 回程比去程早就當沒填
  const exTwd = parseInt($('newTripExTwd').value, 10) || null;
  const exJpy = parseInt($('newTripExJpy').value, 10) || null;
  const t = newTrip(name, start, end, exTwd, exJpy, $('newTripCur').value);
  t.budget = parseInt($('newTripBudget').value, 10) || null;
  S.trips.unshift(t);
  // 首次引導建立的旅程：把一開始自動生成的空白預設旅程換掉
  if (S.needsSetup) {
    S.trips = S.trips.filter(x => x.id === t.id || x.entries.length > 0);
    S.needsSetup = false;
  }
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
    // 小數點：只有「有小數的幣別」能用；一個金額只能有一個點
    if (!decOf(sheetCur) || sheetAmount.includes('.')) return;
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
$('curBtn').onclick = openCurSheet;
$('sheetDayBtn').onclick = openDaySheet;
document.querySelectorAll('#payToggle button').forEach(b => {
  b.onclick = () => { sheetPay = b.dataset.pay; renderPayToggle(); renderSheetAmount(); };
});

// 儲存（一律換算成旅程主貨幣存；非主貨幣輸入時保留原始金額 oc/oa）
$('btnSave').onclick = () => {
  const v = Number(sheetAmount || 0);
  let raw;
  if (sheetCur === T().cur) raw = v;                       // 主貨幣：直接存
  else if (sheetCur === 'TWD') raw = v / payRate(sheetPay); // 台幣：依付款方式換算
  else raw = toMain(v, sheetCur);                           // 其他幣別：市場牌價交叉換算
  const jpy = CUR().dec ? Math.round(raw * 100) / 100 : Math.round(raw);
  if (jpy <= 0) return;
  const note = $('noteInput').value.trim();
  const orig = sheetCur !== T().cur ? { oc: sheetCur, oa: v } : {};
  if (editingId) {
    const e = E().find(x => x.id === editingId);
    if (e) {
      e.jpy = jpy; e.cat = sheetCat; e.note = note; e.pay = sheetPay;
      e.date = sheetDate;                     // 編輯可以改天
      delete e.oc; delete e.oa;               // 編輯後以主貨幣為準
      Object.assign(e, orig);
    }
  } else {
    const now = new Date();
    E().push({
      id: uid(),
      date: sheetDate, // 記到面板上選的那一天
      time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      jpy, cat: sheetCat, note, pay: sheetPay, ...orig
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

// 設定：目前旅程（名稱與日期都在「旅程資訊」面板改）
$('btnEditTrip').onclick = openDateSheet;
$('displaySelect').onchange = ev => { S.display = ev.target.value; save(); renderAll(); };
$('tripCurSelect').onchange = ev => {
  const from = T().cur, to = ev.target.value;
  if (from === to) return;
  // 既有記錄存的是舊貨幣金額，不換算的話 ¥5,520 會直接變成 NT$5,520
  if (E().length) {
    const k = rateFor(from) / rateFor(to); // 舊貨幣 → 新貨幣
    const ok = confirm(
      `把現有 ${E().length} 筆記錄一起換算成${nameOf(to)}嗎？\n` +
      `（用目前牌價 1 ${nameOf(from)} ≈ ${k.toFixed(4)} ${nameOf(to)}）\n\n` +
      `按「取消」則只改幣別符號，金額數字維持不變。`);
    if (ok) {
      const dec = curOf(to).dec;
      for (const e of E()) {
        e.jpy = dec ? Math.round(e.jpy * k * 100) / 100 : Math.round(e.jpy * k);
        delete e.oc; delete e.oa; // 原始外幣金額已無對應關係
      }
    }
  }
  T().cur = to;
  T().exTwd = T().exJpy = null; // 換匯金額是舊貨幣的數字，換幣別後清掉重填
  save(); renderAll();
  fetchRate(); // 抓新貨幣的牌價
};
$('tripBudgetInput').onchange = ev => {
  T().budget = parseInt(ev.target.value, 10) || null;
  save(); renderAll();
};
$('tripExTwdInput').onchange = ev => {
  T().exTwd = parseInt(ev.target.value, 10) || null;
  save(); renderAll();
};
$('tripExJpyInput').onchange = ev => {
  T().exJpy = parseInt(ev.target.value, 10) || null;
  if (isTwdTrip()) T().exTwd = T().exJpy; // 台幣旅程換算比率固定為 1
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
    const t = newTrip('日本旅遊', j.tripStart, null, null, null, 'JPY');
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
$('obStart').value = todayStr();
for (const id of ['tripCurSelect', 'newTripCur', 'obCur']) {
  $(id).innerHTML = CURS.map(c => `<option value="${c.code}">${c.name} ${c.code}</option>`).join('');
}
obCashHint();
clampSelected();
renderAll();
// 第一次打開：整頁引導建立第一趟旅程
if (S.needsSetup) showView('view-onboard');
fetchRate();
window.addEventListener('online', () => fetchRate());
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
// 向系統申請「永久儲存」：降低 iOS 空間吃緊時自動清掉記帳資料的風險
if (navigator.storage && navigator.storage.persist) navigator.storage.persist();

})();
