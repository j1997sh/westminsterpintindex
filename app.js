/* ==========================================================
   FIREBASE IMPORTS
========================================================== */
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  deleteDoc,
  doc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { db } from "./firebase.js";

/* ==========================================================
   PAGE INIT
========================================================== */
document.addEventListener("DOMContentLoaded", () => {

  // Add Data
  addPubBtn.addEventListener("click", addPub);
  addPintBtn.addEventListener("click", addPint);
  addPriceBtn.addEventListener("click", addPrice);

  // Tools
  findCheapestBtn.addEventListener("click", findCheapestForPint);
  budgetBtn.addEventListener("click", calculateBudget);

  // Market Table
  expandTableBtn.addEventListener("click", toggleTableExpand);

  // Popularity collapse
  document.querySelector(".collapse-toggle").addEventListener("click", togglePopularity);

  // Admin
  adminToggle.addEventListener("click", () => adminPanel.style.display = "block");
  adminUnlockBtn.addEventListener("click", unlockAdmin);
  wipeAllBtn.addEventListener("click", wipeAllData);
  wipePricesBtn.addEventListener("click", wipePricesOnly);

  refreshAll();
});


/* ==========================================================
   REFRESH EVERYTHING
========================================================== */
function refreshAll() {
  loadPubs();
  loadPints();
  loadCheapest();
  loadTicker();
  loadPPI();
  loadPopularity();
  loadMarketTable();
  loadPriceDistribution();
  loadCheapestPubs();
  loadRecommendations();
  loadRarePints();
}


/* ==========================================================
   ADD PUB
========================================================== */
async function addPub() {
  if (!pubName.value.trim()) return alert("Enter a pub name");

  await addDoc(collection(db, "pubs"), {
    name: pubName.value.trim(),
    address: pubAddress.value.trim(),
    createdAt: serverTimestamp()
  });

  pubName.value = "";
  pubAddress.value = "";
  refreshAll();
}


/* ==========================================================
   ADD PINT TYPE
========================================================== */
async function addPint() {
  if (!pintName.value.trim() || !pintCategory.value.trim())
    return alert("Enter pint + category");

  await addDoc(collection(db, "pintDefinitions"), {
    name: pintName.value.trim(),
    category: pintCategory.value.trim(),
    createdAt: serverTimestamp()
  });

  pintName.value = "";
  pintCategory.value = "";
  refreshAll();
}


/* ==========================================================
   ADD PRICE — OPTION C LOGIC
   (Deactivate old active price, create new active price)
========================================================== */
async function addPrice() {
  const price = Number(pintPrice.value);
  if (!price || price <= 0) return alert("Enter a valid price");

  const pubId = pricePubSelect.value;
  const pintId = pricePintSelect.value;

  const snap = await getDocs(collection(db, "pintPrices"));
  let existing = null;

  snap.forEach(docSnap => {
    const d = docSnap.data();
    if (d.pubId === pubId && d.pintId === pintId && d.active === true) {
      existing = docSnap;
    }
  });

  // Deactivate old entry
  if (existing) {
    await existing.ref.update({ active: false });
  }

  // Add NEW active price
  await addDoc(collection(db, "pintPrices"), {
    pubId,
    pintId,
    price,
    active: true,
    timestamp: serverTimestamp()
  });

  pintPrice.value = "";
  refreshAll();
}


/* ==========================================================
   LOAD PUBS
========================================================== */
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


/* ==========================================================
   LOAD PINT TYPES
========================================================== */
async function loadPints() {
  const snap = await getDocs(collection(db, "pintDefinitions"));

  [pricePintSelect, cheapestSelect].forEach(sel => sel.innerHTML = "");

  snap.forEach(doc => {
    const o = document.createElement("option");
    o.value = doc.id;
    o.textContent = doc.data().name;

    pricePintSelect.appendChild(o.cloneNode(true));
    cheapestSelect.appendChild(o.cloneNode(true));
  });
}


/* ==========================================================
   HERO SECTION — CHEAPEST PINT
========================================================== */
async function loadCheapest() {
  const activePrices = (await getDocs(collection(db, "pintPrices")))
    .docs.map(d => ({ id: d.id, ...d.data() }))
    .filter(x => x.active);

  if (!activePrices.length) {
    heroContent.innerHTML = "No prices yet.";
    return;
  }

  const cheapest = [...activePrices].sort((a,b)=>a.price - b.price)[0];

  const pint = (await getDocs(collection(db, "pintDefinitions")))
    .docs.find(p => p.id === cheapest.pintId)?.data();

  const pub = (await getDocs(collection(db, "pubs")))
    .docs.find(p => p.id === cheapest.pubId)?.data();

  heroContent.innerHTML = `
    <div class="hero-block">
      <div class="hero-label">🔥 Cheapest Pint Right Now</div>
      <div class="hero-item">🍺 <strong>${pint.name}</strong> (${pint.category})</div>
      <div class="hero-price">£${cheapest.price.toFixed(2)}</div>
      <div class="hero-pub">📍 ${pub.name}</div>
    </div>
  `;
}


