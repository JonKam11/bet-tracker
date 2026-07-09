// ============================================================
// LEDGER — personal bet tracker (v2)
// Data saved in this browser's storage only.
// ============================================================

const STORAGE_KEY = "ledger_bets_v1";
const SETTINGS_KEY = "ledger_settings_v1";

// ---------------- state ----------------
let bets = load();
let settings = loadSettings();
let editingId = null;
let calendarDate = new Date();
let selectedCalendarDay = null;

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
function loadSettings() {
  try {
    return { currency: "NOK", theme: "dark", displayName: "", ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") };
  } catch {
    return { currency: "NOK", theme: "dark", displayName: "" };
  }
}
function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// ---------------- currency formatting ----------------
function fmt(n) {
  if (settings.currency === "EUR") {
    return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);
  }
  if (settings.currency === "USD") {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
  }
  return new Intl.NumberFormat("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + " kr";
}

function sortBets() {
  bets.sort((a, b) => {
    const dc = b.date.localeCompare(a.date);
    if (dc !== 0) return dc;
    return (b.time || "").localeCompare(a.time || "");
  });
}

function addOrUpdateBet(betData) {
  if (editingId) {
    const idx = bets.findIndex((b) => b.id === editingId);
    if (idx > -1) bets[idx] = { ...bets[idx], ...betData };
  } else {
    bets.unshift({ id: crypto.randomUUID(), ...betData });
  }
  sortBets();
  save();
}

function removeBet(id) {
  bets = bets.filter((b) => b.id !== id);
  save();
  renderAll();
}

// ============================================================
// SETTINGS / PROFILE PANEL
// ============================================================
function applySettings() {
  document.documentElement.setAttribute("data-theme", settings.theme);
  document.getElementById("set-currency").value = settings.currency;
  document.getElementById("set-name").value = settings.displayName;
  document.querySelectorAll(".theme-opt").forEach((btn) =>
    btn.classList.toggle("active", btn.dataset.theme === settings.theme)
  );
}

document.getElementById("profile-btn").addEventListener("click", (e) => {
  e.stopPropagation();
  document.getElementById("profile-panel").classList.toggle("hidden");
});
document.addEventListener("click", (e) => {
  const panel = document.getElementById("profile-panel");
  if (!panel.classList.contains("hidden") && !panel.contains(e.target) && e.target.id !== "profile-btn") {
    panel.classList.add("hidden");
  }
});

document.getElementById("set-currency").addEventListener("change", (e) => {
  settings.currency = e.target.value;
  saveSettings();
  renderAll();
});
document.getElementById("set-name").addEventListener("input", (e) => {
  settings.displayName = e.target.value;
  saveSettings();
});
document.querySelectorAll(".theme-opt").forEach((btn) => {
  btn.addEventListener("click", () => {
    settings.theme = btn.dataset.theme;
    saveSettings();
    applySettings();
  });
});

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
// NAVIGATION (Dashboard / Bets / Stats)
// ============================================================
const views = ["dashboard", "bets", "stats"];
function switchView(name) {
  views.forEach((v) => {
    document.getElementById("view-" + v).classList.toggle("hidden", v !== name);
  });
  document.querySelectorAll("nav.tabs button, nav.tabs-mobile button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === name);
  });
  if (name === "bets") {
    renderCalendar();
    renderDayDetail();
  }
}
document.querySelectorAll("nav.tabs button, nav.tabs-mobile button").forEach((btn) => {
  btn.addEventListener("click", () => switchView(btn.dataset.view));
});

// Bets sub-tabs: List / Calendar
document.querySelectorAll(".subtabs button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".subtabs button").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const sub = btn.dataset.subview;
    document.getElementById("subview-list").classList.toggle("hidden", sub !== "list");
    document.getElementById("subview-calendar").classList.toggle("hidden", sub !== "calendar");
    if (sub === "calendar") {
      renderCalendar();
      renderDayDetail();
    }
  });
});

// ============================================================
// SLIDE-OVER FORM (add + edit)
// ============================================================
const overlay = document.getElementById("overlay");
const slideover = document.getElementById("slideover");
const betForm = document.getElementById("bet-form");

function setSegStatus(status) {
  document.getElementById("bf-status").value = status;
  document.querySelectorAll(".seg-opt").forEach((btn) =>
    btn.classList.toggle("active", btn.dataset.status === status)
  );
}
document.querySelectorAll(".seg-opt").forEach((btn) => {
  btn.addEventListener("click", () => setSegStatus(btn.dataset.status));
});

