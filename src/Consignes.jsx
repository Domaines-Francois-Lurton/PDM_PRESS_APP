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

// ---------- « Proposer un vin, étape par étape » : de la soumission à la PDM
// Pour modifier une étape, c'est ici. note = précision interne (en ambre), doc = fichier à télécharger, mail / link = bouton, pdm = bouton « Nouvelle PDM »
const PROCEDURES = {
  WS: [
    { titre: "Remplir le formulaire d'information", texte: "Télécharger le fichier Excel et le compléter.", doc: DOCUMENTS.WS[0] },
    {
      titre: "L'envoyer avec la photo de chaque étiquette",
      texte: "Photo en taille réelle, 330 dpi minimum, jpg, au bon millésime. Ajouter la contre-étiquette si le millésime ou l'appellation n'est pas sur la face.",
      note: "Le service marketing fournit les liens vers les visuels des étiquettes.",
      mail: "napatastings@mshanken.com",
    },
    { titre: "Attendre la pré-approbation", texte: "Wine Spectator répond avec la liste des vins acceptés : n'envoyer que ceux-là." },
    { titre: "Vérifier le COLA et l'importateur US", texte: "Wine Spectator ne note que des vins importés aux USA. L'envoi doit arriver dédouané." },
    { titre: "Faire la demande d'échantillons", texte: "2 bouteilles par vin, colis marqués « Approved ».", pdm: true },
  ],
  WE: [
    {
      titre: "Se connecter à la Ratings Platform", texte: "Le portail en ligne de Wine Enthusiast pour proposer des vins.",
      link: ["Ouvrir la Ratings Platform", "https://ratingsplatform.wineenthusiast.com/login"],
    },
    { titre: "Saisir chaque référence", texte: "Une fiche par vin et par millésime." },
    { titre: "Régler les frais", texte: "95 $ par référence, non remboursables, même en cas de refus." },
    { titre: "Imprimer la fiche QR code", texte: "La fiche « Shipment Barcode » de la plateforme, à glisser dans chaque colis." },
    { titre: "Faire la demande d'échantillons", texte: "Joindre la fiche QR code aux mails de PDM. 2 bouteilles par vin, 1 par spiritueux.", pdm: true },
  ],
};

