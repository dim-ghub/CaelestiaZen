# Caelestia Zen Sync

A Sine mod for Zen Browser that syncs Caelestia's color scheme to the browser UI.

## Features

- Real-time sync with Caelestia's generated theme files
- Configurable chrome theme path
- Dark/light mode detection
- Minimal, lightweight implementation

## Installation

Run the install script:
```bash
bash install.sh
```

This will automatically:
- Detect your Zen profile
- Copy the mod files
- Update `mods.json`

Then restart Zen Browser.

## Manual Installation

1. Create the mod directory:
```bash
mkdir -p ~/.config/zen/<profile>/chrome/sine-mods/caelestia-theme-sync
```

2. Copy the mod files:
```bash
cp *.json *.uc.js *.css ~/.config/zen/<profile>/chrome/sine-mods/caelestia-theme-sync/
```

3. Add to `mods.json` in `~/.config/zen/<profile>/chrome/sine-mods/`:
```bash
cd ~/.config/zen/<profile>/chrome/sine-mods
python3 -c "
import json
with open('mods.json', 'r') as f:
    mods = json.load(f)
with open('caelestia-theme-sync/theme.json', 'r') as f:
    new_mod = json.load(f)
mods['caelestia-theme-sync'] = new_mod
mods['caelestia-theme-sync']['origin'] = 'store'
with open('mods.json', 'w') as f:
    json.dump(mods, f, indent=2)
"
```

## Configuration

Edit preferences in Sine settings:
- **Enable Theme Sync**: Toggle the theme sync on/off
- **Chrome Theme Path**: Path to the generated chrome CSS (default: `~/.local/state/caelestia/theme/zen-browser.css`)

## Theme File

The mod watches for changes in the chrome theme file and automatically applies updates to the browser UI (toolbar, tabs, sidebar, etc.).

## Requirements

- [Caelestia](https://github.com/caelestia-dots) dotfiles with theme generation configured
- Zen Browser with Sine mod system installed
- A `zen-browser.css` template in `~/.config/caelestia/templates/`

## Website Theming

For theming websites, install the **[CaelestiaSites](https://github.com/dim-ghub/CaelestiaSites)** browser extension instead.

## License

GPL-3.0