function openSlideoverForAdd() {
  editingId = null;
  document.getElementById("slideover-title").textContent = "Log a bet";
  document.getElementById("submit-bet-btn").textContent = "Save bet";
  betForm.reset();
  document.getElementById("bf-date").valueAsDate = new Date();
  setSegStatus("won");
  updatePotentialReturn();
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
  document.getElementById("bf-selection").value = b.selection;
  document.getElementById("bf-type").value = b.type;
  document.getElementById("bf-date").value = b.date;
  document.getElementById("bf-time").value = b.time || "";
  document.getElementById("bf-odds").value = b.odds;
  document.getElementById("bf-stake").value = b.stake;
  document.getElementById("bf-notes").value = b.notes || "";
  setSegStatus(b.status);
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
    selection: document.getElementById("bf-selection").value.trim(),
    type: document.getElementById("bf-type").value,
    date: document.getElementById("bf-date").value,
    time: document.getElementById("bf-time").value,
    odds,
    stake,
    status,
    profit,
    notes: document.getElementById("bf-notes").value.trim()
  };

  addOrUpdateBet(betData);
  closeSlideover();
  renderAll();
});

// ============================================================
// LIST: FILTER + SEARCH + SORT
// ============================================================
function sortForDisplay(list, mode) {
  const arr = [...list];
  switch (mode) {
    case "oldest":
      arr.sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
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
      arr.sort((a, b) => (b.date + (b.time || "")).localeCompare(a.date + (a.time || "")));
  }
  return arr;
}

function filteredSortedBets() {
  const league = document.getElementById("filter-league").value;
  const status = document.getElementById("filter-status").value;
  const search = document.getElementById("search-input").value.trim().toLowerCase();
  const sortMode = document.getElementById("sort-select").value;
  let list = bets.filter(
    (b) =>
      (!league || b.league === league) &&
      (!status || b.status === status) &&
      (!search ||
        [b.homeTeam, b.awayTeam, b.league, b.selection, b.notes].join(" ").toLowerCase().includes(search))
  );
  return sortForDisplay(list, sortMode);
}

function refreshListView() {
  renderBetList(document.getElementById("all-bets-list"), filteredSortedBets());
}
["search-input"].forEach((id) => document.getElementById(id).addEventListener("input", refreshListView));
["sort-select", "filter-league", "filter-status"].forEach((id) =>
  document.getElementById(id).addEventListener("change", refreshListView)
);

function renderLeagueFilter() {
  const sel = document.getElementById("filter-league");
  const current = sel.value;
  const leagues = [...new Set(bets.map((b) => b.league))];
  sel.innerHTML =
    '<option value="">All leagues</option>' + leagues.map((l) => `<option value="${l}">${l}</option>`).join("");
  sel.value = current;
}

function renderTeamAutocomplete() {
  const teams = new Set();
  bets.forEach((b) => {
    if (b.homeTeam) teams.add(b.homeTeam);
    if (b.awayTeam) teams.add(b.awayTeam);
  });
  document.getElementById("team-list").innerHTML = [...teams]
    .sort()
    .map((t) => `<option value="${escapeHtml(t)}"></option>`)
    .join("");
}

// ============================================================
// DASHBOARD RENDERING
// ============================================================
function renderHero() {
  const netProfit = bets.reduce((s, b) => s + b.profit, 0);
  const heroEl = document.getElementById("hero-profit");
  heroEl.textContent = fmt(netProfit);
  heroEl.className = "hero-value " + (netProfit > 0 ? "pos" : netProfit < 0 ? "neg" : "flat");

  const sub = document.getElementById("hero-sub");
  if (bets.length === 0) {
    sub.innerHTML = "No bets logged yet — click <b>+ Add bet</b> to start.";
  } else {
    const wins = bets.filter((b) => b.status === "won").length;
    sub.innerHTML = `<b>${bets.length}</b> bets logged · <b>${wins}</b>/${bets.length} wins`;
  }
  drawSparkline(bets);
}

function drawSparkline(betsDescDate) {
  const path = document.getElementById("sparkline-path");
  const fill = document.getElementById("sparkline-fill");
  if (betsDescDate.length < 1) {
    path.setAttribute("d", "");
    fill.setAttribute("d", "");
    return;
  }
  const chrono = [...betsDescDate].reverse();
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
  fill.setAttribute("d", linePath + ` L ${w} ${h} L 0 ${h} Z`);
  path.style.animation = "none";
  void path.offsetWidth;
  path.style.animation = "";
}