function Procedure({ c, onNew }) {
  return (
    <section>
      <h3>Proposer un vin, étape par étape</h3>
      <ol className="proc">
        {PROCEDURES[c].map((s, i) => (
          <li key={s.titre} className="proc-step">
            <span className="st-n">{i + 1}</span>
            <div className="proc-body">
              <div className="cat-ref">{s.titre}</div>
              <p className="cat-app">{s.texte}</p>
              {s.note && <p className="proc-note">{s.note}</p>}
              {s.doc && <DocumentCard doc={s.doc} />}
              {s.mail && <a className="btn btn-small" href={"mailto:" + s.mail}>Écrire à {s.mail}</a>}
              {s.link && <a className="btn btn-small" href={s.link[1]} target="_blank" rel="noopener noreferrer">{s.link[0]}</a>}
              {s.pdm && onNew && <button type="button" className="btn btn-primary btn-small" onClick={onNew}>Nouvelle PDM</button>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ---------- « Où envoyer ce vin ? » : routage sans passer par une demande
const PRODUITS = [["vin", "Vin"], ["na", "Vin sans alcool"], ["spiritueux", "Spiritueux"], ["vermouth", "Vermouth"]];
const REGIONS_ORIGINE = {
  France: [
    ["Alsace"], ["Bandol"], ["Beaujolais"], ["Bordeaux"], ["Bourgogne"], ["Champagne"], ["Corse"], ["Jura, Savoie"],
    ["Languedoc-Roussillon", "Languedoc-Roussillon, Pays d'Oc"], ["Méditerranée", "Méditerranée (IGP)"], ["Provence"],
    ["Sud-Ouest", "Sud-Ouest, dont Côtes de Gascogne"], ["Vallée de la Loire"], ["Vallée du Rhône"], ["Vin de France"],
    ["Autre région de France"],
  ].map(([v, l]) => [v, l || v]),
  Espagne: [
    ["Andalousie"], ["Aragon"], ["Castille-et-León (hors Toro, Ribera del Duero)"], ["Castille-La Manche"], ["Catalogne"],
    ["Cava (toutes zones)"], ["Estrémadure"], ["Galice"], ["Îles (Baléares, Canaries)"], ["La Rioja"], ["Madrid"], ["Murcie"],
    ["Navarre"], ["Pays basque"], ["Ribera del Duero"], ["Rueda"], ["Toro"], ["Valence"],
  ].map(([v, l]) => [v, l || v]),
  Argentine: [["Mendoza", "Mendoza"]],
  Chili: [["Colchagua", "Colchagua"]],
};

function WhereTo({ c }) {
  const [f, setF] = useState("");
  const [p, setP] = useState("");
  const [r, setR] = useState("");
  const regions = f ? REGIONS_ORIGINE[f] : [];
  const needRegion = c === "WE" && p === "vin" && regions.length > 1;
  const ready = f && p && (!needRegion || r);
  const wine = { t: p === "na" ? "vin" : p, na: p === "na", r: needRegion ? r : regions[0]?.[0], f, ref: "" };
  const res = ready ? route(wine, c) : null;
  const dest = res?.ok ? DESTINATIONS[res.dest] : null;
  const rk = dest ? routeKey({ dest: res.dest, filiale: f }) : null;
  const qty = qtyFor(wine);
  const importer = f === "Espagne"
    ? "VinAmericas (Campo Eliseo), Pardela USA (Hermanos), aucun pour les autres références"
    : importerFor(wine) || "Aucun importateur US référencé";

  return (
    <section className="finder">
      <h3>Où envoyer ce vin chez {CRITIQUES[c].nom} ?</h3>
      <div className="finder-fields">
        <label className="field">
          Origine
          <select value={f} onChange={(e) => { setF(e.target.value); setR(""); }}>
            <option value="">Choisir…</option>
            {ORIGINES.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
        <label className="field">
          Produit
          <select value={p} onChange={(e) => setP(e.target.value)}>
            <option value="">Choisir…</option>
            {PRODUITS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        {needRegion && (
          <label className="field">
            Région
            <select value={r} onChange={(e) => setR(e.target.value)}>
              <option value="">Choisir…</option>
              {regions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        )}
      </div>

      {!ready && <p className="muted">Choisissez l'origine et le produit{needRegion ? ", puis la région" : ""} pour voir l'adresse et les consignes.</p>}
      {res && !res.ok && <Callout tone="wine" title="Envoi impossible">{res.raison}.</Callout>}
      {dest && (
        <>
          {res.note && <Callout title="À vérifier">{res.note}.</Callout>}
          <div className="finder-result">
            <article className="label">
              <header className="label-head">
                <div className="label-meta"><CritTag c={c} /><span>{CRITIQUES[c].nom}</span></div>
                <span className="cat-app">{res.reviewer}</span>
              </header>
              <div className="label-from">
                <span className="k">Préparé par</span>
                <span className="v">{FILIALES[f].prepa}</span>
                <span className="route-pill">{ROUTE_COURT[rk]}</span>
              </div>
              <div className="label-to">
                <div className="k">Livrer à</div>
                <div className="v">{dest.titre}</div>
                {dest.adresse.map((l) => <div key={l} className="addr">{l}</div>)}
                <div className="cat-app">{dest.tel}{dest.email ? `, ${dest.email}` : ""}</div>
              </div>
            </article>
            <div>
              <dl className="finder-facts">
                <div><dt>Quantité</dt><dd>{qty} {unitLabel(wine, qty, "fr")} par référence</dd></div>
                <div><dt>COLA</dt><dd>{dest.zone === "US" ? `Requis. Importateur US : ${importer}` : "Non requis (envoi en Europe)"}</dd></div>
              </dl>
              <div className="k">Consignes d'envoi</div>
              <ul className="notes notes-ink">
                <li>{ROUTE_TXT[rk].fr}</li>
                {dest.consignes.map((k) => <li key={k}>{CONSIGNES[k].fr}</li>)}
              </ul>
              <p className="cat-app">Règles générales de {CRITIQUES[c].nom} : voir plus bas.</p>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

// ---------- adresses
function Addresses({ onNew }) {
  const regionsFor = (id) => {
    const out = [];
    if (id === "WS_NAPA") out.push("Tous les vins, toutes origines");
    // Regroupées par critique : « Aleks Zecevic : Alsace, Jura, Savoie, Vin de France »
    const byWho = {};
    Object.entries(WE_REGIONS).forEach(([r, [d, who]]) => d === id && (byWho[who] = [...(byWho[who] || []), r]));
    Object.entries(byWho).forEach(([who, rs]) => out.push(`${who} : ${rs.join(", ")}`));
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
      <Procedure c={tab} onNew={onNew} />
      <WhereTo c={tab} />

      <dl className="orga-facts">
        <div><dt>Échantillons</dt><dd>{info.echantillons}</dd></div>
        <div><dt>Livraison</dt><dd>{info.livraison}</dd></div>
        <div>
          <dt>Contacts</dt>
          <dd>{info.contacts.map(([l, m]) => <div key={m}>{l} : <a href={"mailto:" + m}>{m}</a></div>)}</dd>
        </div>
      </dl>

      <section>
        <h3>Bon à savoir</h3>
        <ul className="notes">{rules.savoir.map((t) => <li key={t}>{t}</li>)}</ul>
      </section>

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
