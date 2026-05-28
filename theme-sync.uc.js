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
  let currentColors = {};

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

  // Apply colors directly to Zen's background element with inline styles
  function applyToZenBackground() {
    if (!currentColors.surfaceContainer) return;

    // Target the specific element that Zen uses
    const zenBg = document.getElementById("zen-browser-background") ||
                  document.querySelector(".zen-browser-generic-background") ||
                  document.querySelector(".zen-gradient-canvas");

    if (zenBg) {
      // Set the CSS variables directly as inline styles
      zenBg.style.setProperty("--zen-main-browser-background", currentColors.surfaceContainer);
      zenBg.style.setProperty("--zen-main-browser-background-old", currentColors.surfaceContainer);

      // Also set background-color directly
      zenBg.style.backgroundColor = currentColors.surfaceContainer;

      console.log("[Caelestia Theme Sync] Applied to #zen-browser-background:", currentColors.surfaceContainer);
    }

    // Also apply to other key elements
    const browser = document.getElementById("browser");
    if (browser) {
      browser.style.setProperty("--zen-main-browser-background", currentColors.surfaceContainer);
      browser.style.backgroundColor = currentColors.surfaceContainer;
    }

    const tabpanels = document.getElementById("tabbrowser-tabpanels");
    if (tabpanels) {
      tabpanels.style.backgroundColor = currentColors.surfaceContainer;
    }

    // Set on documentElement too
    const docEl = document.documentElement;
    docEl.style.setProperty("--zen-main-browser-background", currentColors.surfaceContainer);
    docEl.style.setProperty("--zen-main-browser-background-old", currentColors.surfaceContainer);
    docEl.style.backgroundColor = currentColors.surfaceContainer;

    docEl.setAttribute("caelestia-theme-active", "true");
  }

  // Extract colors from CSS content
  function extractColors(cssContent) {
    const colors = {};

    const patterns = [
      { key: "surface", regex: /--caelestia-surface:\s*(#[a-fA-F0-9]+)/ },
      { key: "surfaceContainer", regex: /--caelestia-surfaceContainer:\s*(#[a-fA-F0-9]+)/ },
      { key: "surfaceContainerHigh", regex: /--caelestia-surfaceContainerHigh:\s*(#[a-fA-F0-9]+)/ },
      { key: "surfaceDim", regex: /--caelestia-surfaceDim:\s*(#[a-fA-F0-9]+)/ },
    ];

    for (const { key, regex } of patterns) {
      const match = cssContent.match(regex);
      if (match) colors[key] = match[1];
    }

    // Fallback: surfaceContainer = surface if not found
    if (!colors.surfaceContainer && colors.surface) {
      colors.surfaceContainer = colors.surface;
    }

    return colors;
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

      // Extract and store colors
      currentColors = extractColors(content);
      console.log("[Caelestia Theme Sync] Colors:", currentColors);

      // Inject CSS
      if (chromeStyleEl) chromeStyleEl.remove();

      chromeStyleEl = document.createElement("style");
      chromeStyleEl.id = "caelestia-chrome-theme";
      chromeStyleEl.setAttribute("type", "text/css");
      chromeStyleEl.textContent = content;
      document.head.appendChild(chromeStyleEl);

      // Apply colors directly to elements with inline styles
      applyToZenBackground();
      console.log("[Caelestia Theme Sync] Theme applied!");
    } catch (e) {
      console.error("[Caelestia Theme Sync] Error:", e);
    }
  }

  // Watch for the zen-browser-background element and apply styles when it appears
  function watchForZenBackground() {
    const observer = new MutationObserver(() => {
      if (currentColors.surfaceContainer) {
        applyToZenBackground();
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style"],
    });
  }

  // File watcher - poll for changes since XPCOM doesn't have native file watching in JS
  let lastCheckMtime = 0;

  function startFileWatcher() {
    setInterval(async () => {
      if (!isEnabled()) return;

      try {
        const path = expandPath(getPref(PREF_CHROME_PATH, DEFAULT_CHROME_PATH));
        if (!await IOUtils.exists(path)) return;

        const info = await IOUtils.stat(path);
        if (info.lastModified > lastCheckMtime) {
          lastCheckMtime = info.lastModified;
          lastChromeMtime = 0; // Force reload
          loadChromeTheme();
        }
      } catch (e) {}
    }, 500);
  }

  function init() {
    if (window.location.href !== "chrome://browser/content/browser.xhtml") return;

    Services.prefs.addObserver(PREF_ENABLED, loadChromeTheme);
    Services.prefs.addObserver(PREF_CHROME_PATH, loadChromeTheme);

    const start = () => {
      loadChromeTheme();
      watchForZenBackground();
      startFileWatcher();

      // Re-apply periodically to catch Zen's JS changes
      setInterval(applyToZenBackground, 200);
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", start);
    } else {
      start();
    }

    console.log("[Caelestia Theme Sync] Init complete!");
  }

  init();
})();