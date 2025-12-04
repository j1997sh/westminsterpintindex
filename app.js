import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/* Helper: get element */
const $ = id => document.getElementById(id);

/* ==========================================================
   ON PAGE LOAD
========================================================== */
document.addEventListener("DOMContentLoaded", () => {

  // Add data buttons
  $("addPubBtn").addEventListener("click", addPub);
  $("addPintBtn").addEventListener("click", addPint);
  $("addPriceBtn").addEventListener("click", addPrice);

  // Tools
  $("compareBtn").addEventListener("click", comparePints);
  $("budgetBtn").addEventListener("click", calculateBudget);
  $("expandTableBtn").addEventListener("click", toggleTableExpand);

  // Admin
  $("adminLockTrigger").addEventListener("click", showAdminPanel);
  $("adminUnlockBtn").addEventListener("click", unlockAdmin);
  $("wipeAllBtn").addEventListener("click", wipeAllData);
  $("wipePricesBtn").addEventListener("click", wipePricesOnly);

  // Load dashboard
  loadPubs();
  loadPints();
  loadCheapest();
  loadPPI();
  loadPopularityChart();
  loadMarketTable();
  loadPriceDistribution();
  loadCheapestPubs();
  loadRecommendations();
  loadRarePints();
  loadTicker();
});


/* ==========================================================
   ADD PUB
========================================================== */
async function addPub() {
  const name = $("pubName").value.trim();
  const addr = $("pubAddress").value.trim();

  if (!name) return alert("Enter pub name");

  await addDoc(collection(db, "pubs"), {
    name,
    address: addr,
    createdAt: serverTimestamp()
  });

  loadPubs();
}


/* ==========================================================
   ADD PINT
========================================================== */
async function addPint() {
  const name = $("pintName").value.trim();
  const cat = $("pintCategory").value.trim();

  if (!name || !cat) return alert("Fill all fields");

  await addDoc(collection(db, "pintDefinitions"), {
    name,
    category: cat,
    createdAt: serverTimestamp()
  });

  loadPints();
}


/* ==========================================================
   ADD PRICE
========================================================== */
async function addPrice() {
  const price = Number($("pintPrice").value);
  if (!price || price <= 0) return alert("Enter valid price");

  await addDoc(collection(db, "pintPrices"), {
    pubId: $("pricePubSelect").value,
    pintId: $("pricePintSelect").value,
    price: price,
    timestamp: serverTimestamp()
  });

  refreshDashboard();
}

/* Reload everything */
function refreshDashboard() {
  loadCheapest();
  loadPPI();
  loadPopularityChart();
  loadMarketTable();
  loadPriceDistribution();
  loadCheapestPubs();
  loadRecommendations();
  loadRarePints();
  loadTicker();
}


/* ==========================================================
   LOAD PUBS / PINTS
========================================================== */
async function loadPubs() {
  const snap = await getDocs(collection(db, "pubs"));
  const sel = $("pricePubSelect");
  sel.innerHTML = "";
  snap.forEach(doc => {
    const opt = document.createElement("option");
    opt.value = doc.id;
    opt.textContent = doc.data().name;
    sel.appendChild(opt);
  });
}

async function loadPints() {
  const snap = await getDocs(collection(db, "pintDefinitions"));

  const selects = [
    $("pricePintSelect"),
    $("comparePintA"),
    $("comparePintB")
  ];

  selects.forEach(s => s.innerHTML = "");

  snap.forEach(doc => {
    const opt = document.createElement("option");
    opt.value = doc.id;
    opt.textContent = doc.data().name;

    selects.forEach(s => s.appendChild(opt.cloneNode(true)));
  });
}


/* ==========================================================
   HERO CARD — CHEAPEST PINT
========================================================== */
async function loadCheapest() {
  const qPrice = query(collection(db, "pintPrices"), orderBy("price"), limit(1));
  const snap = await getDocs(qPrice);

  if (snap.empty) {
    $("hero-content").innerHTML = "<p>No prices yet.</p>";
    return;
  }

  const cheapest = snap.docs[0].data();

  const pints = await getDocs(collection(db, "pintDefinitions"));
  const pubs  = await getDocs(collection(db, "pubs"));

  const pint = pints.docs.find(x => x.id === cheapest.pintId)?.data();
  const pub  = pubs.docs.find(x => x.id === cheapest.pubId)?.data();

  $("hero-content").innerHTML = `
    <div class="cheapest-name">🍺 ${pint.name} (${pint.category})</div>
    <div class="cheapest-price">£${cheapest.price}</div>
    <div class="cheapest-pub">📍 ${pub.name}</div>
    <div class="cheapest-trend">➡️ Stable today</div>
  `;
}


/* ==========================================================
   PINT INDEX
========================================================== */
async function loadPPI() {
  const snap = await getDocs(collection(db, "pintPrices"));
  const avg = (
    snap.docs.reduce((a,b)=>a + b.data().price, 0) / snap.size || 0
  ).toFixed(2);

  $("ppiOutput").textContent = `£${avg}`;
}


