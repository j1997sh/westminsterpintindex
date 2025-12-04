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

  // Accordion Logic
  document.querySelectorAll(".accordion-header").forEach(header => {
    header.addEventListener("click", () => {
      const body = header.nextElementSibling;
      const isOpen = body.style.display === "block";

      document.querySelectorAll(".accordion-body").forEach(b => b.style.display = "none");
      if (!isOpen) body.style.display = "block";
    });
  });

  // Buttons
  document.getElementById("addPubBtn").addEventListener("click", addPub);
  document.getElementById("addPintBtn").addEventListener("click", addPint);
  document.getElementById("addPriceBtn").addEventListener("click", addPrice);
  document.getElementById("compareBtn").addEventListener("click", comparePints);
  document.getElementById("budgetBtn").addEventListener("click", calculateBudget);
  document.getElementById("expandTableBtn").addEventListener("click", toggleTableExpand);

  // Load data
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
   LOAD PUBS
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
   LOAD PINTS
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
   CHEAPEST PINT (with trend)
---------------------------------------------------------- */
async function loadCheapest() {
  const qPrice = query(collection(db, "pintPrices"), orderBy("price"), limit(1));
  const cheapestSnap = await getDocs(qPrice);
  if (cheapestSnap.empty) return;

  const cheapest = cheapestSnap.docs[0].data();

  // Fetch pint + pub names
  const pintSnap = await getDocs(collection(db, "pintDefinitions"));
  const pubSnap  = await getDocs(collection(db, "pubs"));

  const pint = pintSnap.docs.find(d => d.id === cheapest.pintId)?.data();
  const pub  = pubSnap.docs.find(d => d.id === cheapest.pubId)?.data();

  // TREND LOGIC
  const allPrices = await getDocs(collection(db, "pintPrices"));
  const sameEntries = allPrices.docs
    .map(d => d.data())
    .filter(d => d.pintId === cheapest.pintId && d.pubId === cheapest.pubId)
    .sort((a, b) => b.timestamp - a.timestamp);

  let trend = "stable";
  let diff = 0;

  if (sameEntries.length >= 2) {
    const latest = sameEntries[0].price;
    const prev   = sameEntries[1].price;
    diff = (latest - prev).toFixed(2);

    if (latest > prev) trend = "up";
    if (latest < prev) trend = "down";
  }

  // Apply trend colour strip
  const strip = document.getElementById("cheapestTrend");
  if (trend === "up") strip.style.background = "#EF4444";
  else if (trend === "down") strip.style.background = "#10B981";
  else strip.style.background = "#D1D5DB";

  // Trend label
  let trendLabel = "➡️ Stable today";
  if (trend === "up") trendLabel = `🔺 +£${Math.abs(diff)}`;
  if (trend === "down") trendLabel = `🔻 -£${Math.abs(diff)}`;

  // Render
  document.getElementById("cheapestContent").innerHTML = `
    <div class="cheapest-name">🍺 ${pint.name} (${pint.category})</div>
    <div class="cheapest-price">£${cheapest.price}</div>
    <div class="cheapest-pub">📍 ${pub.name}</div>
    <div class="cheapest-trend">${trendLabel}</div>
  `;
}

/* ----------------------------------------------------------
   MARKET TABLE (Top 5 + Expand to Full Table)
---------------------------------------------------------- */
let tableExpanded = false;

