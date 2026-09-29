// ============================================================
//  CONFIGURATION FIREBASE
//  Ces valeurs ne sont pas secrètes : elles identifient le projet.
//  Les données sont protégées par les règles Firestore (firestore.rules).
// ============================================================

export const firebaseConfig = {
  apiKey: "AIzaSyDoAJofs57Mey0VUg-h_7dcgRUaa8jyk-c",
  authDomain: "pdm-presse.firebaseapp.com",
  projectId: "pdm-presse",
  storageBucket: "pdm-presse.firebasestorage.app",
  messagingSenderId: "334079201169",
  appId: "1:334079201169:web:ba593863ffd1c58a8c9430",
};

// E-mail du compte technique partagé, créé dans Firebase > Authentication.
// Il n'est jamais affiché : l'écran de connexion ne demande que le mot de passe.
// ⚠️ Doit être identique à l'e-mail indiqué dans firestore.rules.
export const AUTH_EMAIL = "yvain.ramousse@francoislurton.com";
