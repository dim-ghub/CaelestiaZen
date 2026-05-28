#!/usr/bin/env fish

# Caelestia Zen Sync Install Script

# Get the directory where this script is located
set -l script_dir (dirname (status filename))
set -l install_dir ~/.config/zen/*/chrome/sine-mods/caelestia-theme-sync

# Detect Zen profile
set -l zen_profiles ~/.config/zen
if not test -d $zen_profiles
    echo "Error: Zen config directory not found at ~/.config/zen"
    exit 1
end

# Find the profile with sine-mods directory
set -l profile_dir ""
for dir in $zen_profiles/*/
    if test -d "$dir/chrome/sine-mods"
        set profile_dir $dir
        break
    end
end

if test -z "$profile_dir"
    echo "Error: Could not find a Zen profile with sine-mods directory"
    exit 1
end

echo "Installing to: $profile_dir/chrome/sine-mods/caelestia-theme-sync"

# Create the mod directory
mkdir -p "$profile_dir/chrome/sine-mods/caelestia-theme-sync"

# Copy mod files
cp $script_dir/theme.json "$profile_dir/chrome/sine-mods/caelestia-theme-sync/"
cp $script_dir/theme-sync.uc.js "$profile_dir/chrome/sine-mods/caelestia-theme-sync/"
cp $script_dir/preferences.json "$profile_dir/chrome/sine-mods/caelestia-theme-sync/"
cp $script_dir/chrome.css "$profile_dir/chrome/sine-mods/caelestia-theme-sync/"

# Update mods.json
set -l mods_json "$profile_dir/chrome/sine-mods/mods.json"
if test -f $mods_json
    # Read existing mods.json
    set -l mods (python3 -c "
import json
with open('$mods_json', 'r') as f:
    mods = json.load(f)
with open('$script_dir/theme.json', 'r') as f:
    new_mod = json.load(f)
mods['caelestia-theme-sync'] = new_mod
mods['caelestia-theme-sync']['origin'] = 'store'
with open('$mods_json', 'w') as f:
    json.dump(mods, f, indent=2)
print('Updated existing mods.json')
")
    echo $mods
else
    # Create new mods.json
    python3 -c "
import json
with open('$script_dir/theme.json', 'r') as f:
    new_mod = json.load(f)
new_mod['origin'] = 'store'
mods = {'caelestia-theme-sync': new_mod}
with open('$mods_json', 'w') as f:
    json.dump(mods, f, indent=2)
print('Created new mods.json')
"
    echo "Created mods.json"
end

echo ""
echo "Caelestia Zen Sync installed successfully!"
echo "Restart Zen Browser to activate the mod."
echo ""
echo "For website theming, install CaelestiaSites:"
echo "https://github.com/dim-ghub/CaelestiaSites"