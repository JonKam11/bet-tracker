// ============================================================
// LEDGER — personal bet tracker (local version)
// All data is saved in this browser's storage only.
// Use the ⭳ export / ⭱ import buttons to back up or move your
// data to another device/browser.
// ============================================================

const STORAGE_KEY = "ledger_bets_v1";
const SETTINGS_KEY = "ledger_settings_v1";

// ---------------- settings (currency + theme) ----------------
let settings = loadSettings();

function loadSettings() {
  try {
    return { currency: "NOK", theme: "dark", ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") };
  } catch {
    return { currency: "NOK", theme: "dark" };
  }
}
function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
function applySettings() {
  document.documentElement.setAttribute("data-theme", settings.theme);
  document.getElementById("set-currency").value = settings.currency;
  document.querySelectorAll(".theme-opt").forEach((btn) =>
    btn.classList.toggle("active", btn.dataset.theme === settings.theme)
  );
}

function fmt(n) {
  if (settings.currency === "EUR") {
    return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);
  }
  if (settings.currency === "USD") {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
  }
  return new Intl.NumberFormat("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + " kr";
}

// settings panel toggle + interactions
document.getElementById("settings-btn").addEventListener("click", (e) => {
  e.stopPropagation();
  document.getElementById("settings-panel").classList.toggle("hidden");
});
document.addEventListener("click", (e) => {
  const panel = document.getElementById("settings-panel");
  if (!panel.classList.contains("hidden") && !panel.contains(e.target) && e.target.id !== "settings-btn") {
    panel.classList.add("hidden");
  }
});
document.getElementById("set-currency").addEventListener("change", (e) => {
  settings.currency = e.target.value;
  saveSettings();
  renderAll();
});
document.querySelectorAll(".theme-opt").forEach((btn) => {
  btn.addEventListener("click", () => {
    settings.theme = btn.dataset.theme;
    saveSettings();
    applySettings();
  });
});

// ---------------- state ----------------
let bets = load();
let editingId = null;

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bets));
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("show"), 2200);
}

function addOrUpdateBet(betData) {
  const wasEditing = !!editingId;
  if (editingId) {
    const idx = bets.findIndex((b) => b.id === editingId);
    if (idx > -1) bets[idx] = { ...bets[idx], ...betData };
  } else {
    bets.unshift({ id: crypto.randomUUID(), ...betData });
  }
  sortBets();
  save();
  renderAll();
  showToast(wasEditing ? "✓ Bet updated" : "✓ Bet saved");
}

function removeBet(id) {
  bets = bets.filter((b) => b.id !== id);
  save();
  renderAll();
  showToast("Bet deleted");
}

function sortBets() {
  bets.sort((a, b) => b.date.localeCompare(a.date));
}

// ============================================================
// EXPORT / IMPORT (your manual backup / device-transfer method)
// ============================================================
document.getElementById("export-btn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(bets, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ledger-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("import-input").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!Array.isArray(imported)) throw new Error("bad format");
      bets = imported;
      sortBets();
      save();
      renderAll();
      alert(`Imported ${imported.length} bets.`);
    } catch {
      alert("Couldn't read that file — make sure it's a Ledger backup .json.");
    }
    e.target.value = "";
  };
  reader.readAsText(file);
});

// ============================================================
// NAVIGATION
// ============================================================
const views = ["dashboard", "bets", "stats"];
function switchView(name) {
  views.forEach((v) => {
    document.getElementById("view-" + v).classList.toggle("hidden", v !== name);
  });
  document.querySelectorAll("nav.tabs button, nav.tabs-mobile button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === name);
  });
}
document.querySelectorAll("nav.tabs button, nav.tabs-mobile button").forEach((btn) => {
  btn.addEventListener("click", () => switchView(btn.dataset.view));
});

// Bets sub-tabs: List / Calendar
let calendarDate = new Date();
let selectedCalendarDay = null;

document.querySelectorAll(".subtabs button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".subtabs button").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const sub = btn.dataset.subview;
    document.getElementById("subview-list").classList.toggle("hidden", sub !== "list");
    document.getElementById("subview-calendar").classList.toggle("hidden", sub !== "calendar");
    if (sub === "calendar") renderCalendarView();
  });
});

document.getElementById("cal-prev").addEventListener("click", () => {
  calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1);
  renderCalendarView();
});
document.getElementById("cal-next").addEventListener("click", () => {
  calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1);
  renderCalendarView();
});

