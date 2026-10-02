import React, { useState, useMemo, useEffect } from "react";
import {
  CATALOGUE, CAT, ORIGINES, FILIALES, CRITIQUES, DESTINATIONS, WE_REGIONS, route, qtyFor, unitLabel, wineName, IMPORTATEURS, importerFor, isOn, buildPdms, colaLines, CONSIGNES, ROUTE_TXT, routeKey, ROUTE_COURT, MAIL, PREP_COLOR, escHtml, buildMail, requesterName, dossierStatut, uid, emptyDraft,
} from "./logic.js";
import { copyText, fmtDate, Badge, CritTag, Callout, Segmented, copyRich, CopyButton, ConfirmDialog, PdmLabel } from "./ui.jsx";
import { STEPS, CARRIERS, StepDemandeur, Step1, Step2, Step3, Step4, Checklist, orgaRules, ORGA_INFO, Step5, Step6, TrackingFields, Step7 } from "./steps.jsx";

// ---------- assistant
function Wizard({ draft, setDraft, names, onSave, onSaveDraft, onNew, saving }) {
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const [draftMsg, setDraftMsg] = useState(false);
  const s = draft.step;
  const last = STEPS.length;
  const requester = requesterName(draft);
  const canNext = (() => {
    if (s === 1) return !!(draft.prenom || "").trim() && !!(draft.nom || "").trim();
    if (s === 2) return draft.lines.length > 0 && draft.lines.every((l) => CAT[l.wineId].t !== "vin" || l.vintage.trim());
    if (s === 3) return draft.lines.some((l) => ["WS", "WE"].some((c) => isOn(draft, l, c)));
    if (s === 5) return colaLines(draft).every((l) => draft.cola[l.uid]);
    if (s === 6 || s === 7) return buildPdms(draft, true).pdms.length > 0;
    return true;
  })();
  const blockMsg = {
    1: "Indiquez votre prénom et votre nom.",
    2: draft.lines.length ? "Indiquez le millésime de chaque vin." : "Ajoutez au moins un vin.",
    3: "Choisissez au moins un critique.",
    5: "Répondez pour chaque vin.",
    6: "Aucune PDM possible : tous les vins sont bloqués.",
    7: "Aucune PDM possible : tous les vins sont bloqués.",
  }[s];
  const go = (n) => {
    setDraft((d) => ({ ...d, step: n, max: Math.max(d.max, n) }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const saveDraft = async () => {
    const ok = await onSaveDraft();
    if (!ok) return;
    setDraftMsg(true);
    setTimeout(() => setDraftMsg(false), 2000);
  };
  const started = draft.lines.length > 0 || requester || draft.id;
  const Body = [null, StepDemandeur, Step1, Step2, Step3, Step4, Step5, Step6, Step7][s];

  return (
    <div className="wizard">
      <nav className="stepper" aria-label="Étapes">
        <ol>
          {STEPS.map((label, i) => {
            const n = i + 1;
            const state = n === s ? "current" : n <= draft.max ? "done" : "todo";
            return (
              <li key={n} className={"st st-" + state}>
                <button type="button" disabled={n > draft.max} onClick={() => go(n)} aria-current={n === s ? "step" : undefined}>
                  <span className="st-n">{n}</span>
                  <span className="st-l">{label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
      <section className="panel">
        <div className="panel-toprow">
          <span className="panel-step">
            Étape {s} sur {last}
            {draft.id && <span className="draft-flag">Brouillon</span>}
          </span>
          {started && <button type="button" className="link-btn" onClick={onNew}>Recommencer</button>}
        </div>
        <h2 className="panel-title">{STEPS[s - 1]}</h2>
        {draft.relance && s <= 2 && (
          <Callout tone="green" title="Relance après obtention du COLA">
            {draft.relance.count > 1 ? `${draft.relance.count} vins repris` : "1 vin repris"} du dossier du {fmtDate(draft.relance.date)}, avec le COLA indiqué comme obtenu.
            {s === 1 ? " Indiquez votre nom pour continuer." : " Vérifiez les millésimes avant de continuer."}
          </Callout>
        )}
        <Body draft={draft} set={set} user={requester} names={names} />
        <footer className="panel-foot">
          {s > 1 ? <button type="button" className="btn" onClick={() => go(s - 1)}>Retour</button> : <span />}
          <div className="foot-right">
            {draftMsg && <span className="foot-msg ok">Brouillon enregistré</span>}
            {!draftMsg && !canNext && blockMsg && <span className="foot-msg">{blockMsg}</span>}
            {s > 1 && s < last && (
              <button type="button" className="btn" onClick={saveDraft} disabled={saving}>Enregistrer le brouillon</button>
            )}
            {s < last && (
              <button type="button" className="btn btn-primary" disabled={!canNext} onClick={() => go(s + 1)}>
                Continuer
              </button>
            )}
            {s === last && (
              <button type="button" className="btn btn-primary" onClick={onSave} disabled={saving}>
                Enregistrer le dossier
              </button>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
}

export default Wizard;