/* ==========================================================
   MARKET TICKER
========================================================== */
async function loadTicker() {
  const pintsSnap = await getDocs(collection(db, "pintDefinitions"));
  const priceSnap = await getDocs(collection(db, "pintPrices"));

  const active = priceSnap.docs
    .map(x => x.data())
    .filter(x => x.active);

  if (!active.length) {
    ticker.textContent = "No market data yet.";
    return;
  }

  const cheapest = [...active].sort((a,b)=>a.price - b.price)[0];
  const highest = [...active].sort((a,b)=>b.price - a.price)[0];
  const avg = (active.reduce((a,b)=>a + b.price, 0) / active.length).toFixed(2);

  // Trending pint = most activity
  const freq = {};
  active.forEach(x => freq[x.pintId] = (freq[x.pintId] || 0) + 1);

  const trending = Object.keys(freq).sort((a,b)=>freq[b] - freq[a])[0];
  const trendingName = pintsSnap.docs.find(p => p.id === trending)?.data().name;

  ticker.textContent =
    `Cheapest £${cheapest.price} | Index £${avg} | Popular ${trendingName} | High £${highest.price}`;
}


/* ==========================================================
   PINT INDEX — Average active price
========================================================== */
async function loadPPI() {
  const active = (await getDocs(collection(db,"pintPrices")))
    .docs.map(d => d.data())
    .filter(x => x.active);

  if (!active.length) return ppiOutput.textContent = "£0.00";

  const avg = active.reduce((a,b)=>a + b.price, 0) / active.length;
  ppiOutput.textContent = `£${avg.toFixed(2)}`;
}


/* ==========================================================
   POPULARITY (COLLAPSIBLE)
========================================================== */
let popularityOpen = false;

function togglePopularity() {
  popularityOpen = !popularityOpen;
  document.querySelector(".collapsible").classList.toggle("open");
}

async function loadPopularity() {
  const pintSnap = await getDocs(collection(db, "pintDefinitions"));
  const priceSnap = await getDocs(collection(db, "pintPrices"));

  const freq = {};
  pintSnap.forEach(p => freq[p.id] = 0);

  priceSnap.forEach(pr => {
    const x = pr.data();
    if (x.active) freq[x.pintId]++;
  });

  const sorted = pintSnap.docs
    .map(doc => ({ name: doc.data().name, count: freq[doc.id] }))
    .sort((a,b)=>b.count - a.count);

  const max = sorted[0]?.count || 1;

  popularityChartContainer.innerHTML = sorted.map(item => `
    <div style="margin:6px 0;">
      <div>${item.name}</div>
      <div class="poll-bar-wrapper">
        <div class="poll-bar" style="width:${(item.count/max)*100}%"></div>
      </div>
    </div>
  `).join("");
}


/* ==========================================================
   MARKET TABLE
========================================================== */
let tableExpanded = false;

async function loadMarketTable() {
  const pricesSnap = await getDocs(collection(db, "pintPrices"));
  const defsSnap   = await getDocs(collection(db, "pintDefinitions"));
  const pubsSnap   = await getDocs(collection(db, "pubs"));

  const pints = {};
  const pubs = {};

  defsSnap.forEach(p => pints[p.id] = p.data().name);
  pubsSnap.forEach(p => pubs[p.id] = p.data().name);

  const active = pricesSnap.docs
    .map(x => x.data())
    .filter(x => x.active);

  let rows = active.map(x => ({
    pint: pints[x.pintId],
    pub: pubs[x.pubId],
    price: x.price
  }));

  rows.sort((a,b)=>a.price - b.price);

  const show = tableExpanded ? rows : rows.slice(0,5);

  marketTableBody.innerHTML = show.map((r,i)=>`
    <tr>
      <td>${i+1}</td>
      <td>${r.pint}</td>
      <td>${r.pub}</td>
      <td>£${r.price}</td>
    </tr>
  `).join("");
}

function toggleTableExpand() {
  tableExpanded = !tableExpanded;
  expandTableBtn.textContent = tableExpanded ? "Show Top 5 ▲" : "Show Full Table ▼";
  loadMarketTable();
}


