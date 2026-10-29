# CaelestiaZen

A Sine mod for Zen Browser that live-themes the browser from your [Caelestia](https://github.com/caelestia-dots) scheme, restyles Zen as an M3 Expressive app, and tints every website to match.

## Features

- Real-time sync with Caelestia's color scheme, read straight from `scheme.json` (no template setup)
- M3 Expressive interface: pill tabs that change shape when selected, tonal Essentials, a connected spaces switcher, a floating URL bar card, context menus split into floating rounded groups that grow in when opened, a FAB menu for creating spaces, folders, splits and tabs, a navigation-rail Library, ripple press feedback, a shape-morphing loading indicator and wavy progress bars
- Text selection and accent colors (in Zen and on websites) follow your scheme's primary color
- Website tint presets via Zen Boosts (Off, Subtle, Balanced, Vivid, Accent or Custom)
- Follows Caelestia's light/dark mode for both Zen and websites
- Works with the Transparent Zen mod

## Installation

You need Zen Browser, [Caelestia](https://github.com/caelestia-dots), and `git`, `curl`, `unzip` and `python3`. There are three ways to install.

### 1. Install script (recommended)

```bash
git clone https://github.com/dim-ghub/CaelestiaZen
cd CaelestiaZen
bash install.sh
```

The script asks two things:

- **Which browser:** it detects Zen (including the Flatpak) and preselects it. Pick `0` to type an install and profile directory yourself.
- **Which profile:** your default profile is listed first.

Then it:

- **Installs Sine** (the mod loader) if it isn't already there. Its bootloader goes into the browser's install directory, which usually needs `sudo`; you'll be asked for your password if so. If Sine is already installed, it asks whether to reinstall it.
- **Copies the mod** into `<profile>/chrome/sine-mods/caelestia-zen` and enables it in `mods.json`.
- **Removes the Caelestia template** left behind by CaelestiaZen 1.x, if there is one. Colors now come straight from `scheme.json`.

Restart Zen Browser. If the new look doesn't appear, open `about:support`, click **Clear Startup Cache**, and restart again.

### 2. Development install

```bash
git clone https://github.com/dim-ghub/CaelestiaZen
cd CaelestiaZen
bash install.sh --dev
```

Same as above, but the mod files are **symlinked** to your clone instead of copied, so edits take effect on the next Zen restart without reinstalling.

### 3. Manual install

Use this if Sine is already set up and you'd rather not run the script. Replace `<profile>` with your profile folder (listed in `~/.config/zen/profiles.ini`).

1. Copy the mod into Sine's mod folder:
```bash
mkdir -p ~/.config/zen/<profile>/chrome/sine-mods/caelestia-zen
cp theme.json preferences.json theme-sync.uc.js chrome.css ~/.config/zen/<profile>/chrome/sine-mods/caelestia-zen/
cp -r m3e ~/.config/zen/<profile>/chrome/sine-mods/caelestia-zen/
```

2. Register it in `mods.json`:
```bash
cd ~/.config/zen/<profile>/chrome/sine-mods
python3 -c "
import json, os
mods = json.load(open('mods.json')) if os.path.exists('mods.json') else {}
mod = json.load(open('caelestia-zen/theme.json'))
mod['origin'] = 'store'
mod['enabled'] = True
mods['caelestia-zen'] = mod
json.dump(mods, open('mods.json', 'w'), indent=2)
"
```

3. Restart Zen Browser.

### Updating

```bash
cd CaelestiaZen
git pull
bash install.sh
```

With a development install, `git pull` and a restart are enough.

### Uninstalling

1. Remove `~/.config/zen/<profile>/chrome/sine-mods/caelestia-zen` and its `caelestia-zen` entry in `mods.json` (or disable it in Sine's settings).
2. In `about:config`, reset the `caelestia.zen.*` prefs, and the `ui.highlight`, `ui.highlighttext`, `ui.textSelectDisabledBackground`, `ui.accentcolor` and `ui.accentcolortext` prefs CaelestiaZen set, to get your system selection colors back.

## Configuration

Everything is in the mod's Sine settings and applies live:

- **Interface style**: M3 Expressive (default) or Zen default. With M3 Expressive you also get:
  - **Shape**: Expressive (round, large corners) or Standard (smaller corners).
  - **Density**: Comfortable or Compact tab height.
- **Follow Caelestia light/dark** (on by default): switches Zen and the light/dark preference websites see whenever your Caelestia mode changes. Turning it off hands control back to Zen's own setting.
- **Website tint**: how strongly websites are recolored to match your scheme.
  - Off, Subtle, Balanced (default), Vivid, or Accent (tints with your primary color).
  - **Custom** shows Tint color, Intensity, Brightness and Strength. For all three numbers, higher means more.
  - Turning the tint Off only removes CaelestiaZen's tint; boosts you made for specific sites in Zen stay.
- **Background**: Caelestia surface (default), or Transparent if you use the Transparent Zen mod, with an **Opacity** slider. Website tint keeps working in both.

Settings from CaelestiaZen 1.x (`caelestia.zen-sync.*`) are migrated automatically the first time 2.0 runs.

To match text selection and form-control accents to your scheme, CaelestiaZen sets Firefox's `ui.highlight`, `ui.highlighttext`, `ui.textSelectDisabledBackground`, `ui.accentcolor` and `ui.accentcolortext` prefs (see [Uninstalling](#uninstalling)).

### Advanced

- `caelestia.zen.scheme-path` (in `about:config`): use a scheme file other than `$XDG_STATE_HOME/caelestia/scheme.json` (default `~/.local/state/caelestia/scheme.json`).

## Recoloring Only Website Backgrounds

The website tint shifts the overall color scheme of every website, which can affect text and icons. If you prefer to recolor **only the backgrounds** of websites while leaving their text and icons untouched, set **Website tint** to **Off** and combine the following extensions:

1. **Install Extensions**: Install both [Zen Internet](https://addons.mozilla.org/en-US/firefox/addon/zen-internet/) and [Dark Reader](https://addons.mozilla.org/en-US/firefox/addon/darkreader/).
2. **Background Tinting via Zen Internet**: Zen Internet applies its per-site CSS, recoloring backgrounds to match the transparent chrome while leaving text and icons readable.
3. **Theme Enforcement via Dark Reader**: keep Dark Reader in **Dark** mode for a dark scheme and **Light** mode for a light one. With **Follow Caelestia light/dark** on, sites that respect the system preference already switch on their own.

> **Tip:** You can also keep the tint on and pick **Accent**, which tints website backgrounds with your primary color while Zen Internet keeps text and icons readable.

## Requirements

- [Caelestia](https://github.com/caelestia-dots)
- Zen Browser with the [Sine](https://github.com/CosmoCreeper/Sine) mod loader (`install.sh` installs it for you)
- Optional: [Google Sans Flex](https://fonts.google.com/specimen/Google+Sans+Flex) or Roboto Flex for the M3 Expressive typography (falls back to your system font)
