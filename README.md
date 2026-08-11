# CaelestiaZen

A Sine mod for Zen Browser that live themes the browser as well as generates a global Boost to recolor every site you visit.

## Features

- Real-time sync with Caelestia's color scheme
- Automatically applies a chosen scheme color to all websites via Zen Boosts (togglable)
- Colors the area behind web content with the surface color
- Applies theme to browser chrome (background, sidebar, etc.)
- Configurable chrome theme path
- Minimal, lightweight implementation

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
- Copy or symlink the mod files and template
- Update `mods.json`

Then restart Zen Browser and enable the mod in settings.

## Manual Installation

1. Create the mod directory:
```bash
mkdir -p ~/.config/zen/<profile>/chrome/sine-mods/caelestia-zen
```

2. Copy the mod files:
```bash
cp *.json *.uc.js *.css ~/.config/zen/<profile>/chrome/sine-mods/caelestia-zen/
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
with open('mods.json', 'w') as f:
    json.dump(mods, f, indent=2)
"
```

## Configuration

Edit preferences in Sine settings:
- **Theme File Path**: Path to the zen-browser.css theme file (default: `~/.local/state/caelestia/theme/zen-browser.css`)
- **Enable Website Boost**: Toggle the Zen Boost that recolors every website (default: on)
- **Boost Color**: Which scheme variable the boost uses (Surface, Surface Container, Surface Container High, Surface Dim, On Surface, or Primary; default: Surface)
- **Color Intensity**: 0-200 (default: 150). Lower = more muted, higher = more vivid.
- **Color Brightness**: 0-100 (default: 15). Lower = darker, higher = brighter.
- **Color Strength**: 0-100 (default: 30). Lower = stronger tint, higher = more subtle.

## Recoloring Only Website Backgrounds

The built-in Zen Boost shifts the overall color scheme of every website, which can affect text and icons. If you prefer to recolor **only the backgrounds** of websites while leaving their text and icons untouched, turn **off** `Enable Website Boost` in the mod's Sine settings (or set `caelestia.zen-sync.boost-enabled` to `false`) and combine the following extensions:

1. **Install Extensions**: Install both [Zen Internet](https://addons.mozilla.org/en-US/firefox/addon/zen-internet/) and [Dark Reader](https://addons.mozilla.org/en-US/firefox/addon/darkreader/).
2. **Background Tinting via Zen Internet**: Zen Internet applies its per-site CSS — recoloring backgrounds to match the transparent chrome while leaving text and icons readable.
3. **Theme Enforcement via Dark Reader**:
   - **Dark Scheme**: Keep Dark Reader in **Dark** mode to ensure sites stay dark and match dark shell setups.
   - **Light Scheme**: Switch Dark Reader to **Light** mode if using a light scheme for your shell. This forces websites into a light theme so their backgrounds align with a light desktop environment.

Combining both allows Zen Internet to handle surface-matching transparency while Dark Reader forces the overall light/dark theme state based on your active Caelestia scheme.

> **Tip:** You can also keep `Enable Website Boost` **on** and set **Boost Color** to `Primary`, which tints website backgrounds with the accent color while Zen Internet keeps text and icons readable. A good starting point: Color Intensity `150`, Color Brightness `80`, Color Strength `50`.

## Theme File

The mod watches for changes in the chrome theme file and automatically applies the selected color to Zen Boosts for all websites.

## Template Setup

Copy the template to your Caelestia config:
```bash
mkdir -p ~/.config/caelestia/templates
cp templates/zen-browser.css ~/.config/caelestia/templates/
```

The install script will do this for you.

## Requirements

- [Caelestia](https://github.com/caelestia-dots)
- Zen Browser with Sine mod system installed
