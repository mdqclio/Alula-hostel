// ===================== FIREBASE SETUP =====================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getDatabase, ref, set, get } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyA8Z37siru56CAPE-Jqk87B5IoqKwO4qvQ",
  authDomain: "alula-hostel.firebaseapp.com",
  databaseURL: "https://alula-hostel-default-rtdb.firebaseio.com",
  projectId: "alula-hostel",
  storageBucket: "alula-hostel.firebasestorage.app",
  messagingSenderId: "1017207412620",
  appId: "1:1017207412620:web:591feea91f9aca95cbe8a9"
};

export const firebaseApp = initializeApp(firebaseConfig);
export const db = getDatabase(firebaseApp);
export const auth = getAuth(firebaseApp);

// ===================== DATA STORE =====================
// Cache local para rendimiento
export const cache = {};

export const DB = {
  get: (k, def) => {
    try {
      const v = cache[k];
      return (v !== undefined && v !== null) ? v : def;
    } catch(e) { return def; }
  },
  set: async (k, v) => {
    cache[k] = v;
    try {
      await set(ref(db, 'alula/' + k), v);
    } catch(e) { console.error('Firebase write error:', e); }
  }
};

function showLoader(show) {
  let loader = document.getElementById('fbLoader');
  if (!loader) {
    loader = document.createElement('div');
    loader.id = 'fbLoader';
    loader.style.cssText = 'position:fixed;inset:0;background:rgba(10,22,40,0.92);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:2000;gap:16px';
    loader.innerHTML = '<div style="width:40px;height:40px;border:3px solid rgba(59,130,246,0.2);border-top-color:#3b82f6;border-radius:50%;animation:spin 0.8s linear infinite"></div><p style="color:#94b4d4;font-size:14px">Conectando con Firebase...</p>';
    const style = document.createElement('style');
    style.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
    document.head.appendChild(style);
    document.body.appendChild(loader);
  }
  loader.style.display = show ? 'flex' : 'none';
}

export async function loadAllData() {
  showLoader(true);
  try {
    const snapshot = await get(ref(db, 'alula'));
    if (snapshot.exists()) {
      const data = snapshot.val();
      Object.keys(data).forEach(k => cache[k] = data[k]);
    }
    // Inicializar aluKnowledge si no existe
    if (cache['aluKnowledge'] === undefined) cache['aluKnowledge'] = [];
    // initData se importa dinámicamente para evitar dependencia circular
    const { initData } = await import('./auth.js');
    await initData();
  } catch(e) {
    console.error('Firebase read error:', e);
    // showNotif se importa dinámicamente para evitar ciclos
    const { showNotif } = await import('./helpers.js');
    showNotif('Error conectando con Firebase. Verificá tu conexión.', 'error');
  }
  showLoader(false);
}
