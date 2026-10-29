# CaelestiaZen overhaul plan

> **Status (2026-10-28):** Parts 1 and 2 are implemented in 2.0.0, except the `about:preferences` restyle (that page is not themed by the chrome stylesheet; it needs a separate content stylesheet).

Two tracks:

1. **Configuration** — fewer settings, no manual template step, settings named after what they do.
2. **M3 Expressive UI** — restyle Zen's chrome with Material 3 Expressive shape, color, motion and type, driven by the Caelestia scheme.

Based on CaelestiaZen `aeb0cc0` and Zen-Browser `f75390a`.

---

## Part 1 — Configuration

### What's wrong today

| Problem | Where | Effect on users |
|---|---|---|
| Default theme path is hard-coded to `/home/dim/...` | `theme-sync.uc.js:27` (`DEFAULT_CHROME_PATH`) | Sine only writes a pref's `defaultValue` when its settings page is rendered, so on a fresh install `getPref` falls back to this path. For anyone except you, nothing is themed until they open the mod's settings. **Bug, fix first.** |
| Two sources of truth for colors | `templates/zen-browser.css` + regex parsing in JS | Users have to install a Caelestia template, and the JS can only see the 7 colors it greps for. |
| `chrome.css` is never loaded | `theme.json` has no `style` key | Dead file; there's nowhere to put static chrome CSS. |
| Boost knobs point in different directions | `preferences.json` | "Intensity: higher = more", "Brightness: higher = more", "Strength: **lower** = stronger". Strength is really alpha, inverted. |
| The boost formula doesn't match Zen's | `buildBoostColor` vs `ZenBoostsChild.sys.mjs:126` | Zen stores saturation inverted and maps lightness to `0.1 + 0.9·b`. Values you copy from Zen's boost editor give different results in the mod. |
| Transparent Zen silently turns off website tinting | `loadChromeTheme` | Two settings that look independent fight each other, and nothing in the UI says so. |
| Light/dark needs Dark Reader set by hand | README "Recoloring Only Website Backgrounds" | Users flip Dark Reader whenever they switch Caelestia mode. |
| 6 numeric/string prefs to tune one tint | README "Configuration" | Most users only want "a bit of tint" or "none". |

### Proposal

**1. Read `scheme.json` directly and drop the template.**
Caelestia already writes `$XDG_STATE_HOME/caelestia/scheme.json` with every M3 role (`primaryContainer`, `secondaryContainer`, `surfaceContainerLowest…Highest`, `tertiary*`, `error*`, `inverse*`, plus `mode` and `variant`). The mod can:

- watch that one file (same mtime poll as now),
- emit `--md-sys-color-<role>` custom properties on `:root` from JS,
- keep all Zen-variable mapping in a static, versioned stylesheet in the mod (`chrome.css`, now actually registered in `theme.json`).

That removes the **Theme File Path** setting, the **Template Setup** README section and the template copy in `install.sh`. Keep an optional hidden pref `caelestia.zen.scheme-path` for non-standard setups, defaulting to `$XDG_STATE_HOME` → `~/.local/state`.

**2. Replace the boost section with one preset dropdown.**

```
Website tint:  Off | Subtle | Balanced (default) | Vivid | Accent | Custom
```

| Preset | Color role | Intensity | Brightness | Strength |
|---|---|---|---|---|
| Subtle | surface | 120 | 15 | 50 |
| Balanced | surface | 150 | 15 | 70 |
| Vivid | surfaceContainerHigh | 200 | 20 | 85 |
| Accent | primary | 150 | 80 | 50 |
| Custom | uses the advanced fields below | | | |

The **Custom** fields (color role, intensity, brightness, strength) are only shown when Custom is selected, using Sine's `conditions` key (`{"if": {"property": "caelestia.zen.tint", "value": "custom"}}`, supported by the installed Sine `preferences.sys.mjs`). Strength switches to *higher = stronger* (stored as `100 - x` internally, with a one-time migration of the old pref). *(Built: the alpha packing matches Zen's. Saturation and lightness keep the mod's own mapping, because the hue and saturation come from the scheme color, not a picker, and changing them would break values people had already tuned.)*

