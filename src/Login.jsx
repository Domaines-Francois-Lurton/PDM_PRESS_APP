import React, { useState } from "react";
import { login } from "./backend.js";

// Connexion par mot de passe unique de l'équipe (vérifié par Firebase).
// Mise en page reprise de l'app « Dépôts de marques » (carte en deux panneaux),
// aux couleurs PDM Presse du Portail (violet).
export default function Login() {
  const [pwd, setPwd] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!pwd) return setErr("Saisissez le mot de passe.");
    setBusy(true);
    setErr("");
    const res = await login(pwd);
    if (!res.ok) {
      setErr(res.message);
      setBusy(false);
    }
  };
  return (
    <main className="cx">
      <div className="cx-card">
        <section className="cx-brand">
          <div className="cx-badge" aria-hidden="true">PP</div>
          <h1 className="cx-name">PDM Presse</h1>
          <p className="cx-tagline">Wine Spectator / Wine Enthusiast</p>
        </section>
        <section className="cx-side">
          <img className="cx-logo" src={import.meta.env.BASE_URL + "logo-francois-lurton.png"} alt="François Lurton" />
          <hr className="cx-sep" />
          <form onSubmit={submit} noValidate className={err ? "has-error" : ""}>
            <h2>Connexion</h2>
            <label htmlFor="cx-password">Mot de passe</label>
            <div className="cx-field">
              <input id="cx-password" type={show ? "text" : "password"} value={pwd} autoFocus autoComplete="current-password"
                aria-invalid={!!err} aria-describedby={err ? "cx-error" : undefined}
                onChange={(e) => { setPwd(e.target.value); setErr(""); }} />
              <button type="button" className="cx-toggle" aria-controls="cx-password" aria-pressed={show}
                onClick={() => setShow((s) => !s)}>
                {show ? "Masquer" : "Afficher"}
              </button>
            </div>
            {err && <div id="cx-error" className="cx-error" role="alert">{err}</div>}
            <button type="submit" className="cx-submit" disabled={busy}>{busy ? "Connexion…" : "Se connecter"}</button>
          </form>
        </section>
      </div>
    </main>
  );
}
