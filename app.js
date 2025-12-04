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
   INITIALISE APP
---------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {

  // Accordion functionality
  document.querySelectorAll(".accordion-header").forEach(header => {
    header.addEventListener("click", () => {
      const body = header.nextElementSibling;
      const isOpen = body.style.display === "block";

      document.querySelectorAll(".accordion-body").forEach(b => b.style.display = "none");
      if (!isOpen) body.style.display = "block";
    });
  });

  // Form handlers
  document.getElementById("addPubBtn").addEventListener("click", addPub);
  document.getElementById("addPintBtn").addEventListener("click", addPint);
  document.getElementById("addPriceBtn").addEventListener("click", addPrice);
  document.getElementById("compareBtn").addEventListener("click", comparePints);
  document.getElementById("budgetBtn").addEventListener("click", calculateBudget);
  document.getElementById("expandTableBtn").addEventListener("click", toggleTableExpand);

  // Loads
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
   ADD PINT TYPE
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
   ADD PRICE ENTRY
---------------------------------------------------------- */
async function addPrice() {
  const price = Number(document.getElementById("pintPrice").value);

  if (!price || price < 1) {
    alert("Enter a valid price");
    return;
  }

  await addDoc(collection(db, "pintPrices"), {
    pubId: document.getElementById("pricePubSelect").value,
    pintId: document.getElementById("pricePintSelect").value,
    price: price,
    timestamp: serverTimestamp()
  });

  loadCheapest();
  loadMarketTable();
  loadPopularityChart();
  loadPPI();
  loadRarePints();
  loadTicker();
}


/* ----------------------------------------------------------
   LOAD PUB OPTIONS
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
   LOAD PINT OPTIONS
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
    selects.forEach(sel => {
      const opt = document.createElement("option");
      opt.value = doc.id;
      opt.textContent = doc.data().name;
      sel.appendChild(opt.cloneNode(true));
    });
  });
}


/* ----------------------------------------------------------
   LOAD CHEAPEST PINT (FINTECH STYLE)
---------------------------------------------------------- */
async function loadCheapest() {

  // Get cheapest price
  const qP = query(collection(db, "pintPrices"), orderBy("price"), limit(1));
  const cheapestSnap = await getDocs(qP);

  if (cheapestSnap.empty) return;

  const cheapest = cheapestSnap.docs[0].data();

  const pintSnap = await getDocs(collection(db, "pintDefinitions"));
  const pubSnap  = await getDocs(collection(db, "pubs"));

  const pint = pintSnap.docs.find(d => d.id === cheapest.pintId)?.data();
  const pub  = pubSnap.docs.find(d => d.id === cheapest.pubId)?.data();

  // Trend calculation
  const allPrices = await getDocs(collection(db, "pintPrices"));
  const history = allPrices.docs
    .filter(d => d.data().pintId === cheapest.pintId && d.data().pubId === cheapest.pubId)
    .map(d => d.data())
    .sort((a,b) => b.timestamp - a.timestamp);

  let trend = "stable";
  let diff = 0;

  if (history.length >= 2) {
    const latest = history[0].price;
    const previous = history[1].price;
    diff = (latest - previous).toFixed(2);

    if (latest > previous) trend = "up";
    if (latest < previous) trend = "down";
  }

  // Trend strip colour
  const strip = document.getElementById("cheapestTrend");
  strip.style.background =
    trend === "up" ? "#EF4444" :
    trend === "down" ? "#10B981" :
    "#D1D5DB";

  // Trend label
  const trendLabel =
    trend === "up" ? `🔺 +£${Math.abs(diff)}` :
    trend === "down" ? `🔻 -£${Math.abs(diff)}` :
    "➡️ Stable today";

  // Render tile
  document.getElementById("cheapestContent").innerHTML = `
      <div class="cheapest-name">🍺 ${pint.name} (${pint.category})</div>
      <div class="cheapest-price">£${cheapest.price}</div>
      <div class="cheapest-pub">📍 ${pub.name}</div>
      <div class="cheapest-trend">${trendLabel}</div>
  `;
}


/* ----------------------------------------------------------
   MARKET TABLE (TOP 5 + EXPAND)
---------------------------------------------------------- */
let tableExpanded = false;

async function loadMarketTable() {

  const pricesSnap = await getDocs(collection(db, "pintPrices"));
  const pintsSnap  = await getDocs(collection(db, "pintDefinitions"));
  const pubsSnap   = await getDocs(collection(db, "pubs"));

  const pintMap = {}, pubMap = {};

  pintsSnap.forEach(d => pintMap[d.id] = d.data());
  pubsSnap.forEach(d => pubMap[d.id] = d.data());

  const rows = pricesSnap.docs.map(doc => {
    const d = doc.data();
    return {
      price: d.price,
      pint: pintMap[d.pintId]?.name,
      category: pintMap[d.pintId]?.category,
      pub: pubMap[d.pubId]?.name
    };
  });

  rows.sort((a,b) => a.price - b.price);

  const tbody = document.getElementById("marketTableBody");
  tbody.innerHTML = "";

  const items = tableExpanded ? rows : rows.slice(0,5);

  items.forEach((row, i) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${row.pint} (${row.category})</td>
      <td>${row.pub}</td>
      <td><strong>£${row.price.toFixed(2)}</strong></td>
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
   POPULARITY CHART
---------------------------------------------------------- */
async function loadPopularityChart() {

  const pints = await getDocs(collection(db, "pintDefinitions"));
  const prices = await getDocs(collection(db, "pintPrices"));

  const counts = {};
  pints.forEach(doc => counts[doc.id] = 0);
  prices.forEach(doc => counts[doc.data().pintId]++);

  const results = pints.docs.map(doc => ({
    name: doc.data().name,
    count: counts[doc.id]
  })).sort((a,b) => b.count - a.count);

  const max = results[0]?.count || 1;

  const container = document.getElementById("popularityChartContainer");
  container.innerHTML = results.map(r => `
      <div class="poll-label">${r.name}</div>
      <div class="poll-bar-wrapper">
        <div class="poll-bar" style="width:${(r.count/max)*100}%"></div>
      </div>
  `).join("");
}


/* ----------------------------------------------------------
   PPI INDEX (AVERAGE PRICE)
---------------------------------------------------------- */
async function loadPPI() {
  const pricesSnap = await getDocs(collection(db, "pintPrices"));
  const values = pricesSnap.docs.map(d => d.data().price);

  const avg = (values.reduce((a,b)=>a+b,0) / values.length || 0).toFixed(2);

  document.getElementById("ppiOutput").innerHTML = `£${avg}`;
}


/* ----------------------------------------------------------
   COMPARE TWO PINTS
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
      🍺 Pint A avg: £${avgA}<br>
      🍺 Pint B avg: £${avgB}
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
  pubs.forEach(d => pubMap[d.id] = d.data().name);

  const count = {};
  pints.forEach(p => count[p.id] = 0);

  const latest = {};

  prices.forEach(p => {
    const d = p.data();
    count[d.pintId]++;
    latest[d.pintId] = d;
  });

  const rare = Object.keys(count).filter(id => count[id] < 3);

  const container = document.getElementById("rarePints");
  container.innerHTML = rare.map(id => {
    const pint = pints.docs.find(p => p.id === id).data();
    const last = latest[id];

    return `
      <div class="tile" style="padding:20px;background:#FEF9C3;">
        <strong>${pint.name}</strong><br>
        📍 ${pubMap[last?.pubId] || "Unknown"}<br>
        💷 £${last?.price || "?"}<br>
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
    document.getElementById("budgetOutput").textContent = "Enter a valid budget.";
    return;
  }

  const pricesSnap = await getDocs(collection(db, "pintPrices"));
  const pintsSnap  = await getDocs(collection(db, "pintDefinitions"));
  const pubsSnap   = await getDocs(collection(db, "pubs"));

  const pintMap = {};
  const pubMap  = {};

  pintsSnap.forEach(p => pintMap[p.id] = p.data().name);
  pubsSnap.forEach(p => pubMap[p.id] = p.data().name);

  const options = [];

  pricesSnap.docs.forEach(pr => {
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
      <div class="big-number">
        Best value: ${best.count}× ${best.pint}
      </div>
      At ${best.pub}<br>
      Total £${best.total.toFixed(2)} (change £${best.change.toFixed(2)})<br><br>

      <strong>Top options:</strong><br>
      ${options.slice(0,3).map(o =>
        `${o.count}× ${o.pint} at ${o.pub} (£${o.total.toFixed(2)})`
      ).join("<br>")}
  `;
}


/* ----------------------------------------------------------
   LIVE TICKER
---------------------------------------------------------- */
async function loadTicker() {

  const pricesSnap = await getDocs(collection(db, "pintPrices"));
  const pintsSnap  = await getDocs(collection(db, "pintDefinitions"));

  if (pricesSnap.empty) {
    document.getElementById("ticker").textContent = "No data yet";
    return;
  }

  const prices = pricesSnap.docs.map(d => d.data());

  // Cheapest / most expensive
  const cheapest = [...prices].sort((a,b)=>a.price-b.price)[0];
  const expensive = [...prices].sort((a,b)=>b.price-a.price)[0];

  // Index
  const avg = (prices.reduce((a,b)=>a+b.price,0) / prices.length).toFixed(2);

  // Popular pint
  const freq = {};
  prices.forEach(p => freq[p.pintId] = (freq[p.pintId] || 0) + 1);
  const popularId = Object.keys(freq).sort((a,b)=>freq[b]-freq[a])[0];
  const popular = pintsSnap.docs.find(p => p.id === popularId).data().name;

  document.getElementById("ticker").innerHTML = `
      Cheapest: £${cheapest.price} <span class="ticker-down">▼</span> |
      Index: £${avg} |
      Expensive: £${expensive.price} <span class="ticker-up">▲</span> |
      Popular: ${popular}
  `;
}