**3. Merge background options into one choice.**

```
Background:  Caelestia surface (default) | Transparent (needs Transparent Zen mod)
Opacity:     80        ← only for Transparent
```

When Transparent is picked and tint is on, show the conflict in the description ("website tint is paused while Transparent is active") rather than switching it off silently, or better, let both run if Transparent Zen allows it.

**4. Follow Caelestia light/dark automatically** (checkbox, on by default).
On scheme change, set `zen.view.window.scheme` (0 dark / 1 light) and `layout.css.prefers-color-scheme.content-override` from `scheme.json`'s `mode`. Sites that honor `prefers-color-scheme` follow your shell, so most people won't need the Dark Reader toggle. The Zen Internet + Dark Reader recipe stays in the README as an advanced option.

**5. UI style** (new, see Part 2):

```
Interface style:  M3 Expressive (default) | Zen default
Shape:            Expressive (round, large) | Standard
Density:          Comfortable | Compact
```

### The resulting settings page

```
CaelestiaZen
  Interface style ........ M3 Expressive ▾
  Shape .................. Expressive ▾
  Density ................ Comfortable ▾
  Follow Caelestia light/dark  [x]
Websites
  Website tint ........... Balanced ▾
Background
  Background ............. Caelestia surface ▾
Advanced (Custom tint only)
  Tint color ............. Surface ▾
  Intensity / Brightness / Strength
```

The README "Configuration" section drops to about five bullets, and "Template Setup" and "Theme File" go away.

### Smaller cleanups while in there

- Replace the 100 ms / 200 ms `setInterval`s and the subtree `MutationObserver` on `style` with the existing `TabOpen`/`select`/progress listeners plus one observer on `#zen-browser-background`. These intervals run all the time.
- Store numbers as real `int` prefs instead of strings parsed with `parseFloat`.
- Rename the pref namespace to `caelestia.zen.*` once, with a migration step.

---

## Part 2 — M3 Expressive UI

### What M3 Expressive changes compared to "plain" M3

- **Shape**: a larger corner scale (`xs 4 · sm 8 · md 12 · lg 16 · lg+ 20 · xl 28 · xl+ 32 · xxl 48 · full`), and **shape morphing**: components change corner radius on press or select.
- **Color**: stronger container contrast. Selected states use `*Container` roles, not faint tints.
- **Motion**: spring-based. *Spatial* springs (position/size/shape) can overshoot; *effects* springs (color/opacity) don't.
- **Type**: emphasized styles (heavier weight on selected/primary items), a variable font (Google Sans Flex / Roboto Flex).
- **New components** relevant here: connected button groups, floating toolbars, wavy progress indicators, the shape-morphing loading indicator.

### Token layer (`m3e/tokens.css`)

All components use these tokens and never raw values, so the Shape/Density options only swap tokens.

```css
:root {
  /* color: written by theme-sync.uc.js from scheme.json */
  --md-sys-color-primary: …;            /* + all roles */

  /* shape */
  --md-shape-xs: 4px;  --md-shape-sm: 8px;   --md-shape-md: 12px;
  --md-shape-lg: 16px; --md-shape-lg-plus: 20px;
  --md-shape-xl: 28px; --md-shape-xl-plus: 32px; --md-shape-full: 9999px;

  /* motion (CSS approximations of M3E springs) */
  --md-spring-fast-spatial:    linear(0, 0.35 12%, 0.86 28%, 1.06 42%, 1.02 60%, 1);  /* ~200ms */
  --md-spring-default-spatial: linear(0, 0.24 12%, 0.72 30%, 1.04 50%, 1.01 70%, 1);  /* ~350ms */
  --md-spring-effects:         cubic-bezier(0.2, 0, 0, 1);
  --md-dur-fast: 200ms; --md-dur-default: 350ms; --md-dur-slow: 500ms;

  /* state layers */
  --md-state-hover: 8%; --md-state-focus: 10%; --md-state-press: 10%;

  /* type */
  --md-font: "Google Sans Flex", "Roboto Flex", system-ui, sans-serif;
}
```