async function loadMarketTable() {
  const pricesSnap = await getDocs(collection(db, "pintPrices"));
  const pintsSnap  = await getDocs(collection(db, "pintDefinitions"));
  const pubsSnap   = await getDocs(collection(db, "pubs"));

  const pintMap = {};
  const pubMap = {};

  pintsSnap.forEach(d => pintMap[d.id] = d.data());
  pubsSnap.forEach(d => pubMap[d.id] = d.data());

  const rows = [];

  pricesSnap.forEach(doc => {
    const d = doc.data();
    rows.push({
      price: d.price,
      pint: pintMap[d.pintId]?.name,
      category: pintMap[d.pintId]?.category,
      pub: pubMap[d.pubId]?.name
    });
  });

  // Sort cheapest first
  rows.sort((a, b) => a.price - b.price);

  const tbody = document.getElementById("marketTableBody");
  tbody.innerHTML = "";

  const displayed = tableExpanded ? rows : rows.slice(0, 5);

  displayed.forEach((row, i) => {
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

/* Expand button */
function toggleTableExpand() {
  tableExpanded = !tableExpanded;
  loadMarketTable();

  const btn = document.getElementById("expandTableBtn");
  btn.textContent = tableExpanded ? "Show Top 5 ▲" : "Show Full Table ▼";
}

/* ----------------------------------------------------------
   POPULARITY POLL BARS
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
  })).sort((a, b) => b.count - a.count);

  const max = results[0]?.count || 1;

  const container = document.getElementById("popularityChartContainer");
  container.innerHTML = results.map(r => `
    <div class="poll-bar-container">
      <div class="poll-label">${r.name}</div>
      <div class="poll-bar-wrapper">
        <div class="poll-bar" style="width:${(r.count / max) * 100}%"></div>
      </div>
    </div>
  `).join("");
}

/* ----------------------------------------------------------
   INDEX (Average Price)
---------------------------------------------------------- */
async function loadPPI() {
  const prices = await getDocs(collection(db, "pintPrices"));
  let total = 0, count = 0;

  prices.forEach(d => {
    total += d.data().price;
    count++;
  });

  const index = (total / count || 0).toFixed(2);
  document.getElementById("ppiOutput").innerHTML = `📈 £${index}`;
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
    if (doc.data().pintId === A) aVals.push(doc.data().price);
    if (doc.data().pintId === B) bVals.push(doc.data().price);
  });

  const avgA = aVals.reduce((a,b)=>a+b, 0) / aVals.length || 0;
  const avgB = bVals.reduce((a,b)=>a+b, 0) / bVals.length || 0;

  document.getElementById("comparisonResult").innerHTML = `
    🍺 Pint A average: £${avgA.toFixed(2)}<br>
    🍺 Pint B average: £${avgB.toFixed(2)}
  `;
}

/* ----------------------------------------------------------
   RARE PINTS
---------------------------------------------------------- */
async function loadRarePints() {
  const pints = await getDocs(collection(db, "pintDefinitions"));
  const prices = await getDocs(collection(db, "pintPrices"));
  const pubs = await getDocs(collection(db, "pubs"));

  const pubMap = {};
  pubs.forEach(doc => pubMap[doc.id] = doc.data().name);

  const count = {};
  const latest = {};
  pints.forEach(p => count[p.id] = 0);

  prices.forEach(pr => {
    const d = pr.data();
    count[d.pintId]++;
    latest[d.pintId] = d;
  });

  const rare = Object.keys(count).filter(id => count[id] < 3);

  const out = document.getElementById("rarePints");
  out.innerHTML = rare.map(id => `
    <div class="stock-card">
      🌟 <strong>${pints.docs.find(p => p.id === id).data().name}</strong><br>
      📍 ${pubMap[latest[id]?.pubId] || "Unknown"}<br>
      💷 £${latest[id]?.price || "?"}<br>
      ⭐ Rare (only ${count[id]} entries)
    </div>
  `).join("");
}

/* ----------------------------------------------------------
   BUDGET PLANNER
---------------------------------------------------------- */
async function calculateBudget() {
  const budget = Number(document.getElementById("budgetInput").value);
  if (!budget || budget <= 0) {
    document.getElementById("budgetOutput").innerHTML = "⚠️ Enter a valid budget.";
    return;
  }

  const pricesSnap = await getDocs(collection(db, "pintPrices"));
  const pintsSnap  = await getDocs(collection(db, "pintDefinitions"));
  const pubsSnap   = await getDocs(collection(db, "pubs"));

  const pintMap = {};
  const pubMap = {};

  pintsSnap.forEach(p => pintMap[p.id] = p.data().name);
  pubsSnap.forEach(p => pubMap[p.id] = p.data().name);

  const results = [];

  pricesSnap.forEach(pr => {
    const d = pr.data();
    const count = Math.floor(budget / d.price);

    if (count > 0) {
      const total = count * d.price;
      const change = budget - total;

      results.push({
        pint: pintMap[d.pintId],
        pub: pubMap[d.pubId],
        price: d.price,
        count,
        total,
        change
      });
    }
  });

  results.sort((a, b) => b.count - a.count);

  const best = results[0];
  const topThree = results.slice(0, 3);

  document.getElementById("budgetOutput").innerHTML = `
    <h3>🏆 Best Value Buy</h3>
    ${best.count} × ${best.pint} @ ${best.pub}<br>
    £${best.total.toFixed(2)} (Change £${best.change.toFixed(2)})<br><br>

    <h3>🥇 Top Buys</h3>
    ${topThree.map(r => `
      ${r.count} × ${r.pint} @ ${r.pub} = £${r.total.toFixed(2)}<br>
    `).join("")}
  `;
}

/* ----------------------------------------------------------
   TICKER (Cheapest + Index + Most Expensive + Popular)
---------------------------------------------------------- */
async function loadTicker() {
  const pricesSnap = await getDocs(collection(db, "pintPrices"));
  const pintsSnap  = await getDocs(collection(db, "pintDefinitions"));

  if (pricesSnap.empty) {
    document.getElementById("ticker").textContent = "No data yet";
    return;
  }

  const prices = pricesSnap.docs.map(d => d.data());

  // Cheapest
  const cheapest = [...prices].sort((a, b) => a.price - b.price)[0];

  // Most expensive
  const expensive = [...prices].sort((a, b) => b.price - a.price)[0];

  // Index
  const index = (
    prices.reduce((acc, d) => acc + d.price, 0) / prices.length
  ).toFixed(2);

  // Most popular pint (by submissions)
  const count = {};
  prices.forEach(p => count[p.pintId] = (count[p.pintId] || 0) + 1);
  const popularId = Object.keys(count).sort((a, b) => count[b] - count[a])[0];
  const popularPint = pintsSnap.docs.find(p => p.id === popularId).data().name;

  // Trend classes
  const cheapestTrend = "ticker-down";   // down = good
  const expensiveTrend = "ticker-up";    // up = bad

  // Build ticker text
  document.getElementById("ticker").innerHTML = `
    Cheapest: £${cheapest.price} <span class="${cheapestTrend}">▼</span> |
    Index: £${index} |
    Most Expensive: £${expensive.price} <span class="${expensiveTrend}">▲</span> |
    Popular: ${popularPint}
  `;
}
