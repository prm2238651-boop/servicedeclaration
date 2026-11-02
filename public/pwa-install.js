(() => {
  const installState = window.__policePwaInstall || {
    prompt: null,
    installed: false,
  };
  window.__policePwaInstall = installState;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installState.prompt = event;
    window.dispatchEvent(new Event("police:pwa-install-ready"));
  });

  window.addEventListener("appinstalled", () => {
    installState.prompt = null;
    installState.installed = true;
    window.dispatchEvent(new Event("police:pwa-installed"));
  });
})();
