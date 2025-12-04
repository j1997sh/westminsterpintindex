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

/* ----------------------------------------------------------
   INITIAL LOAD
---------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {

  // Bind actions
  document.getElementById("addPubBtn").addEventListener("click", addPub);
  document.getElementById("addPintBtn").addEventListener("click", addPint);
  document.getElementById("addPriceBtn").addEventListener("click", addPrice);
  document.getElementById("compareBtn").addEventListener("click", comparePints);
  document.getElementById("budgetBtn").addEventListener("click", calculateBudget);
  document.getElementById("expandTableBtn").addEventListener("click", toggleTableExpand);

  // Load all dynamic dashboard modules
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
  const name = document.getElementById("pubName").value.trim();
  const addr = document.getElementById("pubAddress").value.trim();

  if (!name) return alert("Enter a pub name");

  await addDoc(collection(db, "pubs"), {
    name,
    address: addr,
    createdAt: serverTimestamp()
  });

  loadPubs();
}



/* ==========================================================
   ADD PINT TYPE
========================================================== */
async function addPint() {
  const name = document.getElementById("pintName").value.trim();
  const cat = document.getElementById("pintCategory").value.trim();

  if (!name || !cat) return alert("Fill both fields");

  await addDoc(collection(db, "pintDefinitions"), {
    name,
    category: cat,
    createdAt: serverTimestamp()
  });

  loadPints();
}



/* ==========================================================
   ADD PINT PRICE
========================================================== */
async function addPrice() {
  const price = Number(document.getElementById("pintPrice").value);

  if (!price || price <= 0) {
    alert("Enter a valid price above £0.");
    return;
  }

  await addDoc(collection(db, "pintPrices"), {
    pubId: document.getElementById("pricePubSelect").value,
    pintId: document.getElementById("pricePintSelect").value,
    price: price,
    timestamp: serverTimestamp()
  });

  // Refresh ALL dashboards
  loadCheapest();
  loadPPI();
  loadPopularityChart();
  loadMarketTable();
  loadPriceDistribution();
  loadCheapestPubs();
  loadRecommendations();
  loadTicker();
  loadRarePints();
}



/* ==========================================================
   LOAD PUBS INTO SELECT BOX
========================================================== */
async function loadPubs() {
  const snap = await getDocs(collection(db, "pubs"));
  const sel = document.getElementById("pricePubSelect");
  sel.innerHTML = "";

  snap.forEach(doc => {
    const opt = document.createElement("option");
    opt.value = doc.id;
    opt.textContent = doc.data().name;
    sel.appendChild(opt);
  });
}



