import React, { useState, useEffect, useRef } from "react";
import { CAT, buildPdms, emptyDraft, requesterName, uid } from "./logic.js";
import { ConfirmDialog, Callout } from "./ui.jsx";
import Login from "./Login.jsx";
import Wizard from "./Wizard.jsx";
import History from "./History.jsx";
import Addresses from "./Consignes.jsx";
import {
  watchAuth, logout, subscribeDossiers, saveDraftDoc, saveFinalDossier, updateTracking, deleteDossier,
} from "./backend.js";

// La demande en cours de saisie (pas encore enregistrée) reste dans le navigateur,
// pour ne rien perdre en cas de fermeture de l'onglet.
const LOCAL_DRAFT_KEY = "echantillons-presse-demande-en-cours";
function loadLocalDraft() {
  try {
    const raw = localStorage.getItem(LOCAL_DRAFT_KEY);
    if (raw) return { ...emptyDraft(), ...JSON.parse(raw) };
  } catch (e) {}
  return emptyDraft();
}
function saveLocalDraft(draft) {
  try {
    localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(draft));
  } catch (e) {}
}

const newId = (prefix) => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export default function App() {
  const [authed, setAuthed] = useState(null); // null = vérification en cours
  const [view, setView] = useState("new");
  const [dossiers, setDossiers] = useState([]);
  const [loadingDb, setLoadingDb] = useState(true);
  const [draft, setDraft] = useState(loadLocalDraft);
  const [highlight, setHighlight] = useState(null);
  const [confirmState, setConfirmState] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => watchAuth(setAuthed), []);

  useEffect(() => {
    if (!authed) return;
    setLoadingDb(true);
    return subscribeDossiers(
      (ds) => {
        setDossiers(ds);
        setLoadingDb(false);
      },
      (e) => {
        setLoadingDb(false);
        setError(
          e && e.code === "permission-denied"
            ? "Accès à la base refusé. Vérifiez les règles Firestore (voir le guide)."
            : "Impossible de charger l'historique. Vérifiez votre connexion à internet."
        );
      }
    );
  }, [authed]);

  useEffect(() => saveLocalDraft(draft), [draft]);

  if (authed === null) return <div className="boot">Chargement…</div>;
  if (!authed) return <Login />;

  // Exécute une écriture en base ; renvoie true si elle a réussi
  const run = async (fn, failMsg) => {
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    try {
      await fn();
      setError(null);
      return true;
    } catch (e) {
      console.error(e);
      setError(failMsg + (e && e.code ? ` (${e.code})` : ""));
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const names = [...new Set(dossiers.map((d) => d.createdBy).filter(Boolean))];
  const hasWork = draft.lines.length > 0 || requesterName(draft);
  const ask = (opts) => setConfirmState(opts);
  const guard = (action) => {
    if (!hasWork) return action();
    ask({
      title: "Remplacer la demande en cours ?",
      message: "Les modifications qui n'ont pas été enregistrées en brouillon seront perdues.",
      okLabel: "Continuer",
      onOk: action,
    });
  };

  const saveDraft = async () => {
    const id = draft.id || newId("b");
    const now = new Date().toISOString();
    const prev = dossiers.find((x) => x.id === id);
    const entry = {
      id, isDraft: true, createdAt: prev?.createdAt || now, updatedAt: now,
      createdBy: requesterName(draft), draft: { ...draft, id },
    };
    const ok = await run(() => saveDraftDoc(entry), "Le brouillon n'a pas pu être enregistré.");
    if (ok) setDraft((d) => ({ ...d, id }));
    return ok;
  };

  const save = async () => {
    const { pdms, blocked } = buildPdms(draft, true);
    pdms.forEach((p) => (p.tracking = draft.tracking[p.id] || { carrier: "", number: "", date: "" }));
    const id = newId("d");
    const now = new Date().toISOString();
    const d = { id, createdAt: now, updatedAt: now, createdBy: requesterName(draft), pdms, blocked, check: draft.check };
    const relanceFromId = draft.relance && dossiers.some((x) => x.id === draft.relance.fromId) ? draft.relance.fromId : null;
    const replaceId = draft.id && dossiers.some((x) => x.id === draft.id) ? draft.id : null;
    const ok = await run(
      () => saveFinalDossier(d, { replaceId, relanceFromId }),
      "Le dossier n'a pas pu être enregistré. Votre saisie est conservée, réessayez."
    );
    if (!ok) return;
    setDraft(emptyDraft());
    setHighlight(id);
    setView("history");
  };

  const saveTrackingFor = (d, pdms) => run(() => updateTracking(d.id, pdms), "Le suivi n'a pas pu être enregistré.");

  const removeDraft = async (d) => {
    const ok = await run(() => deleteDossier(d.id), "Le brouillon n'a pas pu être supprimé.");
    if (ok && draft.id === d.id) setDraft((x) => ({ ...x, id: null }));
  };

  const newRequest = () => guard(() => setDraft(emptyDraft()));

  const resume = (d) => {
    const go = () => {
      setDraft({ ...emptyDraft(), ...d.draft, id: d.id });
      setView("new");
      window.scrollTo({ top: 0 });
    };
    draft.id === d.id ? go() : guard(go);
  };

  // Relance après obtention du COLA : vins repris, COLA marqué obtenu, uniquement vers les critiques bloqués
  const relaunch = (d) =>
    guard(() => {
      const lines = [];
      const map = {};
      d.blocked.forEach((b) => {
        if (map[b.uid]) return;
        map[b.uid] = uid();
        lines.push({ uid: map[b.uid], wineId: b.wineId, vintage: b.vintage, comment: b.comment || "" });
      });
      const crit = { WS: d.blocked.some((b) => b.critique === "WS"), WE: d.blocked.some((b) => b.critique === "WE") };
      const excl = {};
      Object.entries(map).forEach(([oldUid, newUid]) =>
        ["WS", "WE"].forEach((c) => {
          if (crit[c] && !d.blocked.some((b) => b.uid === oldUid && b.critique === c)) excl[newUid + "|" + c] = true;
        })
      );
      const cola = Object.fromEntries(lines.map((l) => [l.uid, "oui"]));
      setDraft({
        ...emptyDraft(), lines, critiques: crit, excl, cola,
        origines: [...new Set(lines.map((l) => CAT[l.wineId]?.f).filter(Boolean))],
        relance: { fromId: d.id, date: d.createdAt, count: lines.length },
      });
      setView("new");
      window.scrollTo({ top: 0 });
    });

  return (
    <div className="app">
      <header className="top">
        <div className="top-in">
          <div className="brand">
            <span className="brand-name">Échantillons Presse</span>
            <span className="brand-sub">ADV France</span>
          </div>
          <nav className="nav" aria-label="Sections">
            {[["new", "Nouvel envoi"], ["history", "Historique"], ["addr", "Consignes et adresses"]].map(([k, l]) => (
              <button key={k} type="button" className={"nav-btn" + (view === k ? " on" : "")}
                aria-current={view === k ? "page" : undefined}
                onClick={() => { setView(k); setHighlight(null); }}>
                {l}
                {k === "history" && !loadingDb && <span className="count">{dossiers.length}</span>}
              </button>
            ))}
          </nav>
          <div className="who">
            <button type="button" className="link-btn" onClick={logout}>Se déconnecter</button>
          </div>
        </div>
      </header>
      {error && (
        <div className="banner">
          <Callout tone="wine" title="Problème d'enregistrement">
            {error}{" "}
            <button type="button" className="link-btn" onClick={() => setError(null)}>Masquer</button>
          </Callout>
        </div>
      )}
      <main className="main">
        {view === "new" && (
          <Wizard draft={draft} setDraft={setDraft} names={names} onSave={save} onSaveDraft={saveDraft}
            onNew={newRequest} saving={saving} />
        )}
        {view === "history" && (
          <History dossiers={dossiers} loading={loadingDb} highlight={highlight} onRelaunch={relaunch}
            onNew={() => setView("new")} onResume={resume} ask={ask}
            onSaveTracking={saveTrackingFor} onDelete={removeDraft} />
        )}
        {view === "addr" && <Addresses />}
      </main>
      <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />
      <footer className="bottom">
        <div className="bottom-in">
          <span>Adresses et consignes : FAQ Wine Enthusiast (août 2026) et Wine Spectator Napa (2025).</span>
        </div>
      </footer>
    </div>
  );
}
