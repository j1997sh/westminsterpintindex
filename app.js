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

  // Hook up buttons
  document.getElementById("addPubBtn").addEventListener("click", addPub);
  document.getElementById("addPintBtn").addEventListener("click", addPint);
  document.getElementById("addPriceBtn").addEventListener("click", addPrice);
  document.getElementById("compareBtn").addEventListener("click", comparePints);
  document.getElementById("budgetBtn").addEventListener("click", calculateBudget);
  document.getElementById("expandTableBtn").addEventListener("click", toggleTableExpand);

  // Load dynamic UI
  loadPubs();
  loadPints();
  loadCheapest();
  loadMarketTable();
  loadPopularityChart();
  loadPPI();
  loadRarePints();
  loadTicker();
});

/* ----------------------------------------------------------
   ADD PUB
---------------------------------------------------------- */
async function addPub() {
  await addDoc(collection(db, "pubs"), {
    name: document.getElementById("pubName").value,
    address: document.getElementById("pubAddress").value,
    createdAt: serverTimestamp()
  });

  loadPubs();
}

/* ----------------------------------------------------------
   ADD PINT
---------------------------------------------------------- */
async function addPint() {
  await addDoc(collection(db, "pintDefinitions"), {
    name: document.getElementById("pintName").value,
    category: document.getElementById("pintCategory").value,
    createdAt: serverTimestamp()
  });

  loadPints();
}

/* ----------------------------------------------------------
   ADD PRICE
---------------------------------------------------------- */
async function addPrice() {
  const price = Number(document.getElementById("pintPrice").value);
  if (!price || price <= 0) {
    alert("Enter a valid price above £0");
    return;
  }

  await addDoc(collection(db, "pintPrices"), {
    pubId: document.getElementById("pricePubSelect").value,
    pintId: document.getElementById("pricePintSelect").value,
    price: price,
    timestamp: serverTimestamp()
  });

  // Refresh dashboard
  loadCheapest();
  loadMarketTable();
  loadPopularityChart();
  loadPPI();
  loadRarePints();
  loadTicker();
}

/* ----------------------------------------------------------
   LOAD PUBS (dropdown)
---------------------------------------------------------- */
async function loadPubs() {
  const snap = await getDocs(collection(db, "pubs"));
  const select = document.getElementById("pricePubSelect");
  select.innerHTML = "";

  snap.forEach(doc => {
    const opt = document.createElement("option");
    opt.value = doc.id;
    opt.textContent = doc.data().name;
    select.appendChild(opt);
  });
}

/* ----------------------------------------------------------
   LOAD PINTS (dropdowns)
---------------------------------------------------------- */
async function loadPints() {
  const snap = await getDocs(collection(db, "pintDefinitions"));

  const selects = [
    document.getElementById("pricePintSelect"),
    document.getElementById("comparePintA"),
    document.getElementById("comparePintB")
  ];

  selects.forEach(sel => sel.innerHTML = "");

  snap.forEach(doc => {
    const opt = document.createElement("option");
    opt.value = doc.id;
    opt.textContent = doc.data().name;

    selects.forEach(sel => sel.appendChild(opt.cloneNode(true)));
  });
}

