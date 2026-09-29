// ============================================================
//  ACCÈS À FIREBASE (connexion + base Firestore)
//  Toute l'app passe par ce fichier : aucun autre fichier n'appelle Firebase.
// ============================================================
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import {
  initializeFirestore, collection, doc, onSnapshot, query, orderBy,
  setDoc, updateDoc, deleteDoc, writeBatch,
} from "firebase/firestore";
import { firebaseConfig, AUTH_EMAIL } from "./config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
// ignoreUndefinedProperties : les champs vides (undefined) sont ignorés au lieu de bloquer l'écriture
const db = initializeFirestore(app, { ignoreUndefinedProperties: true });

const COL = "dossiers";

// ---------- connexion
export function watchAuth(callback) {
  return onAuthStateChanged(auth, (u) => callback(!!u));
}

export async function login(password) {
  try {
    await signInWithEmailAndPassword(auth, AUTH_EMAIL, password);
    return { ok: true };
  } catch (e) {
    const code = e && e.code;
    if (["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found", "auth/invalid-email"].includes(code))
      return { ok: false, message: "Mot de passe incorrect." };
    if (code === "auth/too-many-requests")
      return { ok: false, message: "Trop de tentatives. Réessayez dans quelques minutes." };
    if (code === "auth/network-request-failed")
      return { ok: false, message: "Connexion impossible : vérifiez votre accès à internet." };
    return { ok: false, message: `Connexion impossible (${code || "erreur inconnue"}).` };
  }
}

export function logout() {
  return signOut(auth);
}

// ---------- dossiers et brouillons (collection « dossiers »)
export function subscribeDossiers(onData, onError) {
  const q = query(collection(db, COL), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ ...d.data(), id: d.id }))),
    onError
  );
}

export function saveDraftDoc(entry) {
  return setDoc(doc(db, COL, entry.id), entry);
}

// Enregistre le dossier final ; supprime le brouillon qu'il remplace ;
// si c'est une relance COLA, marque le dossier d'origine comme relancé. Tout ou rien.
export function saveFinalDossier(dossier, { replaceId, relanceFromId } = {}) {
  const batch = writeBatch(db);
  batch.set(doc(db, COL, dossier.id), dossier);
  if (replaceId) batch.delete(doc(db, COL, replaceId));
  if (relanceFromId) batch.update(doc(db, COL, relanceFromId), { blocked: [], relanceId: dossier.id });
  return batch.commit();
}

export function updateTracking(id, pdms) {
  return updateDoc(doc(db, COL, id), { pdms, updatedAt: new Date().toISOString() });
}

export function deleteDossier(id) {
  return deleteDoc(doc(db, COL, id));
}
