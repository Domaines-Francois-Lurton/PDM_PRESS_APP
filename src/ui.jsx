// Petits composants partagés
import React, { useState, useEffect } from "react";
import {
  CATALOGUE, CAT, ORIGINES, FILIALES, CRITIQUES, DESTINATIONS, WE_REGIONS, route, qtyFor, unitLabel, wineName, IMPORTATEURS, importerFor, isOn, buildPdms, colaLines, CONSIGNES, ROUTE_TXT, routeKey, ROUTE_COURT, MAIL, PREP_COLOR, escHtml, buildMail, requesterName, dossierStatut, uid, emptyDraft,
} from "./logic.js";

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (e2) {}
    document.body.removeChild(ta);
    return ok;
  }
}

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

// ---------- petits composants
function Badge({ tone = "neutral", children }) {
  return <span className={"badge badge-" + tone}>{children}</span>;
}
function CritTag({ c }) {
  return <span className={"crit crit-" + c}>{c}</span>;
}
function Callout({ tone = "amber", title, children }) {
  return (
    <div className={"callout callout-" + tone} role={tone === "wine" ? "alert" : undefined}>
      {title && <strong>{title}</strong>}
      <div>{children}</div>
    </div>
  );
}
function Segmented({ value, options, onChange, label }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={"seg-btn" + (value === o.value ? " on" : "") + (o.tone ? " tone-" + o.tone : "")}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
// Copie en texte enrichi (gras et couleur conservés dans Outlook, Gmail…), avec repli en texte brut
async function copyRich(html, text) {
  try {
    if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        }),
      ]);
      return true;
    }
  } catch (e) {}
  try {
    const div = document.createElement("div");
    div.contentEditable = "true";
    div.innerHTML = html;
    Object.assign(div.style, { position: "fixed", left: "-9999px", top: "0" });
    document.body.appendChild(div);
    const range = document.createRange();
    range.selectNodeContents(div);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    const ok = document.execCommand("copy");
    sel.removeAllRanges();
    document.body.removeChild(div);
    if (ok) return true;
  } catch (e) {}
  return copyText(text);
}

function CopyButton({ text, html, label }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-small"
      onClick={async () => {
        const ok = html ? await copyRich(html, text) : await copyText(text);
        setDone(ok ? "Copié" : "Copie impossible");
        setTimeout(() => setDone(false), 1800);
      }}
    >
      {done || label}
    </button>
  );
}

// ---------- boîte de confirmation (les confirmations natives du navigateur sont bloquées dans une page intégrée)
function ConfirmDialog({ state, onClose }) {
  useEffect(() => {
    if (!state) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state]);
  if (!state) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="cd-title" onClick={(e) => e.stopPropagation()}>
        <h3 id="cd-title">{state.title}</h3>
        <p className="muted">{state.message}</p>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>Annuler</button>
          <button type="button" className={"btn " + (state.danger ? "btn-danger" : "btn-primary")} autoFocus
            onClick={() => { onClose(); state.onOk(); }}>
            {state.okLabel || "Confirmer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- étiquette PDM (élément signature)
function PdmLabel({ pdm, compact }) {
  const dest = DESTINATIONS[pdm.dest];
  const fil = FILIALES[pdm.filiale];
  const rk = routeKey(pdm);
  const total = pdm.items.reduce((s, i) => s + i.qty, 0);
  return (
    <article className="label">
      <header className="label-head">
        <div className="label-num">PDM{pdm.num}</div>
        <div className="label-meta">
          <CritTag c={pdm.critique} />
          <span>{CRITIQUES[pdm.critique].nom}</span>
        </div>
      </header>
      <div className="label-from">
        <span className="k">Préparé par</span>
        <span className="v">{fil.nom}</span>
        <span className="s">{fil.pays}</span>
        <span className="route-pill">
          <svg viewBox="0 0 24 10" width="20" height="10" aria-hidden="true"><path d="M0 5h21M16 1l5 4-5 4" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
          {ROUTE_COURT[rk]}
        </span>
      </div>
      <div className="label-to">
        <div className="k">Livrer à</div>
        <div className="v">{dest.titre}</div>
        {compact ? (
          <div className="addr">{dest.adresse.slice(-2).join(", ")}</div>
        ) : (
          dest.adresse.map((l) => <div key={l} className="addr">{l}</div>)
        )}
      </div>
      {!compact && (
        <ul className="label-items">
          {pdm.items.map((it) => {
            const w = CAT[it.wineId];
            return (
              <li key={it.uid + it.critique}>
                <span className="it-name">
                  {wineName(w)} <span className="vint">{it.vintage || "sans millésime"}</span>
                  {it.note && <span className="it-note">{it.note}</span>}
                  {it.comment && it.comment.trim() && <span className="it-prep">Préparation : {it.comment.trim()}</span>}
                </span>
                <span className="it-qty">{it.qty} {unitLabel(w, it.qty, "fr")}</span>
              </li>
            );
          })}
          <li className="it-total">
            <span>Critique en charge : {[...new Set(pdm.items.map((i) => i.reviewer))].join(", ")}</span>
            <span className="it-qty">{total} au total</span>
          </li>
        </ul>
      )}
    </article>
  );
}

export { copyText, fmtDate, Badge, CritTag, Callout, Segmented, copyRich, CopyButton, ConfirmDialog, PdmLabel };
