# CaelestiaZen

A Sine mod for Zen Browser that live themes the browser as well as generates a global Boost to recolor every site you visit.

## Features

- Real-time sync with Caelestia's color scheme
- Automatically applies surface color to all websites via Zen Boosts
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
- **Color Intensity**: 0-200 (default: 150)
- **Color Brightness**: 0-100 (default: 15)
- **Color Strength**: 0-100, lower = stronger (default: 30)

## Theme File

The mod watches for changes in the chrome theme file and automatically applies the surface color to Zen Boosts for all websites.

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
