# Caelestia Zen Sync

A Sine mod for Zen Browser that syncs Caelestia's color scheme to the browser UI.

## Features

- Real-time sync with Caelestia's generated theme files
- Configurable chrome theme path
- Dark/light mode detection
- Minimal, lightweight implementation

## Installation

1. Copy the mod folder to your Sine mods directory:

```bash
cp -r caelestia-theme-sync ~/.config/zen/<profile>/chrome/sine-mods/
```

2. Restart Zen Browser or go to Sine settings to enable the mod

## Website Theming

For theming websites, install the **[CaelestiaSites](https://github.com/dim-ghub/CaelestiaSites)** browser extension instead. It provides:

- Per-website theme injection
- Dark mode support
- Custom CSS variables for websites
- Integration with Caelestia's color scheme

## Configuration

Edit preferences in Sine settings:
- **Enable Theme Sync**: Toggle the theme sync on/off
- **Chrome Theme Path**: Path to the generated chrome CSS (default: `~/.local/state/caelestia/theme/zen-browser.css`)

## Theme File

The mod watches for changes in the chrome theme file and automatically applies updates to the browser UI (toolbar, tabs, sidebar, etc.).

## Requirements

- Caelestia dotfiles with theme generation configured
- Zen Browser with Sine mod system installed