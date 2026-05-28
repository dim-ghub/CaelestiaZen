/// <reference no-default-lib="true"/>
/// <reference lib="esnext"/>
/// <reference lib="dom"/>

// Caelestia Theme Sync for Zen Browser
// Syncs Caelestia's color scheme to Zen Browser UI

(function() {
  "use strict";

  console.log("[Caelestia Theme Sync] Initializing...");

  if (window.__caelestiaThemeSyncInitialized) {
    return;
  }
  window.__caelestiaThemeSyncInitialized = true;

  const PREF_ENABLED = "extensions.caelestia-zen-sync.enabled";
  const PREF_CHROME_PATH = "extensions.caelestia-zen-sync.chrome-path";
  const DEFAULT_CHROME_PATH = "/home/dim/.local/state/caelestia/theme/zen-browser.css";

  let chromeStyleEl = null;
  let lastChromeMtime = 0;

  function getPref(prefName, defaultValue) {
    try {
      if (Services.prefs.prefHasUserValue(prefName)) {
        const value = Services.prefs.getStringPref(prefName);
        return value.trim() || defaultValue;
      }
    } catch (e) {}
    return defaultValue;
  }

  function isEnabled() {
    try {
      return Services.prefs.getBoolPref(PREF_ENABLED);
    } catch (e) {
      return true;
    }
  }

  function expandPath(path) {
    if (path.startsWith("~/")) {
      return path.replace("~/", Services.dirsvc.get("Home", Ci.nsIFile).path + "/");
    }
    return path;
  }

  async function loadChromeTheme() {
    if (!isEnabled()) return;

    try {
      const path = expandPath(getPref(PREF_CHROME_PATH, DEFAULT_CHROME_PATH));
      if (!await IOUtils.exists(path)) return;

      const info = await IOUtils.stat(path);
      if (info.lastModified <= lastChromeMtime && lastChromeMtime > 0) return;
      lastChromeMtime = info.lastModified;

      const content = await IOUtils.readUTF8(path);

      if (!chromeStyleEl) {
        chromeStyleEl = document.createElement("style");
        chromeStyleEl.id = "caelestia-chrome-theme";
        chromeStyleEl.setAttribute("type", "text/css");
        document.documentElement.appendChild(chromeStyleEl);
      }

      chromeStyleEl.textContent = content;
      document.documentElement.setAttribute("caelestia-theme-active", "true");

      if (content.includes("color-scheme: dark")) {
        document.documentElement.setAttribute("zen-should-be-dark-mode", "true");
      } else if (content.includes("color-scheme: light")) {
        document.documentElement.setAttribute("zen-should-be-dark-mode", "false");
      }

      console.log("[Caelestia Theme Sync] Theme applied!");
    } catch (e) {
      console.error("[Caelestia Theme Sync] Error:", e);
    }
  }

  function init() {
    if (window.location.href !== "chrome://browser/content/browser.xhtml") return;

    Services.prefs.addObserver(PREF_ENABLED, loadChromeTheme);
    Services.prefs.addObserver(PREF_CHROME_PATH, loadChromeTheme);

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        loadChromeTheme();
        setInterval(loadChromeTheme, 500);
      });
    } else {
      loadChromeTheme();
      setInterval(loadChromeTheme, 500);
    }

    console.log("[Caelestia Theme Sync] Initialized!");
  }

  init();
})();