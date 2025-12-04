import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { db } from "./firebase.js";

/* ---------------------------------------------------------
   PAGE INIT
--------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  // Add data
  addPubBtn.addEventListener("click", addPub);
  addPintBtn.addEventListener("click", addPint);
  addPriceBtn.addEventListener("click", addPrice);

  // Tools
  compareBtn.addEventListener("click", comparePints);
  budgetBtn.addEventListener("click", calculateBudget);
  expandTableBtn.addEventListener("click", toggleTableExpand);

  // Admin
  adminLockTrigger.addEventListener("click", showAdminPanel);
  adminUnlockBtn.addEventListener("click", unlockAdmin);
  wipeAllBtn.addEventListener("click", wipeAllData);
  wipePricesBtn.addEventListener("click", wipePricesOnly);

  // Load dashboard
  refreshDashboard();
});

/* ---------------------------------------------------------
   REFRESH EVERYTHING
--------------------------------------------------------- */
function refreshDashboard() {
  loadPubs();
  loadPints();
  loadCheapest();
  loadPPI();
  loadPopularity();
  loadMarketTable();
  loadPriceDistribution();
  loadCheapestPubs();
  loadRecommendations();
  loadRarePints();
  loadTicker();
}

/* ---------------------------------------------------------
   ADD PUB
--------------------------------------------------------- */
async function addPub() {
  if (!pubName.value.trim()) return alert("Enter pub name");

  await addDoc(collection(db, "pubs"), {
    name: pubName.value.trim(),
    address: pubAddress.value.trim(),
    createdAt: serverTimestamp()
  });

  pubName.value = "";
  pubAddress.value = "";
  refreshDashboard();
}

/* ---------------------------------------------------------
   ADD PINT TYPE
--------------------------------------------------------- */
async function addPint() {
  if (!pintName.value.trim() || !pintCategory.value.trim())
    return alert("Fill all fields");

  await addDoc(collection(db, "pintDefinitions"), {
    name: pintName.value.trim(),
    category: pintCategory.value.trim(),
    createdAt: serverTimestamp()
  });

  pintName.value = "";
  pintCategory.value = "";
  refreshDashboard();
}

/* ---------------------------------------------------------
   ADD PRICE ENTRY
--------------------------------------------------------- */
async function addPrice() {
  const val = Number(pintPrice.value);
  if (!val || val <= 0) return alert("Invalid price");

  await addDoc(collection(db, "pintPrices"), {
    pubId: pricePubSelect.value,
    pintId: pricePintSelect.value,
    price: val,
    timestamp: serverTimestamp()
  });

  pintPrice.value = "";
  refreshDashboard();
}

/* ---------------------------------------------------------
   LOAD PUB DROPDOWN
--------------------------------------------------------- */
async function loadPubs() {
  const snap = await getDocs(collection(db, "pubs"));
  pricePubSelect.innerHTML = "";

  snap.forEach(doc => {
    const opt = document.createElement("option");
    opt.value = doc.id;
    opt.textContent = doc.data().name;
    pricePubSelect.appendChild(opt);
  });
}

/* ---------------------------------------------------------
   LOAD PINT DROPDOWN
--------------------------------------------------------- */
async function loadPints() {
  const snap = await getDocs(collection(db, "pintDefinitions"));
  [pricePintSelect, comparePintA, comparePintB].forEach(sel => sel.innerHTML = "");

  snap.forEach(doc => {
    const o = document.createElement("option");
    o.value = doc.id;
    o.textContent = doc.data().name;

    pricePintSelect.appendChild(o.cloneNode(true));
    comparePintA.appendChild(o.cloneNode(true));
    comparePintB.appendChild(o.cloneNode(true));
  });
}

/* ---------------------------------------------------------
   HERO CHEAPEST PINT
--------------------------------------------------------- */
async function loadCheapest() {
  const qPrice = query(collection(db, "pintPrices"), orderBy("price"), limit(1));
  const snap = await getDocs(qPrice);

  if (snap.empty) {
    heroContent.innerHTML = "No prices yet.";
    return;
  }

  const cheapest = snap.docs[0].data();
  const pints = await getDocs(collection(db, "pintDefinitions"));
  const pubs = await getDocs(collection(db, "pubs"));

  const pint = pints.docs.find(p => p.id === cheapest.pintId)?.data();
  const pub = pubs.docs.find(p => p.id === cheapest.pubId)?.data();

  heroContent.innerHTML = `
    <div class="cheapest-name">🍺 ${pint.name} (${pint.category})</div>
    <div class="cheapest-price">£${cheapest.price}</div>
    <div class="cheapest-pub">📍 ${pub.name}</div>
    <div class="cheapest-trend">➡️ Stable today</div>
  `;
}

/* ---------------------------------------------------------
   PINT PRICE INDEX (AVERAGE)
--------------------------------------------------------- */
async function loadPPI() {
  const snap = await getDocs(collection(db, "pintPrices"));
  if (snap.empty) {
    ppiOutput.textContent = "£0.00";
    return;
  }

  const avg =
    snap.docs.reduce((a, b) => a + b.data().price, 0) / snap.size;

  ppiOutput.textContent = `£${avg.toFixed(2)}`;
}

/* ---------------------------------------------------------
   POPULARITY (COUNT OF PRICE ENTRIES)
--------------------------------------------------------- */
async function loadPopularity() {
  const pints = await getDocs(collection(db, "pintDefinitions"));
  const prices = await getDocs(collection(db, "pintPrices"));

  const counts = {};
  pints.forEach(p => (counts[p.id] = 0));
  prices.forEach(pr => counts[pr.data().pintId]++);

  const sorted = pints.docs
    .map(p => ({ name: p.data().name, count: counts[p.id] }))
    .sort((a, b) => b.count - a.count);

  const max = sorted[0]?.count || 1;

  popularityChartContainer.innerHTML = sorted
    .map(
      p => `
      <div class="poll-row">
        <div class="poll-label">${p.name}</div>
        <div class="poll-bar-wrapper">
          <div class="poll-bar" style="width:${(p.count / max) * 100}%"></div>
        </div>
      </div>`
    )
    .join("");
}

/* ---------------------------------------------------------
   MARKET TABLE
--------------------------------------------------------- */
let tableExpanded = false;

