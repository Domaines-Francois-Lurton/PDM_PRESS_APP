import React, { useState, useMemo, useEffect } from "react";
import {
  CATALOGUE, CAT, ORIGINES, FILIALES, CRITIQUES, DESTINATIONS, WE_REGIONS, route, qtyFor, unitLabel, wineName, IMPORTATEURS, importerFor, isOn, buildPdms, colaLines, CONSIGNES, ROUTE_TXT, routeKey, ROUTE_COURT, MAIL, PREP_COLOR, escHtml, buildMail, requesterName, dossierStatut, SUIVI_DELAI_JOURS, aSuivre, historiqueCsv, uid, emptyDraft,
} from "./logic.js";
import { copyText, fmtDate, downloadFile, Badge, CritTag, Callout, Segmented, copyRich, CopyButton, ConfirmDialog, PdmLabel } from "./ui.jsx";
import { STEPS, CARRIERS, StepDemandeur, Step1, Step2, Step3, Step4, Checklist, orgaRules, ORGA_INFO, Step5, Step6, TrackingFields, Step7 } from "./steps.jsx";

// ---------- historique
const WHO_KEY = "pdm-presse-modifie-par"; // dernier nom saisi dans « Votre nom », gardé dans ce navigateur
const fmtDateTime = (iso) =>
  new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const sameTracking = (a = {}, b = {}) => ["carrier", "number", "date"].every((k) => (a[k] || "") === (b[k] || ""));
const STATUTS = ["Brouillon", "En préparation", "Partiellement expédié", "Expédié", "Bloqué"];

// Ce qui a réellement changé dans un dossier (pour le journal des modifications)
function changesOf(d, lines, e, det) {
  const out = [];
  const nums = d.pdms.filter((p) => e[p.id] && !sameTracking(e[p.id], p.tracking)).map((p) => "PDM" + p.num);
  if (nums.length) out.push(`Suivi des colis (${nums.join(", ")})`);
  lines.forEach((it) => {
    const v = det[it.uid];
    if (!v) return;
    if ((v.vintage || "") !== (it.vintage || "")) out.push(`Millésime ${it.ref} : ${it.vintage || "vide"} → ${v.vintage}`);
    if ((v.comment || "") !== (it.comment || "")) out.push(`Préparation (${it.ref})`);
  });
  return out;
}

// Recherche : demandeur, vins, numéros de suivi
function searchText(d) {
  const parts = [d.createdBy];
  if (d.isDraft) d.draft.lines.forEach((l) => CAT[l.wineId] && parts.push(wineName(CAT[l.wineId])));
  else {
    d.pdms.forEach((p) => { parts.push(p.tracking?.number); p.items.forEach((i) => parts.push(i.ref, i.gamme)); });
    d.blocked.forEach((b) => parts.push(b.ref, b.gamme));
  }
  return parts.filter(Boolean).join(" ").toLowerCase();
}
const critiquesOf = (d) =>
  d.isDraft
    ? ["WS", "WE"].filter((c) => d.draft.critiques[c])
    : [...new Set(d.pdms.map((p) => p.critique).concat(d.blocked.map((b) => b.critique)))];

