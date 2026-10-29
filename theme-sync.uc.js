/// <reference no-default-lib="true"/>
/// <reference lib="esnext"/>
/// <reference lib="dom"/>

// CaelestiaZen
// Reads Caelestia's scheme.json, exposes it as --md-sys-color-* variables,
// tints websites through Zen Boosts and drives the M3 Expressive UI.

(function() {
  "use strict";

  if (window.__caelestiaZenInitialized) {
    return;
  }
  window.__caelestiaZenInitialized = true;

  if (window.location.href !== "chrome://browser/content/browser.xhtml") return;

  const P = {
    tint: "caelestia.zen.tint",
    tintColor: "caelestia.zen.tint-color",
    intensity: "caelestia.zen.tint-intensity",
    brightness: "caelestia.zen.tint-brightness",
    strength: "caelestia.zen.tint-strength",
    background: "caelestia.zen.background",
    opacity: "caelestia.zen.background-opacity",
    followMode: "caelestia.zen.follow-mode",
    uiStyle: "caelestia.zen.ui-style",
    uiShape: "caelestia.zen.ui-shape",
    uiDensity: "caelestia.zen.ui-density",
    schemePath: "caelestia.zen.scheme-path",
    modeApplied: "caelestia.zen.mode-applied",
    migrated: "caelestia.zen.migrated",
  };
  const OLD_PREFIX = "caelestia.zen-sync.";

  // Strength is "higher = stronger" (the tint's alpha).
  const TINT_PRESETS = {
    subtle:   { color: "surface",              intensity: 120, brightness: 15, strength: 50 },
    balanced: { color: "surface",              intensity: 150, brightness: 15, strength: 70 },
    vivid:    { color: "surfaceContainerHigh", intensity: 200, brightness: 20, strength: 85 },
    accent:   { color: "primary",              intensity: 150, brightness: 80, strength: 50 },
  };

  const ZEN_SCHEME_PREF = "zen.view.window.scheme";
  const CONTENT_SCHEME_PREF = "layout.css.prefers-color-scheme.content-override";
  const TRANSPARENT_ZEN_PREF = "mod.sameerasw.zen_bg_color_enabled";

  let colors = {};
  let mode = "dark";
  let lastSchemeMtime = 0;
  let colorStyleEl = null;
  let boostColor = 0;   // signed 32-bit value written to zenBoostsData, 0 = no tint
  let appliedBoost = 0; // last non-zero value we wrote, so "Off" only clears our own tint

  // ==========================================
  // Preferences
  // ==========================================

  function getStr(name, def) {
    try {
      if (Services.prefs.getPrefType(name) === Ci.nsIPrefBranch.PREF_STRING) {
        const v = Services.prefs.getStringPref(name).trim();
        return v || def;
      }
    } catch (e) {}
    return def;
  }

  function getBool(name, def) {
    try {
      if (Services.prefs.getPrefType(name) === Ci.nsIPrefBranch.PREF_BOOL) {
        return Services.prefs.getBoolPref(name);
      }
    } catch (e) {}
    return def;
  }

  function getNum(name, def) {
    try {
      switch (Services.prefs.getPrefType(name)) {
        case Ci.nsIPrefBranch.PREF_INT:
          return Services.prefs.getIntPref(name);
        case Ci.nsIPrefBranch.PREF_STRING: {
          const v = parseFloat(Services.prefs.getStringPref(name));
          return isNaN(v) ? def : v;
        }
      }
    } catch (e) {}
    return def;
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  // Sine only writes defaults once its settings page is opened; write the
  // dropdown defaults up front so its conditional fields show correctly.
  function ensureDefaults() {
    const defaults = {
      [P.tint]: "balanced",
      [P.tintColor]: "surface",
      [P.background]: "solid",
      [P.uiStyle]: "m3e",
      [P.uiShape]: "expressive",
      [P.uiDensity]: "comfortable",
    };
    for (const [name, value] of Object.entries(defaults)) {
      if (!Services.prefs.prefHasUserValue(name)) {
        Services.prefs.setStringPref(name, value);
      }
    }
  }

  // One-time move from the old caelestia.zen-sync.* prefs.
  function migrateOldPrefs() {
    if (getBool(P.migrated, false)) return;
    const has = (n) => Services.prefs.prefHasUserValue(OLD_PREFIX + n);

    if (has("boost-enabled") && !getBool(OLD_PREFIX + "boost-enabled", true)) {
      Services.prefs.setStringPref(P.tint, "off");
    } else if (["boost-color", "saturation", "brightness", "contrast"].some(has)) {
      Services.prefs.setStringPref(P.tint, "custom");
      Services.prefs.setStringPref(P.tintColor, getStr(OLD_PREFIX + "boost-color", "surface"));
      Services.prefs.setIntPref(P.intensity, Math.round(getNum(OLD_PREFIX + "saturation", 150)));
      Services.prefs.setIntPref(P.brightness, Math.round(getNum(OLD_PREFIX + "brightness", 15)));
      Services.prefs.setIntPref(P.strength, Math.round(100 - getNum(OLD_PREFIX + "contrast", 30)));
    }

    if (getBool(OLD_PREFIX + "transparent-zen", false)) {
      Services.prefs.setStringPref(P.background, "transparent");
    }
    if (has("transparency-level")) {
      Services.prefs.setIntPref(P.opacity, Math.round(getNum(OLD_PREFIX + "transparency-level", 80)));
    }

    Services.prefs.setBoolPref(P.migrated, true);
    console.log("[CaelestiaZen] Migrated old preferences");
  }

  // ==========================================
  // Scheme
  // ==========================================

  function schemePath() {
    const custom = getStr(P.schemePath, "");
    const home = Services.dirsvc.get("Home", Ci.nsIFile).path;
    if (custom) {
      return custom.startsWith("~/") ? home + custom.slice(1) : custom;
    }
    const stateHome = Services.env.get("XDG_STATE_HOME") || home + "/.local/state";
    return stateHome + "/caelestia/scheme.json";
  }

  function kebab(name) {
    return name.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
  }

  async function loadScheme(force = false) {
    try {
      const path = schemePath();
      if (!await IOUtils.exists(path)) return;

      const info = await IOUtils.stat(path);
      if (!force && info.lastModified === lastSchemeMtime) return;

      let data;
      try {
        data = JSON.parse(await IOUtils.readUTF8(path));
      } catch (e) {
        // Caelestia may be mid-write; the next poll retries.
        return;
      }
      lastSchemeMtime = info.lastModified;

      const next = {};
      for (const [key, value] of Object.entries(data.colours || {})) {
        const hex = String(value).replace(/^#/, "");
        if (/^[0-9a-fA-F]{6}$/.test(hex)) next[key] = "#" + hex.toLowerCase();
      }
      if (!next.surface) return;

      colors = next;
      mode = data.mode === "light" ? "light" : "dark";
      console.log("[CaelestiaZen] Scheme loaded:", data.name, data.variant, mode);
      applyAll();
    } catch (e) {
      console.error("[CaelestiaZen] Error loading scheme:", e);
    }
  }

  function writeColorVars() {
    const lines = Object.entries(colors).map(([k, v]) => `  --md-sys-color-${kebab(k)}: ${v} !important;`);
    const css = `:root {\n${lines.join("\n")}\n}\n`;
    if (!colorStyleEl) {
      colorStyleEl = document.createElement("style");
      colorStyleEl.id = "caelestia-scheme";
      document.head.appendChild(colorStyleEl);
    }
    colorStyleEl.textContent = css;
    document.documentElement.setAttribute("caelestia-theme-active", "true");
    document.documentElement.setAttribute("caelestia-mode", mode);
  }

  // ==========================================
  // Background
  // ==========================================

  function applyBackground() {
    const docEl = document.documentElement;
    const transparent = getStr(P.background, "solid") === "transparent";
    docEl.setAttribute("caelestia-background", transparent ? "transparent" : "solid");

    if (transparent && colors.surface) {
      const alpha = clamp(getNum(P.opacity, 80), 0, 100) / 100;
      const [r, g, b] = hexToRgb(colors.surface).map((c) => Math.round(c * 255));
      try {
        Services.prefs.setBoolPref(TRANSPARENT_ZEN_PREF, true);
      } catch (e) {}
      docEl.style.setProperty("--mod-sameerasw-zen_transparency_color", `rgba(${r}, ${g}, ${b}, ${alpha})`, "important");
    } else {
      docEl.style.removeProperty("--mod-sameerasw-zen_transparency_color");
    }
  }

  // ==========================================
  // Light / dark
  // ==========================================

  function applyMode() {
    if (!getBool(P.followMode, true)) {
      if (getBool(P.modeApplied, false)) {
        Services.prefs.clearUserPref(ZEN_SCHEME_PREF);
        Services.prefs.clearUserPref(CONTENT_SCHEME_PREF);
        Services.prefs.setBoolPref(P.modeApplied, false);
      }
      return;
    }
    const value = mode === "light" ? 1 : 0;
    if (Services.prefs.getIntPref(ZEN_SCHEME_PREF, 2) !== value) {
      Services.prefs.setIntPref(ZEN_SCHEME_PREF, value);
    }
    if (Services.prefs.getIntPref(CONTENT_SCHEME_PREF, 2) !== value) {
      Services.prefs.setIntPref(CONTENT_SCHEME_PREF, value);
    }
    if (!getBool(P.modeApplied, false)) {
      Services.prefs.setBoolPref(P.modeApplied, true);
    }
  }

  // ==========================================
  // System colors (text selection, accent)
  // ==========================================

  // Text selection in both chrome and web pages uses the system Highlight
  // color (the GTK accent), which no stylesheet can reach. Firefox's ui.*
  // color prefs override those system colors and update live.
  const SYSTEM_COLOR_PREFS = {
    "ui.highlight": "primary",
    "ui.highlighttext": "onPrimary",
    "ui.textSelectDisabledBackground": "secondaryContainer",
    "ui.accentcolor": "primary",
    "ui.accentcolortext": "onPrimary",
  };

  function applySystemColors() {
    for (const [pref, role] of Object.entries(SYSTEM_COLOR_PREFS)) {
      const value = colors[role];
      if (value && getStr(pref, "") !== value) {
        Services.prefs.setStringPref(pref, value);
      }
    }
  }

  // ==========================================
  // Segmented menus and panels
  // ==========================================

  // Marks separator-delimited groups so menus.css can draw each group as its
  // own floating block: every item gets [caelestia-seg-item], each group's
  // first/last item [caelestia-group-start]/[caelestia-group-end] (small inner
  // corners), the very first/last item [caelestia-menu-first]/[-last] (full
  // corners), and separators between groups [caelestia-gap].
  const SEG_ATTRS = [
    "caelestia-seg-item", "caelestia-group-start", "caelestia-group-end",
    "caelestia-menu-first", "caelestia-menu-last", "caelestia-gap",
  ];
  const MENU_ITEMS = new Set(["menuitem", "menu", "menugroup", "menucaption"]);
  const SEPARATORS = new Set(["menuseparator", "toolbarseparator"]);

  function isShown(el) {
    if (el.hidden || el.collapsed) return false;
    const cs = window.getComputedStyle(el);
    return cs.display !== "none" && cs.visibility !== "collapse";
  }

  function segment(host, elements, isItem) {
    // Our CSS hides separators in segmented hosts; measure visibility without
    // our own rules applied, or every separator looks hidden.
    host.removeAttribute("caelestia-segmented");

    let firstItem = null;
    let lastItem = null;
    let pendingSeparator = null;
    let startNext = true;
    let index = 0;
    let group = -1;
    const items = [];
    for (const el of elements) {
      for (const attr of SEG_ATTRS) el.removeAttribute(attr);
      el.removeAttribute("caelestia-group-hover");
      if (!isShown(el)) continue;

      if (SEPARATORS.has(el.localName)) {
        // Only a separator between two visible items becomes a gap.
        if (lastItem && !startNext) pendingSeparator = el;
        startNext = true;
        continue;
      }
      if (!isItem(el)) continue;

      el.setAttribute("caelestia-seg-item", "true");
      // Row index for the staggered drop-in.
      el.style.setProperty("--caelestia-i", index++);
      firstItem ??= el;
      if (startNext) {
        group++;
        lastItem?.setAttribute("caelestia-group-end", "true");
        pendingSeparator?.setAttribute("caelestia-gap", "true");
        pendingSeparator = null;
        el.setAttribute("caelestia-group-start", "true");
        startNext = false;
      }
      el.__caelestiaGroup = group;
      items.push(el);
      lastItem = el;
    }
    lastItem?.setAttribute("caelestia-group-end", "true");
    firstItem?.setAttribute("caelestia-menu-first", "true");
    lastItem?.setAttribute("caelestia-menu-last", "true");
    host.__caelestiaItems = items;
    host.__caelestiaHoverGroup = -1;
    host.removeAttribute("caelestia-hovered");
    host.setAttribute("caelestia-segmented", "true");
  }

  // M3E menus: once the pointer has been over a menu, only the group under
  // it keeps its full outer corners; the others morph to the inactive shape.
  function onSegmentHover(event) {
    const item = event.target.closest?.("[caelestia-seg-item]");
    const host = item?.closest("menupopup[caelestia-segmented], panelview[caelestia-segmented]");
    if (!host || !host.__caelestiaItems) return;
    const group = item.__caelestiaGroup ?? -1;
    host.setAttribute("caelestia-hovered", "true");
    if (group === host.__caelestiaHoverGroup) return;
    host.__caelestiaHoverGroup = group;
    for (const el of host.__caelestiaItems) {
      el.toggleAttribute("caelestia-group-hover", el.__caelestiaGroup === group);
    }
  }

  function segmentMenu(popup) {
    if (popup.localName !== "menupopup" || popup.closest("menulist")) return;
    // The FAB menu is styled as stacked pills, not segmented groups.
    if (popup.id === "zenCreateNewPopup") return;
    if (!document.documentElement.hasAttribute("caelestia-m3e")) {
      popup.removeAttribute("caelestia-segmented");
      return;
    }
    segment(popup, [...popup.children], (el) => MENU_ITEMS.has(el.localName));
  }

  // App menu (⋯) views: items live inside .panel-subview-body, with the
  // view's header/footer around it. Flatten that into one list.
  const SEGMENTED_PANELS = "#appMenu-popup";

  function isPanelItem(el) {
    // Skip empty wrappers such as the add-on banners box.
    if (["vbox", "hbox", "box"].includes(el.localName) && !el.children.length && !el.textContent.trim()) {
      return false;
    }
    return true;
  }

  function segmentPanelView(view) {
    if (!view?.closest?.(SEGMENTED_PANELS)) return;
    if (!document.documentElement.hasAttribute("caelestia-m3e")) {
      view.removeAttribute("caelestia-segmented");
      return;
    }
    const elements = [];
    for (const child of view.children) {
      if (child.classList.contains("panel-subview-body")) {
        elements.push(...child.children);
      } else {
        elements.push(child);
      }
    }
    segment(view, elements, isPanelItem);
  }

  function onViewEvent(event) {
    const view = event.target;
    if (view.localName !== "panelview") return;
    segmentPanelView(view);
    // App-menu subviews differ in height; size their corners on their own.
    if (event.type === "ViewShown" && view.closest?.(SEGMENTED_PANELS)) {
      sizeMenuCorners(view, view.getBoundingClientRect().height);
    }
  }

  // ---------- Grow from the click point ----------

  // Remembers where the pointer last was, so a popup can grow out of the
  // point it was opened from (the right-click position, or the button).
  const lastPointer = { x: 0, y: 0, time: 0 };

  function trackPointer(event) {
    lastPointer.x = event.screenX;
    lastPointer.y = event.screenY;
    lastPointer.time = event.timeStamp;
  }

  function originPoint(popup) {
    const opened = popup.__caelestiaOpenPoint;
    if (opened && performance.now() - opened.time < 2000) return opened;
    if (performance.now() - lastPointer.time < 1500) return lastPointer;
    return null;
  }

  function setPopupOrigin(popup) {
    const point = originPoint(popup);
    if (!point || typeof popup.getOuterScreenRect !== "function") {
      popup.style.removeProperty("--caelestia-origin");
      return;
    }
    const rect = popup.getOuterScreenRect();
    if (!rect.width || !rect.height) return;
    const x = clamp(point.x - rect.x, 0, rect.width);
    const y = clamp(point.y - rect.y, 0, rect.height);
    popup.style.setProperty("--caelestia-origin", `${Math.round(x)}px ${Math.round(y)}px`);
    // The reveal clips from this point, as percentages of the popup.
    popup.style.setProperty("--caelestia-ox", `${(100 * x / rect.width).toFixed(2)}%`);
    popup.style.setProperty("--caelestia-oy", `${(100 * y / rect.height).toFixed(2)}%`);
  }

  // Menu corners scale with the menu's size: a short menu gets ~10px, the
  // long app menu ~20px. Outer = 4px + 2.5% of the height (10..24px); the
  // gap-facing corners keep the spec's 16:8 ratio at half that.
  function sizeMenuCorners(host, height) {
    if (!height) return;
    const outer = clamp(4 + height * 0.025, 10, 24);
    host.style.setProperty("--caelestia-group-outer", `${outer.toFixed(1)}px`);
    host.style.setProperty("--caelestia-group-inner", `${(outer / 2).toFixed(1)}px`);
  }

  // Cleared again on popuphidden, so every open replays the animation.
  function startPopupAnimation(popup) {
    clearTimeout(popup.__caelestiaPendingTimer);
    if (!popup.hasAttribute("caelestia-pending")) return;
    // Its final position is known now (popuppositioned doesn't fire for
    // menus opened at a screen point, e.g. when flipped to fit the screen).
    setPopupOrigin(popup);
    if (typeof popup.getOuterScreenRect === "function") {
      sizeMenuCorners(popup, popup.getOuterScreenRect().height);
    }
    popup.removeAttribute("caelestia-pending");
    popup.setAttribute("caelestia-opening", "true");
  }

  function isAnimatedPopup(el) {
    return el.localName === "menupopup" || (el.localName === "panel" && el.getAttribute("type") === "arrow");
  }

  function onPopupEvent(event) {
    const popup = event.target;
    switch (event.type) {
      case "popupshowing":
        segmentMenu(popup);
        if (isAnimatedPopup(popup)) {
          // Before positioning, assume the popup opens at the pointer with its
          // top-left corner there (true for context menus that aren't flipped);
          // popuppositioned corrects it.
          for (const prop of ["--caelestia-origin", "--caelestia-ox", "--caelestia-oy"]) {
            popup.style.removeProperty(prop);
          }
          if (originPoint(popup)) {
            popup.style.setProperty("--caelestia-origin", "0px 0px");
            popup.style.setProperty("--caelestia-ox", "0%");
            popup.style.setProperty("--caelestia-oy", "0%");
          }
          // Hold the popup collapsed at its origin until it is really on screen:
          // the window only maps a few frames after popupshowing (Wayland), so
          // an animation started now would mostly play while invisible.
          popup.removeAttribute("caelestia-opening");
          popup.setAttribute("caelestia-pending", "true");
          clearTimeout(popup.__caelestiaPendingTimer);
          // Failsafe: never leave a popup hidden if popupshown doesn't come.
          popup.__caelestiaPendingTimer = setTimeout(() => startPopupAnimation(popup), 400);
        }
        break;
      case "popupshown":
        if (isAnimatedPopup(popup)) startPopupAnimation(popup);
        segmentMenu(popup);
        if (popup.matches?.(SEGMENTED_PANELS)) {
          segmentPanelView(popup.querySelector("panelview[current], panelview[visible]") ||
            popup.querySelector("panelview"));
        }
        break;
      case "popuppositioned":
        popup.toggleAttribute("caelestia-opens-up", !!event.alignmentPosition?.startsWith("before"));
        if (isAnimatedPopup(popup)) setPopupOrigin(popup);
        break;
      case "popuphidden":
        clearTimeout(popup.__caelestiaPendingTimer);
        popup.removeAttribute("caelestia-pending");
        popup.removeAttribute("caelestia-opening");
        break;
    }
  }

  // ---------- Fold-up close ----------

  // Like KiiteShell's popup: on close a menu folds up toward where it opened
  // and fades. The popup is held open for MENU_CLOSE_MS, then really hidden.
  const MENU_CLOSE_MS = 160;

  function hasCloseAnimation(popup) {
    return popup.localName === "menupopup" && popup.id !== "zenCreateNewPopup" &&
      !popup.closest("menulist") && m3eMotion();
  }

  function finishClose(popup) {
    clearTimeout(popup.__caelestiaCloseTimer);
    popup.__caelestiaCloseTimer = null;
    popup.hidePopup();
    popup.removeAttribute("caelestia-closing");
    popup.__caelestiaClosing = false;
  }

  function onPopupHiding(event) {
    const popup = event.target;
    if (popup.__caelestiaClosing || !hasCloseAnimation(popup)) return;
    event.preventDefault();
    popup.__caelestiaClosing = true;
    popup.setAttribute("caelestia-closing", "true");
    popup.__caelestiaCloseTimer = setTimeout(() => finishClose(popup), MENU_CLOSE_MS);
  }

  // The screen point a popup is opened from, as Firefox asks for it: the
  // right-click position for context menus (openPopupAtScreen), or the center
  // of the anchor button. Right-clicks on web pages happen in the content
  // process, so the chrome window never sees that pointer; this is the only
  // reliable source for page context menus.
  function openPoint(name, args) {
    if (name === "openPopupAtScreen") {
      const [x, y] = args;
      if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
    } else if (name === "openPopupAtScreenRect") {
      const [, x, y, w, h] = args;
      if (Number.isFinite(x)) return { x: x + (w || 0) / 2, y: y + (h || 0) / 2 };
    } else if (name === "openPopup") {
      const anchor = args[0];
      const rect = anchor?.getBoundingClientRect?.();
      if (rect?.width) {
        // Prefer the pointer when the button was just clicked with it.
        if (performance.now() - lastPointer.time < 600) return { x: lastPointer.x, y: lastPointer.y };
        return { x: window.mozInnerScreenX + rect.x + rect.width / 2, y: window.mozInnerScreenY + rect.y + rect.height / 2 };
      }
    }
    return null;
  }

  // Records the open point, and makes a popup that is still folding away
  // close for real before it opens again, or a quick second right-click would
  // be swallowed.
  function patchPopupOpening() {
    const proto = window.XULPopupElement?.prototype;
    if (!proto || proto.__caelestiaPatched) return;
    proto.__caelestiaPatched = true;
    for (const name of ["openPopup", "openPopupAtScreen", "openPopupAtScreenRect"]) {
      const original = proto[name];
      if (typeof original !== "function") continue;
      proto[name] = function (...args) {
        if (this.__caelestiaClosing) finishClose(this);
        const point = openPoint(name, args);
        this.__caelestiaOpenPoint = point && { ...point, time: performance.now() };
        return original.apply(this, args);
      };
    }
  }

  // ==========================================
  // URL bar open/close morph
  // ==========================================

  function m3eMotion() {
    return document.documentElement.hasAttribute("caelestia-m3e") &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function cssVar(name, el = document.documentElement) {
    return getComputedStyle(el).getPropertyValue(name).trim();
  }

  let urlbarGhost = null;

  // Animates a stand-in card between two rects (container transform). Runs
  // from a MutationObserver, i.e. after Firefox toggles breakout-extend but
  // before the next paint, so nothing flashes in between.
  function morphUrlbar(urlbar, from, to, fromRadius, toRadius, opening) {
    urlbarGhost?.remove();
    const ghost = document.createElementNS("http://www.w3.org/1999/xhtml", "div");
    ghost.id = "caelestia-urlbar-ghost";
    document.documentElement.appendChild(ghost);
    urlbarGhost = ghost;

    const frame = (r, radius) => ({
      transform: `translate(${r.x}px, ${r.y}px)`,
      width: `${r.width}px`,
      height: `${r.height}px`,
      borderRadius: radius,
    });
    if (opening) urlbar.setAttribute("caelestia-morphing", "true");

    const anim = ghost.animate([frame(from, fromRadius), frame(to, toRadius)], {
      duration: parseFloat(cssVar("--md-dur-slow")) || 500,
      easing: cssVar("--md-spring-default-spatial") || "ease-out",
      fill: "forwards",
    });
    anim.finished.then(() => {
      urlbar.removeAttribute("caelestia-morphing");
      if (opening) {
        ghost.remove();
        // Contents settle in (field, then staggered rows) instead of popping.
        urlbar.setAttribute("caelestia-revealing", "true");
        clearTimeout(urlbar.__caelestiaRevealTimer);
        urlbar.__caelestiaRevealTimer = setTimeout(() => urlbar.removeAttribute("caelestia-revealing"), 700);
        return;
      }
      // Closing: the ghost now sits exactly on the resting bar; fade it out.
      ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: "forwards" })
        .finished.then(() => ghost.remove());
    }, () => {
      urlbar.removeAttribute("caelestia-morphing");
    });
  }

  // Where the card grows from when the bar wasn't clicked (Ctrl+L, Ctrl+T, a
  // new tab focusing it): a small dot at the center of the web page area.
  const URLBAR_DOT = 12;

  function pageCenterDot() {
    const area = document.getElementById("tabbrowser-tabpanels") || document.documentElement;
    const r = area.getBoundingClientRect();
    return new DOMRect(r.x + r.width / 2 - URLBAR_DOT / 2, r.y + r.height / 2 - URLBAR_DOT / 2, URLBAR_DOT, URLBAR_DOT);
  }

  function initUrlbarMorph() {
    const urlbar = document.getElementById("urlbar");
    const bg = urlbar?.querySelector(".urlbar-background");
    const container = document.getElementById("urlbar-container");
    if (!bg || !container) return;

    // A press on the bar itself means "opened by clicking the bar".
    let barPressedAt = -Infinity;
    container.addEventListener("mousedown", () => {
      barPressedAt = performance.now();
    }, { capture: true, passive: true });

    let lastOpenRect = null;
    let openedFrom = "bar";
    new ResizeObserver(() => {
      if (urlbar.hasAttribute("breakout-extend")) lastOpenRect = bg.getBoundingClientRect();
    }).observe(bg);

    let wasOpen = urlbar.hasAttribute("breakout-extend");
    new MutationObserver(() => {
      const open = urlbar.hasAttribute("breakout-extend");
      if (open === wasOpen) return;
      wasOpen = open;
      if (!m3eMotion()) return;

      const rest = container.getBoundingClientRect();
      const barVisible = rest.width > 0 && rest.height > 0;
      const restRadius = cssVar("--caelestia-urlbar-rest-radius", urlbar) || `${rest.height / 2}px`;
      const panelRadius = cssVar("--caelestia-urlbar-open-radius", urlbar) || "36px";
      const dotRadius = `${URLBAR_DOT / 2}px`;

      if (open) {
        // Clicking the bar morphs it into the card; any other way of opening
        // grows the card out of a dot at the center of the page.
        openedFrom = barVisible && performance.now() - barPressedAt < 800 ? "bar" : "center";
        lastOpenRect = bg.getBoundingClientRect();
        if (openedFrom === "bar") {
          morphUrlbar(urlbar, rest, lastOpenRect, restRadius, panelRadius, true);
        } else {
          morphUrlbar(urlbar, pageCenterDot(), lastOpenRect, dotRadius, panelRadius, true);
        }
      } else if (lastOpenRect) {
        // Close back into wherever it came from.
        if (openedFrom === "bar" && barVisible) {
          morphUrlbar(urlbar, lastOpenRect, rest, panelRadius, restRadius, false);
        } else {
          morphUrlbar(urlbar, lastOpenRect, pageCenterDot(), panelRadius, dotRadius, false);
        }
      }
    }).observe(urlbar, { attributes: true, attributeFilter: ["breakout-extend"] });
  }

  // ==========================================
  // FAB menu
  // ==========================================

  const FAB_CLOSE_MS = 160;

  function initFabMenu() {
    const popup = document.getElementById("zenCreateNewPopup");
    if (!popup) return;

    // Zen opens it with "before_start" (items grow away from the sidebar edge).
    // With M3E, open toward the content side instead, right-aligned to the FAB
    // when the sidebar is on the left.
    const openPopup = popup.openPopup.bind(popup);
    popup.openPopup = (anchor, position, ...rest) => {
      if (document.documentElement.hasAttribute("caelestia-m3e") && position === "before_start") {
        const rightSide = document.documentElement.getAttribute("zen-right-side") === "true";
        position = rightSide ? "before_start" : "before_end";
        popup.toggleAttribute("caelestia-align-end", !rightSide);
      }
      return openPopup(anchor, position, ...rest);
    };

    // Close animation: hold the popup open while its items collapse into the FAB.
    popup.addEventListener("popuphiding", (event) => {
      if (event.target !== popup || popup.__caelestiaClosing || !m3eMotion()) return;
      event.preventDefault();
      popup.__caelestiaClosing = true;
      popup.setAttribute("caelestia-closing", "true");
      setTimeout(() => {
        popup.hidePopup();
        popup.removeAttribute("caelestia-closing");
        popup.__caelestiaClosing = false;
      }, FAB_CLOSE_MS);
    });
  }

  // ==========================================
  // UI style
  // ==========================================

  function applyUiAttrs() {
    const docEl = document.documentElement;
    if (getStr(P.uiStyle, "m3e") === "m3e") {
      docEl.setAttribute("caelestia-m3e", "true");
    } else {
      docEl.removeAttribute("caelestia-m3e");
    }
    docEl.setAttribute("caelestia-shape", getStr(P.uiShape, "expressive"));
    docEl.setAttribute("caelestia-density", getStr(P.uiDensity, "comfortable"));
  }

  // ==========================================
  // Website tint (Zen Boosts)
  // ==========================================

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

  function hexToRgb(hex) {
    const clean = hex.replace("#", "");
    return [
      parseInt(clean.slice(0, 2), 16) / 255,
      parseInt(clean.slice(2, 4), 16) / 255,
      parseInt(clean.slice(4, 6), 16) / 255,
    ];
  }

  function tintSettings() {
    const tint = getStr(P.tint, "balanced");
    if (tint === "off") return null;
    if (tint === "custom") {
      return {
        color: getStr(P.tintColor, "surface"),
        intensity: getNum(P.intensity, 150),
        brightness: getNum(P.brightness, 15),
        strength: getNum(P.strength, 70),
      };
    }
    return TINT_PRESETS[tint] || TINT_PRESETS.balanced;
  }

  // Same packing as ZenBoostsChild#buildBoostColor: alpha in the high byte, then b, g, r.
  function computeBoostColor() {
    const t = tintSettings();
    const hex = t && (colors[t.color] || colors.surface);
    if (!hex) return 0;

    const [h, s] = rgbToHsl(...hexToRgb(hex));
    const sat = clamp(s * t.intensity / 100, 0, 1);
    const light = clamp(t.brightness / 100, 0, 1);
    const alpha = clamp(t.strength / 100, 0, 1);
    const [r, g, b] = hslToRgb(h, sat, light);
    return (Math.round(alpha * 255) << 24) | (Math.round(b * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(r * 255);
  }

  function applyBoostToBrowser(browser) {
    const bc = browser?.browsingContext;
    if (!bc) return;
    try {
      if (boostColor) {
        if (bc.zenBoostsData !== boostColor) {
          bc.zenBoostsData = boostColor;
          bc.zenBoostsComplementaryRotation = 55;
          bc.isZenBoostsInverted = false;
        }
      } else if (appliedBoost && bc.zenBoostsData === appliedBoost) {
        // Tint turned off: clear only what we wrote, leave the user's own site boosts alone.
        bc.zenBoostsData = 0;
        bc.zenBoostsComplementaryRotation = 0;
      }
    } catch (e) {}
  }

  function applyBoostToAllTabs() {
    if (!window.gBrowser) return;
    for (const tab of gBrowser.tabs) {
      applyBoostToBrowser(tab.linkedBrowser);
    }
  }

  function applyTint() {
    const next = computeBoostColor();
    if (!next && boostColor) appliedBoost = boostColor;
    boostColor = next;
    applyBoostToAllTabs();
    appliedBoost = boostColor;
  }

  function watchTabs() {
    gBrowser.tabContainer.addEventListener("TabSelect", () => {
      applyBoostToBrowser(gBrowser.selectedBrowser);
    });

    gBrowser.addTabsProgressListener({
      onLocationChange(browser) {
        applyBoostToBrowser(browser);
      },
      onStateChange(browser, webProgress, request, flags) {
        if ((flags & Ci.nsIWebProgressListener.STATE_STOP) && webProgress?.isTopLevel) {
          applyBoostToBrowser(browser);
        }
      },
    });

    // Zen's boost actor resets the field on its own schedule; re-check the visible tab.
    // Reading the field is local, so this only writes when something reset it.
    setInterval(() => {
      if (boostColor) applyBoostToBrowser(gBrowser.selectedBrowser);
    }, 250);
  }

  // ==========================================
  // Ripple
  // ==========================================

  const RIPPLE_HOSTS = [
    ".tabbrowser-tab",
    "toolbarbutton",
    "menuitem",
    "menu",
    ".subviewbutton",
    ".urlbarView-row",
    "button",
    ".zen-current-workspace-indicator",
  ].join(", ");

  function rippleSurface(host) {
    if (host.classList.contains("tabbrowser-tab")) {
      return host.querySelector(".tab-background");
    }
    if (host.classList.contains("toolbarbutton-1")) {
      return host.querySelector(":scope > .toolbarbutton-icon, :scope > .toolbarbutton-badge-stack") || host;
    }
    return host;
  }

  function onPointerDown(event) {
    if (event.button !== 0) return;
    if (!document.documentElement.hasAttribute("caelestia-m3e")) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const host = event.target.closest?.(RIPPLE_HOSTS);
    const surface = host && rippleSurface(host);
    if (!surface) return;

    const rect = surface.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    surface.style.setProperty("--caelestia-ripple-x", `${event.clientX - rect.left}px`);
    surface.style.setProperty("--caelestia-ripple-y", `${event.clientY - rect.top}px`);
    surface.style.setProperty("--caelestia-ripple-size", `${Math.hypot(rect.width, rect.height) * 1.1}px`);

    // Restart the animation if it is already running.
    surface.removeAttribute("caelestia-ripple");
    void surface.getBoundingClientRect();
    surface.setAttribute("caelestia-ripple", "true");
    clearTimeout(surface.__caelestiaRippleTimer);
    surface.__caelestiaRippleTimer = setTimeout(() => surface.removeAttribute("caelestia-ripple"), 700);
  }

  // ==========================================
  // Init
  // ==========================================

  function applyAll() {
    if (!colors.surface) return;
    writeColorVars();
    applySystemColors();
    applyBackground();
    applyTint();
    applyMode();
  }

  function onPrefChange() {
    applyUiAttrs();
    applyAll();
  }

  // Firefox ignores ::part() in user-origin sheets (how Sine loads chrome.css),
  // so the ::part() rules live in m3e/parts.css, loaded here as an author sheet.
  function loadPartsSheet() {
    try {
      const path = PathUtils.join(PathUtils.profileDir, "chrome", "sine-mods", "caelestia-zen", "m3e", "parts.css");
      window.windowUtils.loadSheetUsingURIString(PathUtils.toFileURI(path), window.windowUtils.AUTHOR_SHEET);
    } catch (e) {
      console.error("[CaelestiaZen] Could not load parts.css:", e);
    }
  }

  function startSchemeWatcher() {
    setInterval(() => loadScheme(), 500);
  }

  function init() {
    migrateOldPrefs();
    ensureDefaults();

    for (const name of Object.values(P)) {
      if (name === P.modeApplied || name === P.migrated) continue;
      if (name === P.schemePath) {
        Services.prefs.addObserver(name, () => loadScheme(true));
      } else {
        Services.prefs.addObserver(name, onPrefChange);
      }
    }

    const start = () => {
      loadPartsSheet();
      applyUiAttrs();
      loadScheme(true);
      startSchemeWatcher();
      window.addEventListener("pointerdown", onPointerDown, true);
      // Bubble phase: runs after the menu's own popupshowing handler has
      // hidden/shown its items. popupshown catches items added late.
      window.addEventListener("popupshowing", onPopupEvent);
      window.addEventListener("popupshown", onPopupEvent);
      window.addEventListener("popuppositioned", onPopupEvent);
      window.addEventListener("popuphidden", onPopupEvent);
      window.addEventListener("popuphiding", onPopupHiding);
      window.addEventListener("mouseover", onSegmentHover, { capture: true, passive: true });
      patchPopupOpening();
      window.addEventListener("ViewShowing", onViewEvent, true);
      window.addEventListener("ViewShown", onViewEvent, true);
      for (const type of ["mousedown", "contextmenu", "mousemove"]) {
        window.addEventListener(type, trackPointer, { capture: true, passive: true });
      }
      initUrlbarMorph();
      initFabMenu();
      if (window.gBrowser) {
        watchTabs();
      } else {
        window.addEventListener("load", watchTabs, { once: true });
      }
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", start);
    } else {
      start();
    }

    console.log("[CaelestiaZen] Init complete!");
  }

  init();
})();