// ============================================================
// SLIDE-OVER FORM
// ============================================================
const overlay = document.getElementById("overlay");
const slideover = document.getElementById("slideover");
const betForm = document.getElementById("bet-form");

function openSlideoverForAdd() {
  editingId = null;
  document.getElementById("slideover-title").textContent = "Log a bet";
  document.getElementById("submit-bet-btn").textContent = "Save bet";
  betForm.reset();
  document.getElementById("bf-date").valueAsDate = new Date();
  overlay.classList.add("show");
  slideover.classList.add("show");
}

function openSlideoverForEdit(b) {
  editingId = b.id;
  document.getElementById("slideover-title").textContent = "Edit bet";
  document.getElementById("submit-bet-btn").textContent = "Update bet";
  document.getElementById("bf-league").value = b.league;
  document.getElementById("bf-home").value = b.homeTeam;
  document.getElementById("bf-away").value = b.awayTeam;
  document.getElementById("bf-type").value = b.type;
  document.getElementById("bf-date").value = b.date;
  document.getElementById("bf-odds").value = b.odds;
  document.getElementById("bf-stake").value = b.stake;
  document.getElementById("bf-status").value = b.status;
  document.getElementById("bf-notes").value = b.notes || "";
  updatePotentialReturn();
  overlay.classList.add("show");
  slideover.classList.add("show");
}

function closeSlideover() {
  overlay.classList.remove("show");
  slideover.classList.remove("show");
  betForm.reset();
  editingId = null;
}
["add-bet-btn", "add-bet-btn-2"].forEach((id) =>
  document.getElementById(id).addEventListener("click", openSlideoverForAdd)
);
document.getElementById("close-slideover").addEventListener("click", closeSlideover);
document.getElementById("cancel-bet").addEventListener("click", closeSlideover);
overlay.addEventListener("click", closeSlideover);

// live potential-return preview
function updatePotentialReturn() {
  const odds = parseFloat(document.getElementById("bf-odds").value) || 0;
  const stake = parseFloat(document.getElementById("bf-stake").value) || 0;
  document.getElementById("bf-potential").textContent = fmt(odds * stake);
}
document.getElementById("bf-odds").addEventListener("input", updatePotentialReturn);
document.getElementById("bf-stake").addEventListener("input", updatePotentialReturn);

betForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const odds = parseFloat(document.getElementById("bf-odds").value);
  const stake = parseFloat(document.getElementById("bf-stake").value);
  const status = document.getElementById("bf-status").value; // won | lost

  const profit = status === "won" ? stake * odds - stake : -stake;

  const betData = {
    league: document.getElementById("bf-league").value,
    homeTeam: document.getElementById("bf-home").value.trim(),
    awayTeam: document.getElementById("bf-away").value.trim(),
    type: document.getElementById("bf-type").value,
    date: document.getElementById("bf-date").value,
    odds,
    stake,
    status,
    profit,
    notes: document.getElementById("bf-notes").value.trim()
  };

  addOrUpdateBet(betData);
  closeSlideover();
});

// ============================================================
// RENDERING
// ============================================================
function renderAll() {
  renderHero();
  renderStatCards();
  renderBetList(document.getElementById("recent-bets-list"), bets.slice(0, 6));
  refreshListView();
  renderLeagueFilter();
  renderStatsBreakdowns();
}

function sortForDisplay(list, mode) {
  const arr = [...list];
  switch (mode) {
    case "oldest":
      arr.sort((a, b) => a.date.localeCompare(b.date));
      break;
    case "profit-high":
      arr.sort((a, b) => b.profit - a.profit);
      break;
    case "profit-low":
      arr.sort((a, b) => a.profit - b.profit);
      break;
    case "odds-high":
      arr.sort((a, b) => b.odds - a.odds);
      break;
    case "stake-high":
      arr.sort((a, b) => b.stake - a.stake);
      break;
    default:
      arr.sort((a, b) => b.date.localeCompare(a.date)); // newest
  }
  return arr;
}

function filteredSortedBets() {
  const league = document.getElementById("filter-league").value;
  const status = document.getElementById("filter-status").value;
  const search = document.getElementById("search-input").value.trim().toLowerCase();
  const sortMode = document.getElementById("sort-select").value;
  const list = bets.filter(
    (b) =>
      (!league || b.league === league) &&
      (!status || b.status === status) &&
      (!search ||
        [b.homeTeam, b.awayTeam, b.league, b.notes].join(" ").toLowerCase().includes(search))
  );
  return sortForDisplay(list, sortMode);
}

