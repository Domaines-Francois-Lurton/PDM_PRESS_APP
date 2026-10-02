import React, { useState, useMemo, useEffect } from "react";
import {
  CATALOGUE, CAT, ORIGINES, FILIALES, CRITIQUES, DESTINATIONS, WE_REGIONS, route, qtyFor, unitLabel, wineName, IMPORTATEURS, importerFor, isOn, buildPdms, colaLines, CONSIGNES, ROUTE_TXT, routeKey, ROUTE_COURT, MAIL, PREP_COLOR, escHtml, buildMail, requesterName, dossierStatut, uid, emptyDraft,
} from "./logic.js";
import { copyText, fmtDate, Badge, CritTag, Callout, Segmented, copyRich, CopyButton, ConfirmDialog, PdmLabel } from "./ui.jsx";
import { STEPS, CARRIERS, StepDemandeur, Step1, Step2, Step3, Step4, Checklist, orgaRules, ORGA_INFO, Step5, Step6, TrackingFields, Step7 } from "./steps.jsx";

// ---------- historique
function History({ dossiers, loading, highlight, onRelaunch, onNew, onResume, ask, onSaveDossier, onDelete, onDeleteDossier }) {
  const [open, setOpen] = useState(highlight || null);
  const [edits, setEdits] = useState({});
  const [details, setDetails] = useState({}); // millésime et préparation modifiés, par dossier puis par vin (uid)
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
        <button className="btn btn-primary" onClick={onNew}>Nouvelle PDM</button>
      </div>
    );
  // Enregistre le suivi des colis et les vins modifiés ; un vin est corrigé dans toutes ses PDM
  const saveChanges = (d) => {
    const e = edits[d.id] || {};
    const det = details[d.id] || {};
    const fix = (it) => (det[it.uid] ? { ...it, ...det[it.uid] } : it);
    const pdms = d.pdms.map((p) => ({ ...p, tracking: e[p.id] || p.tracking, items: p.items.map(fix) }));
    const blocked = d.blocked.map(fix);
    onSaveDossier(d, { pdms, blocked }).then((ok) => {
      if (!ok) return;
      setEdits((x) => ({ ...x, [d.id]: {} }));
      setDetails((x) => ({ ...x, [d.id]: {} }));
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
        const det = details[d.id] || {};
        const lines = [...new Map(d.pdms.flatMap((p) => p.items).concat(d.blocked).map((it) => [it.uid, it])).values()];
        const val = (it) => ({ vintage: it.vintage || "", comment: it.comment || "", ...det[it.uid] });
        const setDet = (it, patch) => setDetails({ ...details, [d.id]: { ...det, [it.uid]: { ...val(it), ...patch } } });
        const needVintage = (it) => CAT[it.wineId]?.t === "vin" && !val(it).vintage.trim();
        const dirty = Object.keys(e).length > 0 || Object.keys(det).length > 0;
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
                <h4>Vins du dossier</h4>
                {lines.map((it) => (
                  <div key={it.uid} className="sel-row">
                    <div className="cat-ref">{CAT[it.wineId] ? wineName(CAT[it.wineId]) : it.ref}</div>
                    <div className="sel-fields">
                      <label className="field field-inline">
                        <span>Millésime</span>
                        <input inputMode="numeric" className={needVintage(it) ? "need" : ""} value={val(it).vintage}
                          onChange={(ev) => setDet(it, { vintage: ev.target.value })} />
                      </label>
                      <label className="field field-grow">
                        <span>Préparation des bouteilles</span>
                        <input placeholder="ex. contre-étiquette US, capsule neuve" value={val(it).comment}
                          onChange={(ev) => setDet(it, { comment: ev.target.value })} />
                      </label>
                    </div>
                  </div>
                ))}
                <p className="hint">Si les mails de PDM sont déjà partis, prévenez la filiale de ces changements.</p>
                <h4>Suivi des colis</h4>
                {d.pdms.map((p) => (
                  <div key={p.id} className="h-pdm-row">
                    <div className="track-id">
                      <span className="label-num small">PDM{p.num}</span>
                      <div>
                        <div className="cat-ref">{FILIALES[p.filiale].prepa} vers {DESTINATIONS[p.dest].titre}</div>
                        <div className="cat-app">{p.items.map((i) => `${i.ref} ${i.vintage}`.trim()).join(", ")}</div>
                      </div>
                    </div>
                    <TrackingFields
                      value={e[p.id] || p.tracking}
                      onChange={(t) => setEdits({ ...edits, [d.id]: { ...e, [p.id]: t } })}
                    />
                  </div>
                ))}
                {d.relanceId && <p className="muted">COLA obtenu : les vins bloqués ont été relancés dans une nouvelle demande.</p>}
                {d.blocked.length > 0 && (
                  <Callout tone="wine" title="En attente de COLA">
                    <p>{d.blocked.map((b) => `${b.ref} ${b.vintage} (${CRITIQUES[b.critique].nom})`).join(", ")}</p>
                    <button type="button" className="btn btn-small" onClick={() => onRelaunch(d)}>
                      COLA obtenu : préparer l'envoi
                    </button>
                  </Callout>
                )}
                <div className="h-foot">
                  <button type="button" className="link-btn" onClick={() => {
                    ask({
                      title: "Supprimer ce dossier ?",
                      message: "Le dossier et son suivi des colis seront définitivement supprimés de l'historique."
                        + (d.blocked.length ? " Les vins en attente de COLA seront aussi perdus." : ""),
                      okLabel: "Supprimer", danger: true,
                      onOk: () => onDeleteDossier(d),
                    });
                  }}>Supprimer le dossier</button>
                  {saved === d.id && <span className="foot-msg ok">Modifications enregistrées</span>}
                  {lines.some(needVintage) && <span className="foot-msg">Millésime manquant.</span>}
                  <button type="button" className="btn btn-primary" disabled={!dirty || lines.some(needVintage)} onClick={() => saveChanges(d)}>
                    Enregistrer les modifications
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
