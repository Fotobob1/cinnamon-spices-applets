/* Looking Glass Shortcuts (xsession@claudiux)
*/
const Applet = imports.ui.applet; // ++
const GLib = imports.gi.GLib; // ++ Needed for starting programs and translations
const Gio = imports.gi.Gio; // Needed for file infos
const Gtk = imports.gi.Gtk; // Needed for theme icons
const Gettext = imports.gettext; // ++ Needed for translations
const Util = imports.misc.util; // Needed for spawnCommandLineAsync()
const {
  reloadExtension,
  Type
} = imports.ui.extension; //Extension
const { restartCinnamon } = imports.ui.main; // Main

const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu; // ++ Needed for menus

// ++ Set DEBUG to true to display log messages in ~/.xsession-errors
// ++ Set DEBUG to false in production.
const DEBUG = false;

const UUID="xsession@claudiux";

const HOME_DIR = GLib.get_home_dir();
const CONFIG_DIR = HOME_DIR + "/.cinnamon/configs";
const CACHE_DIR = HOME_DIR + "/.cinnamon/spices.cache";
const SPICES_DIR = HOME_DIR + "/.local/share/cinnamon"
const APPLET_DIR = SPICES_DIR + "/applets/" + UUID;
const SCRIPTS_DIR = APPLET_DIR + "/scripts";
const ICONS_DIR = APPLET_DIR + "/icons";
const WATCHXSE_SCRIPT = SCRIPTS_DIR + "/watch-xse.sh";

// ++ l10n support
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

// ++ Always needed if you want localisation/translation support
function _(str) {
    let customTrans = Gettext.dgettext(UUID, str);
    if (customTrans !== str && customTrans !== "")
        return customTrans;
    return Gettext.gettext(str);
}

// Dummy bidon variable for translation (don't remove these lines):
let bidon = _("Applet");
bidon = _("Desklet");
bidon = _("Extension");
//bidon = _("Theme");
//bidon = _("Search Provider");
bidon = _("Applets");
bidon = _("Desklets");
bidon = _("Extensions");
//bidon = _("Themes");
//bidon = _("Search Providers");
bidon = null;

// ++ Useful for logging
/**
 * Usage of log and logError:
 * log("Any message here") to log the message only if DEBUG is set to true.
 * log("Any message here", true) to log the message even if DEBUG is set to false.
 * logError("Any error message") log the error message regardless of the DEBUG value.
 */
function log(message, alwaysLog=false) {
    if (DEBUG || alwaysLog)
        global.log("[" + UUID + "]: " + message);
}

function logError(error) {
    global.logError("[" + UUID + "]: " + error)
}

class LGS extends Applet.IconApplet {
    constructor (metadata, orientation, panelHeight, instance_id) {
        super(orientation, panelHeight, instance_id);
        this.instanceId = instance_id;
        this.setAllowedLayout(Applet.AllowedLayout.BOTH); // Can be used on horizontal or vertical panels.
        this.set_applet_icon_symbolic_path(metadata.path + "/icons/face-glasses-symbolic.svg");
        this.name = metadata.name
        this.set_applet_tooltip(_(this.name));
        this.version = metadata.version;

        // ++ Set up left click menu
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        let _tooltip = _("Middle-click: \n") + _("Show .xsession-errors");
        this.set_applet_tooltip(_tooltip);
    }; // End of constructor

    //++ Handler for when the applet is clicked.
    on_applet_clicked(event) {
        if (!this.menu.isOpen)
            this.makeMenu();
        this.menu.toggle();
    }; // End of on_applet_clicked