function refreshListView() {
  renderBetList(document.getElementById("all-bets-list"), filteredSortedBets());
  if (!document.getElementById("subview-calendar").classList.contains("hidden")) {
    renderCalendarView();
  }
}
["filter-league", "filter-status", "sort-select"].forEach((id) =>
  document.getElementById(id).addEventListener("change", refreshListView)
);
document.getElementById("search-input").addEventListener("input", refreshListView);

function renderLeagueFilter() {
  const sel = document.getElementById("filter-league");
  const current = sel.value;
  const leagues = [...new Set(bets.map((b) => b.league))];
  sel.innerHTML =
    '<option value="">All leagues</option>' +
    leagues.map((l) => `<option value="${l}">${l}</option>`).join("");
  sel.value = current;
}

function renderHero() {
  const settled = bets.filter((b) => b.status === "won" || b.status === "lost");
  const netProfit = settled.reduce((sum, b) => sum + b.profit, 0);
  const heroEl = document.getElementById("hero-profit");
  heroEl.textContent = fmt(netProfit);
  heroEl.className = "hero-value " + (netProfit > 0 ? "pos" : netProfit < 0 ? "neg" : "flat");

  const sub = document.getElementById("hero-sub");
  if (bets.length === 0) {
    sub.innerHTML = "No bets logged yet — click <b>+ Add bet</b> to start.";
  } else {
    const wins = settled.filter((b) => b.status === "won").length;
    sub.innerHTML = `<b>${bets.length}</b> bets logged · <b>${wins}</b>/${settled.length} settled wins`;
  }

  drawSparkline(settled);
}

function drawSparkline(settledBetsDescDate) {
  const path = document.getElementById("sparkline-path");
  const fill = document.getElementById("sparkline-fill");
  if (settledBetsDescDate.length < 1) {
    path.setAttribute("d", "");
    fill.setAttribute("d", "");
    return;
  }
  const chrono = [...settledBetsDescDate].reverse();
  let cum = 0;
  const points = [0, ...chrono.map((b) => (cum += b.profit))];

  const w = 400, h = 90, pad = 6;
  const min = Math.min(0, ...points);
  const max = Math.max(0, ...points);
  const range = max - min || 1;

  const coords = points.map((v, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return [x, y];
  });

  const linePath = coords.map((c, i) => (i === 0 ? "M" : "L") + c[0].toFixed(1) + " " + c[1].toFixed(1)).join(" ");
  path.setAttribute("d", linePath);

  const fillPath = linePath + ` L ${w} ${h} L 0 ${h} Z`;
  fill.setAttribute("d", fillPath);

  path.style.animation = "none";
  void path.offsetWidth;
  path.style.animation = "";
}

function renderStatCards() {
  const settled = bets.filter((b) => b.status === "won" || b.status === "lost");
  const staked = settled.reduce((s, b) => s + b.stake, 0);
  const returned = settled.reduce((s, b) => s + (b.status === "won" ? b.stake * b.odds : 0), 0);
  const wins = settled.filter((b) => b.status === "won").length;
  const winRate = settled.length ? (wins / settled.length) * 100 : 0;
  const roi = staked ? ((returned - staked) / staked) * 100 : 0;

  document.getElementById("stat-staked").textContent = fmt(staked);
  document.getElementById("stat-returned").textContent = fmt(returned);
  document.getElementById("stat-winrate").textContent = winRate.toFixed(1) + "%";
  document.getElementById("stat-roi").textContent = (roi >= 0 ? "+" : "") + roi.toFixed(1) + "%";
}

