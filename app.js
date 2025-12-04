import { db } from "./firebase.js";
import {
  collection, addDoc, getDocs,
  query, orderBy, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {

  // Attach event listeners
  document.getElementById("addPubBtn").addEventListener("click", addPub);
  document.getElementById("addPintBtn").addEventListener("click", addPint);
  document.getElementById("addPriceBtn").addEventListener("click", addPrice);
  document.getElementById("compareBtn").addEventListener("click", comparePints);

  // Load everything
  loadPubs();
  loadPints();
  loadCheapest();
  loadLeagueTable();
  loadPopularityChart();
  loadPPI();
  loadRarePints();
});

/* ------------------- ADD PUB ------------------- */
async function addPub() {
  await addDoc(collection(db, "pubs"), {
    name: document.getElementById("pubName").value,
    address: document.getElementById("pubAddress").value,
    createdAt: serverTimestamp()
  });
  loadPubs();
}

/* ------------------- ADD PINT ------------------- */
async function addPint() {
  await addDoc(collection(db, "pintDefinitions"), {
    name: document.getElementById("pintName").value,
    category: document.getElementById("pintCategory").value,
    createdAt: serverTimestamp()
  });
  loadPints();
}

/* ------------------- ADD PRICE ------------------- */
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

/* ------------------- LOAD PUBS ------------------- */
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

/* ------------------- LOAD PINTS ------------------- */
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

/* ------------------- CHEAPEST PINT ------------------- */
async function loadCheapest() {
  const q = query(collection(db, "pintPrices"), orderBy("price"), limit(1));
  const snap = await getDocs(q);

  let output = "No data yet!";
  snap.forEach(doc => output = `£${doc.data().price} 🍺`);

  document.getElementById("cheapestPint").innerHTML = output;
}

/* ------------------- LEAGUE TABLE ------------------- */
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
      <td>${pintMap[d.pintId].name}</td>
      <td>${pintMap[d.pintId].category}</td>
      <td>${pubMap[d.pubId].name}</td>
      <td>£${d.price}</td>
    `;
    body.appendChild(row);
  });
}

/* ------------------- POPULARITY CHART ------------------- */
async function loadPopularityChart() {
  const pints = await getDocs(collection(db, "pintDefinitions"));
  const prices = await getDocs(collection(db, "pintPrices"));

  const counts = {};
  pints.forEach(doc => counts[doc.id] = 0);
  prices.forEach(doc => counts[doc.data().pintId]++);

  const labels = [];
  const data = [];

  pints.forEach(doc => {
    labels.push(doc.data().name);
    data.push(counts[doc.id]);
  });

  new Chart(document.getElementById("popularityChart"), {
    type: "bar",
    data: {
      labels: labels,
      datasets: [{
        label: "Submissions",
        data: data,
        backgroundColor: "#1F2A44"
      }]
    }
  });
}

/* ------------------- PINT PRICE INDEX ------------------- */
async function loadPPI() {
  const prices = await getDocs(collection(db, "pintPrices"));
  let total = 0, count = 0;

  prices.forEach(doc => {
    total += doc.data().price;
    count++;
  });

  const index = (total / count || 0).toFixed(2);
  document.getElementById("ppiOutput").innerHTML = `📈 Index: £${index}`;
}

/* ------------------- COMPARE PINTS ------------------- */
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

/* ------------------- RARE PINTS ------------------- */
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
    <div>
      🌟 <strong>${r.name}</strong><br>
      📍 ${r.pub}<br>
      💷 £${r.price || "?"}<br>
      Rarity Score: ⭐${"⭐".repeat(3 - r.count)}
    </div>
  `).join("");
}
