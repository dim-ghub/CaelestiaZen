#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEV_MODE=false

for arg in "$@"; do
    if [[ "$arg" == "--dev" ]]; then
        DEV_MODE=true
        break
    fi
done

# ==========================================
# Utility functions
# ==========================================

info()  { printf "\033[1;34m::\033[0m %s\n" "$*" >&2; }
ok()    { printf "\033[1;32mOK\033[0m %s\n" "$*" >&2; }
warn()  { printf "\033[1;33m!!\033[0m %s\n" "$*" >&2; }
err()   { printf "\033[1;31m!!\033[0m %s\n" "$*" >&2; }

cleanup() {
    [[ -n "$TMPDIR" && -d "$TMPDIR" ]] && rm -rf "$TMPDIR"
}
TMPDIR=$(mktemp -d)
trap cleanup EXIT

require_cmd() {
    if ! command -v "$1" &>/dev/null; then
        err "Required command '$1' not found. Please install it first."
        exit 1
    fi
}

github_api() {
    local endpoint="$1" out
    out=$(curl -sfL "https://api.github.com/$endpoint" 2>/dev/null) || return 1
    echo "$out"
}

get_latest_tag() {
    local repo="$1" data tag
    data=$(github_api "repos/$repo/releases/latest") || return 1
    tag=$(echo "$data" | python3 -c "import sys,json; print(json.load(sys.stdin)['tag_name'])" 2>/dev/null) || return 1
    echo "$tag"
}

get_asset_url() {
    local repo="$1" name="$2" data
    data=$(github_api "repos/$repo/releases/latest") || return 1
    echo "$data" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for a in d['assets']:
    if a['name']=='$name':
        print(a['browser_download_url'])
" 2>/dev/null
}

download() {
    info "Downloading $(basename "$1")..."
    curl -sfL "$1" -o "$2" || {
        err "Download failed for $1"
        return 1
    }
}

# ==========================================
# Browser detection
# ==========================================

detect_browsers() {
    local browsers install_dirs config_dirs names fp
    browsers=()
    install_dirs=()
    config_dirs=()
    names=()
    fp="$HOME/.local/share/flatpak/app/io.github.zen_browser.zen"

    for dir in /opt/zen /opt/zen-browser /opt/zen-browser-bin /usr/lib/zen /snap/zen/current/usr/lib/zen; do
        if [[ -d "$dir" && ( -f "$dir/zen" || -f "$dir/firefox" ) ]]; then
            browsers+=("zen")
            install_dirs+=("$dir")
            config_dirs+=("$HOME/.config/zen")
            names+=("Zen Browser")
            break
        fi
    done
    if [[ -d "$fp" ]]; then
        browsers+=("zen")
        install_dirs+=("/var/lib/flatpak/app/io.github.zen_browser.zen/current/active/files/zen")
        config_dirs+=("$HOME/.config/zen")
        names+=("Zen Browser (Flatpak)")
    fi

    for dir in /usr/lib/firefox /opt/firefox /snap/firefox/current/usr/lib/firefox /usr/lib/firefox-esr; do
        if [[ -d "$dir" && ( -f "$dir/firefox" || -f "$dir/firefox-esr" ) ]]; then
            browsers+=("firefox")
            install_dirs+=("$dir")
            config_dirs+=("$HOME/.mozilla/firefox")
            names+=("Firefox")
            break
        fi
    done

    for dir in /opt/floorp /usr/lib/floorp; do
        if [[ -d "$dir" ]] && [[ -f "$dir/floorp" ]]; then
            browsers+=("floorp")
            install_dirs+=("$dir")
            config_dirs+=("$HOME/.config/floorp")
            names+=("Floorp")
            break
        fi
    done

    for dir in /opt/librewolf /usr/lib/librewolf; do
        if [[ -d "$dir" ]] && [[ -f "$dir/librewolf" ]]; then
            browsers+=("librewolf")
            install_dirs+=("$dir")
            config_dirs+=("$HOME/.config/librewolf")
            names+=("LibreWolf")
            break
        fi
    done

    for dir in /opt/waterfox /usr/lib/waterfox; do
        if [[ -d "$dir" ]] && [[ -f "$dir/waterfox" ]]; then
            browsers+=("waterfox")
            install_dirs+=("$dir")
            config_dirs+=("$HOME/.config/waterfox")
            names+=("Waterfox")
            break
        fi
    done

    for i in "${!browsers[@]}"; do
        printf "%s|%s|%s|%s\n" "${browsers[$i]}" "${install_dirs[$i]}" "${config_dirs[$i]}" "${names[$i]}"
    done
}