async function loadMarketTable() {
  const prices = await getDocs(collection(db, "pintPrices"));
  const pints = await getDocs(collection(db, "pintDefinitions"));
  const pubs = await getDocs(collection(db, "pubs"));

  const pintMap = {};
  const pubMap = {};

  pints.forEach(p => (pintMap[p.id] = p.data()));
  pubs.forEach(p => (pubMap[p.id] = p.data()));

  let rows = prices.docs.map(d => {
    const x = d.data();
    return {
      pint: pintMap[x.pintId]?.name,
      pub: pubMap[x.pubId]?.name,
      price: x.price
    };
  });

  rows.sort((a, b) => a.price - b.price);

  const show = tableExpanded ? rows : rows.slice(0, 5);

  marketTableBody.innerHTML = show
    .map(
      (r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${r.pint}</td>
      <td>${r.pub}</td>
      <td>£${r.price.toFixed(2)}</td>
    </tr>`
    )
    .join("");
}

function toggleTableExpand() {
  tableExpanded = !tableExpanded;
  expandTableBtn.textContent = tableExpanded
    ? "Show Top 5 ▲"
    : "Show Full Table ▼";
  loadMarketTable();
}

/* ---------------------------------------------------------
   PRICE DISTRIBUTION (BUCKETS £X–£X+1)
--------------------------------------------------------- */
async function loadPriceDistribution() {
  const snap = await getDocs(collection(db, "pintPrices"));
  if (snap.empty) {
    priceDistribution.innerHTML = "No data yet.";
    return;
  }

  const buckets = {};

  snap.docs.forEach(d => {
    const p = d.data().price;
    const key = `£${Math.floor(p)}–£${Math.floor(p) + 1}`;
    buckets[key] = (buckets[key] || 0) + 1;
  });

  const max = Math.max(...Object.values(buckets));

  priceDistribution.innerHTML = Object.entries(buckets)
    .map(
      ([range, count]) => `
      <div class="dist-row">
        <div class="dist-label">${range}</div>
        <div class="dist-bar-wrapper">
          <div class="dist-bar" style="width:${(count / max) * 100}%"></div>
        </div>
      </div>
    `
    )
    .join("");
}

/* ---------------------------------------------------------
   TOP 5 CHEAPEST PUBS
--------------------------------------------------------- */
async function loadCheapestPubs() {
  const prices = await getDocs(collection(db, "pintPrices"));
  const pubs = await getDocs(collection(db, "pubs"));

  if (prices.empty) {
    cheapestPubs.innerHTML = "No data.";
    return;
  }

  const pubMap = {};
  pubs.forEach(p => (pubMap[p.id] = p.data().name));

  const grouped = {};

  prices.forEach(pr => {
    const d = pr.data();
    if (!grouped[d.pubId]) grouped[d.pubId] = [];
    grouped[d.pubId].push(d.price);
  });

  const sorted = Object.entries(grouped)
    .map(([id, vals]) => ({
      pub: pubMap[id],
      avg: vals.reduce((a, b) => a + b, 0) / vals.length
    }))
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 5);

  cheapestPubs.innerHTML = sorted
    .map((p, i) => `<div>${i + 1}. ${p.pub} — £${p.avg.toFixed(2)}</div>`)
    .join("");
}

/* ---------------------------------------------------------
   RECOMMENDATIONS
--------------------------------------------------------- */
async function loadRecommendations() {
  const prices = await getDocs(collection(db, "pintPrices"));
  if (prices.empty) {
    recommendations.innerHTML = "No data.";
    return;
  }

  const pints = await getDocs(collection(db, "pintDefinitions"));
  const pubs = await getDocs(collection(db, "pubs"));

  const pintMap = {};
  const pubMap = {};

  pints.forEach(p => (pintMap[p.id] = p.data()));
  pubs.forEach(p => (pubMap[p.id] = p.data()));

  const list = prices.docs.map(d => d.data());
  const cheapest = [...list].sort((a, b) => a.price - b.price)[0];

  const freq = {};
  list.forEach(x => (freq[x.pintId] = (freq[x.pintId] || 0) + 1));
  const trending = Object.keys(freq).sort((a, b) => freq[b] - freq[a])[0];

  recommendations.innerHTML = `
    <div>⭐ Cheapest Pint:<br>${pintMap[cheapest.pintId].name} @ ${
    pubMap[cheapest.pubId].name
  } (£${cheapest.price})</div>

    <div>📈 Trending Pint:<br>${pintMap[trending].name}</div>

    <div>💡 Best Value:<br>${pintMap[cheapest.pintId].name}</div>
  `;
}

/* ---------------------------------------------------------
   RARE PINTS (< 3 submissions)
--------------------------------------------------------- */
async function loadRarePints() {
  const pints = await getDocs(collection(db, "pintDefinitions"));
  const prices = await getDocs(collection(db, "pintPrices"));
  const pubs = await getDocs(collection(db, "pubs"));

  const pubMap = {};
  pubs.forEach(p => (pubMap[p.id] = p.data().name));

  const count = {};
  const lastSeen = {};

  pints.forEach(p => (count[p.id] = 0));

  prices.forEach(pr => {
    const x = pr.data();
    count[x.pintId]++;
    lastSeen[x.pintId] = x;
  });

  const rare = Object.keys(count).filter(id => count[id] < 3);

  rarePints.innerHTML = rare
    .map(id => {
      const pint = pints.docs.find(p => p.id === id)?.data();
      const last = lastSeen[id];

      return `
      <div class="rare-card">
        <strong>${pint.name}</strong><br>
        📍 ${pubMap[last?.pubId] || "Unknown"}<br>
        £${last?.price || "?"}<br>
        ⭐ Rare (${count[id]} logged)
      </div>`;
    })
    .join("");
}

/* ---------------------------------------------------------
   COMPARE TWO PINTS
--------------------------------------------------------- */
async function comparePints() {
  const a = comparePintA.value;
  const b = comparePintB.value;

  if (a === b) {
    comparisonResult.textContent = "Choose two different pints.";
    return;
  }

  const prices = await getDocs(collection(db, "pintPrices"));

  const listA = [];
  const listB = [];

  prices.forEach(pr => {
    const d = pr.data();
    if (d.pintId === a) listA.push(d.price);
    if (d.pintId === b) listB.push(d.price);
  });

  const avgA = listA.reduce((a, b) => a + b, 0) / listA.length || 0;
  const avgB = listB.reduce((a, b) => a + b, 0) / listB.length || 0;

  comparisonResult.textContent = `Avg £${avgA.toFixed(
    2
  )} vs Avg £${avgB.toFixed(2)}`;
}

/* ---------------------------------------------------------
   BUDGET PLANNER
--------------------------------------------------------- */
async function calculateBudget() {
  const budget = Number(budgetInput.value);
  if (!budget) return;

  const prices = await getDocs(collection(db, "pintPrices"));
  const pints = await getDocs(collection(db, "pintDefinitions"));
  const pubs = await getDocs(collection(db, "pubs"));

  const pintMap = {};
  const pubMap = {};

  pints.forEach(p => (pintMap[p.id] = p.data().name));
  pubs.forEach(p => (pubMap[p.id] = p.data().name));

  const opts = prices.docs
    .map(d => {
      const x = d.data();
      const count = Math.floor(budget / x.price);
      return count > 0
        ? {
            pint: pintMap[x.pintId],
            pub: pubMap[x.pubId],
            count,
            total: count * x.price,
            change: budget - count * x.price
          }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.count - a.count);

  if (!opts.length) {
    budgetOutput.textContent = "Budget too low.";
    return;
  }

  const best = opts[0];
  budgetOutput.innerHTML = `${best.count} × ${best.pint} @ ${
    best.pub
  } — £${best.total.toFixed(2)} (Change £${best.change.toFixed(2)})`;
}

/* ---------------------------------------------------------
   TICKER BAR
--------------------------------------------------------- */
async function loadTicker() {
  const prices = await getDocs(collection(db, "pintPrices"));
  const pints = await getDocs(collection(db, "pintDefinitions"));

  if (prices.empty) {
    ticker.textContent = "No data.";
    return;
  }

  const list = prices.docs.map(d => d.data());

  const cheapest = [...list].sort((a, b) => a.price - b.price)[0];
  const highest = [...list].sort((a, b) => b.price - a.price)[0];
  const avg = (
    list.reduce((a, b) => a + b.price, 0) / list.length
  ).toFixed(2);

  const freq = {};
  list.forEach(x => (freq[x.pintId] = (freq[x.pintId] || 0) + 1));

  const pop = Object.keys(freq).sort((a, b) => freq[b] - freq[a])[0];
  const popName = pints.docs.find(p => p.id === pop)?.data().name;

  ticker.textContent = `Cheapest £${cheapest.price} ▼ | Index £${avg} | Popular ${popName} | High £${highest.price} ▲`;
}

/* ---------------------------------------------------------
   ADMIN LOCK + DATA WIPERS
--------------------------------------------------------- */
function showAdminPanel() {
  adminLockPanel.style.display = "block";
}

function unlockAdmin() {
  if (adminCodeInput.value.trim() === "PINTADMIN2025") {
    adminTools.style.display = "block";
    adminLockPanel.style.display = "none";
  } else alert("Incorrect code");
}

async function wipeAllData() {
  if (!confirm("Delete EVERYTHING?")) return;

  const collections = ["pubs", "pintDefinitions", "pintPrices"];

  for (const c of collections) {
    const snap = await getDocs(collection(db, c));
    for (const d of snap.docs) await deleteDoc(doc(db, c, d.id));
  }

  alert("All data wiped.");
  refreshDashboard();
}

async function wipePricesOnly() {
  if (!confirm("Delete ALL price entries?")) return;

  const snap = await getDocs(collection(db, "pintPrices"));
  for (const d of snap.docs) await deleteDoc(doc(db, "pintPrices", d.id));

  alert("Prices wiped.");
  refreshDashboard();
}
