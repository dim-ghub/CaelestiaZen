# CaelestiaZen

A Sine mod for Zen Browser that syncs Caelestia's surface color to Zen Boosts, automatically theming all websites.

## Features

- Real-time sync with Caelestia's generated theme files
- Automatically applies surface color to all websites via Zen Boosts
- Applies theme to browser chrome (background, sidebar, etc.)
- Configurable chrome theme path
- Minimal, lightweight implementation

## Installation

Run the install script:
```bash
bash install.sh
```

For development with symlinks:
```bash
bash install.sh --dev
```

This will automatically:
- Detect your Zen profile
- Copy or symlink the mod files
- Update `mods.json`

Then restart Zen Browser.

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
- **Color Brightness**: 0-100 (default: 19)
- **Color Strength**: 0-100, lower = stronger (default: 50)

## Theme File

The mod watches for changes in the chrome theme file and automatically applies the surface color to Zen Boosts for all websites.

## Template Setup

Copy the template to your Caelestia config:
```bash
mkdir -p ~/.config/caelestia/templates
cp templates/zen-browser.css ~/.config/caelestia/templates/
```

The template uses Mustache-style placeholders (`{{ variableName.hex }}`) that Caelestia replaces with actual colors.

## Requirements

- [Caelestia](https://github.com/caelestia-dots) dotfiles with theme generation configured
- Zen Browser with Sine mod system installed
- A `zen-browser.css` template in `~/.config/caelestia/templates/`

## License

GPL-3.0