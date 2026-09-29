// ============================================================
//  DONNÉES DE RÉFÉRENCE ET LOGIQUE MÉTIER
//  Ce fichier est indépendant de l'interface. Pour modifier une adresse,
//  une consigne, un importateur ou le routage d'une région, c'est ici.
// ============================================================

import CATALOGUE from "./data/catalogue.json";

const CAT = Object.fromEntries(CATALOGUE.map((w) => [w.id, w]));

const ORIGINES = ["France", "Espagne", "Argentine", "Chili"];

// Filiale qui reçoit la PDM et prépare les échantillons
const FILIALES = {
  France: { nom: "Logistique France", pays: "France", langue: "fr", envoiUS: "transitaire" },
  Espagne: { nom: "Bodegas Campo Eliseo", pays: "Espagne", langue: "es", envoiUS: "transitaire" },
  Argentine: { nom: "Bodega Piedra Negra", pays: "Argentine", langue: "es", envoiUS: "direct" },
  Chili: { nom: "Hacienda Araucano", pays: "Chili", langue: "es", envoiUS: "direct" },
};

const CRITIQUES = {
  WS: { code: "WS", nom: "Wine Spectator" },
  WE: { code: "WE", nom: "Wine Enthusiast" },
};

// Adresses de réception (sources : WS Napa 2025, WE FAQ août 2026)
const DESTINATIONS = {
  WS_NAPA: {
    critique: "WS", titre: "Wine Spectator Annex",
    adresse: ["1750 A First St.", "Napa, CA 94559", "USA"],
    tel: "+1 707 299 3999", email: "napatastings@mshanken.com", zone: "US",
    consignes: ["finished", "approved", "noTracking", "wsCustoms", "usDocs"],
  },
  WE_HQ: {
    critique: "WE", titre: "Wine Enthusiast, c/o Tasting Department",
    adresse: ["200 Summit Lake Drive, 4th Floor", "Valhalla, NY 10595", "USA"],
    tel: "+1 914 345 9463", zone: "US",
    consignes: ["finished", "qr", "noStyro", "usDocs"],
  },
  WE_KETTMANN: {
    critique: "WE", titre: "Matt Kettmann",
    adresse: ["318 Loreto Place", "Santa Barbara, CA 93111", "USA"],
    tel: "+1 805 284 2097", email: "mkettmann@wineenthusiast.com", zone: "US",
    consignes: ["finished", "qr", "noStyro", "carrier", "reviewerName", "usDocs"],
  },
  WE_VOSS: {
    critique: "WE", titre: "Roger Voss",
    adresse: ["4 Route de Mondebat à Laclaverie", "32160 Beaumarchés", "France"],
    tel: "+33 7 82 62 05 79", email: "rvoss@wineenthusiast.com", zone: "UE",
    consignes: ["finished", "qr", "noStyro", "euOnly"],
  },
  WE_SUMNERS: {
    critique: "WE", titre: "John Sumners",
    adresse: ["Control Space Storage Alfragide", "Casal de Alfragide 1, Unidade B203", "2720-413 Amadora", "Portugal"],
    tel: "+351 800 210 566", email: "jsumners@wineenthusiast.com", zone: "UE",
    consignes: ["finished", "qr", "noStyro", "euOnly"],
  },
  WE_NEWMAN: {
    critique: "WE", titre: "Kara Newman",
    adresse: ["136 Madison Ave., 6th Floor", "New York, NY 10016", "USA"],
    tel: "+1 646 722 3300", email: "knewman@wineenthusiast.com", zone: "US",
    consignes: ["qr", "noStyro", "usDocs"],
  },
};

// Routage Wine Enthusiast par région (page 6 de la FAQ WE)
const WE_REGIONS = {
  "Languedoc-Roussillon": ["WE_KETTMANN", "Matt Kettmann"],
  "Sud-Ouest": ["WE_VOSS", "Roger Voss"],
  "Vin de France": ["WE_HQ", "Aleks Zecevic"],
  Provence: ["WE_HQ", "Cody Wexler"],
  Toro: ["WE_SUMNERS", "John Sumners"],
  Rueda: ["WE_HQ", "Reggie Solomon"],
  Mendoza: ["WE_HQ", "Jesica Vargas"],
  Colchagua: ["WE_HQ", "Jesica Vargas"],
};

function route(wine, critique) {
  if (critique === "WS") {
    if (wine.t !== "vin") return { ok: false, raison: "Wine Spectator ne note ni spiritueux ni vermouths" };
    return { ok: true, dest: "WS_NAPA", reviewer: "Napa Tasting Department" };
  }
  if (wine.t !== "vin") {
    return {
      ok: true, dest: "WE_NEWMAN", reviewer: "Kara Newman",
      note: wine.t === "vermouth" ? "Catégorie vermouth à confirmer avec WE" : null,
    };
  }
  if (wine.na) return { ok: true, dest: "WE_HQ", reviewer: "Vins sans alcool (New York)" };
  const r = WE_REGIONS[wine.r];
  return { ok: true, dest: r[0], reviewer: r[1] };
}

// WE : 2 bouteilles par vin, 1 par spiritueux. WS : 2 bouteilles.
function qtyFor(wine) {
  return wine.t === "vin" ? 2 : 1;
}

function unitLabel(wine, qty, lang) {
  if (wine.bib) return "BIB";
  const u = { fr: ["bouteille", "bouteilles"], es: ["botella", "botellas"], en: ["bottle", "bottles"] }[lang];
  return qty > 1 ? u[1] : u[0];
}

function wineName(w) {
  return w.ref.startsWith(w.g) || w.ref.startsWith(w.g.replace(/^Domaine /, "")) ? w.ref : w.g + ", " + w.ref;
}

// Importateurs US (affichés à l'étape COLA)
const IMPORTATEURS = {
  France: "USA Wine West",
  Argentine: "USA Wine West",
  Chili: "Winesellers",
};
function importerFor(wine) {
  if (wine.f === "Espagne") {
    if (/^Campo Eliseo/.test(wine.ref)) return "VinAmericas";
    if (/^Hermanos/.test(wine.ref)) return "Pardela USA";
    return null;
  }
  return IMPORTATEURS[wine.f] || null;
}

function isOn(draft, line, c) {
  return !!draft.critiques[c] && route(CAT[line.wineId], c).ok && !draft.excl[line.uid + "|" + c];
}

// Une PDM = une filiale expéditrice + une adresse de destination
function buildPdms(draft, withCola) {
  const groups = new Map();
  const blocked = [];
  draft.lines.forEach((line) => {
    const wine = CAT[line.wineId];
    ["WS", "WE"].forEach((c) => {
      if (!isOn(draft, line, c)) return;
      const r = route(wine, c);
      const dest = DESTINATIONS[r.dest];
      const item = {
        uid: line.uid, wineId: wine.id, ref: wine.ref, gamme: wine.g,
        vintage: line.vintage, comment: line.comment, qty: qtyFor(wine),
        reviewer: r.reviewer, note: r.note, critique: c, dest: r.dest, filiale: wine.f,
      };
      if (withCola && dest.zone === "US" && draft.cola[line.uid] !== "oui") {
        blocked.push(item);
        return;
      }
      const key = wine.f + "|" + r.dest;
      if (!groups.has(key)) groups.set(key, { id: key, filiale: wine.f, dest: r.dest, critique: c, items: [] });
      groups.get(key).items.push(item);
    });
  });
  const pdms = [...groups.values()].sort(
    (a, b) =>
      ORIGINES.indexOf(a.filiale) - ORIGINES.indexOf(b.filiale) ||
      a.critique.localeCompare(b.critique) ||
      a.dest.localeCompare(b.dest)
  );
  pdms.forEach((p, i) => (p.num = i + 1));
  return { pdms, blocked };
}

function colaLines(draft) {
  return draft.lines.filter((line) =>
    ["WS", "WE"].some((c) => isOn(draft, line, c) && DESTINATIONS[route(CAT[line.wineId], c).dest].zone === "US")
  );
}

// ------------------------------------------------------------
//  Consignes (reprises dans les mails, en 3 langues)
// ------------------------------------------------------------
const CONSIGNES = {
  finished: {
    fr: "Bouteilles finies et étiquetées pour la vente (pas d'échantillon de cuve ou de barrique).",
    es: "Botellas terminadas y etiquetadas para la venta (no se aceptan muestras de depósito ni de barrica).",
    en: "Finished bottles labeled for sale (no tank or barrel samples).",
  },
  approved: {
    fr: "Inscrire « Approved » sur chaque colis.",
    es: "Marcar cada caja con «Approved».",
    en: "Mark each box “Approved”.",
  },
  noTracking: {
    fr: "Ne pas envoyer le numéro de suivi à Wine Spectator : le transmettre uniquement à l'ADV France.",
    es: "No enviar el número de seguimiento a Wine Spectator: enviarlo solo al ADV Francia.",
    en: "Do not send the tracking number to Wine Spectator: send it to ADV France only.",
  },
  wsCustoms: {
    fr: "Wine Spectator ne récupère pas les colis en douane : l'envoi doit arriver dédouané, frais et droits payés.",
    es: "Wine Spectator no retira envíos en aduana: el envío debe llegar despachado, con gastos y aranceles pagados.",
    en: "Wine Spectator cannot collect parcels from US customs: the shipment must arrive cleared, duties paid.",
  },
  usDocs: {
    fr: "Documents douaniers US à la charge de l'expéditeur (COLA, FDA Prior Notice). Transport, douane et droits payés par l'expéditeur.",
    es: "Documentación aduanera de EE. UU. a cargo del remitente (COLA, FDA Prior Notice). Transporte, aduana y aranceles pagados por el remitente.",
    en: "US customs paperwork is the shipper's responsibility (COLA, FDA Prior Notice). Freight, customs and duties paid by the shipper.",
  },
  qr: {
    fr: "Glisser dans chaque colis la fiche QR code (Shipment Barcode) de la Ratings Platform, jointe à ce mail.",
    es: "Incluir en cada caja la hoja con el código QR (Shipment Barcode) de la Ratings Platform, adjunta a este correo.",
    en: "Place the Ratings Platform Shipment Barcode (QR code) sheet, attached to this email, inside each box.",
  },
  noStyro: {
    fr: "Emballage recyclable, pas de polystyrène.",
    es: "Embalaje reciclable, sin poliestireno.",
    en: "Recyclable packaging, no Styrofoam.",
  },
  carrier: {
    fr: "Expédier par un transporteur avec suivi : les dépôts sans transporteur sont refusés.",
    es: "Enviar con transportista y seguimiento: no se aceptan entregas sin transportista.",
    en: "Ship with a tracked carrier: drop-offs without a carrier are refused.",
  },
  reviewerName: {
    fr: "Indiquer clairement le nom du critique sur le colis.",
    es: "Indicar claramente el nombre del crítico en la caja.",
    en: "Clearly write the reviewer's name on the box.",
  },
  euOnly: {
    fr: "Expédition depuis l'Union européenne uniquement.",
    es: "Envío únicamente desde la Unión Europea.",
    en: "Ship from within the European Union only.",
  },
};

const ROUTE_TXT = {
  eu: {
    fr: "Envoi direct par transporteur avec suivi.",
    es: "Envío directo con transportista y seguimiento.",
    en: "Direct shipment with a tracked carrier.",
  },
  transitaire: {
    fr: "Remettre les colis au transitaire pour l'export vers les USA.",
    es: "Entregar las cajas al transitario para la exportación a EE. UU.",
    en: "Hand the boxes to the freight forwarder for export to the US.",
  },
  direct: {
    fr: "Expédition directe par la filiale vers les USA, droits et taxes payés (DDP).",
    es: "Envío directo desde la filial a EE. UU., con aranceles e impuestos pagados (DDP).",
    en: "Direct shipment from the subsidiary to the US, duties and taxes paid (DDP).",
  },
};

function routeKey(pdm) {
  if (DESTINATIONS[pdm.dest].zone === "UE") return "eu";
  return FILIALES[pdm.filiale].envoiUS;
}

const ROUTE_COURT = { eu: "Transporteur, UE", transitaire: "Via transitaire", direct: "Direct, DDP" };

const MAIL = {
  fr: {
    subject: (n, c, f) => `PDM${n} – Échantillons ${c} – ${f}`,
    hello: "Bonjour,",
    intro: (c) => `Merci de préparer les échantillons suivants pour ${c} :`,
    shipTo: "Adresse de livraison :",
    tel: "Tél.",
    instr: "Consignes d'envoi :",
    tracking: "Merci de nous communiquer le numéro de suivi dès l'expédition.",
    bye: "Bien cordialement,",
    sv: "sans millésime",
    prep: "Préparation :",
  },
  es: {
    subject: (n, c, f) => `PDM${n} – Muestras ${c} – ${f}`,
    hello: "Hola:",
    intro: (c) => `Por favor, preparad las siguientes muestras para ${c}:`,
    shipTo: "Dirección de entrega:",
    tel: "Tel.",
    instr: "Instrucciones de envío:",
    tracking: "Por favor, enviadnos el número de seguimiento en cuanto salga el envío.",
    bye: "Un saludo,",
    sv: "sin añada",
    prep: "Preparación:",
  },
  en: {
    subject: (n, c, f) => `PDM${n} – ${c} samples – ${f}`,
    hello: "Hello,",
    intro: (c) => `Please prepare the following samples for ${c}:`,
    shipTo: "Ship to:",
    tel: "Tel.",
    instr: "Shipping instructions:",
    tracking: "Please send us the tracking number as soon as the parcel ships.",
    bye: "Best regards,",
    sv: "non-vintage",
    prep: "Preparation:",
  },
};

const PREP_COLOR = "#8A5A08";

function escHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Le mail est construit ligne par ligne : chaque ligne sait si elle est une consigne de préparation,
// ce qui permet un aperçu mis en forme et une copie en texte enrichi (gras + couleur).
function buildMail(pdm, lang, user) {
  const T = MAIL[lang];
  const dest = DESTINATIONS[pdm.dest];
  const fil = FILIALES[pdm.filiale];
  const crit = CRITIQUES[pdm.critique].nom;
  const P = (text) => ({ text });
  const items = [];
  pdm.items.forEach((it) => {
    const wine = CAT[it.wineId];
    const v = it.vintage && it.vintage.trim() ? it.vintage.trim() : T.sv;
    items.push(P(`- ${wineName(wine)} ${v} : ${it.qty} ${unitLabel(wine, it.qty, lang)}`));
    if (it.comment && it.comment.trim()) items.push({ text: `    → ${T.prep} ${it.comment.trim()}`, prep: true });
  });
  const consignes = [ROUTE_TXT[routeKey(pdm)][lang], ...dest.consignes.map((k) => CONSIGNES[k][lang])];
  const lines = [
    T.hello, "", T.intro(crit), "",
  ].map(P).concat(items, [
    "", T.shipTo, dest.titre, ...dest.adresse, `${T.tel} ${dest.tel}`, "",
    T.instr, ...consignes.map((c) => "- " + c), "",
    T.tracking, "", T.bye, user, "ADV France",
  ].map(P));
  const body = lines.map((l) => l.text).join("\n");
  const html =
    "<div>" +
    lines
      .map((l) => {
        if (!l.prep) return escHtml(l.text) || "&nbsp;";
        const t = escHtml(l.text.trim());
        return `&nbsp;&nbsp;&nbsp;&nbsp;<b style="color:${PREP_COLOR}">${t}</b>`;
      })
      .join("<br>") +
    "</div>";
  return { subject: T.subject(pdm.num, crit, fil.nom), body, html, lines };
}