/* ----------------------------------------------------------
   LOAD CHEAPEST PINT (hero card)
---------------------------------------------------------- */
async function loadCheapest() {
  const qP = query(collection(db, "pintPrices"), orderBy("price"), limit(1));
  const cheapestSnap = await getDocs(qP);

  if (cheapestSnap.empty) {
    document.getElementById("hero-content").innerHTML = "<p>No price data yet.</p>";
    return;
  }

  const cheapest = cheapestSnap.docs[0].data();

  const pints = await getDocs(collection(db, "pintDefinitions"));
  const pubs  = await getDocs(collection(db, "pubs"));
  const allPrices = await getDocs(collection(db, "pintPrices"));

  const pint = pints.docs.find(d => d.id === cheapest.pintId)?.data();
  const pub  = pubs.docs.find(d => d.id === cheapest.pubId)?.data();

  // Trend logic
  const history = allPrices.docs
    .map(d => d.data())
    .filter(d => d.pintId === cheapest.pintId && d.pubId === cheapest.pubId)
    .sort((a, b) => b.timestamp - a.timestamp);

  let trend = "stable";
  let diff = 0;

  if (history.length >= 2) {
    const latest = history[0].price;
    const previous = history[1].price;
    diff = (latest - previous).toFixed(2);

    if (latest > previous) trend = "up";
    if (latest < previous) trend = "down";
  }

  // Update hero trend strip
  const strip = document.getElementById("hero-trend-strip");
  strip.style.background =
    trend === "up" ? "#DC2626" :
    trend === "down" ? "#16A34A" :
    "#D1D5DB";

  const trendLabel =
    trend === "up" ? `🔺 +£${Math.abs(diff)}` :
    trend === "down" ? `🔻 -£${Math.abs(diff)}` :
    "➡️ Stable today";

  // Render hero card
  document.getElementById("hero-content").innerHTML = `
    <div class="cheapest-name">🍺 ${pint.name} (${pint.category})</div>
    <div class="cheapest-price">£${cheapest.price}</div>
    <div class="cheapest-pub">📍 ${pub.name}</div>
    <div class="cheapest-trend">${trendLabel}</div>
  `;
}

/* ----------------------------------------------------------
   MARKET LEAGUE TABLE (top 5)
---------------------------------------------------------- */
let tableExpanded = false;

