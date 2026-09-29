import React, { useState } from "react";
import { login } from "./backend.js";

// Connexion par mot de passe unique de l'équipe (vérifié par Firebase)
export default function Login() {
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!pwd) return setErr("Saisissez le mot de passe.");
    setBusy(true);
    const res = await login(pwd);
    if (!res.ok) {
      setErr(res.message);
      setBusy(false);
    }
  };
  return (
    <main className="login">
      <form className="login-card" onSubmit={submit}>
        <h1>Échantillons Presse</h1>
        <p className="muted">Préparer les envois de vins à Wine Spectator et Wine Enthusiast.</p>
        <label className="field">
          <span>Mot de passe</span>
          <input type="password" value={pwd} autoFocus autoComplete="current-password"
            onChange={(e) => { setPwd(e.target.value); setErr(""); }} aria-invalid={!!err} />
        </label>
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </main>
  );
}
