/* ==========================================================
   IMPORT FIREBASE
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
   ON PAGE LOAD
========================================================== */
document.addEventListener("DOMContentLoaded", () => {

  // Add Data
  addPubBtn.addEventListener("click", addPub);
  addPintBtn.addEventListener("click", addPint);
  addPriceBtn.addEventListener("click", addPrice);

  // Tools
  findCheapestBtn.addEventListener("click", findCheapestForPint);
  budgetBtn.addEventListener("click", calculateBudget);
  expandTableBtn.addEventListener("click", toggleTableExpand);

  // Admin
  adminToggle.addEventListener("click", showAdminLogin);
  adminUnlockBtn.addEventListener("click", unlockAdmin);
  wipeAllBtn.addEventListener("click", wipeAllData);
  wipePricesBtn.addEventListener("click", wipePricesOnly);

  // Collapsible Popularity
  document.querySelector(".collapse-toggle").addEventListener("click", togglePopularity);

  // Load Dashboard
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
  if (!pubName.value.trim()) return alert("Enter pub name");

  await addDoc(collection(db, "pubs"), {
    name: pubName.value.trim(),
    address: pubAddress?.value.trim() || "",
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
   ADD PRICE
========================================================== */
async function addPrice() {
  const price = Number(pintPrice.value);
  if (!price || price <= 0) return alert("Enter valid price");

  await addDoc(collection(db, "pintPrices"), {
    pubId: pricePubSelect.value,
    pintId: pricePintSelect.value,
    price,
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
   HERO CHEAPEST PINT CARD
========================================================== */
async function loadCheapest() {
  const q = query(collection(db, "pintPrices"), orderBy("price"), limit(1));
  const snap = await getDocs(q);

  if (snap.empty) {
    heroContent.innerHTML = "No prices yet.";
    return;
  }

  const cheapest = snap.docs[0].data();

  const pintSnap = await getDocs(collection(db, "pintDefinitions"));
  const pubSnap  = await getDocs(collection(db, "pubs"));

  const pint = pintSnap.docs.find(p => p.id === cheapest.pintId)?.data();
  const pub  = pubSnap.docs.find(p => p.id === cheapest.pubId)?.data();

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
  const prices = await getDocs(collection(db, "pintPrices"));
  const pints  = await getDocs(collection(db, "pintDefinitions"));

  if (prices.empty) {
    ticker.textContent = "No market data yet.";
    return;
  }

  const list = prices.docs.map(d => d.data());
  const cheapest = [...list].sort((a,b)=>a.price - b.price)[0];
  const highest  = [...list].sort((a,b)=>b.price - a.price)[0];

  const avg = (list.reduce((a,b)=>a + b.price, 0) / list.length).toFixed(2);

  // Most logged pint
  const freq = {};
  list.forEach(x => freq[x.pintId] = (freq[x.pintId] || 0) + 1);
  const popID = Object.keys(freq).sort((a,b)=>freq[b] - freq[a])[0];
  const popName = pints.docs.find(p => p.id === popID)?.data().name;

  ticker.textContent =
    `Cheapest £${cheapest.price} | Index £${avg} | Popular ${popName} | High £${highest.price}`;
}


/* ==========================================================
   PINT INDEX (AVERAGE PRICE)
========================================================== */
async function loadPPI() {
  const snap = await getDocs(collection(db, "pintPrices"));
  if (snap.empty) return ppiOutput.textContent = "£0.00";

  const avg = snap.docs.reduce((sum, d) => sum + d.data().price, 0) / snap.size;
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

  const count = {};
  pintSnap.forEach(p => count[p.id] = 0);
  priceSnap.forEach(pr => count[pr.data().pintId]++);

  const sorted = pintSnap.docs
    .map(doc => ({ name: doc.data().name, count: count[doc.id] }))
    .sort((a,b)=>b.count - a.count);

  const max = sorted[0]?.count || 1;

  popularityChartContainer.innerHTML = sorted.map(item => `
    <div style="margin:5px 0;">
      <div>${item.name}</div>
      <div class="poll-bar-wrapper">
        <div class="poll-bar" style="width:${(item.count/max)*100}%"></div>
      </div>
    </div>
  `).join("");
}


/* ==========================================================
   MARKET TABLE (EXPANDABLE)
========================================================== */
let tableExpanded = false;

async function loadMarketTable() {
  const prices = await getDocs(collection(db, "pintPrices"));
  const pints  = await getDocs(collection(db, "pintDefinitions"));
  const pubs   = await getDocs(collection(db, "pubs"));

  const pintMap = {};
  const pubMap = {};

  pints.forEach(p => pintMap[p.id] = p.data().name);
  pubs.forEach(p => pubMap[p.id] = p.data().name);

  let rows = prices.docs.map(d => ({
    pint: pintMap[d.data().pintId],
    pub: pubMap[d.data().pubId],
    price: d.data().price
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
  const snap = await getDocs(collection(db, "pintPrices"));
  if (snap.empty) return priceDistribution.textContent = "No data";

  const buckets = {};

  snap.forEach(d => {
    const p = d.data().price;
    const key = `£${Math.floor(p)}–£${Math.floor(p)+1}`;
    buckets[key] = (buckets[key]||0) + 1;
  });

  const max = Math.max(...Object.values(buckets));

  priceDistribution.innerHTML = Object.entries(buckets).map(([range,count]) => `
    <div>${range}</div>
    <div class="dist-bar-wrapper">
      <div class="dist-bar" style="width:${(count/max)*100}%"></div>
    </div>
  `).join("");
}


/* ==========================================================
   TOP 5 CHEAPEST PUBS
========================================================== */
async function loadCheapestPubs() {
  const prices = await getDocs(collection(db, "pintPrices"));
  const pubs = await getDocs(collection(db, "pubs"));

  if (prices.empty) return cheapestPubs.textContent = "No data";

  const pubNames = {};
  pubs.forEach(p => pubNames[p.id] = p.data().name);

  const grouped = {};

  prices.forEach(pr => {
    const x = pr.data();
    if (!grouped[x.pubId]) grouped[x.pubId] = [];
    grouped[x.pubId].push(x.price);
  });

  const sorted = Object.entries(grouped)
    .map(([id, vals]) => ({
      pub: pubNames[id],
      avg: vals.reduce((a,b)=>a+b,0) / vals.length
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
  const pricesSnap = await getDocs(collection(db, "pintPrices"));
  const pintsSnap  = await getDocs(collection(db, "pintDefinitions"));
  const pubsSnap   = await getDocs(collection(db, "pubs"));

  if (pricesSnap.empty) return recommendations.textContent = "No data";

  const pints = {};
  const pubs = {};

  pintsSnap.forEach(p => pints[p.id] = p.data().name);
  pubsSnap.forEach(p => pubs[p.id] = p.data().name);

  const list = pricesSnap.docs.map(d => d.data());

  const cheapest = [...list].sort((a,b)=>a.price - b.price)[0];

  const freq = {};
  list.forEach(x => freq[x.pintId] = (freq[x.pintId]||0) + 1);
  const trending = Object.keys(freq).sort((a,b)=>freq[b] - freq[a])[0];

  recommendations.innerHTML = `
    <div>💸 Cheapest: ${pints[cheapest.pintId]} @ ${pubs[cheapest.pubId]} (£${cheapest.price})</div>
    <div>📈 Trending: ${pints[trending]}</div>
  `;
}


/* ==========================================================
   RARE PINTS TABLE
========================================================== */
let rareExpanded = false;

async function loadRarePints() {
  const pintSnap = await getDocs(collection(db, "pintDefinitions"));
  const priceSnap = await getDocs(collection(db, "pintPrices"));

  const count = {};
  pintSnap.forEach(p => count[p.id] = 0);

  priceSnap.forEach(pr => {
    const x = pr.data();
    count[x.pintId]++;
  });

  const rare = pintSnap.docs.map(p => {
    const id = p.id;
    const name = p.data().name;
    const c = count[id];

    let emoji = "⭐";
    if (c === 1) emoji = "🌟";
    if (c === 0) emoji = "💎";

    return { name, count: c, emoji };
  }).filter(r => r.count < 3);

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
    <button class="btn-secondary" id="expandRareBtn">
      ${rareExpanded ? "Show Less ▲" : "Show All ▼"}
    </button>
  `;

  document.getElementById("expandRareBtn").onclick = () => {
    rareExpanded = !rareExpanded;
    loadRarePints();
  };
}


/* ==========================================================
   TOOL: WHERE IS THE CHEAPEST XXXX?
========================================================== */
async function findCheapestForPint() {
  const pintId = cheapestSelect.value;

  const priceSnap = await getDocs(collection(db, "pintPrices"));
  const pintSnap  = await getDocs(collection(db, "pintDefinitions"));
  const pubSnap   = await getDocs(collection(db, "pubs"));

  const pintName = pintSnap.docs.find(p => p.id === pintId)?.data().name;
  const pubNames = {};
  pubSnap.forEach(p => pubNames[p.id] = p.data().name);

  const matches = priceSnap.docs
    .map(x => x.data())
    .filter(x => x.pintId === pintId);

  if (!matches.length) {
    cheapestResult.textContent = "No prices found for this pint.";
    return;
  }

  const cheapest = [...matches].sort((a,b)=>a.price - b.price)[0];
  const avg = (matches.reduce((a,b)=>a + b.price,0) / matches.length).toFixed(2);

  cheapestResult.innerHTML = `
    <div>🍺 <strong>${pintName}</strong></div>
    <div>📍 Cheapest @ ${pubNames[cheapest.pubId]}</div>
    <div>💷 £${cheapest.price}</div>
    <div>📊 Avg £${avg}</div>
  `;
}


/* ==========================================================
   BUDGET PLANNER
========================================================== */
async function calculateBudget() {
  const budget = Number(budgetInput.value);
  if (!budget) return alert("Enter amount");

  const priceSnap = await getDocs(collection(db, "pintPrices"));
  const pintSnap  = await getDocs(collection(db, "pintDefinitions"));
  const pubSnap   = await getDocs(collection(db, "pubs"));

  const pintNames = {};
  const pubNames = {};

  pintSnap.forEach(p => pintNames[p.id] = p.data().name);
  pubSnap.forEach(p => pubNames[p.id] = p.data().name);

  const options = priceSnap.docs.map(d => {
    const x = d.data();
    const count = Math.floor(budget / x.price);
    if (count <= 0) return null;

    return {
      pint: pintNames[x.pintId],
      pub: pubNames[x.pubId],
      price: x.price,
      count,
      total: count * x.price,
      leftover: budget - count * x.price
    };
  }).filter(Boolean);

  if (!options.length) return budgetOutput.textContent = "Budget too low.";

  const bestValue = [...options].sort((a,b)=>b.count - a.count)[0];
  const cheapestPint = [...options].sort((a,b)=>a.price - b.price)[0];
  const closestSpend = [...options].sort((a,b)=>a.leftover - b.leftover)[0];

  budgetOutput.innerHTML = `
    <div>🥇 Best Value: ${bestValue.count} × ${bestValue.pint} @ ${bestValue.pub} (Total £${bestValue.total.toFixed(2)})</div>
    <div>💸 Cheapest Pint: ${cheapestPint.pint} @ ${cheapestPint.pub} (£${cheapestPint.price})</div>
    <div>🎯 Closest to Full Spend: ${closestSpend.count} × ${closestSpend.pint} (£${closestSpend.total.toFixed(2)})</div>
  `;
}


/* ==========================================================
   ADMIN PANEL
========================================================== */
function showAdminLogin() {
  adminPanel.style.display = "block";
}

function unlockAdmin() {
  if (adminCodeInput.value.trim() === "PINTADMIN2025") {
    adminTools.style.display = "block";
    adminPanel.style.display = "none";
  } else alert("Wrong code");
}

async function wipeAllData() {
  if (!confirm("Delete ALL data?")) return;

  const collections = ["pubs","pintDefinitions","pintPrices"];

  for (const c of collections) {
    const snap = await getDocs(collection(db,c));
    for (const d of snap.docs) await deleteDoc(doc(db,c,d.id));
  }

  alert("All data wiped");
  refreshAll();
}

async function wipePricesOnly() {
  if (!confirm("Delete ALL prices?")) return;

  const snap = await getDocs(collection(db,"pintPrices"));
  for (const d of snap.docs) await deleteDoc(doc(db,"pintPrices",d.id));

  alert("Prices wiped");
  refreshAll();
}
