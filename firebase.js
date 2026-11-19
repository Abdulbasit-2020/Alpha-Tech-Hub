// Alpha Tech Hub — Firebase client setup
// Firebase Web SDK (modular) loaded from CDN for GitHub Pages.

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDw1QWf46HxNgdRZKaRNLesx0wPzZ070EM",
  authDomain: "alpha-tech-hub-8d863.firebaseapp.com",
  projectId: "alpha-tech-hub-8d863",
  databaseURL: "https://alpha-tech-hub-8d863-default-rtdb.firebaseio.com",
  storageBucket: "alpha-tech-hub-8d863.firebasestorage.app",
  messagingSenderId: "701524294623",
  appId: "1:701524294623:web:8193198f514dac7fb5226a"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getDatabase(app);
export default app;