    get_active_spices(type) {
        // Returns the list of active spices of type 'type'
        var dconfEnabled;
        var elt = (type.toString() === "applets") ? 3 : 0;
        let enabled;
        var listEnabled = new Array();
        let _SETTINGS_SCHEMA, _SETTINGS_KEY;
        let _interface_settings;

        if (type.toString() === "themes") {
            _SETTINGS_SCHEMA = "org.cinnamon.theme";
            _SETTINGS_KEY = "name";
            _interface_settings = new Gio.Settings({ schema_id: _SETTINGS_SCHEMA });
            enabled = _interface_settings.get_string(_SETTINGS_KEY);
            listEnabled.push(enabled);
            return listEnabled
        }

        _SETTINGS_SCHEMA = "org.cinnamon";
        _SETTINGS_KEY = "enabled-%s".format(type.toString());
        _interface_settings = new Gio.Settings({ schema_id: _SETTINGS_SCHEMA });

        enabled = _interface_settings.get_strv(_SETTINGS_KEY);
        let xlet_uuid;
        for (let xl of enabled) {
            xlet_uuid = xl.split(":")[elt].toString().replace(/'/g,"");
            if (!xlet_uuid.endsWith("@cinnamon.org"))
                listEnabled.push(xlet_uuid);
        }
        return listEnabled.sort();
        // End of get_active_spices
    }

    makeMenu() {
        this.menu.removeAll();

        // Head
        let menuitemHead1 = new PopupMenu.PopupMenuItem(_(this.name)+' '+this.version, {
            reactive: false
        });
        this.menu.addMenuItem(menuitemHead1);

        let itemWatchXSE = new PopupMenu.PopupIconMenuItem(_("Show .xsession-errors"), "face-glasses", St.IconType.SYMBOLIC, {
            reactive: true
        });
        itemWatchXSE.connect(
            "activate",
            () => {
                if (this.menu.isOpen) this.menu.close();
                let to = setTimeout( () => {
                    Util.spawnCommandLineAsync("bash -c '"+WATCHXSE_SCRIPT+"'");
                    clearTimeout(to);
                },
                300);
            }
        );

        this.menu.addMenuItem(itemWatchXSE);

        // Restart Cinnamon
        let itemReloadCinnamon = new PopupMenu.PopupIconMenuItem(_("Restart Cinnamon"), "restart", St.IconType.SYMBOLIC, {
            reactive: true
        });
        itemReloadCinnamon.connect(
            "activate",
            () => {
                if (this.menu.isOpen) this.menu.close();
                let to = setTimeout( () => {
                    restartCinnamon(true);
                    clearTimeout(to);
                },
                300);
            }
        );

        this.menu.addMenuItem(itemReloadCinnamon);

        // Reload:
        let reloadHead = new PopupMenu.PopupMenuItem(_("--- Reload Spices ---"), {
            reactive: false
        });
        this.menu.addMenuItem(reloadHead);

        // Applets
        this.subMenuReloadApplets = new PopupMenu.PopupSubMenuMenuItem(_("Reload Applet:"));
        this.menu.addMenuItem(this.subMenuReloadApplets);

        for (let applet of this.get_active_spices("applets")) {
            let s =  new PopupMenu.PopupMenuItem(applet, {
                reactive: true
            });
            s.connect("activate", () => {
                if (this.menu.isOpen) this.menu.close();
                let to = setTimeout( () => {
                    reloadExtension(applet, Type.APPLET);
                    clearTimeout(to);
                },
                300);
            });
            this.subMenuReloadApplets.menu.addMenuItem(s)
        }

        // Desklets
        this.subMenuReloadDesklets = new PopupMenu.PopupSubMenuMenuItem(_("Reload Desklet:"));
        this.menu.addMenuItem(this.subMenuReloadDesklets);

        for (let desklet of this.get_active_spices("desklets")) {
            let s =  new PopupMenu.PopupMenuItem(desklet, {
                reactive: true
            });
            s.connect("activate", () => {
                if (this.menu.isOpen) this.menu.close();
                let to = setTimeout( () => {
                    reloadExtension(desklet, Type.DESKLET);
                    clearTimeout(to);
                },
                300);
            });
            this.subMenuReloadDesklets.menu.addMenuItem(s)
        }

        // Extensions
        this.subMenuReloadExtensions = new PopupMenu.PopupSubMenuMenuItem(_("Reload Extension:"));
        this.menu.addMenuItem(this.subMenuReloadExtensions);

        for (let extension of this.get_active_spices("extensions")) {
            let s =  new PopupMenu.PopupMenuItem(extension, {
                reactive: true
            });
            s.connect("activate", () => {
                if (this.menu.isOpen) this.menu.close();
                let to = setTimeout( () => {
                    reloadExtension(extension, Type.EXTENSION);
                    clearTimeout(to);
                },
                300);
            });
            this.subMenuReloadExtensions.menu.addMenuItem(s)
        }

        // Settings:
        let settingsHead = new PopupMenu.PopupMenuItem(_("--- Settings for ---"), {
            reactive: false
        });
        this.menu.addMenuItem(settingsHead);

        // Applets
        this.subMenuSettingsApplets = new PopupMenu.PopupSubMenuMenuItem(_("Applet:"));
        this.menu.addMenuItem(this.subMenuSettingsApplets);

        for (let applet of this.get_active_spices("applets")) {
            let s =  new PopupMenu.PopupMenuItem(applet, {
                reactive: true
            });
            s.connect("activate", () => {
                if (this.menu.isOpen) this.menu.close();
                let to = setTimeout( () => {
                    Util.spawnCommandLineAsync('bash -c "cinnamon-settings applets %s"'.format(applet));
                    clearTimeout(to);
                },
                300);
            });
            this.subMenuSettingsApplets.menu.addMenuItem(s)
        }

        // Desklets
        this.subMenuSettingsDesklets = new PopupMenu.PopupSubMenuMenuItem(_("Desklet:"));
        this.menu.addMenuItem(this.subMenuSettingsDesklets);

        for (let desklet of this.get_active_spices("desklets")) {
            let s =  new PopupMenu.PopupMenuItem(desklet, {
                reactive: true
            });
            s.connect("activate", () => {
                if (this.menu.isOpen) this.menu.close();
                let to = setTimeout( () => {
                    Util.spawnCommandLineAsync('bash -c "cinnamon-settings desklets %s"'.format(desklet));
                    clearTimeout(to);
                },
                300);
            });
            this.subMenuSettingsDesklets.menu.addMenuItem(s)
        }

        // Extensions
        this.subMenuSettingsExtensions = new PopupMenu.PopupSubMenuMenuItem(_("Extension:"));
        this.menu.addMenuItem(this.subMenuSettingsExtensions);

        for (let extension of this.get_active_spices("extensions")) {
            let s =  new PopupMenu.PopupMenuItem(extension, {
                reactive: true
            });
            s.connect("activate", () => {
                if (this.menu.isOpen) this.menu.close();
                let to = setTimeout( () => {
                    Util.spawnCommandLineAsync('bash -c "cinnamon-settings extensions %s"'.format(extension));
                    clearTimeout(to);
                },
                300);
            });
            this.subMenuSettingsExtensions.menu.addMenuItem(s)
        }

        // View Code:
        let codeHead = new PopupMenu.PopupMenuItem(_("--- View Code ---"), {
            reactive: false
        });
        this.menu.addMenuItem(codeHead);

        // Applets
        this.subMenuCodeApplets = new PopupMenu.PopupSubMenuMenuItem(_("View Applet Code for:"));
        this.menu.addMenuItem(this.subMenuCodeApplets);

        for (let applet of this.get_active_spices("applets")) {
            let s =  new PopupMenu.PopupMenuItem(applet, {
                reactive: true
            });
            s.connect("activate", () => {
                if (this.menu.isOpen) this.menu.close();
                let to = setTimeout( () => {
                    Util.spawnCommandLineAsync('bash -c "xdg-open %s/applets/%s/"'.format(SPICES_DIR, applet));
                    clearTimeout(to);
                },
                300);
            });
            this.subMenuCodeApplets.menu.addMenuItem(s)
        }

        // Desklets
        this.subMenuCodeDesklets = new PopupMenu.PopupSubMenuMenuItem(_("View Desklet Code for:"));
        this.menu.addMenuItem(this.subMenuCodeDesklets);

        for (let desklet of this.get_active_spices("desklets")) {
            let s =  new PopupMenu.PopupMenuItem(desklet, {
                reactive: true
            });
            s.connect("activate", () => {
                if (this.menu.isOpen) this.menu.close();
                let to = setTimeout( () => {
                    Util.spawnCommandLineAsync('bash -c "xdg-open %s/desklets/%s/"'.format(SPICES_DIR, desklet));
                    clearTimeout(to);
                },
                300);
            });
            this.subMenuCodeDesklets.menu.addMenuItem(s)
        }

        // Extensions
        this.subMenuCodeExtensions = new PopupMenu.PopupSubMenuMenuItem(_("View Extension Code for:"));
        this.menu.addMenuItem(this.subMenuCodeExtensions);

        for (let extension of this.get_active_spices("extensions")) {
            let s =  new PopupMenu.PopupMenuItem(extension, {
                reactive: true
            });
            s.connect("activate", () => {
                if (this.menu.isOpen) this.menu.close();
                let to = setTimeout( () => {
                    Util.spawnCommandLineAsync('bash -c "xdg-open %s/extensions/%s/"'.format(SPICES_DIR, extension));
                    clearTimeout(to);
                },
                300);
            });
            this.subMenuCodeExtensions.menu.addMenuItem(s)
        }

    }; // End of makeMenu

    on_applet_middle_clicked(event) {
        if (this.menu.isOpen) this.menu.close();
        let to = setTimeout( () => {
            Util.spawnCommandLineAsync("bash -c '"+WATCHXSE_SCRIPT+"'");
            clearTimeout(to);
        },
        300);
    }
} // End of class LGS

function main(metadata, orientation, panelHeight, instance_id) {
    return new LGS(metadata, orientation, panelHeight, instance_id);
}
