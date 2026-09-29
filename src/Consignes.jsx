import React, { useState, useMemo, useEffect } from "react";
import {
  CATALOGUE, CAT, ORIGINES, FILIALES, CRITIQUES, DESTINATIONS, WE_REGIONS, route, qtyFor, unitLabel, wineName, IMPORTATEURS, importerFor, isOn, buildPdms, colaLines, CONSIGNES, ROUTE_TXT, routeKey, ROUTE_COURT, MAIL, PREP_COLOR, escHtml, buildMail, requesterName, dossierStatut, uid, emptyDraft,
} from "./logic.js";
import { copyText, fmtDate, Badge, CritTag, Callout, Segmented, copyRich, CopyButton, ConfirmDialog, PdmLabel } from "./ui.jsx";
import { STEPS, CARRIERS, StepDemandeur, Step1, Step2, Step3, Step4, Checklist, orgaRules, ORGA_INFO, Step5, Step6, TrackingFields, Step7 } from "./steps.jsx";

// ---------- documents téléchargeables (fichiers placés dans le dossier public/)
const DOCUMENTS = {
  WS: [{
    filename: "Wine_Spectator_Information_Form_2026.xlsx",
    titre: "Formulaire d'information Wine Spectator 2026",
    desc: "À remplir (un vin par ligne) et à envoyer à napatastings@mshanken.com pour obtenir la pré-approbation, avant toute PDM.",
    taille: "1,7 Mo",
  }],
  WE: [],
};

function DocumentCard({ doc }) {
  return (
    <div className="doc-card">
      <div className="doc-icon" aria-hidden="true">XLSX</div>
      <div className="doc-text">
        <div className="cat-ref">{doc.titre}</div>
        <div className="cat-app">{doc.desc}</div>
        <div className="doc-meta">{doc.filename}, {doc.taille}</div>
      </div>
      <a className="btn btn-primary btn-small" href={import.meta.env.BASE_URL + doc.filename} download={doc.filename}>
        Télécharger
      </a>
    </div>
  );
}

// ---------- adresses
function Addresses() {
  const regionsFor = (id) => {
    const out = [];
    if (id === "WS_NAPA") out.push("Tous les vins, toutes origines");
    Object.entries(WE_REGIONS).forEach(([r, [d, who]]) => d === id && out.push(`${r} (${who})`));
    if (id === "WE_HQ") out.push("Vins sans alcool");
    if (id === "WE_NEWMAN") out.push("Spiritueux et vermouths");
    return out;
  };
  const [tab, setTab] = useState("WS");
  const c = tab;
  const rules = orgaRules(c, null);
  const info = ORGA_INFO[c];
  return (
    <div className="panel">
      <h2 className="panel-title">Consignes et adresses</h2>
      <p className="muted">Les règles de chaque organisme, telles qu'elles s'appliquent aux envois.</p>
      <div className="tabs" role="tablist">
        {["WS", "WE"].map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} className={"tab" + (tab === k ? " on" : "")} onClick={() => setTab(k)}>
            {CRITIQUES[k].nom}
          </button>
        ))}
      </div>

      {DOCUMENTS[c].length > 0 && (
        <section>
          <h3>Documents</h3>
          {DOCUMENTS[c].map((doc) => <DocumentCard key={doc.filename} doc={doc} />)}
        </section>
      )}

      <dl className="orga-facts">
        <div><dt>Échantillons</dt><dd>{info.echantillons}</dd></div>
        <div><dt>Livraison</dt><dd>{info.livraison}</dd></div>
        <div>
          <dt>Contacts</dt>
          <dd>{info.contacts.map(([l, m]) => <div key={m}>{l} : <a href={"mailto:" + m}>{m}</a></div>)}</dd>
        </div>
      </dl>

      <div className="consignes">
        <section>
          <h3>Avant d'envoyer une PDM</h3>
          <ul className="notes notes-ink">{rules.avant.map(([k, t]) => <li key={k}>{t}</li>)}</ul>
        </section>
        <section>
          <h3>Bon à savoir</h3>
          <ul className="notes">{rules.savoir.map((t) => <li key={t}>{t}</li>)}</ul>
        </section>
      </div>

      <section>
        <h3>Adresses et consignes d'envoi</h3>
        <p className="muted">Ces consignes sont reprises dans les mails de PDM.</p>
        <div className="dest-grid">
          {Object.entries(DESTINATIONS).filter(([, d]) => d.critique === c).map(([id, d]) => (
            <div key={id} className="dest-card">
              <div className="cat-ref">{d.titre}</div>
              {d.adresse.map((l) => <div key={l} className="addr">{l}</div>)}
              <div className="cat-app">{d.tel}{d.email ? `, ${d.email}` : ""}</div>
              <div className="routes">
                <span className="k">Reçoit</span>
                <ul>{regionsFor(id).map((r) => <li key={r}>{r}</li>)}</ul>
              </div>
              <div className="routes">
                <span className="k">Consignes d'envoi</span>
                <ul>
                  {d.zone === "UE" && <li>{ROUTE_TXT.eu.fr}</li>}
                  {d.consignes.map((k) => <li key={k}>{CONSIGNES[k].fr}</li>)}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default Addresses;
