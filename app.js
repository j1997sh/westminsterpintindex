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

/* ==========================================================
   ON PAGE LOAD
========================================================== */
document.addEventListener("DOMContentLoaded", () => {

  // Add data
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

  // Load dashboard data
  refreshDashboard();
});

/* Utility shortcut */
function $(id) {
  return document.getElementById(id);
}

/* Refresh all UI elements */
function refreshDashboard() {
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
}

/* ==========================================================
   ADD PUB
========================================================== */
async function addPub() {
  const name = $("pubName").value.trim();
  if (!name) return alert("Enter a pub name");

  await addDoc(collection(db, "pubs"), {
    name,
    address: $("pubAddress").value.trim(),
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
    price,
    timestamp: serverTimestamp()
  });

  refreshDashboard();
}

/* ==========================================================
   LOAD PUBS + PINTS
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

  const selects = ["pricePintSelect", "comparePintA", "comparePintB"];
  selects.forEach(id => $(id).innerHTML = "");

  snap.forEach(doc => {
    const opt = document.createElement("option");
    opt.value = doc.id;
    opt.textContent = doc.data().name;

    selects.forEach(id => $(id).appendChild(opt.cloneNode(true)));
  });
}

/* ==========================================================
   HERO — Cheapest Pint
========================================================== */
async function loadCheapest() {

  const qPrice = query(collection(db, "pintPrices"), orderBy("price"), limit(1));
  const priceSnap = await getDocs(qPrice);
  const hero = $("hero-content");

  if (priceSnap.empty) {
    hero.innerHTML = "<p>No prices yet.</p>";
    return;
  }

  const cheapest = priceSnap.docs[0].data();
  const pints = await getDocs(collection(db, "pintDefinitions"));
  const pubs  = await getDocs(collection(db, "pubs"));

  const pint = pints.docs.find(p => p.id === cheapest.pintId)?.data();
  const pub  = pubs.docs.find(p => p.id === cheapest.pubId)?.data();

  hero.innerHTML = `
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
   POPULARITY (Top 3 mobile + expandable)
========================================================== */
let popularityExpanded = false;

async function loadPopularityChart() {
  const pintSnap = await getDocs(collection(db, "pintDefinitions"));
  const priceSnap = await getDocs(collection(db, "pintPrices"));

  const counts = {};
  pintSnap.forEach(p => counts[p.id] = 0);
  priceSnap.forEach(pr => counts[pr.data().pintId]++);

  const sorted = pintSnap.docs
    .map(p => ({ name: p.data().name, count: counts[p.id] }))
    .sort((a,b) => b.count - a.count);

  const max = sorted[0]?.count || 1;

  const isMobile = window.innerWidth < 700;
  const limit = popularityExpanded ? sorted.length : (isMobile ? 3 : 5);
  const visible = sorted.slice(0, limit);

  const container = $("popularityChartContainer");
  container.innerHTML = "";

  visible.forEach(item => {
    container.innerHTML += `
      <div class="poll-label">${item.name} (${item.count})</div>
      <div class="poll-bar-wrapper">
        <div class="poll-bar" style="width:${(item.count/max)*100}%"></div>
      </div>
    `;
  });

  if (sorted.length > limit || popularityExpanded) {
    const btn = document.createElement("button");
    btn.id = "popularityExpandBtn";
    btn.className = "expand-btn";
    btn.textContent = popularityExpanded ? "Show Less ▲" : "Show More ▼";
    btn.onclick = () => {
      popularityExpanded = !popularityExpanded;
      loadPopularityChart();
    };
    container.appendChild(btn);
  }
}

/* ==========================================================
   MARKET TABLE
========================================================== */
let tableExpanded = false;

async function loadMarketTable() {
  const prices = await getDocs(collection(db, "pintPrices"));
  const pints = await getDocs(collection(db, "pintDefinitions"));
  const pubs  = await getDocs(collection(db, "pubs"));

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

  (tableExpanded ? rows : rows.slice(0,5)).forEach((r,i) => {
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
    buckets[key] = (buckets[key]||0) + 1;
  });

  const max = Math.max(...Object.values(buckets));
  const container = $("priceDistribution");

  container.innerHTML = Object.entries(buckets).map(([range,count]) => `
    <div class="dist-label">${range}</div>
    <div class="dist-bar-wrapper">
      <div class="dist-bar" style="width:${(count/max)*100}%"></div>
    </div>
  `).join("");
}

/* ==========================================================
   CHEAPEST PUBS
========================================================== */
async function loadCheapestPubs() {
  const prices = await getDocs(collection(db, "pintPrices"));
  const pubs  = await getDocs(collection(db, "pubs"));

  if (prices.empty) {
    $("cheapestPubs").innerHTML = "<p>No data.</p>";
    return;
  }

  const pubMap = {};
  pubs.forEach(p => pubMap[p.id] = p.data().name);

  const groups = {};
  prices.forEach(pr => {
    const d = pr.data();
    if (!groups[d.pubId]) groups[d.pubId] = [];
    groups[d.pubId].push(d.price);
  });

  const sorted = Object.entries(groups)
    .map(([id,vals]) => ({
      pub: pubMap[id],
      avg: vals.reduce((a,b)=>a+b,0) / vals.length
    }))
    .sort((a,b)=>a.avg - b.avg)
    .slice(0,5);

  $("cheapestPubs").innerHTML = sorted.map((p,i) => `
    <div class="pub-row">
      <span class="pub-rank">${i+1}.</span> ${p.pub} — £${p.avg.toFixed(2)}
    </div>
  `).join("");
}

/* ==========================================================
   RECOMMENDATIONS
========================================================== */
async function loadRecommendations() {
  const pricesSnap = await getDocs(collection(db, "pintPrices"));
  const pintsSnap  = await getDocs(collection(db, "pintDefinitions"));
  const pubsSnap   = await getDocs(collection(db, "pubs"));
  
  if (pricesSnap.empty) {
    $("recommendations").innerHTML = "<p>No data.</p>";
    return;
  }

  const pintMap = {}, pubMap = {};
  pintsSnap.forEach(p => pintMap[p.id] = p.data());
  pubsSnap.forEach(p => pubMap[p.id] = p.data());

  const values = pricesSnap.docs.map(d => d.data());

  const cheapest = [...values].sort((a,b)=>a.price-b.price)[0];

  const freq = {};
  values.forEach(v => freq[v.pintId] = (freq[v.pintId]||0)+1);
  const trending = Object.keys(freq).sort((a,b)=>freq[b]-freq[a])[0];

  $("recommendations").innerHTML = `
    <div class="rec-item">
      ⭐ Cheapest Pint:<br>
      <strong>${pintMap[cheapest.pintId].name}</strong> @ ${pubMap[cheapest.pubId].name} (£${cheapest.price})
    </div>

    <div class="rec-item">
      📈 Trending Pint:<br>
      <strong>${pintMap[trending].name}</strong> (most submissions)
    </div>

    <div class="rec-item">
      💡 Best Value:<br>
      <strong>${pintMap[cheapest.pintId].name}</strong> 
    </div>
  `;
}

/* ==========================================================
   RARE PINTS (NEW DESIGN)
========================================================== */
async function loadRarePints() {
  const pintsSnap = await getDocs(collection(db, "pintDefinitions"));
  const pricesSnap = await getDocs(collection(db, "pintPrices"));
  const pubsSnap = await getDocs(collection(db, "pubs"));

  const pubMap = {};
  pubsSnap.forEach(p => pubMap[p.id] = p.data().name);

  const count = {}, lastSeen = {};
  pintsSnap.forEach(p => count[p.id] = 0);

  pricesSnap.forEach(pr => {
    const d = pr.data();
    count[d.pintId]++;
    lastSeen[d.pintId] = d;
  });

  const rare = Object.keys(count).filter(id => count[id] < 3);

  $("rarePints").innerHTML = rare.map(id => {
    const pint = pintsSnap.docs.find(p=>p.id===id).data();
    const last = lastSeen[id];

    return `
      <div class="rare-card">
        <div class="rare-name">${pint.name}</div>
        <div class="rare-meta">📍 ${pubMap[last?.pubId] || "Unknown"}</div>
        <div class="rare-price">£${last?.price || "?"} — Rare (${count[id]} logged)</div>
      </div>
    `;
  }).join("");
}

/* ==========================================================
   COMPARE PINTS (NEW LAYOUT)
========================================================== */
async function comparePints() {
  const a = $("comparePintA").value;
  const b = $("comparePintB").value;

  if (!a || !b) return alert("Select two pints to compare");
  if (a === b) {
    $("comparisonResult").innerHTML = "Both selections are the same pint.";
    return;
  }

  const pricesSnap = await getDocs(collection(db, "pintPrices"));
  const pintsSnap = await getDocs(collection(db, "pintDefinitions"));

  const pintMap = {};
  pintsSnap.forEach(p => pintMap[p.id] = p.data().name);

  const prices = pricesSnap.docs.map(d => d.data());

  const bestA = prices.filter(p => p.pintId === a).sort((x,y)=>x.price-y.price)[0];
  const bestB = prices.filter(p => p.pintId === b).sort((x,y)=>x.price-y.price)[0];

  if (!bestA || !bestB) {
    $("comparisonResult").innerHTML = "Not enough data for comparison.";
    return;
  }

  $("comparisonResult").innerHTML = `
    <strong>${pintMap[a]}</strong><br>
    Cheapest Price: £${bestA.price}<br><br>

    <strong>${pintMap[b]}</strong><br>
    Cheapest Price: £${bestB.price}<br><br>

    <strong style="font-size:1.2rem;">
      ${bestA.price < bestB.price ? "👉 First pint is cheaper" : "👉 Second pint is cheaper"}
    </strong>
  `;
}

/* ==========================================================
   BUDGET PLANNER (NEW DESIGN)
========================================================== */
async function calculateBudget() {
  const budget = Number($("budgetInput").value);
  if (!budget) return alert("Enter budget");

  const pricesSnap = await getDocs(collection(db, "pintPrices"));
  const pintsSnap = await getDocs(collection(db, "pintDefinitions"));
  const pubsSnap = await getDocs(collection(db, "pubs"));

  const pintMap = {}, pubMap = {};
  pintsSnap.forEach(p => pintMap[p.id] = p.data().name);
  pubsSnap.forEach(p => pubMap[p.id] = p.data().name);

  const options = pricesSnap.docs.map(doc => {
    const d = doc.data();
    const count = Math.floor(budget / d.price);
    return {
      pint: pintMap[d.pintId],
      pub: pubMap[d.pubId],
      count,
      total: count * d.price,
      change: budget - count * d.price
    };
  }).filter(x => x.count > 0)
    .sort((a,b)=>b.count - a.count);

  if (!options.length) {
    $("budgetOutput").innerHTML = "Not enough budget.";
    return;
  }

  const best = options[0];

  $("budgetOutput").innerHTML = `
    🍺 <strong>${best.count}</strong> × ${best.pint}<br>
    📍 ${best.pub}<br><br>
    Total: <strong>£${best.total.toFixed(2)}</strong><br>
    Change: £${best.change.toFixed(2)}
  `;
}

/* ==========================================================
   TICKER
========================================================== */
async function loadTicker() {
  const pricesSnap = await getDocs(collection(db, "pintPrices"));
  const pintsSnap  = await getDocs(collection(db, "pintDefinitions"));

  if (pricesSnap.empty) {
    $("ticker").innerHTML = "No data yet.";
    return;
  }

  const vals = pricesSnap.docs.map(d => d.data());
  const cheapest = [...vals].sort((a,b)=>a.price-b.price)[0];
  const expensive = [...vals].sort((a,b)=>b.price-a.price)[0];
  const avg = (vals.reduce((a,b)=>a+b.price,0) / vals.length).toFixed(2);

  const freq = {};
  vals.forEach(v=>freq[v.pintId]=(freq[v.pintId]||0)+1);

  const popId = Object.keys(freq).sort((a,b)=>freq[b]-freq[a])[0];
  const popName = pintsSnap.docs.find(p=>p.id===popId).data().name;

  $("ticker").innerHTML = `
    Cheapest £${cheapest.price} ▼ |
    Index £${avg} |
    Popular: ${popName} |
    High £${expensive.price} ▲
  `;
}

/* ==========================================================
   ADMIN SYSTEM
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
