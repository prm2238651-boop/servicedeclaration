"use client";

import { useEffect, useState } from "react";
import { Download, Smartphone, X } from "lucide-react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

declare global {
  interface Window {
    __policePwaInstall?: {
      prompt: InstallPromptEvent | null;
      installed: boolean;
    };
  }
}

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
    const updateInstalledState = () => {
      setIsInstalled(isStandalone() || window.__policePwaInstall?.installed === true);
    };
    const updateInstallPrompt = () => setInstallPrompt(window.__policePwaInstall?.prompt ?? null);
    const handleInstalled = () => {
      updateInstallPrompt();
      setInstallPrompt(null);
      setIsInstalled(true);
      setVisible(false);
    };

    const initialize = window.requestAnimationFrame(() => {
      setInstructions(getInstallInstructions());
      updateInstalledState();
      updateInstallPrompt();
    });
    window.addEventListener("police:pwa-install-ready", updateInstallPrompt);
    window.addEventListener("police:pwa-installed", handleInstalled);

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
      window.removeEventListener("police:pwa-install-ready", updateInstallPrompt);
      window.removeEventListener("police:pwa-installed", handleInstalled);
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
      if (window.__policePwaInstall) window.__policePwaInstall.prompt = null;
      setInstallPrompt(null);
      if (choice.outcome === "accepted") {
        setVisible(false);
      } else {
        setShowInstructions(true);
      }
    } catch (error) {
      console.error("Failed to open the browser installation prompt", error);
      setInstallError("Impossible d’ouvrir l’installation. Utilisez le menu de votre navigateur.");
      if (window.__policePwaInstall) window.__policePwaInstall.prompt = null;
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
        {installPrompt ? "Installer" : showInstructions ? "Fermer" : "Voir les étapes"}
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
