// Importa as funções necessárias do SDK do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// --- ATENÇÃO: CONFIGURAÇÃO PARA AMBIENTE DE PRODUÇÃO ---
const firebaseConfig = {
  apiKey: "AIzaSyA8MxD_m6lKrrQKijlxQ0lQUQdC3OpTEv4",
  authDomain: "saas-57e0d.firebaseapp.com",
  projectId: "saas-57e0d",
  storageBucket: "saas-57e0d.appspot.com",
  messagingSenderId: "230026949437",
  appId: "1:230026949437:web:9f19f286aefb96e0330b54"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Inicializa os serviços do Firestore e Auth e os exporta para serem usados em outros módulos
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };

