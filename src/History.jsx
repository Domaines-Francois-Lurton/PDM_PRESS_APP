import React, { useState, useMemo, useEffect } from "react";
import {
  CATALOGUE, CAT, ORIGINES, FILIALES, CRITIQUES, DESTINATIONS, WE_REGIONS, route, qtyFor, unitLabel, wineName, IMPORTATEURS, importerFor, isOn, buildPdms, colaLines, CONSIGNES, ROUTE_TXT, routeKey, ROUTE_COURT, MAIL, PREP_COLOR, escHtml, buildMail, requesterName, dossierStatut, uid, emptyDraft,
} from "./logic.js";
import { copyText, fmtDate, Badge, CritTag, Callout, Segmented, copyRich, CopyButton, ConfirmDialog, PdmLabel } from "./ui.jsx";
import { STEPS, CARRIERS, StepDemandeur, Step1, Step2, Step3, Step4, Checklist, orgaRules, ORGA_INFO, Step5, Step6, TrackingFields, Step7 } from "./steps.jsx";

// ---------- historique
function History({ dossiers, loading, highlight, onRelaunch, onNew, onResume, ask, onSaveTracking, onDelete, onEdit }) {
  const [open, setOpen] = useState(highlight || null);
  const [edits, setEdits] = useState({});
  const [saved, setSaved] = useState(null);
  if (loading)
    return (
      <div className="panel">
        <p className="empty">Chargement de l'historique…</p>
      </div>
    );
  if (!dossiers.length)
    return (
      <div className="panel">
        <p className="empty">Aucun dossier enregistré.</p>
        <button className="btn btn-primary" onClick={onNew}>Préparer un envoi</button>
      </div>
    );
  const saveTracking = (d) => {
    const e = edits[d.id] || {};
    const pdms = d.pdms.map((p) => (e[p.id] ? { ...p, tracking: e[p.id] } : p));
    onSaveTracking(d, pdms).then((ok) => {
      if (!ok) return;
      setEdits((x) => ({ ...x, [d.id]: {} }));
      setSaved(d.id);
      setTimeout(() => setSaved(null), 1800);
    });
  };
  return (
    <div className="history">
      {dossiers.map((d) => {
        const st = dossierStatut(d);
        if (d.isDraft) {
          const dr = d.draft;
          const critD = ["WS", "WE"].filter((c) => dr.critiques[c]);
          const isOpenD = open === d.id;
          return (
            <article key={d.id} className={"h-card h-draft" + (highlight === d.id ? " fresh" : "")}>
              <button type="button" className="h-head" aria-expanded={isOpenD} onClick={() => setOpen(isOpenD ? null : d.id)}>
                <span className="h-date">{fmtDate(d.updatedAt || d.createdAt)}</span>
                <span className="h-sum">
                  {dr.lines.length} vin{dr.lines.length > 1 ? "s" : ""}
                  {critD.length ? " pour " + critD.map((c) => CRITIQUES[c].nom).join(" et ") : ", critiques à choisir"}
                  {dr.editing && <span className="h-by">Modification du dossier du {fmtDate(dr.editing.createdAt)}</span>}
                  <span className="h-by">par {d.createdBy || "demandeur non renseigné"}</span>
                </span>
                <span className="h-pdm">Étape {dr.step} sur {STEPS.length}</span>
                <span className="h-badges"><Badge tone={st.tone}>{st.label}</Badge></span>
              </button>
              {isOpenD && (
                <div className="h-body">
                  {dr.lines.length > 0 ? (
                    <ul className="notes notes-ink">
                      {dr.lines.map((l) => <li key={l.uid}>{wineName(CAT[l.wineId])} {l.vintage}</li>)}
                    </ul>
                  ) : <p className="muted">Aucun vin sélectionné.</p>}
                  <div className="h-foot">
                    <button type="button" className="link-btn" onClick={() => {
                      ask({
                        title: "Supprimer ce brouillon ?",
                        message: "Le brouillon sera définitivement supprimé de l'historique.",
                        okLabel: "Supprimer", danger: true,
                        onOk: () => onDelete(d),
                      });
                    }}>Supprimer le brouillon</button>
                    <button type="button" className="btn btn-primary" onClick={() => onResume(d)}>Reprendre la demande</button>
                  </div>
                </div>
              )}
            </article>
          );
        }
        const crit = [...new Set(d.pdms.map((p) => p.critique).concat(d.blocked.map((b) => b.critique)))];
        const wines = new Set(d.pdms.flatMap((p) => p.items.map((i) => i.uid)).concat(d.blocked.map((b) => b.uid))).size;
        const isOpen = open === d.id;
        const e = edits[d.id] || {};
        return (
          <article key={d.id} className={"h-card" + (highlight === d.id ? " fresh" : "")}>
            <button type="button" className="h-head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : d.id)}>
              <span className="h-date">{fmtDate(d.createdAt)}</span>
              <span className="h-sum">
                {wines} vin{wines > 1 ? "s" : ""} pour {crit.map((c) => CRITIQUES[c].nom).join(" et ")}
                <span className="h-by">par {d.createdBy}</span>
              </span>
              <span className="h-pdm">{d.pdms.length} PDM</span>
              <span className="h-badges">
                <Badge tone={st.tone}>{st.label}</Badge>
                {d.blocked.length > 0 && <Badge tone="wine">COLA en attente</Badge>}
              </span>
            </button>
            {isOpen && (
              <div className="h-body">
                {d.pdms.map((p) => (
                  <div key={p.id} className="h-pdm-row">
                    <div className="track-id">
                      <span className="label-num small">PDM{p.num}</span>
                      <div>
                        <div className="cat-ref">{FILIALES[p.filiale].nom} vers {DESTINATIONS[p.dest].titre}</div>
                        <div className="cat-app">{p.items.map((i) => `${i.ref} ${i.vintage}`.trim()).join(", ")}</div>
                      </div>
                    </div>
                    <TrackingFields
                      value={e[p.id] || p.tracking}
                      onChange={(t) => setEdits({ ...edits, [d.id]: { ...e, [p.id]: t } })}
                    />
                  </div>
                ))}
                {d.relanceId && <p className="muted">COLA obtenu : les vins bloqués ont été relancés dans un nouvel envoi.</p>}
                {d.blocked.length > 0 && (
                  <Callout tone="wine" title="En attente de COLA">
                    <p>{d.blocked.map((b) => `${b.ref} ${b.vintage} (${CRITIQUES[b.critique].nom})`).join(", ")}</p>
                    <button type="button" className="btn btn-small" onClick={() => onRelaunch(d)}>
                      COLA obtenu : préparer l'envoi
                    </button>
                  </Callout>
                )}
                <div className="h-foot">
                  <button type="button" className="link-btn link-danger" onClick={() =>
                    ask({
                      title: "Supprimer ce dossier ?",
                      message: "Le dossier et son suivi seront définitivement supprimés de l'historique, pour tous les postes.",
                      okLabel: "Supprimer", danger: true,
                      onOk: () => onDelete(d),
                    })
                  }>Supprimer le dossier</button>
                  {saved === d.id && <span className="foot-msg ok">Suivi enregistré</span>}
                  <button type="button" className="btn" onClick={() => onEdit(d)}>Modifier la demande</button>
                  <button type="button" className="btn btn-primary" disabled={!Object.keys(e).length} onClick={() => saveTracking(d)}>
                    Enregistrer le suivi
                  </button>
                </div>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

export default History;
