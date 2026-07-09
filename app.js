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

function addBet(betData) {
  bets.unshift({ id: crypto.randomUUID(), ...betData });
  sortBets();
  save();
  renderAll();
}

function removeBet(id) {
  bets = bets.filter((b) => b.id !== id);
  save();
  renderAll();
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

// ============================================================
// SLIDE-OVER FORM
// ============================================================
const overlay = document.getElementById("overlay");
const slideover = document.getElementById("slideover");
const betForm = document.getElementById("bet-form");

function openSlideover() {
  document.getElementById("bf-date").valueAsDate = new Date();
  overlay.classList.add("show");
  slideover.classList.add("show");
}
function closeSlideover() {
  overlay.classList.remove("show");
  slideover.classList.remove("show");
  betForm.reset();
}
["add-bet-btn", "add-bet-btn-2"].forEach((id) =>
  document.getElementById(id).addEventListener("click", openSlideover)
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
  const status = document.getElementById("bf-status").value;

  let profit = 0;
  if (status === "won") profit = stake * odds - stake;
  else if (status === "lost") profit = -stake;
  else profit = 0; // pending / void

  const betData = {
    league: document.getElementById("bf-league").value,
    match: document.getElementById("bf-match").value.trim(),
    type: document.getElementById("bf-type").value,
    date: document.getElementById("bf-date").value,
    odds,
    stake,
    status,
    profit,
    notes: document.getElementById("bf-notes").value.trim()
  };

  addBet(betData);
  closeSlideover();
});

// ============================================================
// RENDERING
// ============================================================
function renderAll() {
  renderHero();
  renderStatCards();
  renderBetList(document.getElementById("recent-bets-list"), bets.slice(0, 6));
  renderBetList(document.getElementById("all-bets-list"), filteredBets());
  renderLeagueFilter();
  renderStatsBreakdowns();
}

function filteredBets() {
  const league = document.getElementById("filter-league").value;
  const status = document.getElementById("filter-status").value;
  return bets.filter(
    (b) => (!league || b.league === league) && (!status || b.status === status)
  );
}
document.getElementById("filter-league").addEventListener("change", () =>
  renderBetList(document.getElementById("all-bets-list"), filteredBets())
);
document.getElementById("filter-status").addEventListener("change", () =>
  renderBetList(document.getElementById("all-bets-list"), filteredBets())
);

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
      const profitText =
        b.status === "pending" ? "—" : (b.profit >= 0 ? "+" : "") + fmt(b.profit);
      return `
      <div class="bet-row">
        <div class="date">${formatDate(b.date)}</div>
        <div class="match">
          <strong>${escapeHtml(b.match)}</strong>
          <div class="league-tag">${escapeHtml(b.league)} · ${b.type === "parlay" ? "Parlay" : "Single"}</div>
        </div>
        <div class="odds">@ ${b.odds.toFixed(2)}</div>
        <div class="stake">${fmt(b.stake)}</div>
        <div><span class="status-pill ${b.status}">${b.status}</span></div>
        <div class="profit ${profitClass}">${profitText}</div>
        <button class="row-del" data-id="${b.id}" title="Delete">✕</button>
      </div>`;
    })
    .join("");

  container.querySelectorAll(".row-del").forEach((btn) => {
    btn.addEventListener("click", () => removeBet(btn.dataset.id));
  });
}

function renderStatsBreakdowns() {
  const byLeague = groupSum(bets, "league");
  renderBars(document.getElementById("breakdown-league"), byLeague);

  const byType = groupSum(bets, "type");
  renderBars(document.getElementById("breakdown-type"), byType);

  const settled = bets.filter((b) => b.status === "won" || b.status === "lost");
  const wins = settled.filter((b) => b.status === "won").length;
  const losses = settled.filter((b) => b.status === "lost").length;
  const pending = bets.filter((b) => b.status === "pending").length;
  document.getElementById("breakdown-record").innerHTML = `
    <div class="bar-row"><div class="bar-top"><span>Won</span><span class="amt">${wins}</span></div></div>
    <div class="bar-row"><div class="bar-top"><span>Lost</span><span class="amt">${losses}</span></div></div>
    <div class="bar-row"><div class="bar-top"><span>Pending</span><span class="amt">${pending}</span></div></div>
  `;

  const chrono = [...settled].sort((a, b) => a.date.localeCompare(b.date));
  let streak = 0, streakType = null;
  for (let i = chrono.length - 1; i >= 0; i--) {
    const s = chrono[i].status;
    if (streakType === null) { streakType = s; streak = 1; }
    else if (s === streakType) streak++;
    else break;
  }
  document.getElementById("breakdown-streak").innerHTML = streak
    ? `<div class="bar-row"><div class="bar-top"><span>Current streak</span><span class="amt">${streak} ${streakType === "won" ? "win" : "loss"}${streak > 1 ? "es" : ""}</span></div></div>`
    : `<div class="bar-row"><div class="bar-top"><span>No settled bets yet</span></div></div>`;
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