function renderStatCards() {
  const now = new Date();
  const monthBets = bets.filter((b) => {
    const bd = new Date(b.date + "T00:00:00");
    return bd.getFullYear() === now.getFullYear() && bd.getMonth() === now.getMonth();
  });
  const monthProfit = monthBets.reduce((s, b) => s + b.profit, 0);
  document.getElementById("stat-month").textContent = (monthProfit >= 0 ? "+" : "") + fmt(monthProfit);

  const staked = bets.reduce((s, b) => s + b.stake, 0);
  const returned = bets.reduce((s, b) => s + (b.status === "won" ? b.stake * b.odds : 0), 0);
  const wins = bets.filter((b) => b.status === "won").length;
  const winRate = bets.length ? (wins / bets.length) * 100 : 0;
  const roi = staked ? ((returned - staked) / staked) * 100 : 0;

  document.getElementById("stat-staked").textContent = fmt(staked);
  document.getElementById("stat-returned").textContent = fmt(returned);
  document.getElementById("stat-winrate").textContent = winRate.toFixed(1) + "%";
  document.getElementById("stat-roi").textContent = (roi >= 0 ? "+" : "") + roi.toFixed(1) + "%";
}

function renderInsights() {
  const chrono = [...bets].sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
  let streak = 0, streakType = null;
  for (let i = chrono.length - 1; i >= 0; i--) {
    const s = chrono[i].status;
    if (streakType === null) { streakType = s; streak = 1; }
    else if (s === streakType) streak++;
    else break;
  }
  document.getElementById("stat-streak").textContent = bets.length
    ? `${streak} ${streakType === "won" ? "win" : "loss"}${streak > 1 ? "es" : ""}`
    : "—";

  const leagueProfit = groupSum(bets, "league");
  const bestLeagueEntry = Object.entries(leagueProfit).sort((a, b) => b[1] - a[1])[0];
  document.getElementById("stat-bestleague").textContent = bestLeagueEntry ? bestLeagueEntry[0] : "—";

  const wins = bets.filter((b) => b.status === "won");
  const biggestWin = wins.length ? Math.max(...wins.map((b) => b.profit)) : null;
  document.getElementById("stat-biggestwin").textContent = biggestWin !== null ? "+" + fmt(biggestWin) : "—";

  const avgOdds = bets.length ? bets.reduce((s, b) => s + b.odds, 0) / bets.length : null;
  document.getElementById("stat-avgodds").textContent = avgOdds !== null ? avgOdds.toFixed(2) : "—";
}

function renderMonthlyChart() {
  const container = document.getElementById("monthly-chart");
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ label: d.toLocaleDateString("en-GB", { month: "short" }), y: d.getFullYear(), m: d.getMonth() });
  }
  const monthProfits = months.map(({ y, m }) =>
    bets
      .filter((b) => {
        const bd = new Date(b.date + "T00:00:00");
        return bd.getFullYear() === y && bd.getMonth() === m;
      })
      .reduce((s, b) => s + b.profit, 0)
  );
  const maxAbs = Math.max(...monthProfits.map((v) => Math.abs(v)), 1);
  container.innerHTML = months
    .map((mo, i) => {
      const val = monthProfits[i];
      const pct = (Math.abs(val) / maxAbs) * 100;
      return `
      <div class="month-bar-col">
        <div class="month-bar-track">
          <div class="month-bar-fill ${val < 0 ? "neg" : ""}" style="height:0%" data-pct="${pct}"></div>
        </div>
        <div class="month-bar-label">${mo.label}</div>
        <div class="month-bar-value ${val >= 0 ? "pos" : "neg"}">${val >= 0 ? "+" : ""}${fmt(val)}</div>
      </div>`;
    })
    .join("");
  requestAnimationFrame(() => {
    container.querySelectorAll(".month-bar-fill").forEach((el) => {
      el.style.height = el.dataset.pct + "%";
    });
  });
}