/* ==========================================================
   LOAD PINT TYPES INTO SELECT BOXES
========================================================== */
async function loadPints() {
  const snap = await getDocs(collection(db, "pintDefinitions"));

  const selects = [
    document.getElementById("pricePintSelect"),
    document.getElementById("comparePintA"),
    document.getElementById("comparePintB")
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
   HERO CHEAPEST PINT
========================================================== */
async function loadCheapest() {

  const qPrice = query(collection(db, "pintPrices"), orderBy("price"), limit(1));
  const cheapestSnap = await getDocs(qPrice);

  if (cheapestSnap.empty) {
    document.getElementById("hero-content").innerHTML = "<p>No prices yet.</p>";
    return;
  }

  const cheapest = cheapestSnap.docs[0].data();

  const pints = await getDocs(collection(db, "pintDefinitions"));
  const pubs = await getDocs(collection(db, "pubs"));
  const allPrices = await getDocs(collection(db, "pintPrices"));

  const pint = pints.docs.find(p => p.id === cheapest.pintId)?.data();
  const pub  = pubs.docs.find(p => p.id === cheapest.pubId)?.data();

  // TREND LOGIC
  const history = allPrices.docs
    .map(d => d.data())
    .filter(d => d.pintId === cheapest.pintId && d.pubId === cheapest.pubId)
    .sort((a,b) => b.timestamp - a.timestamp);

  let trend = "stable";
  let diff = 0;

  if (history.length >= 2) {
    const latest = history[0].price;
    const prev   = history[1].price;
    diff = (latest - prev).toFixed(2);

    if (latest > prev) trend = "up";
    if (latest < prev) trend = "down";
  }

  const strip = document.getElementById("hero-trend-strip");
  strip.style.background =
    trend === "up" ? "#DC2626" :     // red
    trend === "down" ? "#16A34A" :   // green
    "#D1D5DB";                       // grey

  const trendLabel =
    trend === "up" ? `🔺 +£${Math.abs(diff)}` :
    trend === "down" ? `🔻 -£${Math.abs(diff)}` :
    "➡️ Stable today";

  // Render HERO card
  document.getElementById("hero-content").innerHTML = `
    <div class="cheapest-name">🍺 ${pint.name} (${pint.category})</div>
    <div class="cheapest-price">£${cheapest.price}</div>
    <div class="cheapest-pub">📍 ${pub.name}</div>
    <div class="cheapest-trend">${trendLabel}</div>
  `;
}



/* ==========================================================
   PINT INDEX (average)
========================================================== */
async function loadPPI() {
  const snap = await getDocs(collection(db, "pintPrices"));
  const vals = snap.docs.map(d => d.data().price);

  const avg = (vals.reduce((a,b)=>a+b,0) / vals.length || 0).toFixed(2);
  document.getElementById("ppiOutput").textContent = `£${avg}`;
}



/* ==========================================================
   POPULARITY BARS
========================================================== */
async function loadPopularityChart() {
  const pints = await getDocs(collection(db, "pintDefinitions"));
  const prices = await getDocs(collection(db, "pintPrices"));

  const count = {};
  pints.forEach(p => count[p.id] = 0);
  prices.forEach(pr => count[pr.data().pintId]++);

  const sorted = pints.docs.map(doc => ({
    name: doc.data().name,
    count: count[doc.id]
  })).sort((a,b) => b.count - a.count);

  const max = sorted[0]?.count || 1;

  const out = sorted.map(r => `
    <div class="poll-label">${r.name}</div>
    <div class="poll-bar-wrapper">
      <div class="poll-bar" style="width:${(r.count/max)*100}%"></div>
    </div>
  `).join("");

  document.getElementById("popularityChartContainer").innerHTML = out;
}



/* ==========================================================
   MARKET TABLE (League Table)
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
      cat: pintMap[d.pintId]?.category,
      pub: pubMap[d.pubId]?.name,
      price: d.price
    };
  });

  rows.sort((a,b)=>a.price - b.price);

  const tbody = document.getElementById("marketTableBody");
  tbody.innerHTML = "";

  const display = tableExpanded ? rows : rows.slice(0,5);

  display.forEach((r,i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i+1}</td>
      <td>${r.pint} (${r.cat})</td>
      <td>${r.pub}</td>
      <td><strong>£${r.price.toFixed(2)}</strong></td>
    `;
    tbody.appendChild(tr);
  });
}

function toggleTableExpand() {
  tableExpanded = !tableExpanded;
  loadMarketTable();
  document.getElementById("expandTableBtn").textContent =
    tableExpanded ? "Show Top 5 ▲" : "Show Full Table ▼";
}



/* ==========================================================
   PINT INTELLIGENCE — PRICE DISTRIBUTION
========================================================== */

async function loadPriceDistribution() {
  const prices = await getDocs(collection(db, "pintPrices"));
  const values = prices.docs.map(d => d.data().price);

  if (values.length === 0) {
    document.getElementById("priceDistribution").innerHTML = "<p>No data yet.</p>";
    return;
  }

  // Create price buckets (£5–£6, £6–£7, etc)
  const buckets = {};
  values.forEach(v => {
    const floor = Math.floor(v);
    const label = `£${floor}–£${floor+1}`;
    buckets[label] = (buckets[label] || 0) + 1;
  });

  const max = Math.max(...Object.values(buckets));

  const html = Object.entries(buckets).map(([range,count]) => `
    <div class="dist-label">${range}</div>
    <div class="dist-bar-wrapper">
      <div class="dist-bar" style="width:${(count/max)*100}%"></div>
    </div>
  `).join("");

  document.getElementById("priceDistribution").innerHTML = html;
}



/* ==========================================================
   PINT INTELLIGENCE — TOP 5 CHEAPEST PUBS
========================================================== */

async function loadCheapestPubs() {
  const prices = await getDocs(collection(db, "pintPrices"));
  const pubs   = await getDocs(collection(db, "pubs"));

  const pubNames = {};
  pubs.forEach(p => pubNames[p.id] = p.data().name);

  const groups = {}; // pubId → [prices]
  prices.forEach(pr => {
    const d = pr.data();
    if (!groups[d.pubId]) groups[d.pubId] = [];
    groups[d.pubId].push(d.price);
  });

  const averages = Object.entries(groups)
    .map(([pubId,vals]) => ({
      pubId,
      pubName: pubNames[pubId],
      avg: vals.reduce((a,b)=>a+b,0) / vals.length
    }))
    .sort((a,b)=>a.avg - b.avg)
    .slice(0,5);

  const html = averages.map((p,i) => `
    <div class="pub-row">
      <span class="pub-rank">${i+1}.</span>
      ${p.pubName} — £${p.avg.toFixed(2)}
    </div>
  `).join("");

  document.getElementById("cheapestPubs").innerHTML = html;
}



/* ==========================================================
   PINT INTELLIGENCE — RECOMMENDATIONS
========================================================== */

async function loadRecommendations() {
  const pricesSnap = await getDocs(collection(db, "pintPrices"));
  const pintsSnap  = await getDocs(collection(db, "pintDefinitions"));
  const pubsSnap   = await getDocs(collection(db, "pubs"));

  const pints = {};
  pintsSnap.forEach(p => pints[p.id] = p.data());

  const pubs = {};
  pubsSnap.forEach(p => pubs[p.id] = p.data());

  const prices = pricesSnap.docs.map(d => d.data());

  if (prices.length === 0) {
    document.getElementById("recommendations").innerHTML = "<p>No data yet.</p>";
    return;
  }

  // Cheapest overall
  const cheapest = [...prices].sort((a,b)=>a.price - b.price)[0];

  // Trending: most submissions (like popularity)
  const freq = {};
  prices.forEach(p => freq[p.pintId] = (freq[p.pintId] || 0) + 1);
  const trendingId = Object.keys(freq).sort((a,b)=>freq[b] - freq[a])[0];

  // Best value (min price per category, future-improvable)
  const bestValue = cheapest; // simple version for MVP

  // Render
  document.getElementById("recommendations").innerHTML = `
    <div class="rec-item">
      ⭐ Cheapest Pint Right Now:<br>
      <strong>${pints[cheapest.pintId].name}</strong> @ ${pubs[cheapest.pubId].name} (£${cheapest.price})
    </div>

    <div class="rec-item">
      📈 Trending Pint:<br>
      <strong>${pints[trendingId].name}</strong> (most entries)
    </div>

    <div class="rec-item">
      💡 Best Value Suggestion:<br>
      <strong>${pints[bestValue.pintId].name}</strong> @ ${pubs[bestValue.pubId].name}
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

  const pubMap = {};
  pubs.forEach(p => pubMap[p.id] = p.data().name);

  const count = {};
  const latest = {};

  pints.forEach(p => count[p.id] = 0);

  prices.forEach(pr => {
    const d = pr.data();
    count[d.pintId]++;
    latest[d.pintId] = d;
  });

  const rare = Object.keys(count).filter(id => count[id] < 3);

  const html = rare.map(id => {
    const pint = pints.docs.find(p => p.id === id).data();
    const entry = latest[id];

    return `
      <div style="
        background:#FEF9C3;
        padding:18px;
        border-radius:18px;
        margin-bottom:12px;
        box-shadow:0 6px 14px rgba(0,0,0,0.06);
      ">
        <strong>${pint.name}</strong><br>
        📍 ${pubMap[entry?.pubId] || "Unknown"}<br>
        £${entry?.price || "?"}<br>
        ⭐ Rare (only ${count[id]} entries)
      </div>
    `;
  }).join("");

  document.getElementById("rarePints").innerHTML = html;
}



/* ==========================================================
   BUDGET PLANNER
========================================================== */

async function calculateBudget() {
  const budget = Number(document.getElementById("budgetInput").value);
  if (!budget || budget <= 0) {
    document.getElementById("budgetOutput").innerHTML = "Enter a valid budget.";
    return;
  }

  const prices = await getDocs(collection(db, "pintPrices"));
  const pints  = await getDocs(collection(db, "pintDefinitions"));
  const pubs   = await getDocs(collection(db, "pubs"));

  const pintMap = {}, pubMap = {};
  pints.forEach(p => pintMap[p.id] = p.data().name);
  pubs.forEach(p => pubMap[p.id] = p.data().name);

  const options = [];

  prices.forEach(pr => {
    const d = pr.data();
    const count = Math.floor(budget / d.price);
    if (count > 0) {
      const total = count * d.price;
      const change = budget - total;
      options.push({
        pint: pintMap[d.pintId],
        pub: pubMap[d.pubId],
        count,
        total,
        change
      });
    }
  });

  options.sort((a,b)=>b.count - a.count);

  const best = options[0];

  document.getElementById("budgetOutput").innerHTML = `
    Best value: ${best.count}× <strong>${best.pint}</strong> @ ${best.pub}<br>
    Total £${best.total.toFixed(2)} — Change £${best.change.toFixed(2)}<br><br>
    Top choices:<br>
    ${options.slice(0,3).map(o => 
      `${o.count}× ${o.pint} @ ${o.pub} (£${o.total.toFixed(2)})`
    ).join("<br>")}
  `;
}



/* ==========================================================
   TICKER
========================================================== */

async function loadTicker() {
  const prices = await getDocs(collection(db, "pintPrices"));
  const pints = await getDocs(collection(db, "pintDefinitions"));

  if (prices.empty) {
    document.getElementById("ticker").textContent = "No market data yet";
    return;
  }

  const vals = prices.docs.map(d => d.data());

  const cheapest = [...vals].sort((a,b)=>a.price-b.price)[0];
  const expensive = [...vals].sort((a,b)=>b.price-a.price)[0];
  const avg = (vals.reduce((a,b)=>a+b.price,0) / vals.length).toFixed(2);

  // Popular pint
  const freq = {};
  vals.forEach(v => freq[v.pintId] = (freq[v.pintId] || 0) + 1);

  const popId = Object.keys(freq).sort((a,b)=>freq[b]-freq[a])[0];
  const popName = pints.docs.find(p => p.id === popId).data().name;

  document.getElementById("ticker").innerHTML = `
    Cheapest: £${cheapest.price} <span class="ticker-down">▼</span> |
    Index: £${avg} |
    Popular: ${popName} |
    High: £${expensive.price} <span class="ticker-up">▲</span>
  `;
}