/* ==========================================================
   PRICE DISTRIBUTION
========================================================== */
async function loadPriceDistribution() {
  const active = (await getDocs(collection(db, "pintPrices")))
    .docs.map(d => d.data())
    .filter(x => x.active);

  if (!active.length) {
    priceDistribution.textContent = "No data yet.";
    return;
  }

  const buckets = {};

  active.forEach(x => {
    const p = x.price;
    const key = `£${Math.floor(p)}–£${Math.floor(p)+1}`;
    buckets[key] = (buckets[key]||0) + 1;
  });

  const max = Math.max(...Object.values(buckets));

  priceDistribution.innerHTML = Object.entries(buckets).map(([range,count]) => `
    <div>${range}</div>
    <div class="dist-bar-wrapper"><div class="dist-bar" style="width:${(count/max)*100}%"></div></div>
  `).join("");
}


/* ==========================================================
   TOP 5 CHEAPEST PUBS
========================================================== */
async function loadCheapestPubs() {
  const pricesSnap = await getDocs(collection(db,"pintPrices"));
  const pubsSnap   = await getDocs(collection(db,"pubs"));

  const active = pricesSnap.docs.map(x=>x.data()).filter(x=>x.active);

  if (!active.length) {
    cheapestPubs.textContent = "No data yet.";
    return;
  }

  const pubNames = {};
  pubsSnap.forEach(d => pubNames[d.id] = d.data().name);

  const grouped = {};

  active.forEach(x => {
    if (!grouped[x.pubId]) grouped[x.pubId] = [];
    grouped[x.pubId].push(x.price);
  });

  const sorted = Object.entries(grouped)
    .map(([id, arr]) => ({
      pub: pubNames[id],
      avg: arr.reduce((a,b)=>a+b,0) / arr.length
    }))
    .sort((a,b)=>a.avg - b.avg)
    .slice(0,5);

  cheapestPubs.innerHTML = sorted.map((p,i)=>`
    <div>${i+1}. ${p.pub} — £${p.avg.toFixed(2)}</div>
  `).join("");
}


/* ==========================================================
   RECOMMENDATIONS
========================================================== */
async function loadRecommendations() {
  const priceSnap = await getDocs(collection(db,"pintPrices"));
  const pintSnap  = await getDocs(collection(db,"pintDefinitions"));
  const pubSnap   = await getDocs(collection(db,"pubs"));

  const active = priceSnap.docs.map(x=>x.data()).filter(x=>x.active);
  if (!active.length) {
    recommendations.textContent = "No data.";
    return;
  }

  const pintNames = {};
  const pubNames = {};

  pintSnap.forEach(p=>pintNames[p.id] = p.data().name);
  pubSnap.forEach(p=>pubNames[p.id] = p.data().name);

  const cheapest = [...active].sort((a,b)=>a.price - b.price)[0];

  const freq = {};
  active.forEach(x => freq[x.pintId] = (freq[x.pintId]||0) + 1);

  const trending = Object.keys(freq).sort((a,b)=>freq[b] - freq[a])[0];

  recommendations.innerHTML = `
    <div>💸 Cheapest: ${pintNames[cheapest.pintId]} @ ${pubNames[cheapest.pubId]} (£${cheapest.price})</div>
    <div>🔥 Trending: ${pintNames[trending]}</div>
  `;
}


/* ==========================================================
   RARE PINTS — SORTED RAREST → LEAST RARE
========================================================== */
let rareExpanded = false;

async function loadRarePints() {
  const pintSnap = await getDocs(collection(db,"pintDefinitions"));
  const priceSnap = await getDocs(collection(db,"pintPrices"));

  const count = {};
  pintSnap.forEach(p => count[p.id] = 0);

  priceSnap.forEach(pr => {
    const x = pr.data();
    if (x.active) count[x.pintId]++;
  });

  // Build rarity records
  let rare = pintSnap.docs.map(doc => {
    const id = doc.id;
    const name = doc.data().name;
    const c = count[id];

    let emoji = "⭐";
    if (c === 1) emoji = "🌟";
    if (c === 0) emoji = "💎";

    return { name, count: c, emoji };
  }).filter(r => r.count < 3);

  // Sort: 0 logs → 1 log → 2 logs
  rare.sort((a,b)=>a.count - b.count);

  const list = rareExpanded ? rare : rare.slice(0,5);

  rarePints.innerHTML = `
    <table class="rare-table">
      <tr><th>Pint</th><th>Rarity</th><th>Logs</th></tr>
      ${list.map(r=>`
        <tr>
          <td>${r.name}</td>
          <td>${r.emoji}</td>
          <td>${r.count}</td>
        </tr>
      `).join("")}
    </table>
    <button id="expandRareBtn" class="btn-secondary">
      ${rareExpanded ? "Show Less ▲" : "Show All ▼"}
    </button>
  `;

  document.getElementById("expandRareBtn").onclick = () => {
    rareExpanded = !rareExpanded;
    loadRarePints();
  };
}


