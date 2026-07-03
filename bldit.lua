package_name = "CaelestiaZen"
bldit_version = "0.1.3"
package_version = "1.0.0"
global_dependencies = { "curl", "unzip", "python" }
dependencies = {}

targets = {
    default = {
        build = function()
            return os.execute("true")
        end,
        install = function()
            -- CaelestiaZen installs interactively to browser profiles
            return os.execute("./install.sh")
        end,
        uninstall = function()
            print("CaelestiaZen must be uninstalled manually by removing the mod from your browser profile.")
            return os.execute("true")
        end,
    }
}
