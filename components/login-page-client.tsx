"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, ShieldCheck } from "lucide-react";

export function LoginPageClient() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) });
    if (!response.ok) { setError("Matricule ou mot de passe incorrect."); setLoading(false); return; }
    const result = await response.json();
    router.push(result.redirectTo || "/dashboard"); router.refresh();
  }
  return <main className="login-shell">
    <section className="login-brand">
      <div className="brand-lockup"><span className="crest"><ShieldCheck size={27}/></span><span>POLICE NATIONALE<br/><small>RÉPUBLIQUE DU MALI</small></span></div>
      <div className="brand-copy"><span className="eyebrow">Plateforme nationale sécurisée</span><h1>Objets<br/>signalés.</h1><p>Identifier rapidement un objet déclaré volé et assurer sa traçabilité jusqu’à sa restitution.</p></div>
      <small>Accès strictement réservé aux personnels autorisés</small>
    </section>
    <section className="login-panel"><div className="login-card">
      <LockKeyhole color="#155b96" size={27}/><h2>Connexion sécurisée</h2><p>Identifiez-vous avec votre matricule professionnel.</p>
      <form method="post" action="/api/auth/login" onSubmit={submit}>
        {error && <div className="error" role="alert">{error}</div>}
        <div className="field"><label htmlFor="matricule">Matricule ou identifiant</label><input className="input" id="matricule" name="matricule" autoComplete="username" required/></div>
        <div className="field"><label htmlFor="password">Mot de passe</label><input className="input" id="password" name="password" type="password" autoComplete="current-password" required/></div>
        <button className="btn btn-primary btn-block" disabled={loading}>{loading ? "Vérification…" : "Se connecter"}</button>
      </form>
    </div></section>
  </main>;
}
