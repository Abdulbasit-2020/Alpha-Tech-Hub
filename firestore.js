// Alpha Tech Hub — Firestore connection
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
const firebaseConfig = {
  apiKey: "AIzaSyDw1QWf46HxNgdRZKaRNLesx0wPzZ070EM",
  authDomain: "alpha-tech-hub-8d863.firebaseapp.com",
  projectId: "alpha-tech-hub-8d863",
  databaseURL: "https://alpha-tech-hub-8d863-default-rtdb.europe-west1.firebasedatabase.app",
  storageBucket: "alpha-tech-hub-8d863.firebasestorage.app",
  messagingSenderId: "701524294623",
  appId: "1:701524294623:web:8193198f514dac7fb5226a"
};
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
