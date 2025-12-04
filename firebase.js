// Initialize Firebase (modular v10 syntax)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBa9qyjAIlFil46dtKHNq99w6_gWDuOBLI",
  authDomain: "westminsterpints-9b0d5.firebaseapp.com",
  projectId: "westminsterpints-9b0d5",
  storageBucket: "westminsterpints-9b0d5.firebasestorage.app",
  messagingSenderId: "221558546438",
  appId: "1:221558546438:web:3a4ab8d6ecf73d57fba387",
  measurementId: "G-N8EJ2S5GKT"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);