function History({ dossiers, loading, highlight, names, onRelaunch, onNew, onResume, ask, onSaveDossier, onDelete, onDeleteDossier, onRestore }) {
  const [open, setOpen] = useState(highlight || null);
  const [edits, setEdits] = useState({});
  const [details, setDetails] = useState({}); // millésime et préparation modifiés, par dossier puis par vin (uid)
  const [saved, setSaved] = useState(null);
  const [who, setWho] = useState(() => {
    try { return localStorage.getItem(WHO_KEY) || ""; } catch { return ""; }
  });
  const [whoMsg, setWhoMsg] = useState(null); // dossier pour lequel on a tenté de supprimer/restaurer sans nom
  const [q, setQ] = useState("");
  const [fCrit, setFCrit] = useState("");
  const [fStat, setFStat] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);

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

  const remember = (by) => {
    try { localStorage.setItem(WHO_KEY, by); } catch { /* navigateur sans stockage : on ignore */ }
  };

  // Enregistre le suivi des colis et les vins modifiés ; un vin est corrigé dans toutes ses PDM
  const saveChanges = (d, changes) => {
    const e = edits[d.id] || {};
    const det = details[d.id] || {};
    const fix = (it) => (det[it.uid] ? { ...it, ...det[it.uid] } : it);
    const pdms = d.pdms.map((p) => ({ ...p, tracking: e[p.id] || p.tracking, items: p.items.map(fix) }));
    const blocked = d.blocked.map(fix);
    const by = who.trim();
    const modifs = [...(d.modifs || []), { date: new Date().toISOString(), by, quoi: changes.join(" ; ") }];
    onSaveDossier(d, { pdms, blocked, modifs }).then((ok) => {
      if (!ok) return;
      remember(by);
      setEdits((x) => ({ ...x, [d.id]: {} }));
      setDetails((x) => ({ ...x, [d.id]: {} }));
      setSaved(d.id);
      setTimeout(() => setSaved(null), 1800);
    });
  };

  // Suppression et restauration : le nom est obligatoire (trace dans l'historique)
  const needWho = (d) => {
    if (who.trim()) return false;
    setWhoMsg(d.id);
    return true;
  };
  const confirmDelete = (d) => {
    if (needWho(d)) return;
    const by = who.trim();
    ask({
      title: d.isDraft ? "Supprimer ce brouillon ?" : "Supprimer ce dossier ?",
      message: `Il sera retiré de l'historique, avec la mention « supprimé par ${by} ». Il reste consultable et restaurable avec « Afficher les supprimés ».`,
      okLabel: "Supprimer", danger: true,
      onOk: () => { remember(by); (d.isDraft ? onDelete : onDeleteDossier)(d, by); },
    });
  };
  const restore = (d) => {
    if (needWho(d)) return;
    remember(who.trim());
    onRestore(d, who.trim());
  };

  const whoField = (d, dirty) => (
    <label className="field h-who">
      <span>Votre nom</span>
      <input list="h-names" placeholder="Prénom Nom" value={who}
        className={!who.trim() && (dirty || whoMsg === d.id) ? "need" : ""}
        onChange={(ev) => setWho(ev.target.value)} />
    </label>
  );
  const whoHint = (d, dirty) =>
    !who.trim() && (dirty || whoMsg === d.id) && <span className="foot-msg">Indiquez votre nom.</span>;

  // Export : un fichier Excel lisible, et une sauvegarde complète restaurable
  const today = new Date().toISOString().slice(0, 10);
  const exportCsv = () => downloadFile(`PDM-Presse-historique-${today}.csv`, historiqueCsv(dossiers), "text/csv;charset=utf-8");
  const exportJson = () =>
    downloadFile(`PDM-Presse-sauvegarde-${today}.json`, JSON.stringify(dossiers, null, 2), "application/json");

  // « À suivre » : ouvre le dossier concerné et le fait défiler à l'écran
  const suivi = aSuivre(dossiers);
  const goTo = (id) => {
    setQ(""); setFCrit(""); setFStat("");
    setOpen(id);
    setTimeout(() => document.getElementById("dossier-" + id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };

  // Recherche et filtres
  const query = q.trim().toLowerCase();
  const total = showDeleted ? dossiers.length : dossiers.filter((d) => !d.deletedAt).length;
  const shown = dossiers.filter((d) =>
    (showDeleted || !d.deletedAt)
    && (!query || searchText(d).includes(query))
    && (!fCrit || critiquesOf(d).includes(fCrit))
    && (!fStat || (fStat === "cola" ? !d.isDraft && d.blocked.length > 0 : dossierStatut(d).label === fStat))
  );

  const renderDeleted = (d) => {
    const isOpen = open === d.id;
    return (
      <article key={d.id} id={"dossier-" + d.id} className="h-card h-deleted">
        <button type="button" className="h-head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : d.id)}>
          <span className="h-date">{fmtDate(d.createdAt)}</span>
          <span className="h-sum">
            {d.isDraft ? "Brouillon" : `${d.pdms.length} PDM`} de {d.createdBy || "demandeur non renseigné"}
            <span className="h-by">Supprimé le {fmtDate(d.deletedAt)} par {d.deletedBy}</span>
          </span>
          <span className="h-pdm" />
          <span className="h-badges"><Badge tone="wine">Supprimé</Badge></span>
        </button>
        {isOpen && (
          <div className="h-body">
            <div className="h-foot">
              {whoHint(d, false)}
              {whoField(d, false)}
              <button type="button" className="btn btn-primary" onClick={() => restore(d)}>Restaurer</button>
            </div>
          </div>
        )}
      </article>
    );
  };

  const renderDraft = (d) => {
    const st = dossierStatut(d);
    const dr = d.draft;
    const critD = ["WS", "WE"].filter((c) => dr.critiques[c]);
    const isOpenD = open === d.id;
    return (
      <article key={d.id} id={"dossier-" + d.id} className={"h-card h-draft" + (highlight === d.id ? " fresh" : "")}>
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
              <button type="button" className="link-btn" onClick={() => confirmDelete(d)}>Supprimer le brouillon</button>
              {whoHint(d, false)}
              {whoField(d, false)}
              <button type="button" className="btn btn-primary" onClick={() => onResume(d)}>Reprendre la demande</button>
            </div>
          </div>
        )}
      </article>
    );
  };

  const renderDossier = (d) => {
    const st = dossierStatut(d);
    const crit = critiquesOf(d);
    const wines = new Set(d.pdms.flatMap((p) => p.items.map((i) => i.uid)).concat(d.blocked.map((b) => b.uid))).size;
    const isOpen = open === d.id;
    const e = edits[d.id] || {};
    const det = details[d.id] || {};
    const lines = [...new Map(d.pdms.flatMap((p) => p.items).concat(d.blocked).map((it) => [it.uid, it])).values()];
    const val = (it) => ({ vintage: it.vintage || "", comment: it.comment || "", ...det[it.uid] });
    const setDet = (it, patch) => setDetails({ ...details, [d.id]: { ...det, [it.uid]: { ...val(it), ...patch } } });
    const needVintage = (it) => CAT[it.wineId]?.t === "vin" && !val(it).vintage.trim();
    const changes = changesOf(d, lines, e, det);
    const dirty = changes.length > 0;
    const lastModif = d.modifs?.length ? d.modifs[d.modifs.length - 1] : null;
    return (
      <article key={d.id} id={"dossier-" + d.id} className={"h-card" + (highlight === d.id ? " fresh" : "")}>
        <button type="button" className="h-head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : d.id)}>
          <span className="h-date">{fmtDate(d.createdAt)}</span>
          <span className="h-sum">
            {wines} vin{wines > 1 ? "s" : ""} pour {crit.map((c) => CRITIQUES[c].nom).join(" et ")}
            <span className="h-by">par {d.createdBy}</span>
            {lastModif && <span className="h-by">Modifié le {fmtDate(lastModif.date)} par {lastModif.by}</span>}
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
            {d.modifs?.length > 0 && (
              <>
                <h4>Modifications</h4>
                <ul className="notes">
                  {[...d.modifs].reverse().map((m) => (
                    <li key={m.date}>{fmtDateTime(m.date)} · <strong className="notes-ink">{m.by}</strong> · {m.quoi}</li>
                  ))}
                </ul>
              </>
            )}
            <div className="h-foot">
              <button type="button" className="link-btn" onClick={() => confirmDelete(d)}>Supprimer le dossier</button>
              {saved === d.id && <span className="foot-msg ok">Modifications enregistrées</span>}
              {lines.some(needVintage) && <span className="foot-msg">Millésime manquant.</span>}
              {whoHint(d, dirty)}
              {whoField(d, dirty)}
              <button type="button" className="btn btn-primary" disabled={!dirty || lines.some(needVintage) || !who.trim()}
                onClick={() => saveChanges(d, changes)}>
                Enregistrer les modifications
              </button>
            </div>
          </div>
        )}
      </article>
    );
  };

  return (
    <div className="history">
      <datalist id="h-names">{(names || []).map((n) => <option key={n} value={n} />)}</datalist>

      <div className="panel h-tools">
        <div className="h-tools-row">
          <input className="search" type="search" placeholder="Rechercher un vin, un demandeur, un numéro de suivi"
            aria-label="Rechercher" value={q} onChange={(ev) => setQ(ev.target.value)} />
          <label className="field">
            <span>Critique</span>
            <select value={fCrit} onChange={(ev) => setFCrit(ev.target.value)}>
              <option value="">Tous</option>
              {["WS", "WE"].map((c) => <option key={c} value={c}>{CRITIQUES[c].nom}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Statut</span>
            <select value={fStat} onChange={(ev) => setFStat(ev.target.value)}>
              <option value="">Tous</option>
              {STATUTS.map((s) => <option key={s} value={s}>{s}</option>)}
              <option value="cola">COLA en attente</option>
            </select>
          </label>
          <label className="cb">
            <input type="checkbox" checked={showDeleted} onChange={(ev) => setShowDeleted(ev.target.checked)} />
            <span>Afficher les supprimés</span>
          </label>
        </div>
        <div className="h-tools-row h-tools-foot">
          <span className="cat-app">{shown.length} dossier{shown.length > 1 ? "s" : ""} sur {total}</span>
          <span className="h-export">
            <button type="button" className="btn btn-small" onClick={exportCsv}>Exporter en Excel</button>
            <button type="button" className="btn btn-small" onClick={exportJson}>Sauvegarde complète</button>
          </span>
        </div>
      </div>

      {(suivi.sansSuivi.length > 0 || suivi.cola.length > 0) && (
        <Callout tone="amber" title="À suivre">
          {suivi.sansSuivi.length > 0 && (
            <>
              <p>PDM sans numéro de suivi depuis plus de {SUIVI_DELAI_JOURS} jours :</p>
              <ul className="a-suivre">
                {suivi.sansSuivi.map(({ d, p, jours }) => (
                  <li key={d.id + p.id}>
                    <button type="button" className="link-btn" onClick={() => goTo(d.id)}>
                      PDM{p.num}, {FILIALES[p.filiale].prepa} vers {DESTINATIONS[p.dest].titre}
                    </button>{" "}
                    <span className="cat-app">dossier du {fmtDate(d.createdAt)}, il y a {jours} jours</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {suivi.cola.length > 0 && (
            <>
              <p>Vins en attente de COLA :</p>
              <ul className="a-suivre">
                {suivi.cola.map(({ d, b }) => (
                  <li key={d.id + b.uid + b.critique}>
                    <button type="button" className="link-btn" onClick={() => goTo(d.id)}>{b.ref} {b.vintage}</button>{" "}
                    <span className="cat-app">{CRITIQUES[b.critique].nom}, dossier du {fmtDate(d.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Callout>
      )}

      {shown.length === 0 && <p className="empty">Aucun dossier ne correspond à la recherche.</p>}
      {shown.map((d) => (d.deletedAt ? renderDeleted(d) : d.isDraft ? renderDraft(d) : renderDossier(d)))}
    </div>
  );
}

export default History;