/* ==========================================================
   TOOL — WHERE IS THE CHEAPEST FOR SELECTED PINT?
========================================================== */
async function findCheapestForPint() {
  const pintId = cheapestSelect.value;

  const priceSnap = await getDocs(collection(db, "pintPrices"));
  const pintSnap  = await getDocs(collection(db, "pintDefinitions"));
  const pubSnap   = await getDocs(collection(db, "pubs"));

  const active = priceSnap.docs.map(x=>x.data()).filter(x=>x.active);

  const pintName = pintSnap.docs.find(p=>p.id === pintId)?.data().name;

  const pubs = {};
  pubSnap.forEach(d=>pubs[d.id] = d.data().name);

  const matches = active.filter(x => x.pintId === pintId);

  if (!matches.length) {
    cheapestResult.textContent = "No price data yet.";
    return;
  }

  const cheapest = [...matches].sort((a,b)=>a.price - b.price)[0];
  const avg = (matches.reduce((a,b)=>a + b.price, 0) / matches.length).toFixed(2);

  cheapestResult.innerHTML = `
    <div>🍺 <strong>${pintName}</strong></div>
    <div>📍 Cheapest @ ${pubs[cheapest.pubId]}</div>
    <div>💷 £${cheapest.price}</div>
    <div>📊 Avg £${avg}</div>
  `;
}


/* ==========================================================
   ADVANCED BUDGET PLANNER
========================================================== */
async function calculateBudget() {
  const budget = Number(budgetInput.value);
  if (!budget) return alert("Enter £ budget");

  const priceSnap = await getDocs(collection(db, "pintPrices"));
  const pintSnap  = await getDocs(collection(db, "pintDefinitions"));
  const pubSnap   = await getDocs(collection(db,"pubs"));

  const pintNames = {};
  const pubNames = {};

  pintSnap.forEach(p => pintNames[p.id] = p.data().name);
  pubSnap.forEach(p => pubNames[p.id] = p.data().name);

  const active = priceSnap.docs.map(x=>x.data()).filter(x=>x.active);

  const options = active.map(x => {
    const count = Math.floor(budget / x.price);
    if (count <= 0) return null;

    return {
      pintId: x.pintId,
      pint: pintNames[x.pintId],
      pub: pubNames[x.pubId],
      price: x.price,
      count,
      total: count * x.price,
      leftover: budget - count * x.price
    };
  }).filter(Boolean);

  if (!options.length) {
    budgetOutput.textContent = "Budget too low.";
    return;
  }

  // Best value (most pints)
  const bestValue = [...options].sort((a,b)=>b.count - a.count)[0];

  // Cheapest pint
  const cheapestPint = [...options].sort((a,b)=>a.price - b.price)[0];

  // Closest to full spend
  const closestSpend = [...options].sort((a,b)=>a.leftover - b.leftover)[0];

  // Popularity
  const freq = {};
  active.forEach(x => freq[x.pintId] = (freq[x.pintId]||0) + 1);
  const mostPopular = [...options].sort((a,b)=>freq[b.pintId] - freq[a.pintId])[0];

  // Premium choice (highest price)
  const premium = [...options].sort((a,b)=>b.price - a.price)[0];

  budgetOutput.innerHTML = `
    <div>🥇 Best Value: ${bestValue.count} × ${bestValue.pint} @ ${bestValue.pub} (£${bestValue.total.toFixed(2)})</div>

    <div>💸 Cheapest Pint: ${cheapestPint.pint} @ ${cheapestPint.pub} (£${cheapestPint.price})</div>

    <div>🎯 Closest Spend: ${closestSpend.count} × ${closestSpend.pint} (£${closestSpend.total.toFixed(2)})</div>

    <div>🔥 Most Popular Choice: ${mostPopular.count} × ${mostPopular.pint} @ ${mostPopular.pub}</div>

    <div>💎 Premium Choice: ${premium.count} × ${premium.pint} @ ${premium.pub} (Price £${premium.price})</div>
  `;
}


/* ==========================================================
   ADMIN
========================================================== */
function unlockAdmin() {
  if (adminCodeInput.value.trim() === "PINTADMIN2025") {
    adminTools.style.display = "block";
    adminPanel.style.display = "none";
  } else alert("Incorrect admin password");
}

async function wipeAllData() {
  if (!confirm("Delete EVERYTHING?")) return;

  const cols = ["pubs","pintDefinitions","pintPrices"];

  for (const c of cols) {
    const snap = await getDocs(collection(db, c));
    for (const d of snap.docs) await deleteDoc(doc(db, c, d.id));
  }

  alert("All data wiped.");
  refreshAll();
}

async function wipePricesOnly() {
  if (!confirm("Delete ALL price data?")) return;

  const snap = await getDocs(collection(db, "pintPrices"));
  for (const d of snap.docs) await deleteDoc(doc(db,"pintPrices",d.id));

  alert("Price data wiped.");
  refreshAll();
}