/* ==========================================================
   POPULARITY BARS
========================================================== */
async function loadPopularityChart() {
  const pintSnap = await getDocs(collection(db, "pintDefinitions"));
  const priceSnap = await getDocs(collection(db, "pintPrices"));

  const counts = {};
  pintSnap.forEach(p => counts[p.id] = 0);
  priceSnap.forEach(pr => counts[pr.data().pintId]++);

  const sorted = pintSnap.docs
    .map(doc => ({
      name: doc.data().name,
      count: counts[doc.id]
    }))
    .sort((a,b)=>b.count-a.count);

  const max = sorted[0]?.count || 1;

  $("popularityChartContainer").innerHTML = sorted.map(item => `
    <div class="poll-label">${item.name}</div>
    <div class="poll-bar-wrapper">
      <div class="poll-bar" style="width:${(item.count/max)*100}%"></div>
    </div>
  `).join("");
}


/* ==========================================================
   MARKET TABLE
========================================================== */
let tableExpanded = false;

async function loadMarketTable() {
  const prices = await getDocs(collection(db, "pintPrices"));
  const pints  = await getDocs(collection(db, "pintDefinitions"));
  const pubs   = await getDocs(collection(db, "pubs"));

  const pintMap = {}, pubMap = {};
  pints.forEach(p => pintMap[p.id] = p.data());
  pubs.forEach(p => pubMap[p.id] = p.data());

  const rows = prices.docs.map(doc => {
    const d = doc.data();
    return {
      pint: pintMap[d.pintId]?.name,
      pub: pubMap[d.pubId]?.name,
      price: d.price
    };
  }).sort((a,b)=>a.price - b.price);

  const tbody = $("marketTableBody");
  tbody.innerHTML = "";

  const slice = tableExpanded ? rows : rows.slice(0,5);

  slice.forEach((r,i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i+1}</td>
      <td>${r.pint}</td>
      <td>${r.pub}</td>
      <td>£${r.price.toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function toggleTableExpand() {
  tableExpanded = !tableExpanded;
  $("expandTableBtn").textContent = tableExpanded ? "Show Top 5 ▲" : "Show Full Table ▼";
  loadMarketTable();
}


/* ==========================================================
   PRICE DISTRIBUTION
========================================================== */
async function loadPriceDistribution() {
  const snap = await getDocs(collection(db, "pintPrices"));
  if (snap.empty) {
    $("priceDistribution").innerHTML = "No data yet";
    return;
  }

  const values = snap.docs.map(d => d.data().price);
  const buckets = {};

  values.forEach(v => {
    const key = `£${Math.floor(v)}–£${Math.floor(v)+1}`;
    buckets[key] = (buckets[key]||0)+1;
  });

  const max = Math.max(...Object.values(buckets));

  $("priceDistribution").innerHTML = Object.entries(buckets).map(([range,count])=>`
    <div class="dist-label">${range}</div>
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
  const pubs   = await getDocs(collection(db, "pubs"));

  if (prices.empty) {
    $("cheapestPubs").innerHTML = "<p>No data yet</p>";
    return;
  }

  const pubNames = {};
  pubs.forEach(p => pubNames[p.id] = p.data().name);

  const groups = {};

  prices.forEach(pr => {
    const d = pr.data();
    if (!groups[d.pubId]) groups[d.pubId] = [];
    groups[d.pubId].push(d.price);
  });

  const sorted = Object.entries(groups)
    .map(([pubId,vals]) => ({
      pub: pubNames[pubId],
      avg: vals.reduce((a,b)=>a+b,0)/vals.length
    }))
    .sort((a,b)=>a.avg-b.avg)
    .slice(0,5);

  $("cheapestPubs").innerHTML = sorted.map((p,i)=>`
    <div class="pub-row">
      <span class="pub-rank">${i+1}.</span> ${p.pub} — £${p.avg.toFixed(2)}
    </div>
  `).join("");
}


/* ==========================================================
   RECOMMENDATIONS
========================================================== */
async function loadRecommendations() {
  const prices = await getDocs(collection(db, "pintPrices"));
  const pints  = await getDocs(collection(db, "pintDefinitions"));
  const pubs   = await getDocs(collection(db, "pubs"));

  if (prices.empty) {
    $("recommendations").innerHTML = "<p>No data yet</p>";
    return;
  }

  const pintMap = {}, pubMap = {};
  pints.forEach(p => pintMap[p.id] = p.data());
  pubs.forEach(p => pubMap[p.id] = p.data());

  const vals = prices.docs.map(d => d.data());

  const cheapest = [...vals].sort((a,b)=>a.price-b.price)[0];

  // trending
  const freq = {};
  vals.forEach(v => freq[v.pintId]=(freq[v.pintId]||0)+1);
  const trendingId = Object.keys(freq).sort((a,b)=>freq[b]-freq[a])[0];

  $("recommendations").innerHTML = `
    <div class="rec-item">
      ⭐ Cheapest Pint:<br>
      <strong>${pintMap[cheapest.pintId].name}</strong> @ ${pubMap[cheapest.pubId].name} (£${cheapest.price})
    </div>

    <div class="rec-item">
      📈 Trending Pint:<br>
      <strong>${pintMap[trendingId].name}</strong> (most logged)
    </div>

    <div class="rec-item">
      💡 Best Value:<br>
      <strong>${pintMap[cheapest.pintId].name}</strong>
    </div>
  `;
}


/* ==========================================================
   RARE PINTS
========================================================== */
async function loadRarePints() {
  const pints = await getDocs(collection(db, "pintDefinitions"));
  const prices = await getDocs(collection(db, "pintPrices"));
  const pubs = await getDocs(collection(db, "pubs"));

  const pubMap = {}; pubs.forEach(p=>pubMap[p.id]=p.data().name);
  const count = {}, last = {};

  pints.forEach(p => count[p.id]=0);

  prices.forEach(pr => {
    const d = pr.data();
    count[d.pintId]++;
    last[d.pintId] = d;
  });

  const rare = Object.keys(count).filter(id=>count[id] < 3);

  $("rarePints").innerHTML = rare.map(id => {
    const pint = pints.docs.find(p=>p.id===id).data();
    return `
      <div style="padding:16px;background:#FEF9C3;border-radius:18px;margin-bottom:10px;">
        <strong>${pint.name}</strong><br>
        📍 ${pubMap[last[id]?.pubId] || "Unknown"}<br>
        £${last[id]?.price || "?"}<br>
        ⭐ Rare (${count[id]} entries)
      </div>
    `;
  }).join("");
}


/* ==========================================================
   BUDGET PLANNER
========================================================== */
async function calculateBudget() {
  const budget = Number($("budgetInput").value);
  if (!budget) return alert("Enter budget");

  const prices = await getDocs(collection(db, "pintPrices"));
  const pints  = await getDocs(collection(db, "pintDefinitions"));
  const pubs   = await getDocs(collection(db, "pubs"));

  const pintMap = {}, pubMap = {};
  pints.forEach(p=>pintMap[p.id]=p.data().name);
  pubs.forEach(p=>pubMap[p.id]=p.data().name);

  const options = prices.docs.map(d => {
    const p = d.data();
    const count = Math.floor(budget / p.price);
    return {
      pint: pintMap[p.pintId],
      pub: pubMap[p.pubId],
      count,
      total: count * p.price,
      change: budget - (count*p.price)
    };
  }).filter(o=>o.count>0)
    .sort((a,b)=>b.count-a.count);

  if (!options.length) {
    $("budgetOutput").innerHTML = "Budget too low.";
    return;
  }

  const best = options[0];

  $("budgetOutput").innerHTML = `
    Best Option: ${best.count}× ${best.pint} @ ${best.pub}<br>
    Total £${best.total.toFixed(2)} — Change £${best.change.toFixed(2)}
  `;
}


/* ==========================================================
   TICKER
========================================================== */
async function loadTicker() {
  const prices = await getDocs(collection(db, "pintPrices"));
  const pints  = await getDocs(collection(db, "pintDefinitions"));

  if (prices.empty) {
    $("ticker").textContent = "No data yet.";
    return;
  }

  const vals = prices.docs.map(d=>d.data());
  const cheapest = [...vals].sort((a,b)=>a.price-b.price)[0];
  const expensive = [...vals].sort((a,b)=>b.price-a.price)[0];
  const avg = (
    vals.reduce((a,b)=>a+b.price,0) / vals.length
  ).toFixed(2);

  const freq = {};
  vals.forEach(v=>freq[v.pintId]=(freq[v.pintId]||0)+1);
  const popId = Object.keys(freq).sort((a,b)=>freq[b]-freq[a])[0];
  const popName = pints.docs.find(p=>p.id===popId).data().name;

  $("ticker").innerHTML = `
    Cheapest £${cheapest.price} ▼ |
    Index £${avg} |
    Popular: ${popName} |
    High £${expensive.price} ▲
  `;
}


/* ==========================================================
   ADMIN LOCK
========================================================== */
function showAdminPanel() {
  $("adminLockPanel").style.display = "block";
}

function unlockAdmin() {
  const code = $("adminCodeInput").value.trim();
  if (code === "PINTADMIN2025") {
    $("adminTools").style.display = "block";
    $("adminLockPanel").style.display = "none";
  } else {
    alert("Incorrect admin code");
  }
}

async function wipeAllData() {
  if (!confirm("Delete ALL data?")) return;

  for (const coll of ["pubs", "pintDefinitions", "pintPrices"]) {
    const snap = await getDocs(collection(db, coll));
    for (const doc of snap.docs) await doc.ref.delete();
  }

  alert("All data wiped.");
  location.reload();
}

async function wipePricesOnly() {
  if (!confirm("Delete ALL pint prices?")) return;

  const snap = await getDocs(collection(db, "pintPrices"));
  for (const doc of snap.docs) await doc.ref.delete();

  alert("Prices wiped.");
  location.reload();
}
