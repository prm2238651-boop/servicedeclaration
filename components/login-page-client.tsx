"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, ShieldCheck } from "lucide-react";

type LoginPhase = "credentials" | "code" | "recovery" | "setup" | "recovery-codes";

export function LoginPageClient() {
  const router = useRouter();
  const [phase, setPhase] = useState<LoginPhase>("credentials");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [totpSecret, setTotpSecret] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [redirectTo, setRedirectTo] = useState("/dashboard");

  async function beginSetup() {
    const response = await fetch("/api/auth/totp/setup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "start" }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error("Impossible de démarrer la configuration de la double authentification.");
    setTotpSecret(result.secret);
    setPhase("setup");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      if (phase === "credentials") {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(Object.fromEntries(form)),
        });
        const result = await response.json();
        if (response.status === 202 && result.requiresTwoFactor) {
          setPhase("code");
          return;
        }
        if (response.status === 202 && result.requiresTwoFactorSetup) {
          await beginSetup();
          return;
        }
        if (!response.ok) {
          setError(response.status === 401
            ? "Matricule ou mot de passe incorrect."
            : response.status === 429
              ? "Trop de tentatives. Veuillez patienter avant de réessayer."
              : response.status >= 500
                ? "Le service de connexion rencontre une erreur. Vérifiez la configuration du déploiement."
                : "La connexion n’a pas pu aboutir. Vérifiez les informations saisies.");
          return;
        }
        router.push(result.redirectTo || "/dashboard");
        router.refresh();
        return;
      }

      if (phase === "setup") {
        const response = await fetch("/api/auth/totp/setup", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "verify", code: form.get("code") }),
        });
        const result = await response.json();
        if (!response.ok) {
          setError(response.status === 429
            ? "Trop de tentatives. Veuillez patienter avant de réessayer."
            : "Code incorrect ou configuration expirée. Vérifiez l’heure de votre appareil et réessayez.");
          return;
        }
        setRedirectTo(result.redirectTo || "/dashboard");
        setRecoveryCodes(result.recoveryCodes);
        setPhase("recovery-codes");
        return;
      }

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: form.get("code"),
          recoveryCode: phase === "recovery",
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(response.status === 429
          ? "Trop de tentatives. Veuillez patienter avant de réessayer."
          : "Code invalide ou expiré. Recommencez la connexion.");
        return;
      }
      router.push(result.redirectTo || "/dashboard");
      router.refresh();
    } catch (requestError) {
      console.error("Authentication request failed", requestError);
      setError("Impossible de joindre le serveur. Vérifiez votre connexion puis réessayez.");
    } finally {
      setLoading(false);
    }
  }

  function continueAfterRecoveryCodes() {
    router.push(redirectTo);
    router.refresh();
  }

  return <main className="login-shell">
    <section className="login-brand">
      <div className="brand-lockup"><span className="crest"><ShieldCheck size={27}/></span><span>POLICE NATIONALE<br/><small>RÉPUBLIQUE DU MALI</small></span></div>
      <div className="brand-copy"><span className="eyebrow">Plateforme nationale sécurisée</span><h1>Objets<br/>signalés.</h1><p>Identifier rapidement un objet déclaré volé et assurer sa traçabilité jusqu’à sa restitution.</p></div>
      <small>Accès strictement réservé aux personnels autorisés</small>
    </section>
    <section className="login-panel"><div className="login-card">
      <LockKeyhole color="#155b96" size={27}/><h2>{phase === "credentials" ? "Connexion sécurisée" : phase === "recovery-codes" ? "Codes de récupération" : "Double authentification"}</h2>
      <p>{phase === "credentials"
        ? "Identifiez-vous avec votre matricule professionnel."
        : phase === "code"
          ? "Saisissez le code à 6 chiffres de votre application d’authentification."
          : phase === "recovery"
            ? "Saisissez l’un de vos codes de récupération. Chaque code ne peut servir qu’une fois."
            : phase === "setup"
              ? "Ajoutez votre compte dans une application TOTP, puis confirmez avec le code affiché."
              : "Conservez ces codes dans un endroit sûr. Ils ne seront affichés qu’une seule fois."}</p>

      {phase === "recovery-codes" ? <>
        <ul className="totp-recovery-list">{recoveryCodes.map(code => <li key={code}><code>{code}</code></li>)}</ul>
        <button className="btn btn-primary btn-block" onClick={continueAfterRecoveryCodes}>J’ai enregistré mes codes</button>
      </> : <>
        {phase === "setup" && <div className="demo-note">
          Dans votre application d’authentification, choisissez l’ajout manuel et saisissez cette clé :
          <p><code className="totp-secret">{totpSecret}</code></p>
          <small>Compte : Police Mali · algorithme TOTP, intervalle 30 secondes.</small>
        </div>}
        <form onSubmit={submit}>
          {error && <div className="error" role="alert">{error}</div>}
          {phase === "credentials" ? <>
            <div className="field"><label htmlFor="matricule">Matricule ou identifiant</label><input className="input" id="matricule" name="matricule" autoComplete="username" required/></div>
            <div className="field"><label htmlFor="password">Mot de passe</label><input className="input" id="password" name="password" type="password" autoComplete="current-password" required/></div>
          </> : <div className="field">
            <label htmlFor="code">{phase === "setup" ? "Code de vérification" : phase === "recovery" ? "Code de récupération" : "Code à 6 chiffres"}</label>
            <input className="input" id="code" name="code" inputMode={phase === "recovery" ? "text" : "numeric"} autoComplete="one-time-code" autoFocus required/>
          </div>}
          <button className="btn btn-primary btn-block" disabled={loading}>
            {loading ? "Vérification…" : phase === "setup" ? "Activer la double authentification" : phase === "credentials" ? "Se connecter" : "Vérifier"}
          </button>
        </form>
        {phase === "code" && <button className="btn btn-secondary btn-block" onClick={() => { setError(""); setPhase("recovery"); }}>Utiliser un code de récupération</button>}
        {phase === "recovery" && <button className="btn btn-secondary btn-block" onClick={() => { setError(""); setPhase("code"); }}>Utiliser l’application d’authentification</button>}
        {phase !== "credentials" && <button className="btn btn-secondary btn-block" onClick={() => { setError(""); setPhase("credentials"); }}>Recommencer la connexion</button>}
      </>}
    </div></section>
  </main>;
}