function renderBetList(container, list) {
  if (list.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="big">Nothing here yet</div>
        <div class="small">Add your first bet to see it tracked here.</div>
      </div>`;
    return;
  }
  container.innerHTML = list
    .map((b) => {
      const profitClass = b.profit > 0 ? "pos" : b.profit < 0 ? "neg" : "flat";
      const profitText = (b.profit >= 0 ? "+" : "") + fmt(b.profit);
      return `
      <div class="bet-row">
        <div class="date">${formatDate(b.date)}</div>
        <div class="match">
          <strong>${escapeHtml(b.homeTeam)} vs ${escapeHtml(b.awayTeam)}</strong>
          <div class="league-tag">${escapeHtml(b.league)} · ${b.type === "parlay" ? "Parlay" : "Single"}</div>
        </div>
        <div class="odds">@ ${b.odds.toFixed(2)}</div>
        <div class="stake">${fmt(b.stake)}</div>
        <div><span class="status-pill ${b.status}">${b.status}</span></div>
        <div class="profit ${profitClass}">${profitText}</div>
        <div class="row-actions">
          <button class="row-edit" data-id="${b.id}" title="Edit">✏️</button>
          <button class="row-del" data-id="${b.id}" title="Delete">✕</button>
        </div>
      </div>`;
    })
    .join("");

  container.querySelectorAll(".row-del").forEach((btn) => {
    btn.addEventListener("click", () => removeBet(btn.dataset.id));
  });
  container.querySelectorAll(".row-edit").forEach((btn) => {
    btn.addEventListener("click", () => {
      const bet = bets.find((b) => b.id === btn.dataset.id);
      if (bet) openSlideoverForEdit(bet);
    });
  });
}

// ============================================================
// CALENDAR VIEW
// ============================================================
function calendarSourceBets() {
  // respects the same search/league/status filters as the list
  const league = document.getElementById("filter-league").value;
  const status = document.getElementById("filter-status").value;
  const search = document.getElementById("search-input").value.trim().toLowerCase();
  return bets.filter(
    (b) =>
      (!league || b.league === league) &&
      (!status || b.status === status) &&
      (!search ||
        [b.homeTeam, b.awayTeam, b.league, b.notes].join(" ").toLowerCase().includes(search))
  );
}

function renderCalendarView() {
  renderCalendarSummary();
  renderCalendar();
  renderDayDetail();
}

function renderCalendarSummary() {
  const y = calendarDate.getFullYear();
  const m = calendarDate.getMonth();
  const monthBets = calendarSourceBets().filter((b) => {
    const bd = new Date(b.date + "T00:00:00");
    return bd.getFullYear() === y && bd.getMonth() === m;
  });
  const profit = monthBets.reduce((s, b) => s + b.profit, 0);
  const wins = monthBets.filter((b) => b.status === "won").length;
  const winRate = monthBets.length ? (wins / monthBets.length) * 100 : 0;

  document.getElementById("calendar-summary").innerHTML = `
    <div class="summary-item">
      <div class="label">Profit</div>
      <div class="value ${profit >= 0 ? "pos" : "neg"}" style="color:${profit >= 0 ? "var(--win)" : "var(--loss)"}">${profit >= 0 ? "+" : ""}${fmt(profit)}</div>
    </div>
    <div class="summary-item">
      <div class="label">Win rate</div>
      <div class="value">${winRate.toFixed(1)}%</div>
    </div>
    <div class="summary-item">
      <div class="label">Bets</div>
      <div class="value">${monthBets.length}</div>
    </div>
  `;
}

function renderCalendar() {
  const y = calendarDate.getFullYear();
  const m = calendarDate.getMonth();
  document.getElementById("cal-label").textContent = calendarDate.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric"
  });

  const source = calendarSourceBets();
  const firstOfMonth = new Date(y, m, 1);
  const startWeekday = (firstOfMonth.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  const grid = document.getElementById("calendar-grid");
  let html = "";
  for (let i = 0; i < startWeekday; i++) html += `<div class="calendar-day empty"></div>`;

  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dayBets = source.filter((b) => b.date === iso);
    let cls = "calendar-day";
    let innerHtml = `<span class="cal-daynum">${d}</span>`;

    if (dayBets.length) {
      cls += " has-bets";
      const dayProfit = dayBets.reduce((s, b) => s + b.profit, 0);
      cls += dayProfit >= 0 ? " profit-day" : " loss-day";
      if (iso === selectedCalendarDay) cls += " selected";
      innerHtml += `
        <span class="cal-profit ${dayProfit >= 0 ? "pos" : "neg"}">${dayProfit >= 0 ? "+" : ""}${fmt(dayProfit)}</span>
        <span class="cal-count">${dayBets.length} bet${dayBets.length > 1 ? "s" : ""}</span>`;
    }
    html += `<button type="button" class="${cls}" data-date="${iso}">${innerHtml}</button>`;
  }
  grid.innerHTML = html;

  grid.querySelectorAll(".calendar-day.has-bets").forEach((el) => {
    el.addEventListener("click", () => {
      selectedCalendarDay = el.dataset.date === selectedCalendarDay ? null : el.dataset.date;
      renderCalendar();
      renderDayDetail();
    });
  });
}

function renderDayDetail() {
  const panel = document.getElementById("day-detail");
  if (!selectedCalendarDay) {
    panel.classList.add("hidden");
    return;
  }
  const dayBets = calendarSourceBets().filter((b) => b.date === selectedCalendarDay);
  if (dayBets.length === 0) {
    panel.classList.add("hidden");
    return;
  }
  panel.classList.remove("hidden");
  const dateLabel = new Date(selectedCalendarDay + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
  panel.innerHTML =
    `<h3>${dateLabel}</h3>` +
    dayBets
      .map(
        (b) => `
      <div class="day-detail-bet">
        <div class="ddb-top">
          <strong>${escapeHtml(b.homeTeam)} vs ${escapeHtml(b.awayTeam)}</strong>
          <span class="status-pill ${b.status}">${b.status}</span>
        </div>
        <div class="ddb-meta">
          <span>Stake<b>${fmt(b.stake)}</b></span>
          <span>Odds<b>@ ${b.odds.toFixed(2)}</b></span>
          <span>Profit<b style="color:${b.profit >= 0 ? "var(--win)" : "var(--loss)"}">${b.profit >= 0 ? "+" : ""}${fmt(b.profit)}</b></span>
        </div>
      </div>`
      )
      .join("");
}

function renderLeagueStats() {
  const container = document.getElementById("breakdown-league");
  const leagues = [...new Set(bets.map((b) => b.league))];
  if (leagues.length === 0) {
    container.innerHTML = `<div class="bar-row"><div class="bar-top"><span>No data yet</span></div></div>`;
    return;
  }
  container.innerHTML =
    `<div class="league-mini-grid">` +
    leagues
      .map((lg) => {
        const lb = bets.filter((b) => b.league === lg);
        const profit = lb.reduce((s, b) => s + b.profit, 0);
        const staked = lb.reduce((s, b) => s + b.stake, 0);
        const roi = staked ? (profit / staked) * 100 : 0;
        const wins = lb.filter((b) => b.status === "won").length;
        const winRate = lb.length ? (wins / lb.length) * 100 : 0;
        return `
        <div class="league-mini-card">
          <div class="lmc-name">${escapeHtml(lg)}</div>
          <div class="lmc-profit ${profit >= 0 ? "pos" : "neg"}">${profit >= 0 ? "+" : ""}${fmt(profit)}</div>
          <div class="lmc-row"><span>ROI</span><b>${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%</b></div>
          <div class="lmc-row"><span>Win rate</span><b>${winRate.toFixed(1)}%</b></div>
          <div class="lmc-row"><span>Bets</span><b>${lb.length}</b></div>
        </div>`;
      })
      .join("") +
    `</div>`;
}

function renderStatsBreakdowns() {
  renderLeagueStats();

  const byType = groupSum(bets, "type");
  renderBars(document.getElementById("breakdown-type"), byType);

  const settled = bets.filter((b) => b.status === "won" || b.status === "lost");
  const wins = settled.filter((b) => b.status === "won").length;
  const losses = settled.filter((b) => b.status === "lost").length;
  document.getElementById("breakdown-record").innerHTML = `
    <div class="bar-row"><div class="bar-top"><span>Won</span><span class="amt">${wins}</span></div></div>
    <div class="bar-row"><div class="bar-top"><span>Lost</span><span class="amt">${losses}</span></div></div>
  `;

  renderPerformanceSnapshot();
}

function renderPerformanceSnapshot() {
  const container = document.getElementById("snapshot-card");

  if (bets.length === 0) {
    container.innerHTML = `
      <div class="snapshot-head">
        <div class="snapshot-title">⏱️ Performance snapshot</div>
      </div>
      <div class="empty-state" style="padding:30px 10px;">
        <div class="big">No bets yet</div>
        <div class="small">Log a few bets and your snapshot will appear here.</div>
      </div>`;
    return;
  }

  const wins = bets.filter((b) => b.status === "won");

  // avg odds per winning bet
  const avgOdds = wins.length ? wins.reduce((s, b) => s + b.odds, 0) / wins.length : null;

  // avg stake across all bets
  const avgStake = bets.reduce((s, b) => s + b.stake, 0) / bets.length;

  // best league by profit
  const leagueProfit = groupSum(bets, "league");
  const bestLeagueEntry = Object.entries(leagueProfit).sort((a, b) => b[1] - a[1])[0];

  // biggest single win
  const biggestWin = wins.length ? wins.reduce((a, b) => (b.profit > a.profit ? b : a)) : null;

  // current streak
  const chrono = [...bets].sort((a, b) => a.date.localeCompare(b.date));
  let streak = 0, streakType = null;
  for (let i = chrono.length - 1; i >= 0; i--) {
    const s = chrono[i].status;
    if (streakType === null) { streakType = s; streak = 1; }
    else if (s === streakType) streak++;
    else break;
  }
  const isHot = streakType === "won";
  const formIcon = isHot ? "🔥" : "❄️";
  const formLabel = isHot ? "Hot" : "Cold";
  const formBadgeClass = isHot ? "hot" : "cold";
  const formCaption = streak
    ? `${streak} ${isHot ? "win" : "loss"}${streak > 1 ? (isHot ? "s" : "es") : ""} in a row`
    : "No settled bets yet";

  container.innerHTML = `
    <div class="snapshot-head">
      <div class="snapshot-title">⏱️ Performance snapshot</div>
      <span class="snapshot-badge live">Live</span>
    </div>
    <div class="snapshot-grid">
      <div class="snapshot-stat">
        <div class="ss-label">Avg odds</div>
        <div class="ss-value">${avgOdds !== null ? avgOdds.toFixed(2) : "—"}</div>
        <div class="ss-caption">Per winning bet</div>
      </div>
      <div class="snapshot-stat">
        <div class="ss-label">Avg stake</div>
        <div class="ss-value">${fmt(avgStake)}</div>
        <div class="ss-caption">Across all bets</div>
      </div>
      <div class="snapshot-stat">
        <div class="ss-label">Best league</div>
        <div class="ss-value">${bestLeagueEntry ? escapeHtml(bestLeagueEntry[0]) : "—"}</div>
        <div class="ss-caption">${bestLeagueEntry ? (bestLeagueEntry[1] >= 0 ? "+" : "") + fmt(bestLeagueEntry[1]) + " profit" : "No data yet"}</div>
      </div>
      <div class="snapshot-stat">
        <div class="ss-label">Biggest win</div>
        <div class="ss-value">${biggestWin ? "+" + fmt(biggestWin.profit) : "—"}</div>
        <div class="ss-caption">Single bet</div>
      </div>
    </div>
    <div class="snapshot-divider"></div>
    <div class="snapshot-form">
      <div class="sf-left">
        <span class="sf-icon">${formIcon}</span>
        <div>
          <div class="sf-title">Current form</div>
          <div class="sf-caption">${formCaption}</div>
        </div>
      </div>
      <span class="snapshot-badge ${formBadgeClass}">${formLabel}</span>
    </div>
  `;
}

function groupSum(list, key) {
  const map = {};
  list.forEach((b) => {
    if (b.status === "pending") return;
    map[b[key]] = (map[b[key]] || 0) + b.profit;
  });
  return map;
}

function renderBars(container, dataMap) {
  const entries = Object.entries(dataMap);
  if (entries.length === 0) {
    container.innerHTML = `<div class="bar-row"><div class="bar-top"><span>No data yet</span></div></div>`;
    return;
  }
  const maxAbs = Math.max(...entries.map(([, v]) => Math.abs(v)), 1);
  container.innerHTML = entries
    .map(([label, val]) => {
      const pct = (Math.abs(val) / maxAbs) * 100;
      const neg = val < 0;
      return `
      <div class="bar-row">
        <div class="bar-top">
          <span>${escapeHtml(String(label))}</span>
          <span class="amt">${val >= 0 ? "+" : ""}${fmt(val)}</span>
        </div>
        <div class="bar-track"><div class="bar-fill ${neg ? "neg" : ""}" style="width:0%" data-pct="${pct}"></div></div>
      </div>`;
    })
    .join("");
  requestAnimationFrame(() => {
    container.querySelectorAll(".bar-fill").forEach((el) => {
      el.style.width = el.dataset.pct + "%";
    });
  });
}

function formatDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ============================================================
// INIT
// ============================================================
applySettings();
sortBets();
renderAll();
