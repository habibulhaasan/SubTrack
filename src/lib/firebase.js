import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBmc6neTa6eA6B7k8fL4XV4rnPhk0f3YbA",
  authDomain: "donate-track.firebaseapp.com",
  projectId: "donate-track",
  storageBucket: "donate-track.firebasestorage.app",
  messagingSenderId: "320211882238",
  appId: "1:320211882238:web:d856cc71577c59639f55af",
  measurementId: "G-V90SCM8JXV"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const db = getFirestore(app);