**Bridge to Zen.** One file maps `--md-*` onto Zen's own variables (`--zen-border-radius`, `--zen-colors-*`, `--zen-main-browser-background`, `--toolbar-*`, `--urlbar-*`, `--panel-border-radius`, `--arrowpanel-menuitem-border-radius`, `--border-radius-medium`, `--tab-border-radius`, `--button-border-radius`, `--toolbarbutton-border-radius`). This replaces the current template's `#main-window[caelestia-theme-active]` block. When Zen changes, only this file needs updating.

**Gating.** Zen's own CSS uses `@media -moz-pref(...)`, so every M3E rule is wrapped in `@media -moz-pref('caelestia.zen.m3e')`. Turning the style off is instant and needs no JS.

**Squircles off.** Zen applies `corner-shape: superellipse(var(--zen-squircle-value))` to everything when `layout.css.corner-shape.enabled` is set (`zen-theme.css:361`). M3E shapes are round, so under M3E set `--zen-squircle-value: 1` (`superellipse(1)` = round). Zen divides some radii by this value, so 1 also stops it shrinking our radii.

### Component map

| Zen surface | Selector anchor | M3E treatment |
|---|---|---|
| Window / sidebar backdrop | `#zen-browser-background`, `--zen-main-browser-background` | `surfaceContainer`. Sidebar is a navigation drawer with no visible border. |
| Web content card | `.browserContainer`, `--zen-native-inner-radius` | `surface`, radius `xl` (28) or `lg+` (20) in Compact, separation via `zen.theme.content-element-separation` 8 → 10. |
| Tabs (vertical) | `.tabbrowser-tab .tab-background` | Height 44 (40 compact), radius `full`. Hover is an `onSurface` 8% state layer. **Selected** uses `secondaryContainer` / `onSecondaryContainer`, label weight 600 and **morphs** to radius `lg`. Press shows an Android-style **ripple** from the pointer (no scale/bounce). |
| Essentials grid | `#zen-essentials` tabs | Tonal tiles in `surfaceContainerHigh`, radius `lg`. Selected becomes `primaryContainer` and morphs to `xl`. Optional: favicon clipped to the M3E "cookie" shape. |
| Pinned / folders | `zen-folders.css` | Folder header is a `titleSmall` emphasized label. The chevron rotates with `default-spatial`. |
| Spaces switcher | `zen-workspaces.css` icons | **Connected button group**: segments in `surfaceContainerHigh`. The active segment is `primary` and widens to a pill (width spring). |
| URL bar (idle) | `#urlbar:not([breakout-extend]) .urlbar-background` | M3E search bar: `surfaceContainerHigh`, radius `full`, height 48. |
| URL bar (open) | `#urlbar[breakout-extend]` | Floats as an `xl` card on `surfaceContainerHigh` with elevation 3. Results rows use radius `lg`. The selected row is `secondaryContainer`, and switch-to-tab/action chips are `tertiaryContainer` pills. Opening morphs radius `full` → `xl` on `default-spatial`. |
| Toolbar / sidebar buttons | `toolbarbutton`, `#zen-sidebar-top-buttons` | M3E icon buttons, 40×40, radius `full`. On press the radius morphs to `md` (round → squarish). Toggled buttons (e.g. sidebar) are filled `primary`. |
| Bottom sidebar buttons | `#zen-sidebar-foot-buttons` | **Floating toolbar**: a `surfaceContainerHighest` pill with elevation 2. |
| Menus / context menus | `menupopup`, `panel` (`zen-popup.css`) | `surfaceContainer`, radius `lg`. Items are inset 4px with radius `md`. The checked/selected item is `tertiaryContainer`. Separators become 8px gaps (M3E vertical-menu segments). |
| Panels (extensions, downloads, app menu) | `--panel-border-radius` | Radius `xl`. Headers use `titleMedium` emphasized. |
| Dialogs / prompts | `zen-panels/dialog.css` | `surfaceContainerHigh`, radius `xl`. Buttons are filled/tonal pills. |
| In-content buttons | `--in-content-*`, `zen-buttons.css` | Filled = `primary` pill, tonal = `secondaryContainer`. Press morph to `md`. |
| Toasts | `#zen-toast-container` | Snackbar: `inverseSurface` / `inverseOnSurface`, radius `md`, slides in on `default-spatial`. |
| Tab loading | tab throbber | M3E **loading indicator** (morphing polygon, CSS `clip-path` keyframes) in `primary`. |
| Downloads / media seek | `zen-download-*`, `zen-media-controls.css` | **Wavy progress indicator** (SVG mask wave) in `primary` on a `secondaryContainer` track. |
| Glance / split view | `zen-glance.css`, `zen-split-view.css` | Glance card radius `xl+` with `scrim` backdrop. Active split pane gets a 2px `primary` outline. |
| Settings (`about:preferences`) | `zen-preferences.css` | Cards in `surfaceContainerLow`, radius `lg`. Switches become M3 switches with an icon on the thumb. |