find_profiles() {
    local config_dir="$1"
    local ini="$config_dir/profiles.ini"
    if [[ ! -f "$ini" ]]; then
        return 1
    fi
    python3 - "$config_dir" "$ini" << 'PYEOF'
import configparser, os, sys

config_dir = sys.argv[1]
ini_path = sys.argv[2]

config = configparser.ConfigParser()
config.read(ini_path)

profiles = []
default_path = None

for section in config.sections():
    if not section.startswith("Profile"):
        continue
    path = config[section].get("Path", "")
    name = config[section].get("Name", path)
    is_rel = config[section].get("IsRelative", "1") == "1"
    full_path = os.path.join(config_dir, path) if is_rel else path
    if not os.path.isdir(full_path):
        continue
    profiles.append((name, full_path))
    if config[section].get("Default", "0") == "1":
        default_path = full_path

found_default = False
for name, path in profiles:
    if default_path and os.path.samefile(path, default_path) and not found_default:
        print(f"{name}|{path}|default")
        found_default = True
for name, path in profiles:
    if not (default_path and os.path.samefile(path, default_path)):
        print(f"{name}|{path}|")
PYEOF
}

# ==========================================
# Shared: choose browser and profile
# ==========================================

choose_browser_profile() {
    require_cmd python3

    info "Detecting installed browsers..."
    local browser_lines=()
    mapfile -t browser_lines < <(detect_browsers)
    local browser_ids=() browser_installs=() browser_configs=() browser_names=()

    for line in "${browser_lines[@]}"; do
        IFS='|' read -r id install_dir config_dir name <<< "$line"
        browser_ids+=("$id")
        browser_installs+=("$install_dir")
        browser_configs+=("$config_dir")
        browser_names+=("$name")
    done

    CHOSEN_INSTALL_DIR=""
    CHOSEN_PROFILE_DIR=""

    if [[ ${#browser_lines[@]} -eq 0 ]]; then
        warn "No supported browser found."
        echo ""
        read -r -p "Enter browser installation directory (e.g., /opt/zen): " CHOSEN_INSTALL_DIR
        if [[ ! -d "$CHOSEN_INSTALL_DIR" ]]; then
            err "Directory does not exist: $CHOSEN_INSTALL_DIR"
            exit 1
        fi
        read -r -p "Enter browser profile directory: " CHOSEN_PROFILE_DIR
        if [[ ! -d "$CHOSEN_PROFILE_DIR" ]]; then
            err "Directory does not exist: $CHOSEN_PROFILE_DIR"
            exit 1
        fi
    else
        echo ""
        echo "Available browsers:" >&2
        local default_idx=1 zen_found=""
        for i in "${!browser_ids[@]}"; do
            local idx=$((i + 1))
            local marker=""
            if [[ "${browser_ids[$i]}" == "zen" && -z "$zen_found" ]]; then
                marker="  (default)"
                default_idx=$idx
                zen_found=1
            fi
            printf "  %d) %s (%s)%s\n" "$idx" "${browser_names[$i]}" "${browser_installs[$i]}" "$marker" >&2
        done
        printf "  0) Manual entry\n" >&2
        echo ""
        read -r -p "Select browser [${default_idx}]: " browser_choice
        browser_choice=${browser_choice:-$default_idx}

        if [[ "$browser_choice" == "0" ]]; then
            read -r -p "Installation directory: " CHOSEN_INSTALL_DIR
            read -r -p "Profile directory: " CHOSEN_PROFILE_DIR
            if [[ ! -d "$CHOSEN_INSTALL_DIR" ]]; then
                err "Directory does not exist: $CHOSEN_INSTALL_DIR"; exit 1
            fi
            if [[ ! -d "$CHOSEN_PROFILE_DIR" ]]; then
                err "Directory does not exist: $CHOSEN_PROFILE_DIR"; exit 1
            fi
        else
            local idx=$((browser_choice - 1))
            CHOSEN_INSTALL_DIR="${browser_installs[$idx]}"
            local config_dir="${browser_configs[$idx]}"

            echo ""
            info "Finding profiles in $config_dir..."
            if profiles=$(find_profiles "$config_dir"); then
                mapfile -t profile_list <<< "$profiles"
                if [[ ${#profile_list[@]} -eq 0 ]]; then
                    read -r -p "Enter profile directory manually: " CHOSEN_PROFILE_DIR
                else
                    echo "Available profiles:" >&2
                    for pi in "${!profile_list[@]}"; do
                        IFS='|' read -r pname ppath pdefault <<< "${profile_list[$pi]}"
                        local flag=""
                        [[ "$pdefault" == "default" ]] && flag="  (default)"
                        printf "  %d) %s%s\n" $((pi + 1)) "$pname" "$flag" >&2
                    done
                    echo ""
                    read -r -p "Select profile [1]: " prof_choice
                    prof_choice=${prof_choice:-1}
                    local prof_idx=$((prof_choice - 1))
                    IFS='|' read -r _ CHOSEN_PROFILE_DIR _ <<< "${profile_list[$prof_idx]}"
                fi
            else
                read -r -p "Enter profile directory manually: " CHOSEN_PROFILE_DIR
            fi
        fi
    fi

    echo ""
    info "Browser install dir: $CHOSEN_INSTALL_DIR"
    info "Profile dir:         $CHOSEN_PROFILE_DIR"
    echo ""
}

# ==========================================
# Part 1: Install Sine
# ==========================================

install_sine() {
    local BROWSER_INSTALL_DIR="$1"
    local PROFILE_DIR="$2"

    info "=== Sine Installation ==="

    require_cmd curl
    require_cmd unzip
    require_cmd python3

    # Check if Sine already installed
    if [[ -f "$BROWSER_INSTALL_DIR/config.js" && -d "$PROFILE_DIR/chrome/engine" ]]; then
        warn "Sine appears to already be installed."
        read -r -p "Reinstall? [y/N]: " reinstall
        if [[ ! "$reinstall" =~ ^[Yy]$ ]]; then
            info "Skipping Sine installation."
            return 0
        fi
    fi

    # Fetch latest releases
    info "Fetching latest release info..."
    local sine_tag boot_tag
    sine_tag=$(get_latest_tag "CosmoCreeper/Sine" 2>/dev/null) || sine_tag=""
    boot_tag=$(get_latest_tag "sineorg/bootloader" 2>/dev/null) || boot_tag=""

    if [[ -z "$sine_tag" || -z "$boot_tag" ]]; then
        warn "Could not fetch latest release info from GitHub API."
        warn "Falling back to known versions..."
        sine_tag="v2.3.3"
        boot_tag="v0.1.4"
    fi
    info "Sine $sine_tag — Bootloader $boot_tag"

    local sine_base="https://github.com/CosmoCreeper/Sine/releases/download/$sine_tag"
    local boot_base="https://github.com/sineorg/bootloader/releases/download/$boot_tag"

    download "$boot_base/program.zip" "$TMPDIR/program.zip"
    download "$boot_base/profile.zip" "$TMPDIR/profile.zip"

    info "Extracting bootloader to browser installation directory..."
    if [[ ! -w "$BROWSER_INSTALL_DIR" ]]; then
        warn "Installation directory not writable — sudo will be used."
        sudo unzip -o "$TMPDIR/program.zip" -d "$BROWSER_INSTALL_DIR"
    else
        unzip -o "$TMPDIR/program.zip" -d "$BROWSER_INSTALL_DIR"
    fi
    ok "Bootloader installed to $BROWSER_INSTALL_DIR"

    local chrome_dir="$PROFILE_DIR/chrome"
    mkdir -p "$chrome_dir"
    info "Extracting bootloader profile to $chrome_dir..."
    unzip -o "$TMPDIR/profile.zip" -d "$chrome_dir"
    ok "Bootloader profile extracted"

    download "$sine_base/engine.zip" "$TMPDIR/engine.zip"
    info "Extracting engine to $chrome_dir..."
    unzip -o "$TMPDIR/engine.zip" -d "$chrome_dir"
    ok "Sine engine installed"

    local locales_url=""
    locales_url=$(get_asset_url CosmoCreeper/Sine locales.zip 2>/dev/null || true)
    if [[ -z "$locales_url" ]]; then
        if curl -sfL -o /dev/null "$sine_base/locales.zip" 2>/dev/null; then
            locales_url="$sine_base/locales.zip"
        fi
    fi
    if [[ -n "$locales_url" ]]; then
        download "$locales_url" "$TMPDIR/locales.zip"
        info "Extracting locales to $chrome_dir..."
        unzip -o "$TMPDIR/locales.zip" -d "$chrome_dir"
        ok "Sine locales installed"
    fi

    echo ""
    ok "Sine installation complete!"
    echo "  Bootloader: $BROWSER_INSTALL_DIR"
    echo "  Engine:     $chrome_dir"
}

# ==========================================
# Part 2: Install CaelestiaZen mod
# ==========================================

install_mod() {
    local PROFILE_DIR="$1"
    XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"

    info "=== CaelestiaZen Mod Installation ==="

    local MOD_DIR="$PROFILE_DIR/chrome/sine-mods/caelestia-zen"
    info "Installing mod to: $MOD_DIR"

    mkdir -p "$MOD_DIR"
    mkdir -p "$XDG_CONFIG_HOME/caelestia/templates"

    export MODS_JSON="$PROFILE_DIR/chrome/sine-mods/mods.json"
    export SCRIPT_DIR

    if [[ "$DEV_MODE" == true ]]; then
        ln -sf "$SCRIPT_DIR/theme.json" "$MOD_DIR/"
        ln -sf "$SCRIPT_DIR/theme-sync.uc.js" "$MOD_DIR/"
        ln -sf "$SCRIPT_DIR/preferences.json" "$MOD_DIR/"
        ln -sf "$SCRIPT_DIR/chrome.css" "$MOD_DIR/"
        ln -sf "$SCRIPT_DIR/templates/zen-browser.css" "$XDG_CONFIG_HOME/caelestia/templates/"
        ok "Installed in DEV mode (symlinks)"
    else
        cp "$SCRIPT_DIR/theme.json" "$MOD_DIR/"
        cp "$SCRIPT_DIR/theme-sync.uc.js" "$MOD_DIR/"
        cp "$SCRIPT_DIR/preferences.json" "$MOD_DIR/"
        cp "$SCRIPT_DIR/chrome.css" "$MOD_DIR/"
        cp "$SCRIPT_DIR/templates/zen-browser.css" "$XDG_CONFIG_HOME/caelestia/templates/"
        ok "Installed (copied)"
    fi

    if [[ -f "$MODS_JSON" ]]; then
        python3 << 'PYEOF'
import json, os
path = os.environ['MODS_JSON']
script = os.environ['SCRIPT_DIR']
with open(path) as f:
    mods = json.load(f)
with open(os.path.join(script, 'theme.json')) as f:
    new_mod = json.load(f)
mods['caelestia-zen'] = new_mod
mods['caelestia-zen']['origin'] = 'store'
mods['caelestia-zen']['enabled'] = True
with open(path, 'w') as f:
    json.dump(mods, f, indent=2)
PYEOF
        ok "Updated existing mods.json"
    else
        python3 << 'PYEOF'
import json, os
path = os.environ['MODS_JSON']
script = os.environ['SCRIPT_DIR']
with open(os.path.join(script, 'theme.json')) as f:
    new_mod = json.load(f)
new_mod['origin'] = 'store'
new_mod['enabled'] = True
mods = {'caelestia-zen': new_mod}
with open(path, 'w') as f:
    json.dump(mods, f, indent=2)
PYEOF
        ok "Created mods.json"
    fi

    echo ""
    ok "CaelestiaZen installed successfully!"
    echo "Restart Zen Browser to apply the mod."
}

# ==========================================
# Main
# ==========================================

echo ""
echo "  CaelestiaZen Installer"
echo "  ======================"
echo ""

# Choose browser and profile ONCE, share between both steps
choose_browser_profile

install_sine "$CHOSEN_INSTALL_DIR" "$CHOSEN_PROFILE_DIR"
echo ""
install_mod "$CHOSEN_PROFILE_DIR"
echo ""
info "All done! Restart your browser, go to about:support,"
info "click 'Clear Startup Cache', then restart again."