async function loadMarketTable() {

  const prices   = await getDocs(collection(db, "pintPrices"));
  const pints    = await getDocs(collection(db, "pintDefinitions"));
  const pubs     = await getDocs(collection(db, "pubs"));

  const pintMap = {}, pubMap = {};
  pints.forEach(p => pintMap[p.id] = p.data());
  pubs.forEach(p => pubMap[p.id] = p.data());

  const rows = prices.docs.map(doc => {
    const d = doc.data();
    return {
      pint: pintMap[d.pintId]?.name,
      category: pintMap[d.pintId]?.category,
      pub: pubMap[d.pubId]?.name,
      price: d.price
    };
  });

  rows.sort((a,b) => a.price - b.price);

  const tbody = document.getElementById("marketTableBody");
  tbody.innerHTML = "";

  const displayRows = tableExpanded ? rows : rows.slice(0, 5);

  displayRows.forEach((r, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${r.pint} (${r.category})</td>
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

/* ----------------------------------------------------------
   POPULARITY BARS (compact sidebar-like UI)
---------------------------------------------------------- */
async function loadPopularityChart() {
  const pints = await getDocs(collection(db, "pintDefinitions"));
  const prices = await getDocs(collection(db, "pintPrices"));

  const count = {};
  pints.forEach(p => count[p.id] = 0);
  prices.forEach(p => count[p.data().pintId]++);

  const sorted = pints.docs.map(doc => ({
    name: doc.data().name,
    count: count[doc.id]
  })).sort((a,b) => b.count - a.count);

  const max = sorted[0]?.count || 1;

  const container = document.getElementById("popularityChartContainer");
  container.innerHTML = sorted.map(item => `
      <div class="poll-label">${item.name}</div>
      <div class="poll-bar-wrapper">
        <div class="poll-bar" style="width:${(item.count/max)*100}%"></div>
      </div>
  `).join("");
}

/* ----------------------------------------------------------
   PPI INDEX (average)
---------------------------------------------------------- */
async function loadPPI() {
  const prices = await getDocs(collection(db, "pintPrices"));
  const values = prices.docs.map(d => d.data().price);

  const avg = (values.reduce((a,b)=>a+b,0) / values.length || 0).toFixed(2);
  document.getElementById("ppiOutput").textContent = `£${avg}`;
}

/* ----------------------------------------------------------
   COMPARE PINTS
---------------------------------------------------------- */
async function comparePints() {
  const A = document.getElementById("comparePintA").value;
  const B = document.getElementById("comparePintB").value;

  const prices = await getDocs(collection(db, "pintPrices"));

  const aVals = [], bVals = [];
  prices.forEach(doc => {
    const d = doc.data();
    if (d.pintId === A) aVals.push(d.price);
    if (d.pintId === B) bVals.push(d.price);
  });

  const avgA = (aVals.reduce((a,b)=>a+b,0) / aVals.length || 0).toFixed(2);
  const avgB = (bVals.reduce((a,b)=>a+b,0) / bVals.length || 0).toFixed(2);

  document.getElementById("comparisonResult").innerHTML = `
    Pint A avg: £${avgA}<br>
    Pint B avg: £${avgB}
  `;
}

/* ----------------------------------------------------------
   RARE PINTS
---------------------------------------------------------- */
async function loadRarePints() {
  const pints = await getDocs(collection(db, "pintDefinitions"));
  const prices = await getDocs(collection(db, "pintPrices"));
  const pubs   = await getDocs(collection(db, "pubs"));

  const pubMap = {};
  pubs.forEach(p => pubMap[p.id] = p.data().name);

  const count = {};
  const lastSeen = {};

  pints.forEach(p => count[p.id] = 0);

  prices.forEach(pr => {
    const d = pr.data();
    count[d.pintId]++;
    lastSeen[d.pintId] = d;
  });

  const rare = Object.keys(count).filter(id => count[id] < 3);

  const container = document.getElementById("rarePints");
  container.innerHTML = rare.map(id => {
    const pint = pints.docs.find(p => p.id === id).data();
    const latest = lastSeen[id];

    return `
      <div style="
        margin-bottom:16px;
        padding:18px;
        border-radius:18px;
        background:#FEF9C3;
        box-shadow:0 6px 14px rgba(0,0,0,0.06);
      ">
        <strong>${pint.name}</strong><br>
        📍 ${pubMap[latest?.pubId] || "Unknown"}<br>
        £${latest?.price || "?"}<br>
        ⭐ Rare (only ${count[id]} entries)
      </div>
    `;
  }).join("");
}

/* ----------------------------------------------------------
   BUDGET CALCULATOR
---------------------------------------------------------- */
async function calculateBudget() {
  const budget = Number(document.getElementById("budgetInput").value);
  if (!budget || budget <= 0) {
    document.getElementById("budgetOutput").textContent = "Enter a valid amount.";
    return;
  }

  const pricesSnap = await getDocs(collection(db, "pintPrices"));
  const pintsSnap  = await getDocs(collection(db, "pintDefinitions"));
  const pubsSnap   = await getDocs(collection(db, "pubs"));

  const pintMap = {}, pubMap = {};
  pintsSnap.forEach(p => pintMap[p.id] = p.data().name);
  pubsSnap.forEach(p => pubMap[p.id] = p.data().name);

  const options = [];

  pricesSnap.forEach(pr => {
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
    Best value: ${best.count}× ${best.pint} @ ${best.pub}<br>
    Total £${best.total.toFixed(2)} — Change £${best.change.toFixed(2)}<br><br>
    Top options:<br>
    ${options.slice(0,3).map(o =>
      `${o.count}× ${o.pint} @ ${o.pub} (£${o.total.toFixed(2)})`
    ).join("<br>")}
  `;
}

/* ----------------------------------------------------------
   TICKER (Cheapest, Index, Popular)
---------------------------------------------------------- */
async function loadTicker() {
  const prices = await getDocs(collection(db, "pintPrices"));
  const pints  = await getDocs(collection(db, "pintDefinitions"));

  if (prices.empty) {
    document.getElementById("ticker").textContent = "No data yet";
    return;
  }

  const vals = prices.docs.map(d => d.data());

  const cheapest = [...vals].sort((a,b)=>a.price-b.price)[0];
  const expensive = [...vals].sort((a,b)=>b.price-a.price)[0];

  const avg = (vals.reduce((a,b)=>a+b.price,0) / vals.length).toFixed(2);

  // Popular pint
  const freq = {};
  vals.forEach(v => freq[v.pintId] = (freq[v.pintId] || 0) + 1);

  const popularId = Object.keys(freq).sort((a,b)=>freq[b]-freq[a])[0];
  const popular = pints.docs.find(p => p.id === popularId).data().name;

  document.getElementById("ticker").innerHTML = `
    Cheapest: £${cheapest.price} <span class="ticker-down">▼</span> |
    Index: £${avg} |
    Popular: ${popular} |
    Highest: £${expensive.price} <span class="ticker-up">▲</span>
  `;
}