### Motion rules

- Shape and size changes (radius morph, width of active segment, URL bar open) use `--md-spring-*-spatial`.
- Color and opacity use `--md-spring-effects` and never overshoot.
- Respect `prefers-reduced-motion`: the springs collapse to `--md-spring-effects` at `--md-dur-fast`.
- Press feedback is a ripple, never a scale bounce: a `::after` radial gradient that expands from the pointer. `theme-sync.uc.js` sets `--ripple-x`/`--ripple-y` on `pointerdown`, and it falls back to the center. Icon buttons can still morph their corner radius on press.
- Don't animate layout properties on tabs during drag or reorder, because Zen already animates those. Animate only `border-radius`, `background-color` and opacity.

### File layout

```
CaelestiaZen/
  theme.json            # registers scripts + style.chrome
  preferences.json      # the slimmer settings from Part 1
  theme-sync.uc.js      # scheme.json → --md-sys-color-*; boost; light/dark
  chrome.css            # @import the files below, gated by -moz-pref
  m3e/
    tokens.css          # shape / motion / type / state tokens
    bridge.css          # --md-* → Zen variables (replaces the template)
    sidebar.css         # tabs, essentials, folders, spaces, foot buttons
    urlbar.css
    menus.css           # menupopup, panels, dialogs, toasts
    controls.css        # buttons, switches, progress, loading indicator
  templates/            # removed
```

### Risks

- **Zen CSS churn**: selectors in `vertical-tabs.css` / `zen-omnibox.css` change often. Mitigate by leaning on Zen's variables (bridge) and keeping per-component overrides small.
- **`!important` conflicts** with other Sine mods (e.g. Transparent Zen). Keep specificity low with `:where()` and use `!important` only in the bridge.
- **Compact mode / single toolbar / collapsed sidebar** each change layout. Each needs a pass (`:root[zen-single-toolbar]`, `[zen-compact-mode]`, `:not([zen-sidebar-expanded])`).
- **Fonts**: Google Sans Flex can't be bundled. Fall back to Roboto Flex if installed, otherwise system-ui.

---

## Suggested order

1. Fix the `DEFAULT_CHROME_PATH` bug and register `chrome.css` in `theme.json`. Small and safe.
2. Read `scheme.json` directly, write `--md-sys-color-*`, move the template's mappings into `m3e/bridge.css`, and remove the template.
3. Website-tint presets, Zen-matching boost math, pref migration, and follow light/dark.
4. M3E tokens, the squircle override, and the sidebar (tabs, essentials, spaces). This is the most visible part.
5. URL bar, menus/panels/dialogs.
6. Extras: loading indicator, wavy progress, preferences page.
7. Rewrite the README around the new settings.
