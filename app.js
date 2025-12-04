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

document.addEventListener("DOMContentLoaded", () => {

  // EVENT LISTENERS
  document.getElementById("addPubBtn").addEventListener("click", addPub);
  document.getElementById("addPintBtn").addEventListener("click", addPint);
  document.getElementById("addPriceBtn").addEventListener("click", addPrice);
  document.getElementById("compareBtn").addEventListener("click", comparePints);
  document.getElementById("budgetBtn").addEventListener("click", calculateBudget);

  // ACCORDION LOGIC
  document.querySelectorAll(".accordion-header").forEach(header => {
    header.addEventListener("click", () => {
      const body = header.nextElementSibling;
      const isOpen = body.style.display === "block";

      // Close all
      document.querySelectorAll(".accordion-body").forEach(b => b.style.display = "none");

      // Re-open if it wasn’t open already
      if (!isOpen) body.style.display = "block";
    });
  });

  // LOAD DATA
  loadPubs();
  loadPints();
  loadCheapest();
  loadMarketCards();
  loadPopularityChart();
  loadPPI();
  loadRarePints();
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
  await addDoc(collection(db, "pintPrices"), {
    pubId: document.getElementById("pricePubSelect").value,
    pintId: document.getElementById("pricePintSelect").value,
    price: Number(document.getElementById("pintPrice").value),
    timestamp: serverTimestamp()
  });

  loadCheapest();
  loadMarketCards();
  loadPopularityChart();
  loadPPI();
  loadRarePints();
}

/* ----------------------------------------------------------
   LOAD PUBS INTO SELECT LISTS
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
   LOAD PINTS INTO SELECT LISTS
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
   CHEAPEST PINT — WITH TREND (Stable + Method A)
---------------------------------------------------------- */
async function loadCheapest() {
  const qPrice = query(collection(db, "pintPrices"), orderBy("price"), limit(1));
  const cheapestSnap = await getDocs(qPrice);

  if (cheapestSnap.empty) {
    document.getElementById("cheapestContent").innerHTML = "No prices submitted yet!";
    return;
  }

  const cheapest = cheapestSnap.docs[0].data();
  const pintId = cheapest.pintId;
  const pubId = cheapest.pubId;

  // Fetch pint + pub names
  const pintSnap = await getDocs(collection(db, "pintDefinitions"));
  const pintData = pintSnap.docs.find(d => d.id === pintId)?.data();

  const pubSnap = await getDocs(collection(db, "pubs"));
  const pubData = pubSnap.docs.find(d => d.id === pubId)?.data();

  // TREND LOGIC (Method A: compare LAST TWO prices for same pint/pub)
  const priceHistoryQuery = query(
    collection(db, "pintPrices"),
    orderBy("timestamp", "desc")
  );
  const historySnap = await getDocs(priceHistoryQuery);

  let previousPrice = null;
  let trendDirection = "stable"; // default
  let diff = 0;

  const entries = historySnap.docs
    .map(d => d.data())
    .filter(d => d.pintId === pintId && d.pubId === pubId);

  if (entries.length >= 2) {
    const latest = entries[0].price;
    const prev = entries[1].price;

    previousPrice = prev;
    diff = (latest - prev).toFixed(2);

    if (latest > prev) trendDirection = "up";
    else if (latest < prev) trendDirection = "down";
  }

  // SET TREND COLOURS
  const trendStrip = document.getElementById("cheapestTrend");

  if (trendDirection === "up") {
    trendStrip.style.background = "#EF4444"; // red
  } else if (trendDirection === "down") {
    trendStrip.style.background = "#10B981"; // green
  } else {
    trendStrip.style.background = "#D1D5DB"; // grey
  }

  // TREND LABEL
  let trendLabel = "➡️ Stable today";
  if (trendDirection === "up") trendLabel = `🔺 +£${Math.abs(diff)}`;
  if (trendDirection === "down") trendLabel = `🔻 -£${Math.abs(diff)}`;

  // RENDER CHEAPEST TILE
  document.getElementById("cheapestContent").innerHTML = `
    <div class="cheapest-name">🍺 ${pintData?.name} (${pintData?.category})</div>
    <div class="cheapest-price">£${cheapest.price}</div>
    <div class="cheapest-pub">📍 ${pubData?.name}</div>
    <div class="cheapest-trend">${trendLabel}</div>
  `;
}

/* ----------------------------------------------------------
   MARKET CARDS (REPLACES LEAGUE TABLE)
---------------------------------------------------------- */
async function loadMarketCards() {
  const pricesSnap = await getDocs(collection(db, "pintPrices"));
  const pintsSnap = await getDocs(collection(db, "pintDefinitions"));
  const pubsSnap = await getDocs(collection(db, "pubs"));

  const pintMap = {};
  const pubMap = {};

  pintsSnap.forEach(d => pintMap[d.id] = d.data());
  pubsSnap.forEach(d => pubMap[d.id] = d.data());

  const container = document.getElementById("marketCards");
  container.innerHTML = "";

  pricesSnap.forEach(doc => {
    const d = doc.data();
    const pint = pintMap[d.pintId];
    const pub = pubMap[d.pubId];

    const card = document.createElement("div");
    card.classList.add("stock-card");

    card.innerHTML = `
      <div class="stock-title">🍺 ${pint.name} (${pint.category})</div>
      <div class="stock-meta">📍 ${pub.name}</div>
      <div class="stock-price">£${d.price}</div>
    `;

    container.appendChild(card);
  });
}

/* ----------------------------------------------------------
   POPULARITY — POLL/VOLUME BARS
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
  }));

  results.sort((a, b) => b.count - a.count);

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
   PINT PRICE INDEX
---------------------------------------------------------- */
async function loadPPI() {
  const prices = await getDocs(collection(db, "pintPrices"));

  let total = 0, count = 0;
  prices.forEach(d => {
    total += d.data().price;
    count++;
  });

  const index = (total / count || 0).toFixed(2);
  document.getElementById("ppiOutput").innerHTML = `📈 Index: £${index}`;
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

  const avgA = aVals.reduce((a,b)=>a+b,0) / aVals.length || 0;
  const avgB = bVals.reduce((a,b)=>a+b,0) / bVals.length || 0;

  document.getElementById("comparisonResult").innerHTML = `
    🍺 Pint A avg: £${avgA.toFixed(2)}<br>
    🍺 Pint B avg: £${avgB.toFixed(2)}
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

  const count = {}, latest = {};
  pints.forEach(p => count[p.id] = 0);

  prices.forEach(pr => {
    const d = pr.data();
    count[d.pintId]++;
    latest[d.pintId] = d;
  });

  const rare = Object.keys(count)
    .filter(id => count[id] < 3)
    .map(id => ({
      name: pints.docs.find(doc => doc.id === id).data().name,
      price: latest[id]?.price,
      pub: pubMap[latest[id]?.pubId] || "Unknown Pub",
      count: count[id]
    }));

  const out = document.getElementById("rarePints");
  out.innerHTML = rare.map(r => `
    <div class="stock-card">
      🌟 <strong>${r.name}</strong><br>
      📍 ${r.pub}<br>
      💷 £${r.price || "?"}<br>
      ⭐ Rare (only ${r.count} entries)
    </div>
  `).join("");
}

/* ----------------------------------------------------------
   BUDGET PLANNER
---------------------------------------------------------- */
async function calculateBudget() {
  const budget = Number(document.getElementById("budgetInput").value);
  const output = document.getElementById("budgetOutput");

  if (!budget || budget <= 0) {
    output.innerHTML = "⚠️ Enter a valid amount.";
    return;
  }

  const prices = await getDocs(collection(db, "pintPrices"));
  const pints = await getDocs(collection(db, "pintDefinitions"));
  const pubs = await getDocs(collection(db, "pubs"));

  const pintMap = {};
  const pubMap = {};

  pints.forEach(p => pintMap[p.id] = p.data().name);
  pubs.forEach(p => pubMap[p.id] = p.data().name);

  let results = [];

  prices.forEach(pr => {
    const d = pr.data();
    const count = Math.floor(budget / d.price);

    if (count > 0) {
      const total = count * d.price;
      const change = budget - total;

      results.push({
        pint: pintMap[d.pintId],
        pub: pubMap[d.pubId],
        count,
        price: d.price,
        total,
        change
      });
    }
  });

  results.sort((a, b) => b.count - a.count || a.price - b.price);

  const best = results[0];
  const topThree = results.slice(0, 3);

  output.innerHTML = `
    <h3>🧾 Breakdown for £${budget}</h3>

    <div class="bestValueBox">
      <h3>🏆 Best Value Buy</h3>
      <p>🍺 <strong>${best.count} × ${best.pint}</strong> @ ${best.pub}</p>
      <p>💷 £${best.total.toFixed(2)} (Change: £${best.change.toFixed(2)})</p>
    </div>

    <h3>🥇 Top Buys</h3>
    ${topThree.map((r, i) => `
      <div class="bestValueItem">
        ${i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
        <strong>${r.count} × ${r.pint}</strong> @ ${r.pub}<br>
        £${r.total.toFixed(2)} (Change £${r.change.toFixed(2)})
      </div>
    `).join("")}

    <h3>📦 Full Breakdown</h3>
    ${results.map(r => `
      <div class="budgetItem">
        🍺 ${r.count} × ${r.pint} @ ${r.pub}<br>
        💵 £${r.total.toFixed(2)} (Change £${r.change.toFixed(2)})
      </div>
    `).join("")}
  `;
}
