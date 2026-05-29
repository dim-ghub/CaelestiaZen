/// <reference no-default-lib="true"/>
/// <reference lib="esnext"/>
/// <reference lib="dom"/>

// CaelestiaZen Boost Sync
// Syncs surface color to Zen Boosts

(function() {
  "use strict";

  console.log("[CaelestiaZen] Initializing...");

  if (window.__caelestiaZenInitialized) {
    return;
  }
  window.__caelestiaZenInitialized = true;

  const PREF_CHROME_PATH = "caelestia.zen-sync.chrome-path";
  const PREF_SATURATION = "caelestia.zen-sync.saturation";
  const PREF_BRIGHTNESS = "caelestia.zen-sync.brightness";
  const PREF_CONTRAST = "caelestia.zen-sync.contrast";
  const BOOST_PREFS = [PREF_SATURATION, PREF_BRIGHTNESS, PREF_CONTRAST];
  const DEFAULT_CHROME_PATH = "/home/dim/.local/state/caelestia/theme/zen-browser.css";

  let chromeStyleEl = null;
  let lastChromeMtime = 0;
  let currentColors = {};
  let currentBoostData = null;
  let mainWin = null;

  function getPref(prefName, defaultValue) {
    try {
      if (Services.prefs.prefHasUserValue(prefName)) {
        const value = Services.prefs.getStringPref(prefName);
        return value.trim() || defaultValue;
      }
    } catch (e) {}
    return defaultValue;
  }

  function getNumPref(prefName, defaultValue) {
    try {
      if (Services.prefs.prefHasUserValue(prefName)) {
        const prefType = Services.prefs.getPrefType(prefName);
        let val;
        if (prefType === Ci.nsIPrefBranch.PREF_STRING) {
          val = Services.prefs.getStringPref(prefName);
          if (!val || val.trim() === "") return defaultValue;
          const parsed = parseFloat(val);
          if (isNaN(parsed)) return defaultValue;
          return parsed;
        } else if (prefType === Ci.nsIPrefBranch.PREF_INT) {
          val = Services.prefs.getIntPref(prefName);
          return val;
        } else if (prefType === Ci.nsIPrefBranch.PREF_FLOAT) {
          val = Services.prefs.getFloatPref(prefName);
          return val;
        }
        return defaultValue;
      }
    } catch (e) {
      console.error("[CaelestiaZen] Error reading num pref", prefName, e);
    }
    return defaultValue;
  }

  function loadBoostSettings() {
    const saturationRaw = getNumPref(PREF_SATURATION, 100);
    const brightnessRaw = getNumPref(PREF_BRIGHTNESS, 50);
    const contrastRaw = getNumPref(PREF_CONTRAST, 50);

    const settings = {
      saturationMultiplier: saturationRaw / 100,
      brightness: brightnessRaw / 100,
      contrast: contrastRaw / 100,
    };
    console.log("[CaelestiaZen] Raw values:", { saturationRaw, brightnessRaw, contrastRaw }, "-> Settings:", settings);
    return settings;
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
      zenBg.style.setProperty("--zen-main-browser-background", currentColors.surfaceContainer);
      zenBg.style.setProperty("--zen-main-browser-background-old", currentColors.surfaceContainer);
      zenBg.style.backgroundColor = currentColors.surfaceContainer;
      console.log("[CaelestiaZen] Applied to #zen-browser-background:", currentColors.surfaceContainer);
    }

    const browser = document.getElementById("browser");
    if (browser) {
      browser.style.setProperty("--zen-main-browser-background", currentColors.surfaceContainer);
      browser.style.backgroundColor = currentColors.surfaceContainer;
    }

    const tabpanels = document.getElementById("tabbrowser-tabpanels");
    if (tabpanels) {
      tabpanels.style.backgroundColor = currentColors.surfaceContainer;
    }

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

    if (!colors.surfaceContainer && colors.surface) {
      colors.surfaceContainer = colors.surface;
    }

    return colors;
  }

  function rgbToHsl(r, g, b) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return [h, s, l];
  }

  function hexToRgb(hex) {
    const clean = hex.replace("#", "");
    return [
      parseInt(clean.slice(0, 2), 16) / 255,
      parseInt(clean.slice(2, 4), 16) / 255,
      parseInt(clean.slice(4, 6), 16) / 255,
    ];
  }