// ============================================================
// BET LIST RENDERING
// ============================================================
function renderBetList(container, list, emptyMessage) {
  if (list.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="big">Nothing here yet</div>
        <div class="small">${emptyMessage || "Add your first bet to see it tracked here."}</div>
      </div>`;
    return;
  }
  container.innerHTML = list
    .map((b) => {
      const profitClass = b.profit > 0 ? "pos" : b.profit < 0 ? "neg" : "flat";
      const profitText = (b.profit >= 0 ? "+" : "") + fmt(b.profit);
      return `
      <div class="bet-row">
        <div class="date">${formatDate(b.date, b.time)}</div>
        <div class="match">
          <strong>${escapeHtml(b.homeTeam)} vs ${escapeHtml(b.awayTeam)}</strong>
          <div class="league-tag">${escapeHtml(b.league)} · ${b.type === "parlay" ? "Parlay" : "Single"} · ${escapeHtml(b.selection)}</div>
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
// CALENDAR
// ============================================================
function renderCalendar() {
  const y = calendarDate.getFullYear();
  const m = calendarDate.getMonth();
  document.getElementById("cal-label").textContent = calendarDate.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric"
  });

  const firstOfMonth = new Date(y, m, 1);
  const startWeekday = (firstOfMonth.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  const grid = document.getElementById("calendar-grid");
  let html = "";
  for (let i = 0; i < startWeekday; i++) html += `<div class="calendar-day empty"></div>`;

  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dayBets = bets.filter((b) => b.date === iso);
    let cls = "calendar-day";
    if (dayBets.length) cls += " has-bets";
    if (iso === selectedCalendarDay) cls += " selected";

    let dotsHtml = "", profitHtml = "", countHtml = "";
    if (dayBets.length) {
      const dayProfit = dayBets.reduce((s, b) => s + b.profit, 0);
      const wins = dayBets.filter((b) => b.status === "won").length;
      const losses = dayBets.filter((b) => b.status === "lost").length;
      dotsHtml = `<div class="cal-dots">${wins ? `<span class="dot win"></span>` : ""}${losses ? `<span class="dot loss"></span>` : ""}</div>`;
      profitHtml = `<div class="cal-profit ${dayProfit >= 0 ? "pos" : "neg"}">${dayProfit >= 0 ? "+" : ""}${fmt(dayProfit)}</div>`;
      countHtml = `<span class="cal-count">${dayBets.length}</span>`;
    }
    html += `<button type="button" class="${cls}" data-date="${iso}">
      <span class="cal-daynum">${d}</span>
      ${dotsHtml}
      ${profitHtml}
      ${countHtml}
    </button>`;
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
  const dayBets = bets.filter((b) => b.date === selectedCalendarDay);
  panel.classList.remove("hidden");
  const dateLabel = new Date(selectedCalendarDay + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long"
  });
  panel.innerHTML =
    `<h3 style="margin-bottom:14px;">${dateLabel}</h3>` +
    dayBets
      .map(
        (b) => `
      <div class="bet-row" style="grid-template-columns: 1fr 90px 70px;">
        <div class="match">
          <strong>${escapeHtml(b.homeTeam)} vs ${escapeHtml(b.awayTeam)}</strong>
          <div class="league-tag">${escapeHtml(b.league)} · ${escapeHtml(b.selection)}</div>
        </div>
        <div class="profit ${b.profit >= 0 ? "pos" : "neg"}">${b.profit >= 0 ? "+" : ""}${fmt(b.profit)}</div>
        <span class="status-pill ${b.status}">${b.status}</span>
      </div>`
      )
      .join("");
}

document.getElementById("cal-prev").addEventListener("click", () => {
  calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1);
  renderCalendar();
});
document.getElementById("cal-next").addEventListener("click", () => {
  calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1);
  renderCalendar();
});

// ============================================================
// STATS TAB
// ============================================================
function renderStatsBreakdowns() {
  const byLeague = groupSum(bets, "league");
  renderBars(document.getElementById("breakdown-league"), byLeague);

  const byType = groupSum(bets, "type");
  renderBars(document.getElementById("breakdown-type"), byType);

  const wins = bets.filter((b) => b.status === "won").length;
  const losses = bets.filter((b) => b.status === "lost").length;
  document.getElementById("breakdown-record").innerHTML = `
    <div class="bar-row"><div class="bar-top"><span>Won</span><span class="amt">${wins}</span></div></div>
    <div class="bar-row"><div class="bar-top"><span>Lost</span><span class="amt">${losses}</span></div></div>
  `;

  const chrono = [...bets].sort((a, b) => a.date.localeCompare(b.date));
  let streak = 0, streakType = null;
  for (let i = chrono.length - 1; i >= 0; i--) {
    const s = chrono[i].status;
    if (streakType === null) { streakType = s; streak = 1; }
    else if (s === streakType) streak++;
    else break;
  }
  document.getElementById("breakdown-streak").innerHTML = streak
    ? `<div class="bar-row"><div class="bar-top"><span>Current streak</span><span class="amt">${streak} ${streakType === "won" ? "win" : "loss"}${streak > 1 ? "es" : ""}</span></div></div>`
    : `<div class="bar-row"><div class="bar-top"><span>No bets yet</span></div></div>`;
}

function groupSum(list, key) {
  const map = {};
  list.forEach((b) => {
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

// ============================================================
// HELPERS
// ============================================================
function formatDate(iso, time) {
  const d = new Date(iso + "T00:00:00");
  const datePart = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  return time ? `${datePart} · ${time}` : datePart;
}
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : str;
  return div.innerHTML;
}

// ============================================================
// MASTER RENDER
// ============================================================
function renderAll() {
  renderHero();
  renderStatCards();
  renderInsights();
  renderMonthlyChart();
  renderLeagueFilter();
  renderTeamAutocomplete();
  refreshListView();
  renderStatsBreakdowns();
  renderCalendar();
  renderDayDetail();
}

// ============================================================
// INIT
// ============================================================
applySettings();
sortBets();
renderAll();