function requesterName(draft) {
  return `${(draft.prenom || "").trim()} ${(draft.nom || "").trim()}`.trim();
}

function dossierStatut(d) {
  if (d.isDraft) return { label: "Brouillon", tone: "draft" };
  const n = d.pdms.length;
  const t = d.pdms.filter((p) => p.tracking && p.tracking.number && p.tracking.number.trim()).length;
  if (n === 0) return { label: "Bloqué", tone: "wine" };
  if (t === n) return { label: "Expédié", tone: "green" };
  if (t > 0) return { label: "Partiellement expédié", tone: "amber" };
  return { label: "En préparation", tone: "neutral" };
}

// Reconstruit l'état de l'assistant à partir d'un dossier enregistré (pour le modifier).
// Source de vérité : les PDM et les vins bloqués du dossier (le suivi des colis y est à jour).
function dossierToDraft(d) {
  const items = [...(d.pdms || []).flatMap((p) => p.items || []), ...(d.blocked || [])].filter((it) => CAT[it.wineId]);
  const lines = [];
  const seen = {};
  items.forEach((it) => {
    if (seen[it.uid]) return;
    seen[it.uid] = true;
    lines.push({ uid: it.uid, wineId: it.wineId, vintage: it.vintage || "", comment: it.comment || "" });
  });
  if (Array.isArray(d.lineOrder)) {
    const pos = Object.fromEntries(d.lineOrder.map((u, i) => [u, i]));
    lines.sort((a, b) => (pos[a.uid] ?? 1e9) - (pos[b.uid] ?? 1e9));
  }
  const critiques = { WS: items.some((i) => i.critique === "WS"), WE: items.some((i) => i.critique === "WE") };
  const excl = {};
  lines.forEach((l) =>
    ["WS", "WE"].forEach((c) => {
      if (critiques[c] && !items.some((i) => i.uid === l.uid && i.critique === c)) excl[l.uid + "|" + c] = true;
    })
  );
  const cola = {};
  (d.pdms || []).forEach((p) => {
    if (DESTINATIONS[p.dest] && DESTINATIONS[p.dest].zone === "US") (p.items || []).forEach((i) => (cola[i.uid] = "oui"));
  });
  (d.blocked || []).forEach((b) => (cola[b.uid] = "non"));
  const tracking = Object.fromEntries((d.pdms || []).map((p) => [p.id, p.tracking || { carrier: "", number: "", date: "" }]));
  const [prenom, ...rest] = (d.createdBy || "").split(" ");
  return {
    ...emptyDraft(),
    prenom: prenom || "", nom: rest.join(" "),
    origines: [...new Set(lines.map((l) => CAT[l.wineId].f))],
    lines, critiques, excl, cola, check: d.check || {}, tracking,
    step: 1, max: 8,
    editing: { id: d.id, createdAt: d.createdAt, createdBy: d.createdBy || "", relanceId: d.relanceId || null },
  };
}

function uid() {
  return "l" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function emptyDraft() {
  return {
    id: null, prenom: "", nom: "", relance: null, editing: null,
    step: 1, max: 1, origines: [], lines: [],
    critiques: { WS: false, WE: false }, excl: {}, cola: {}, check: {}, langs: {}, tracking: {},
  };
}

export {
  CATALOGUE,
  CAT,
  ORIGINES,
  FILIALES,
  CRITIQUES,
  DESTINATIONS,
  WE_REGIONS,
  route,
  qtyFor,
  unitLabel,
  wineName,
  IMPORTATEURS,
  importerFor,
  isOn,
  buildPdms,
  colaLines,
  CONSIGNES,
  ROUTE_TXT,
  routeKey,
  ROUTE_COURT,
  MAIL,
  PREP_COLOR,
  escHtml,
  buildMail,
  requesterName,
  dossierStatut,
  uid,
  emptyDraft,
  dossierToDraft,
};
