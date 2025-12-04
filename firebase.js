// Initialize Firebase (Modular v10+)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Your Firebase configuration (westminsterbeer project)
const firebaseConfig = {
  apiKey: "AIzaSyCpa0ArQCMDMyzv8tSgYHNaDhqm22qzWf8",
  authDomain: "westminsterbeer.firebaseapp.com",
  projectId: "westminsterbeer",
  storageBucket: "westminsterbeer.firebasestorage.app",
  messagingSenderId: "961171696122",
  appId: "1:961171696122:web:b43b517d17dcf778e5dc43",
  measurementId: "G-KBTEYF6YRY"
};

// Init Firebase
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
