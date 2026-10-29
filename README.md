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

Use [pkgit](https://git.symlinx.net/pkgit/) to install CaelestiaZen:
```bash
pkgit -i https://github.com/dim-ghub/CaelestiaZen
```

For development, clone the repository and run the install script with the `--dev` flag to use symlinks:
```bash
git clone https://github.com/dim-ghub/CaelestiaZen
cd CaelestiaZen
bash install.sh --dev
```

This will automatically:
- Install Sine
- Copy or symlink the mod files
- Update `mods.json`
- Remove the template used by CaelestiaZen 1.x, if present

Then restart Zen Browser. If styles don't appear, open `about:support`, click **Clear Startup Cache**, and restart again.

## Manual Installation

1. Create the mod directory:
```bash
mkdir -p ~/.config/zen/<profile>/chrome/sine-mods/caelestia-zen
```

2. Copy the mod files:
```bash
cp *.json *.uc.js chrome.css ~/.config/zen/<profile>/chrome/sine-mods/caelestia-zen/
cp -r m3e ~/.config/zen/<profile>/chrome/sine-mods/caelestia-zen/
```

3. Add to `mods.json` in `~/.config/zen/<profile>/chrome/sine-mods/`:
```bash
cd ~/.config/zen/<profile>/chrome/sine-mods
python3 -c "
import json
with open('mods.json', 'r') as f:
    mods = json.load(f)
with open('caelestia-zen/theme.json', 'r') as f:
    new_mod = json.load(f)
mods['caelestia-zen'] = new_mod
mods['caelestia-zen']['origin'] = 'store'
mods['caelestia-zen']['enabled'] = True
with open('mods.json', 'w') as f:
    json.dump(mods, f, indent=2)
"
```

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

To match text selection and form-control accents to your scheme, CaelestiaZen sets Firefox's `ui.highlight`, `ui.highlighttext`, `ui.textSelectDisabledBackground`, `ui.accentcolor` and `ui.accentcolortext` prefs. If you remove the mod, reset them in `about:config` to get your system colors back.

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
- Zen Browser with the Sine mod system installed
- Optional: [Google Sans Flex](https://fonts.google.com/specimen/Google+Sans+Flex) or Roboto Flex for the M3 Expressive typography (falls back to your system font)
