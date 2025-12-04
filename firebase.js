import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBa9qyjAIlFil46dtKHNq99w6_gWDuOBLI",
  authDomain: "westminsterbeer.firebaseapp.com",
  projectId: "westminsterbeer",
  storageBucket: "westminsterbeer.appspot.com",
  messagingSenderId: "221558546438",
  appId: "1:221558546438:web:3a4ab8d6ecf73d57fba387",
  measurementId: "G-N8EJ2S5GKT"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
