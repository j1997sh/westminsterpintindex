import { db } from "./firebase.js";
import {
  collection, addDoc, getDocs,
  query, orderBy, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("addPubBtn").addEventListener("click", addPub);
  document.getElementById("addPintBtn").addEventListener("click", addPint);
  document.getElementById("addPriceBtn").addEventListener("click", addPrice);
  document.getElementById("compareBtn").addEventListener("click", comparePints);
  document.getElementById("budgetBtn").addEventListener("click", calculateBudget);

  loadPubs();
  loadPints();
  loadCheapest();
  loadLeagueTable();
  loadPopularityChart();
  loadPPI();
  loadRarePints();
});

/* ---------------- ADD PUB ------------------ */
async function addPub() {
  await addDoc(collection(db, "pubs"), {
    name: document.getElementById("pubName").value,
    address: document.getElementById("pubAddress").value,
    createdAt: serverTimestamp()
  });
  loadPubs();
}

/* ---------------- ADD PINT ------------------ */
async function addPint() {
  await addDoc(collection(db, "pintDefinitions"), {
    name: document.getElementById("pintName").value,
    category: document.getElementById("pintCategory").value,
    createdAt: serverTimestamp()
  });
  loadPints();
}

/* ---------------- ADD PRICE ------------------ */
async function addPrice() {
  await addDoc(collection(db, "pintPrices"), {
    pubId: document.getElementById("pricePubSelect").value,
    pintId: document.getElementById("pricePintSelect").value,
    price: Number(document.getElementById("pintPrice").value),
    timestamp: serverTimestamp()
  });

  loadLeagueTable();
  loadPopularityChart();
  loadCheapest();
  loadRarePints();
  loadPPI();
}

/* ---------------- LOAD PUBS ------------------ */
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

/* ---------------- LOAD PINTS ------------------ */
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

/* ---------------- CHEAPEST PINT ------------------ */
async function loadCheapest() {
  const q = query(collection(db, "pintPrices"), orderBy("price"), limit(1));
  const snap = await getDocs(q);

  if (snap.empty) {
    document.getElementById("cheapestPint").innerHTML = "No prices submitted yet!";
    return;
  }

  const cheapest = snap.docs[0].data();

  const pintSnap = await getDocs(collection(db, "pintDefinitions"));
  const pintInfo = pintSnap.docs.find(d => d.id === cheapest.pintId)?.data();

  const pubSnap = await getDocs(collection(db, "pubs"));
  const pubInfo = pubSnap.docs.find(d => d.id === cheapest.pubId)?.data();

  document.getElementById("cheapestPint").innerHTML = `
    <div class="cheapest-wrapper">
      <div class="cheapest-pint-name">🍺 ${pintInfo?.name} (${pintInfo?.category})</div>
      <div class="cheapest-pint-price">£${cheapest.price}</div>
      <div class="cheapest-pint-location">📍 ${pubInfo?.name}</div>
      <div class="cheapest-pint-trend">➡️ Stable today</div>
    </div>
  `;
}

/* ---------------- LEAGUE TABLE ------------------ */
async function loadLeagueTable() {
  const prices = await getDocs(collection(db, "pintPrices"));
  const pints = await getDocs(collection(db, "pintDefinitions"));
  const pubs = await getDocs(collection(db, "pubs"));

  const pintMap = {}, pubMap = {};

  pints.forEach(p => pintMap[p.id] = p.data());
  pubs.forEach(p => pubMap[p.id] = p.data());

  const body = document.querySelector("#leagueTable tbody");
  body.innerHTML = "";

  prices.forEach(doc => {
    const d = doc.data();
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${pintMap[d.pintId]?.name}</td>
      <td>${pintMap[d.pintId]?.category}</td>
      <td>${pubMap[d.pubId]?.name}</td>
      <td>£${d.price}</td>
    `;
    body.appendChild(row);
  });
}

/* ---------------- POPULARITY (POLL BAR) ------------------ */
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
        <div class="poll-bar" style="width: ${(r.count / max) * 100}%"></div>
      </div>
      <div class="poll-value">${r.count}</div>
    </div>
  `).join("");
}

/* ---------------- PINT INDEX ------------------ */
async function loadPPI() {
  const prices = await getDocs(collection(db, "pintPrices"));

  let total = 0;
  let count = 0;
  prices.forEach(d => {
    total += d.data().price;
    count++;
  });

  const index = (total / count || 0).toFixed(2);
  document.getElementById("ppiOutput").innerHTML = `📈 Index: £${index}`;
}

/* ---------------- COMPARE PINTS ------------------ */
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

/* ---------------- RARE PINTS ------------------ */
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
    <div class="budgetItem">
      🌟 <strong>${r.name}</strong><br>
      📍 ${r.pub}<br>
      💷 £${r.price || "?"}<br>
      Rarity Score: ⭐${"⭐".repeat(3 - r.count)}
    </div>
  `).join("");
}

/* ---------------- BUDGET PLANNER ------------------ */
async function calculateBudget() {
  const budget = Number(document.getElementById("budgetInput").value);
  const output = document.getElementById("budgetOutput");

  if (!budget || budget <= 0) {
    output.innerHTML = "⚠️ Please enter a valid amount.";
    return;
  }

  const pricesSnap = await getDocs(collection(db, "pintPrices"));
  const pintsSnap = await getDocs(collection(db, "pintDefinitions"));
  const pubsSnap = await getDocs(collection(db, "pubs"));

  const pintMap = {};
  const pubMap = {};

  pintsSnap.forEach(p => pintMap[p.id] = p.data().name);
  pubsSnap.forEach(p => pubMap[p.id] = p.data().name);

  let results = [];

  pricesSnap.forEach(pr => {
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
      <h3>🏆 Best Value Recommendation</h3>
      <p>🍺 <strong>${best.count} × ${best.pint}</strong> @ ${best.pub}</p>
      <p>💷 Total: £${best.total.toFixed(2)}</p>
      <p>💰 Change left: £${best.change.toFixed(2)}</p>
    </div>

    <h3>🥇 Top 3 Best Buys</h3>
    ${topThree.map((r, i) => `
      <div class="bestValueItem">
        ${i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
        <strong>${r.count} × ${r.pint}</strong> @ ${r.pub}
        — £${r.total.toFixed(2)} (change £${r.change.toFixed(2)})
      </div>
    `).join("")}

    <h3>📦 Full Breakdown</h3>
    ${results.map(r => `
      <div class="budgetItem">
        🍺 ${r.count} × ${r.pint} @ ${r.pub}<br>
        💵 £${r.total.toFixed(2)} spent, £${r.change.toFixed(2)} left
      </div>
    `).join("")}
  `;
}
