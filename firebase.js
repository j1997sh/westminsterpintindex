import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "westminsterpints.firebaseapp.com",
  projectId: "westminsterpints",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
