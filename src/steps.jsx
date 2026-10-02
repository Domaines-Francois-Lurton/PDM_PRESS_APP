// Étapes de l'assistant
import React, { useState, useMemo, useEffect } from "react";
import {
  CATALOGUE, CAT, ORIGINES, FILIALES, CRITIQUES, DESTINATIONS, WE_REGIONS, route, qtyFor, unitLabel, wineName, IMPORTATEURS, importerFor, isOn, buildPdms, colaLines, CONSIGNES, ROUTE_TXT, routeKey, ROUTE_COURT, MAIL, PREP_COLOR, escHtml, buildMail, requesterName, dossierStatut, uid, emptyDraft,
} from "./logic.js";
import { copyText, fmtDate, Badge, CritTag, Callout, Segmented, copyRich, CopyButton, ConfirmDialog, PdmLabel } from "./ui.jsx";

const STEPS = [
  "Demandeur",
  "Vins et origine",
  "Critiques",
  "Demandes d'échantillons",
  "COLA",
  "Consignes d'envoi",
  "Mails de PDM",
  "Suivi des colis",
];
const CARRIERS = ["DHL Express", "FedEx", "UPS", "TNT", "Chronopost", "Autre"];

// ---------- étape « Demandeur »
function StepDemandeur({ draft, set, names }) {
  const current = requesterName(draft);
  return (
    <div>
      <p className="muted">Votre nom est enregistré dans l'historique et signe les mails de PDM.</p>
      <div className="who-fields">
        <label className="field">
          <span>Prénom</span>
          <input value={draft.prenom} onChange={(e) => set({ prenom: e.target.value })} autoComplete="given-name" />
        </label>
        <label className="field">
          <span>Nom</span>
          <input value={draft.nom} onChange={(e) => set({ nom: e.target.value })} autoComplete="family-name" />
        </label>
      </div>
      {names.length > 0 && (
        <div className="recent">
          <span className="k">Déjà utilisés</span>
          <div className="chips">
            {names.map((n) => {
              const [p, ...r] = n.split(" ");
              return (
                <button key={n} type="button" className={"chip chip-small" + (current === n ? " on" : "")} aria-pressed={current === n}
                  onClick={() => set({ prenom: p, nom: r.join(" ") })}>
                  {n}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- étape 1
function Step1({ draft, set }) {
  const [q, setQ] = useState("");
  const toggleOrigine = (o) =>
    set({ origines: draft.origines.includes(o) ? draft.origines.filter((x) => x !== o) : [...draft.origines, o] });
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return CATALOGUE.filter(
      (w) =>
        draft.origines.includes(w.f) &&
        (!s || (w.g + " " + w.ref + " " + w.app + " " + (w.cep || "")).toLowerCase().includes(s))
    );
  }, [q, draft.origines]);
  const groups = useMemo(() => {
    const m = new Map();
    list.forEach((w) => {
      if (!m.has(w.g)) m.set(w.g, []);
      m.get(w.g).push(w);
    });
    return [...m.entries()];
  }, [list]);
  const count = (id) => draft.lines.filter((l) => l.wineId === id).length;
  const add = (w) => set({ lines: [...draft.lines, { uid: uid(), wineId: w.id, vintage: "", comment: "" }] });
  const upd = (u, patch) => set({ lines: draft.lines.map((l) => (l.uid === u ? { ...l, ...patch } : l)) });
  const del = (u) => set({ lines: draft.lines.filter((l) => l.uid !== u) });

  return (
    <div className="step1">
      <section>
        <h3>D'où viennent les vins ?</h3>
        <p className="muted">L'origine détermine la filiale qui prépare les échantillons et l'adresse de livraison.</p>
        <div className="chips">
          {ORIGINES.map((o) => (
            <button
              key={o}
              type="button"
              className={"chip" + (draft.origines.includes(o) ? " on" : "")}
              aria-pressed={draft.origines.includes(o)}
              onClick={() => toggleOrigine(o)}
            >
              {o}
            </button>
          ))}
        </div>
      </section>

      <div className="split">
        <section className="catalogue">
          <div className="cat-head">
            <h3>Catalogue</h3>
            {draft.origines.length > 0 && (
              <input
                className="search"
                placeholder="Rechercher un vin, une appellation…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Rechercher dans le catalogue"
              />
            )}
          </div>
          {!draft.origines.length && <p className="empty">Choisissez une ou plusieurs origines pour afficher les vins.</p>}
          {draft.origines.length > 0 && !list.length && <p className="empty">Aucun vin ne correspond à « {q} ».</p>}
          {groups.length > 0 && <div className="cat-list">
            {groups.map(([g, ws]) => (
              <div key={g} className="cat-group">
                <div className="cat-gname">{g}</div>
                {ws.map((w) => (
                  <div key={w.id} className="cat-row">
                    <div>
                      <div className="cat-ref">
                        {w.ref}
                        {w.t !== "vin" && <span className="type-tag">{w.t}</span>}
                      </div>
                      <div className="cat-app">{w.app}</div>
                    </div>
                    <button type="button" className="btn btn-small" onClick={() => add(w)}>
                      {count(w.id) ? `Ajouter encore (${count(w.id)})` : "Ajouter"}
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>}
        </section>

        <section className="selection">
          <h3>Vins à envoyer <span className="count">{draft.lines.length}</span></h3>
          {!draft.lines.length && <p className="empty">Ajoutez des vins depuis le catalogue.</p>}
          {draft.lines.map((l) => {
            const w = CAT[l.wineId];
            return (
              <div key={l.uid} className="sel-row">
                <div className="sel-top">
                  <div>
                    <div className="cat-ref">{wineName(w)}</div>
                    <div className="cat-app">{w.app}, {w.f}</div>
                  </div>
                  <button type="button" className="link-btn" onClick={() => del(l.uid)} aria-label={"Retirer " + w.ref}>
                    Retirer
                  </button>
                </div>
                <div className="sel-fields">
                  <label className="field field-inline">
                    <span>Millésime</span>
                    <input
                      value={l.vintage}
                      inputMode="numeric"
                      placeholder={w.t === "vin" ? "2024" : "facultatif"}
                      onChange={(e) => upd(l.uid, { vintage: e.target.value })}
                      className={w.t === "vin" && !l.vintage.trim() ? "need" : ""}
                    />
                  </label>
                  <label className="field field-grow">
                    <span>Préparation des bouteilles</span>
                    <input
                      value={l.comment}
                      placeholder="ex. contre-étiquette US, capsule neuve"
                      onChange={(e) => upd(l.uid, { comment: e.target.value })}
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}

// ---------- étape 2
function Step2({ draft, set }) {
  const toggleC = (c) => set({ critiques: { ...draft.critiques, [c]: !draft.critiques[c] } });
  const active = ["WS", "WE"].filter((c) => draft.critiques[c]);
  const toggleEx = (line, c) => {
    const k = line.uid + "|" + c;
    set({ excl: { ...draft.excl, [k]: !draft.excl[k] } });
  };
  const summary = {
    WS: "Une seule adresse, à Napa. Pré-approbation obligatoire avant l'envoi. Pas de frais.",
    WE: "Adresse selon la région du vin. Saisie sur la Ratings Platform, 95 $ par référence.",
  };
  return (
    <div>
      <h3>À qui envoyer les vins ?</h3>
      <div className="crit-cards">
        {["WS", "WE"].map((c) => (
          <button
            key={c}
            type="button"
            className={"crit-card" + (draft.critiques[c] ? " on" : "")}
            aria-pressed={draft.critiques[c]}
            onClick={() => toggleC(c)}
          >
            <span className="crit-card-top">
              <CritTag c={c} />
              <span className="check" aria-hidden="true">{draft.critiques[c] ? "✓" : ""}</span>
            </span>
            <span className="crit-card-name">{CRITIQUES[c].nom}</span>
            <span className="crit-card-sum">{summary[c]}</span>
          </button>
        ))}
      </div>

      {active.length > 0 && (
        <section>
          <h3>Vin par vin</h3>
          <p className="muted">Décochez un vin pour ne pas l'envoyer à un critique.</p>
          <div className="table-wrap">
            <table className="matrix">
              <thead>
                <tr>
                  <th scope="col">Vin</th>
                  {active.map((c) => <th key={c} scope="col">{CRITIQUES[c].nom}</th>)}
                </tr>
              </thead>
              <tbody>
                {draft.lines.map((l) => {
                  const w = CAT[l.wineId];
                  return (
                    <tr key={l.uid}>
                      <th scope="row">
                        {wineName(w)} <span className="vint">{l.vintage}</span>
                      </th>
                      {active.map((c) => {
                        const r = route(w, c);
                        if (!r.ok) return <td key={c} className="na">{r.raison}</td>;
                        return (
                          <td key={c}>
                            <label className="cb">
                              <input type="checkbox" checked={isOn(draft, l, c)} onChange={() => toggleEx(l, c)} />
                              <span>{DESTINATIONS[r.dest].titre === "Wine Spectator Annex" ? "Napa" : r.reviewer}</span>
                            </label>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

// ---------- étape 3
function Step3({ draft }) {
  const { pdms } = buildPdms(draft, false);
  return (
    <div>
      <div className="big-count">
        <span className="n">{pdms.length}</span>
        <span>{pdms.length > 1 ? "demandes d'échantillons à faire" : "demande d'échantillons à faire"}</span>
      </div>
      <p className="muted">Une PDM par filiale et par adresse de livraison. Le nombre final dépend encore des COLA (étape suivante).</p>
      <div className="labels">
        {pdms.map((p) => <PdmLabel key={p.id} pdm={p} />)}
      </div>
    </div>
  );
}

// ---------- étape 4
function Step4({ draft, set }) {
  const needs = colaLines(draft);
  const needIds = new Set(needs.map((l) => l.uid));
  const euOnly = draft.lines.filter(
    (l) => !needIds.has(l.uid) && ["WS", "WE"].some((c) => isOn(draft, l, c))
  );
  const setCola = (u, v) => set({ cola: { ...draft.cola, [u]: v } });
  const nonCount = needs.filter((l) => draft.cola[l.uid] === "non").length;
  return (
    <div>
      <h3>La demande de COLA a-t-elle été faite ?</h3>
      <p className="muted">Le COLA (Certificate of Label Approval) est indispensable pour tout envoi vers les USA.</p>
      {!needs.length && <p className="empty">Aucun vin ne part aux USA : pas de COLA à vérifier.</p>}
      <div className="cola-list">
        {needs.map((l) => {
          const w = CAT[l.wineId];
          const dests = ["WS", "WE"]
            .filter((c) => isOn(draft, l, c))
            .map((c) => route(w, c))
            .filter((r) => DESTINATIONS[r.dest].zone === "US");
          return (
            <div key={l.uid} className={"cola-row" + (draft.cola[l.uid] === "non" ? " is-no" : "")}>
              <div>
                <div className="cat-ref">{wineName(w)} <span className="vint">{l.vintage}</span></div>
                <div className="cat-app">Part vers : {dests.map((r) => DESTINATIONS[r.dest].titre).join(", ")}</div>
                {importerFor(w) ? (
                  <div className="cat-app">Importateur US : <strong className="imp">{importerFor(w)}</strong></div>
                ) : (
                  <div className="cat-app imp-none">Aucun importateur US référencé</div>
                )}
              </div>
              <Segmented
                label={"COLA pour " + w.ref}
                value={draft.cola[l.uid]}
                onChange={(v) => setCola(l.uid, v)}
                options={[
                  { value: "oui", label: "Oui", tone: "green" },
                  { value: "non", label: "Non", tone: "wine" },
                ]}
              />
            </div>
          );
        })}
      </div>
      {nonCount > 0 && (
        <Callout tone="wine" title={nonCount > 1 ? `${nonCount} vins bloqués pour les USA` : "1 vin bloqué pour les USA"}>
          {nonCount > 1
            ? "Ils sont retirés des PDM vers les USA et restent dans les envois vers l'Europe s'il y en a. Le dossier les garde en attente de COLA : vous pourrez relancer l'envoi depuis l'historique."
            : "Il est retiré des PDM vers les USA et reste dans les envois vers l'Europe s'il y en a. Le dossier le garde en attente de COLA : vous pourrez relancer l'envoi depuis l'historique."} Pour un vin non importé, Wine Enthusiast propose une dérogation COLA
          via son partenaire d'import (Europe uniquement) : submissionssupport@wineenthusiast.com.
        </Callout>
      )}
      {euOnly.length > 0 && (
        <section className="eu-only">
          <h4>Sans COLA, envoi dans l'UE</h4>
          <ul>
            {euOnly.map((l) => {
              const w = CAT[l.wineId];
              return <li key={l.uid}>{wineName(w)} {l.vintage}</li>;
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

// ---------- étape 5
function Checklist({ items, draft, set }) {
  return (
    <ul className="checklist">
      {items.map(([k, label]) => (
        <li key={k}>
          <label className="cb">
            <input
              type="checkbox"
              checked={!!draft.check[k]}
              onChange={() => set({ check: { ...draft.check, [k]: !draft.check[k] } })}
            />
            <span>{label}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}

// Consignes par organisme. ctx = contexte d'un envoi (null = version générale, onglet Consignes)
function orgaRules(c, ctx) {
  if (c === "WS") {
    const caisses = !ctx
      ? ", nombre de caisses importées (obligatoire pour l'Amérique du Sud, l'Australie et la Nouvelle-Zélande)"
      : ctx.southAm ? ", nombre de caisses importées (obligatoire pour le Chili et l'Argentine)" : "";
    return {
      avant: [
        ["ws_form", <>
          Envoyés à napatastings@mshanken.com :
          <span className="sub-item">Formulaire d'information : prix de vente conseillé, production en caisses, date de sortie{caisses}</span>
          <span className="sub-item">Photo de l'étiquette : taille réelle, 330 dpi minimum, jpg, millésime exact</span>
        </>],
        ["ws_ok", "Pré-approbation reçue de Wine Spectator pour chaque vin"],
      ],
      savoir: [
        "Pas de frais de dégustation. 2 bouteilles par vin, quel que soit le bouchage.",
        `Envoyer les vins avant leur date de sortie (release date) ou dans les 60 jours qui suivent, soit une sortie après le ${new Date(Date.now() - 60 * 864e5).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}.`,
        "Indiquer le taux de sucre résiduel s'il y en a, et le détail de l'assemblage si les cépages ne figurent pas sur l'étiquette.",
        "Wine Spectator ne communique ni la réception, ni le statut, ni la note avant publication. Ne pas relancer.",
      ],
    };
  }
  const savoir = [
    "Les frais ne sont pas remboursés en cas de refus : étiquette illisible ou non approuvée TTB, échantillon de cuve, doublon.",
    "Si un échantillon est bouchonné, WE demande une deuxième bouteille, sans remboursement.",
    "Aucun délai de publication garanti. Le statut se suit sur la Ratings Platform.",
  ];
  if (!ctx || ctx.hasSpirits) savoir.push("Spiritueux : vérifier la date d'envoi dans le calendrier spiritueux 2026 de WE.");
  return {
    avant: [
      ["we_rp", "Chaque référence saisie sur la Ratings Platform (ratingsplatform.wineenthusiast.com)"],
      ["we_qr", "Fiches QR code (Shipment Barcode) imprimées et jointes aux mails de PDM"],
    ],
    savoir,
  };
}

const ORGA_INFO = {
  WS: {
    echantillons: "2 bouteilles par vin. Pas de spiritueux.",
    contacts: [["Dégustations Napa", "napatastings@mshanken.com"]],
    livraison: "Remise en main propre possible à l'Annex de Napa, du lundi au vendredi de 9 h à midi.",
  },
  WE: {
    echantillons: "2 bouteilles par vin, 2 unités par RTD, 1 bouteille par spiritueux.",
    contacts: [
      ["Ratings Platform et soumissions", "submissionssupport@wineenthusiast.com"],
      ["Autres questions", "tastings@wineenthusiast.com"],
    ],
    livraison: "Adresse selon la région du vin. Envois vers Roger Voss et John Sumners depuis l'UE uniquement.",
  },
};

function Step5({ draft, set }) {
  const { pdms } = buildPdms(draft, true);
  const active = ["WS", "WE"].filter((c) => pdms.some((p) => p.critique === c));
  const [tab, setTab] = useState(active[0]);
  const cur = active.includes(tab) ? tab : active[0];
  if (!active.length) return <p className="empty">Aucun envoi possible : revenez aux étapes précédentes.</p>;
  const hasSpirits = pdms.some((p) => p.dest === "WE_NEWMAN");
  const southAm = pdms.some((p) => p.critique === "WS" && (p.filiale === "Chili" || p.filiale === "Argentine"));
  const destIds = [...new Set(pdms.filter((p) => p.critique === cur).map((p) => p.dest))];
  const rules = orgaRules(cur, { hasSpirits, southAm });

  return (
    <div>
      <div className="tabs" role="tablist">
        {active.map((c) => (
          <button key={c} role="tab" aria-selected={cur === c} className={"tab" + (cur === c ? " on" : "")} onClick={() => setTab(c)}>
            {CRITIQUES[c].nom}
          </button>
        ))}
      </div>

      <div className="consignes">
        <section>
          <h3>Avant d'envoyer la PDM</h3>
          <Checklist draft={draft} set={set} items={rules.avant} />
        </section>
        <section>
          <h3>Bon à savoir</h3>
          <ul className="notes">{rules.savoir.map((t) => <li key={t}>{t}</li>)}</ul>
        </section>
      </div>

      <section>
        <h3>Consignes par adresse</h3>
        <p className="muted">Elles sont reprises automatiquement dans les mails de l'étape suivante.</p>
        <div className="dest-grid">
          {destIds.map((id) => {
            const d = DESTINATIONS[id];
            return (
              <div key={id} className="dest-card">
                <div className="cat-ref">{d.titre}</div>
                <div className="cat-app">{d.adresse.slice(-2).join(", ")}</div>
                <ul>
                  {d.consignes.map((k) => <li key={k}>{CONSIGNES[k].fr}</li>)}
                </ul>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// ---------- étape 6
function Step6({ draft, set, user }) {
  const { pdms, blocked } = buildPdms(draft, true);
  const hasWS = pdms.some((p) => p.critique === "WS");
  const hasWE = pdms.some((p) => p.critique === "WE");
  const lang = (p) => draft.langs[p.id] || FILIALES[p.filiale].langue;
  return (
    <div>
      <div className="big-count">
        <span className="n">{pdms.length}</span>
        <span>{pdms.length > 1 ? "mails de PDM à envoyer" : "mail de PDM à envoyer"}</span>
      </div>
      {hasWS && !draft.check.ws_ok && (
        <Callout tone="amber" title="Pré-approbation Wine Spectator non cochée">
          N'envoyez les PDM Wine Spectator qu'après l'accord de WS (étape 6).
        </Callout>
      )}
      {hasWE && !draft.check.we_qr && (
        <Callout tone="amber" title="Fiches QR code Wine Enthusiast">
          Pensez à joindre la fiche QR code de la Ratings Platform à chaque mail de PDM Wine Enthusiast.
        </Callout>
      )}
      {blocked.length > 0 && (
        <Callout tone="wine" title="En attente de COLA, non inclus">
          {blocked.map((b) => `${b.ref} ${b.vintage} (${CRITIQUES[b.critique].nom})`).join(", ")}
        </Callout>
      )}
      <div className="mails">
        {pdms.map((p) => {
          const l = lang(p);
          const m = buildMail(p, l, user);
          return (
            <div key={p.id} className="mail">
              <PdmLabel pdm={p} compact />
              <div className="mail-bar">
                <Segmented
                  label={"Langue du mail PDM" + p.num}
                  value={l}
                  onChange={(v) => set({ langs: { ...draft.langs, [p.id]: v } })}
                  options={[{ value: "fr", label: "FR" }, { value: "es", label: "ES" }, { value: "en", label: "EN" }]}
                />
                <div className="mail-actions">
                  <CopyButton text={m.subject} label="Copier l'objet" />
                  <CopyButton text={m.body} html={m.html} label="Copier le mail" />
                </div>
              </div>
              <div className="mail-subject"><span className="k">Objet</span> {m.subject}</div>
              <pre className="mail-body" tabIndex={0}>
                {m.lines.map((l, i) => (
                  <React.Fragment key={i}>
                    {l.prep ? <strong className="mail-prep">{l.text}</strong> : l.text}
                    {"\n"}
                  </React.Fragment>
                ))}
              </pre>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- étape 7
function TrackingFields({ value = {}, onChange, idp }) {
  const v = { carrier: "", number: "", date: "", ...value };
  return (
    <div className="track-fields">
      <label className="field">
        <span>Transporteur</span>
        <select value={v.carrier} onChange={(e) => onChange({ ...v, carrier: e.target.value })}>
          <option value="">Choisir</option>
          {CARRIERS.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <label className="field field-grow">
        <span>Numéro de suivi</span>
        <input value={v.number} onChange={(e) => onChange({ ...v, number: e.target.value })} placeholder="Reçu de la filiale" />
      </label>
      <label className="field">
        <span>Date d'envoi</span>
        <input type="date" value={v.date} onChange={(e) => onChange({ ...v, date: e.target.value })} />
      </label>
    </div>
  );
}

function Step7({ draft, set }) {
  const { pdms } = buildPdms(draft, true);
  return (
    <div>
      <h3>Numéros de suivi</h3>
      <p className="muted">Saisissez-les dès que les filiales les transmettent. Vous pourrez aussi les compléter plus tard dans l'historique.</p>
      <div className="track-list">
        {pdms.map((p) => (
          <div key={p.id} className="track-row">
            <div className="track-id">
              <span className="label-num small">PDM{p.num}</span>
              <div>
                <div className="cat-ref">{FILIALES[p.filiale].prepa} vers {DESTINATIONS[p.dest].titre}</div>
                <div className="cat-app">{p.items.length} vin{p.items.length > 1 ? "s" : ""}, {CRITIQUES[p.critique].nom}</div>
              </div>
            </div>
            <TrackingFields
              value={draft.tracking[p.id]}
              onChange={(t) => set({ tracking: { ...draft.tracking, [p.id]: t } })}
            />
            {p.critique === "WS" && <p className="hint">Ne pas transmettre ce numéro à Wine Spectator.</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

export { STEPS, CARRIERS, StepDemandeur, Step1, Step2, Step3, Step4, Checklist, orgaRules, ORGA_INFO, Step5, Step6, TrackingFields, Step7 };
