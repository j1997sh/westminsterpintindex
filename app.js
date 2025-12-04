import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  where,
  limit,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";


/* ------------------- ADD PUB ------------------- */
export async function addPub() {
  await addDoc(collection(db, "pubs"), {
    name: document.getElementById("pubName").value,
    address: document.getElementById("pubAddress").value,
    createdAt: serverTimestamp()
  });
  loadPubs();
}

/* ------------------- ADD PINT ------------------- */
export async function addPint() {
  await addDoc(collection(db, "pintDefinitions"), {
    name: document.getElementById("pintName").value,
    category: document.getElementById("pintCategory").value,
    createdAt: serverTimestamp()
  });
  loadPints();
}

/* ------------------- ADD PRICE ------------------- */
export async function addPrice() {
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
  const pintSelects = [
    document.getElementById("pricePintSelect"),
    document.getElementById("comparePintA"),
    document.getElementById("comparePintB")
  ];

  pintSelects.forEach(sel => sel.innerHTML = "");

  snap.forEach(doc => {
    const opt = document.createElement("option");
    opt.value = doc.id;
    opt.textContent = doc.data().name;
    pintSelects.forEach(sel => sel.appendChild(opt.cloneNode(true)));
  });
}

/* ------------------- CHEAPEST PINT ------------------- */
async function loadCheapest() {
  const q = query(collection(db, "pintPrices"), orderBy("price"), limit(1));
  const snap = await getDocs(q);
  const out = document.getElementById("cheapestPint");

  snap.forEach(doc => {
    out.innerHTML = `£${doc.data().price} 🍺 <br> Latest pint submitted`;
  });
}

/* ------------------- LEAGUE TABLE ------------------- */
async function loadLeagueTable() {
  const prices = await getDocs(collection(db, "pintPrices"));
  const pints = await getDocs(collection(db, "pintDefinitions"));
  const pubs = await getDocs(collection(db, "pubs"));

  const pintMap = {};
  const pubMap = {};

  pints.forEach(d => pintMap[d.id] = d.data());
  pubs.forEach(d => pubMap[d.id] = d.data());

  const tbody = document.querySelector("#leagueTable tbody");
  tbody.innerHTML = "";

  prices.forEach(d => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${pintMap[d.data().pintId].name}</td>
      <td>${pintMap[d.data().pintId].category}</td>
      <td>${pubMap[d.data().pubId].name}</td>
      <td>£${d.data().price}</td>
    `;
    tbody.appendChild(row);
  });
}

/* ------------------- POPULARITY CHART ------------------- */
async function loadPopularityChart() {
  const pints = await getDocs(collection(db, "pintDefinitions"));
  const prices = await getDocs(collection(db, "pintPrices"));

  const countMap = {};
  pints.forEach(doc => countMap[doc.id] = 0);
  prices.forEach(doc => countMap[doc.data().pintId]++);

  const labels = [];
  const counts = [];

  pints.forEach(doc => {
    labels.push(doc.data().name);
    counts.push(countMap[doc.id]);
  });

  new Chart(document.getElementById("popularityChart"), {
    type: "bar",
    data: {
      labels,
      datasets: [{ 
        label: "Submissions",
        data: counts,
        backgroundColor: "#1F2A44"
      }]
    }
  });
}

/* ------------------- PRICE INDEX ------------------- */
async function loadPPI() {
  const prices = await getDocs(collection(db, "pintPrices"));

  let total = 0;
  let count = 0;

  prices.forEach(doc => {
    total += doc.data().price;
    count++;
  });

  const index = (total / count).toFixed(2);
  document.getElementById("ppiOutput").innerHTML = `📈 Index: ${index}`;
}

/* ------------------- COMPARE PINTS ------------------- */
async function comparePints() {
  const pintA = document.getElementById("comparePintA").value;
  const pintB = document.getElementById("comparePintB").value;

  const prices = await getDocs(collection(db, "pintPrices"));

  let aPrices = [];
  let bPrices = [];

  prices.forEach(doc => {
    if (doc.data().pintId === pintA) aPrices.push(doc.data().price);
    if (doc.data().pintId === pintB) bPrices.push(doc.data().price);
  });

  const result = document.getElementById("comparisonResult");
  result.innerHTML = `
    🍺 Pint A avg: £${(aPrices.reduce((a,b)=>a+b,0)/aPrices.length).toFixed(2)}<br>
    🍺 Pint B avg: £${(bPrices.reduce((a,b)=>a+b,0)/bPrices.length).toFixed(2)}
  `;
}

/* ------------------- RARE PINTS ------------------- */
async function loadRarePints() {
  const pints = await getDocs(collection(db, "pintDefinitions"));
  const prices = await getDocs(collection(db, "pintPrices"));
  const pubs = await getDocs(collection(db, "pubs"));

  const pubMap = {};
  pubs.forEach(p => pubMap[p.id] = p.data().name);

  const countMap = {};
  const latestPrice = {};

  pints.forEach(p => countMap[p.id] = 0);
  prices.forEach(pr => {
    countMap[pr.data().pintId]++;
    latestPrice[pr.data().pintId] = pr.data();
  });

  const rare = Object.keys(countMap)
    .filter(id => countMap[id] < 3)
    .map(id => ({
      pintId: id,
      count: countMap[id],
      price: latestPrice[id]?.price,
      pub: pubMap[latestPrice[id]?.pubId]
    }));

  const container = document.getElementById("rarePints");
  container.innerHTML = rare.map(r => `
    <div>
      🌟 ${r.pintId} — ${r.count} submissions <br>
      📍 ${r.pub} <br>
      💷 £${r.price}
    </div>
  `).join("<br>");
}

/* ------------------- INIT ------------------- */
loadPubs();
loadPints();
loadCheapest();
loadLeagueTable();
loadPopularityChart();
loadPPI();
loadRarePints();
