"use client";

import { useEffect, useState } from "react";
import { Download, Smartphone, X } from "lucide-react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function getInstallInstructions() {
  const userAgent = navigator.userAgent;
  const isAppleMobile = /iPhone|iPad|iPod/.test(userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  if (isAppleMobile) {
    return "Sur iPhone ou iPad, ouvrez ce site dans Safari, touchez Partager, puis « Sur l’écran d’accueil ».";
  }

  if (/Android/i.test(userAgent)) {
    return "Ouvrez le menu ⋮ de votre navigateur, puis choisissez « Installer l’application » ou « Ajouter à l’écran d’accueil ».";
  }

  if (/Edg\//i.test(userAgent)) {
    return "Dans Microsoft Edge, ouvrez le menu ⋯, puis « Applications » → « Installer ce site en tant qu’application ».";
  }

  if (/Chrome\//i.test(userAgent) && !/Electron\//i.test(userAgent)) {
    return "Dans Google Chrome, ouvrez ⋮, puis « Caster, enregistrer et partager » → « Installer la page comme application ». Si cette option manque, vérifiez que le site est en HTTPS et actualisez-le.";
  }

  if (/Safari/i.test(userAgent) && !/Chrome|Chromium|CriOS|Edg/i.test(userAgent)) {
    return "Dans Safari, ouvrez le menu Fichier puis choisissez « Ajouter au Dock ».";
  }

  if (/Firefox/i.test(userAgent)) {
    return "L’installation n’est pas proposée dans Firefox sur ordinateur. Ouvrez ce site dans Chrome ou Edge, puis utilisez leur menu pour l’installer.";
  }

  if (/Electron/i.test(userAgent)) {
    return "Ce navigateur intégré ne permet pas l’installation. Ouvrez l’adresse du site dans Google Chrome ou Microsoft Edge, puis utilisez le menu du navigateur pour l’installer.";
  }

  return "Dans le menu de votre navigateur, choisissez « Installer l’application » ou « Ajouter à l’écran d’accueil ».";
}

export function PwaInstallPrompt() {
  const [visible, setVisible] = useState(true);
  const [instructions, setInstructions] = useState("");
  const [showInstructions, setShowInstructions] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installError, setInstallError] = useState("");
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const hideTimer = window.setTimeout(() => setVisible(false), 30_000);
    const updateInstalledState = () => setIsInstalled(isStandalone());
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstallPrompt(null);
      setIsInstalled(true);
      setVisible(false);
    };

    const initialize = window.requestAnimationFrame(() => {
      setInstructions(getInstallInstructions());
      updateInstalledState();
    });
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    if ("serviceWorker" in navigator && window.isSecureContext && !isStandalone()) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error: unknown) => {
        console.error("Failed to register the PWA service worker", error);
        setInstallError("Installation indisponible : vérifiez que le site est accessible en HTTPS, puis actualisez la page.");
      });
    }

    const displayMode = window.matchMedia("(display-mode: standalone)");
    displayMode.addEventListener("change", updateInstalledState);

    return () => {
      window.clearTimeout(hideTimer);
      window.cancelAnimationFrame(initialize);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
      displayMode.removeEventListener("change", updateInstalledState);
    };
  }, []);

  async function installApplication() {
    if (!installPrompt) {
      setShowInstructions((current) => !current);
      return;
    }

    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallPrompt(null);
      if (choice.outcome === "accepted") setVisible(false);
    } catch (error) {
      console.error("Failed to open the browser installation prompt", error);
      setInstallError("Impossible d’ouvrir l’installation. Utilisez le menu de votre navigateur.");
      setInstallPrompt(null);
    }
  }

  if (!visible || isInstalled || !instructions) return null;

  return (
    <aside className="pwa-install" aria-label="Installer l’application">
      <div className="pwa-install-icon" aria-hidden="true"><Smartphone size={22} /></div>
      <div className="pwa-install-content">
        <div className="pwa-install-copy">
          <strong>Installer DECLARATION/MALI</strong>
          <p>Utilisez l’application directement depuis votre appareil.</p>
        </div>
        {showInstructions && (
          <p className="pwa-install-instructions" id="pwa-install-instructions" role="status">
            {instructions}
          </p>
        )}
        {installError && <p className="pwa-install-error" role="alert">{installError}</p>}
      </div>
      <button
        className="btn btn-primary pwa-install-action"
        type="button"
        aria-expanded={showInstructions}
        aria-controls={showInstructions ? "pwa-install-instructions" : undefined}
        onClick={installApplication}
      >
        <Download size={17} />
        {showInstructions && !installPrompt ? "Fermer" : "Installer"}
      </button>
      <button
        className="pwa-install-close"
        type="button"
        aria-label="Fermer le message d’installation"
        onClick={() => setVisible(false)}
      >
        <X size={18} />
      </button>
    </aside>
  );
}