function applyCaelestiaBoost(surfaceHex) {
    if (!surfaceHex || surfaceHex.length !== 7) return;

    const [r, g, b] = hexToRgb(surfaceHex);
    const [h, s, l] = rgbToHsl(r, g, b);

    const settings = loadBoostSettings();

    const boostData = {
      dotAngleDeg: Math.round(h * 360),
      dotDistance: Math.min(s * settings.saturationMultiplier, 1),
      saturation: Math.min(s * settings.saturationMultiplier, 1),
      brightness: settings.brightness,
      contrast: settings.contrast,
      smartInvert: false,
      secondaryDotAngleDegDelta: 55,
      enableColorBoost: true,
    };

    applyBoostToAllTabs(boostData);
    currentBoostData = boostData;
  }

  function applyBoostToTab(tab, boostData) {
    if (!boostData) return;
    const bc = tab?.linkedBrowser?.browsingContext;
    if (!bc) return;
    const primaryColor = buildBoostColor(
      boostData.dotAngleDeg,
      boostData.saturation,
      boostData.brightness,
      boostData
    );
    bc.zenBoostsData = primaryColor;
    bc.zenBoostsComplementaryRotation = boostData.secondaryDotAngleDegDelta ?? 0;
    bc.isZenBoostsInverted = boostData.smartInvert;
  }

  function applyBoostToAllTabs(boostData) {
    if (!mainWin?.gBrowser) return;

    const primaryColor = buildBoostColor(
      boostData.dotAngleDeg,
      boostData.saturation,
      boostData.brightness,
      boostData
    );

    for (const tab of mainWin.gBrowser.tabs) {
      const bc = tab.linkedBrowser?.browsingContext;
      if (!bc) continue;
      bc.zenBoostsData = primaryColor;
      bc.zenBoostsComplementaryRotation = boostData.secondaryDotAngleDegDelta ?? 0;
      bc.isZenBoostsInverted = boostData.smartInvert;
    }
    console.log("[CaelestiaZen] Boost applied to all tabs:", boostData.dotAngleDeg, boostData.saturation);
  }

  function buildBoostColor(hueDeg, sat, light, boostData) {
    const [r, g, b] = hslToRgb(hueDeg / 360, sat, light);
    const contrast = boostData.contrast ?? 0.75;
    return ((Math.round((1 - contrast) * 255) << 24) | (Math.round(b * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(r * 255)) >>> 0;
  }

  function hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    return [r, g, b];
  }

  async function loadChromeTheme() {
    try {
      const path = expandPath(getPref(PREF_CHROME_PATH, DEFAULT_CHROME_PATH));
      if (!await IOUtils.exists(path)) return;

      const info = await IOUtils.stat(path);
      if (info.lastModified <= lastChromeMtime && lastChromeMtime > 0) return;
      lastChromeMtime = info.lastModified;

      const content = await IOUtils.readUTF8(path);

      currentColors = extractColors(content);
      console.log("[CaelestiaZen] Colors:", currentColors);

      if (chromeStyleEl) chromeStyleEl.remove();

      chromeStyleEl = document.createElement("style");
      chromeStyleEl.id = "caelestia-chrome-theme";
      chromeStyleEl.setAttribute("type", "text/css");
      chromeStyleEl.textContent = content;
      document.head.appendChild(chromeStyleEl);

      applyToZenBackground();

      if (currentColors.surface) {
        applyCaelestiaBoost(currentColors.surface);
      }

      console.log("[CaelestiaZen] Theme applied!");
    } catch (e) {
      console.error("[CaelestiaZen] Error:", e);
    }
  }

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

  let lastCheckMtime = 0;

  function watchForNewTabs() {
    if (!mainWin?.gBrowser) return;

    mainWin.gBrowser.tabContainer.addEventListener("TabOpen", (e) => {
      const tab = e.target;
      if (currentBoostData) {
        const applyOnLoad = () => {
          applyBoostToTab(tab, currentBoostData);
          tab.removeEventListener("load", applyOnLoad, true);
        };
        tab.addEventListener("load", applyOnLoad, true);
      }
    });

    mainWin.gBrowser.tabContainer.addEventListener("select", () => {
      if (!currentBoostData) return;
      applyBoostToTab(mainWin.gBrowser.selectedTab, currentBoostData);
    });

    mainWin.gBrowser.addTabsProgressListener({
      onStateChange(browser, webProgress, request, flags, status) {
        if ((flags & 0x0400000) && currentBoostData) {
          const tab = mainWin.gBrowser.getTabForBrowser(browser);
          if (tab) applyBoostToTab(tab, currentBoostData);
        }
      }
    });
  }

  function startFileWatcher() {
    setInterval(async () => {
      try {
        const path = expandPath(getPref(PREF_CHROME_PATH, DEFAULT_CHROME_PATH));
        if (!await IOUtils.exists(path)) return;

        const info = await IOUtils.stat(path);
        if (info.lastModified > lastCheckMtime) {
          lastCheckMtime = info.lastModified;
          lastChromeMtime = 0;
          loadChromeTheme();
        }
      } catch (e) {}
    }, 500);
  }

  function init() {
    if (window.location.href !== "chrome://browser/content/browser.xhtml") return;

    Services.prefs.addObserver(PREF_SATURATION, onBoostSettingsChange);
    Services.prefs.addObserver(PREF_BRIGHTNESS, onBoostSettingsChange);
    Services.prefs.addObserver(PREF_CONTRAST, onBoostSettingsChange);
    Services.prefs.addObserver(PREF_CHROME_PATH, loadChromeTheme);

    const start = () => {
      mainWin = window;
      loadChromeTheme();
      watchForZenBackground();
      startFileWatcher();
      watchForNewTabs();
      setInterval(applyToZenBackground, 200);
      setInterval(() => {
        if (!currentBoostData || !mainWin?.gBrowser) return;
        const tab = mainWin.gBrowser.selectedTab;
        if (tab) applyBoostToTab(tab, currentBoostData);
      }, 100);
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", start);
    } else {
      start();
    }

    console.log("[CaelestiaZen] Init complete!");
  }

  function onBoostSettingsChange() {
    if (!currentColors.surface) return;
    applyCaelestiaBoost(currentColors.surface);
    console.log("[CaelestiaZen] Boost settings updated");
  }

  init();
})();