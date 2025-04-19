import App from "resource:///com/github/Aylur/ags/app.js";
import Audio from "resource:///com/github/Aylur/ags/service/audio.js";
import Widget from "resource:///com/github/Aylur/ags/widget.js";
import * as Utils from "resource:///com/github/Aylur/ags/utils.js";
import { MaterialIcon } from "./materialicon.js";
import Bluetooth from "resource:///com/github/Aylur/ags/service/bluetooth.js";
import Network from "resource:///com/github/Aylur/ags/service/network.js";
import Notifications from "resource:///com/github/Aylur/ags/service/notifications.js";
import { languages } from "./statusicons_languages.js";
import Battery from "resource:///com/github/Aylur/ags/service/battery.js";
import { AnimatedCircProg } from "./cairo_circularprogress.js";
import {
  WWO_CODE,
  WEATHER_SYMBOL,
  NIGHT_WEATHER_SYMBOL,
} from "../.commondata/weather.js";
import GLib from "gi://GLib";
// A guessing func to try to support langs not listed in data/languages.js
function isLanguageMatch(abbreviation, word) {
  const lowerAbbreviation = abbreviation.toLowerCase();
  const lowerWord = word.toLowerCase();
  let j = 0;
  for (let i = 0; i < lowerWord.length; i++) {
    if (lowerWord[i] === lowerAbbreviation[j]) {
      j++;
    }
    if (j === lowerAbbreviation.length) {
      return true;
    }
  }
  return false;
}

export const MicMuteIndicator = () =>
  Widget.Revealer({
    transition: "slide_left",
    transitionDuration: userOptions.animations.durationSmall,
    revealChild: false,
    setup: (self) =>
      self.hook(Audio, (self) => {
        self.revealChild = Audio.microphone?.stream?.isMuted;
      }),
    child: MaterialIcon("mic_off", "norm"),
  });

export const NotificationIndicator = (notifCenterName = "sideright") => {
  const widget = Widget.Revealer({
    transition: "slide_left",
    transitionDuration: userOptions.animations.durationSmall,
    revealChild: false,
    setup: (self) =>
      self
        .hook(
          Notifications,
          (self, id) => {
            if (!id || Notifications.dnd) return;
            if (!Notifications.getNotification(id)) return;
            self.revealChild = true;
          },
          "notified",
        )
        .hook(App, (self, currentName, visible) => {
          if (visible && currentName === notifCenterName) {
            self.revealChild = false;
          }
        }),
    child: Widget.Box({
      children: [
        MaterialIcon("notifications", "norm"),
        Widget.Label({
          className: "txt-small titlefont",
          attribute: {
            unreadCount: 0,
            update: (self) => (self.label = `${self.attribute.unreadCount}`),
          },
          setup: (self) =>
            self
              .hook(
                Notifications,
                (self, id) => {
                  if (!id || Notifications.dnd) return;
                  if (!Notifications.getNotification(id)) return;
                  self.attribute.unreadCount++;
                  self.attribute.update(self);
                },
                "notified",
              )
              .hook(App, (self, currentName, visible) => {
                if (visible && currentName === notifCenterName) {
                  self.attribute.unreadCount = 0;
                  self.attribute.update(self);
                }
              }),
        }),
      ],
    }),
  });
  return widget;
};

export const BluetoothIndicator = ({ isSidebar = false } = {}) =>
  Widget.Stack({
    transition: "slide_up_down",
    transitionDuration: userOptions.animations.durationSmall,
    children: {
      false: Widget.Label({
        className: "txt-norm icon-material",
        label: "bluetooth_disabled",
      }),
      true: Widget.Label({
        className: "txt-norm icon-material",
        label: "bluetooth",
      }),
    },
    setup: (self) =>
      self.hook(Bluetooth, (stack) => {
        stack.shown = String(Bluetooth.enabled);
        if (!isSidebar && userOptions.bar.bluetooth.hideonconnect) {
          stack.visible = !(Bluetooth.connected_devices.length > 0);
        }
      }),
  });

const BluetoothDevices = () => {
  const updateBluetoothDevices = (self) => {
    if (Bluetooth.connected_devices.length > 0) {
      self.children = Bluetooth.connected_devices.map((device) => {
        return Widget.Box({
          className: "bar-bluetooth-device spacing-h-5",
          vpack: "center",
          tooltipText: device.name,
          children: [
            Widget.Icon(`${device.iconName}-symbolic`),
            ...(device.batteryPercentage && !userOptions.bar.bluetooth.noPercentage
              ? [
                  Widget.Label({
                    className: "txt-smallie",
                    label: `${device.batteryPercentage}`,
                    setup: (self) => {
                      self.hook(
                        device,
                        (self) => {
                          self.label = `${device.batteryPercentage}`;
                        },
                        "notify::batteryPercentage",
                      );
                    },
                  }),
                ]
              : []),
          ],
        });
      });
    } else {
      self.children = [];
    }
    self.visible = Bluetooth.connected_devices.length > 0;
  };

  return Widget.Box({
    className: "spacing-h-5",
    visible: Bluetooth.connected_devices.length > 0,
    setup: (self) => {
      updateBluetoothDevices(self);
      self.hook(Bluetooth, () => {
        updateBluetoothDevices(self);
        const updateIntervals = [250, 700, 2600];
        let updateCount = 0;
        const forceUpdateDeviceStatus = (intervals) => {
          if (intervals.length === 0 || updateCount >= 4) return;
          const [interval, ...rest] = intervals;
          setTimeout(() => {
            updateBluetoothDevices(self);
            updateCount++;
            forceUpdateDeviceStatus(rest);
          }, interval);
        };
        forceUpdateDeviceStatus(updateIntervals);
      }, "notify::connected-devices");
    },
  });
};

const NetworkWiredIndicator = () =>
  Widget.Stack({
    transition: "slide_up_down",
    transitionDuration: userOptions.animations.durationSmall,
    children: {
      fallback: SimpleNetworkIndicator(),
      unknown: Widget.Label({
        className: "txt-norm icon-material",
        label: "wifi_off",
      }),
      disconnected: Widget.Label({
        className: "txt-norm icon-material",
        label: "signal_wifi_off",
      }),
      connected: Widget.Label({
        className: "txt-norm icon-material",
        label: "lan",
      }),
      connecting: Widget.Label({
        className: "txt-norm icon-material",
        label: "settings_ethernet",
      }),
    },
    setup: (self) =>
      self.hook(Network, (stack) => {
        if (!Network.wired) return;

        const { internet } = Network.wired;
        if (["connecting", "connected"].includes(internet))
          stack.shown = internet;
        else if (Network.connectivity !== "full") stack.shown = "disconnected";
        else stack.shown = "fallback";
      }),
  });

const SimpleNetworkIndicator = () =>
  Widget.Icon({
    setup: (self) =>
      self.hook(Network, (self) => {
        const icon = Network[Network.primary || "wifi"]?.iconName;
        self.icon = icon || "";
        self.visible = icon;
      }),
  });

const NetworkWifiIndicator = () =>
  Widget.Stack({
    transition: "slide_up_down",
    transitionDuration: userOptions.animations.durationSmall,
    children: {
      disabled: Widget.Label({
        className: "txt-norm icon-material",
        label: "wifi_off",
      }),
      disconnected: Widget.Label({
        className: "txt-norm icon-material",
        label: "signal_wifi_off",
      }),
      connecting: Widget.Label({
        className: "txt-norm icon-material",
        label: "settings_ethernet",
      }),
      0: Widget.Label({
        className: "txt-norm icon-material",
        label: "signal_wifi_0_bar",
      }),
      1: Widget.Label({
        className: "txt-norm icon-material",
        label: "network_wifi_1_bar",
      }),
      2: Widget.Label({
        className: "txt-norm icon-material",
        label: "network_wifi_2_bar",
      }),
      3: Widget.Label({
        className: "txt-norm icon-material",
        label: "network_wifi_3_bar",
      }),
      4: Widget.Label({
        className: "txt-norm icon-material",
        label: "signal_wifi_4_bar",
      }),
    },
    setup: (self) =>
      self.hook(Network, (stack) => {
        if (!Network.wifi) {
          return;
        }
        if (Network.wifi.internet == "connected") {
          stack.shown = String(Math.ceil(Network.wifi.strength / 25));
        } else if (
          ["disconnected", "connecting"].includes(Network.wifi.internet)
        ) {
          stack.shown = Network.wifi.internet;
        }
      }),
  });

export const NetworkIndicator = () =>
  Widget.Stack({
    transition: "slide_up_down",
    transitionDuration: userOptions.animations.durationSmall,
    children: {
      fallback: SimpleNetworkIndicator(),
      wifi: NetworkWifiIndicator(),
      wired: NetworkWiredIndicator(),
    },
    setup: (self) =>
      self.hook(Network, (stack) => {
        if (!Network.primary) {
          stack.shown = "wifi";
          return;
        }
        const primary = Network.primary || "fallback";
        if (["wifi", "wired"].includes(primary)) stack.shown = primary;
        else stack.shown = "fallback";
      }),
  });

const BarGroup = ({ child }) =>
  Widget.Box({
    className: "bar-group-margin bar-sides",
    children: [
      Widget.Box({
        className: "bar-group bar-group-standalone bar-group-pad-system",
        children: [child],
      }),
    ],
  });

const HyprlandXkbKeyboardLayout = async ({ useFlag } = {}) => {
  try {
    const Hyprland = (
      await import("resource:///com/github/Aylur/ags/service/hyprland.js")
    ).default;
    var languageStackArray = [];

    const updateCurrentKeyboards = () => {
      var initLangs = [];
      JSON.parse(Utils.exec("hyprctl -j devices")).keyboards.forEach(
        (keyboard) => {
          initLangs.push(
            ...keyboard.layout.split(",").map((lang) => lang.trim()),
          );
        },
      );
      initLangs = [...new Set(initLangs)];
      languageStackArray = Array.from({ length: initLangs.length }, (_, i) => {
        const lang = languages.find((lang) => lang.layout == initLangs[i]);
        // if (!lang) return [
        //     initLangs[i],
        //     Widget.Label({ label: initLangs[i] })
        // ];
        // return [
        //     lang.layout,
        //     Widget.Label({ label: (useFlag ? lang.flag : lang.layout) })
        // ];
        // Object
        if (!lang)
          return {
            [initLangs[i]]: Widget.Label({ label: initLangs[i] }),
          };
        return {
          [lang.layout]: Widget.Label({
            label: useFlag ? lang.flag : lang.layout,
          }),
        };
      });
    };
    updateCurrentKeyboards();
    const widgetRevealer = Widget.Revealer({
      transition: "slide_left",
      transitionDuration: userOptions.animations.durationSmall,
      revealChild: languageStackArray.length > 1,
    });
    const widgetKids = {
      ...languageStackArray.reduce((obj, lang) => {
        return { ...obj, ...lang };
      }, {}),
      undef: Widget.Label({ label: "?" }),
    };
    const widgetContent = Widget.Stack({
      transition: "slide_up_down",
      transitionDuration: userOptions.animations.durationSmall,
      children: widgetKids,
      setup: (self) =>
        self.hook(
          Hyprland,
          (stack, kbName, layoutName) => {
            if (!kbName) {
              return;
            }
            var lang = languages.find((lang) => layoutName.includes(lang.name));
            if (lang) {
              widgetContent.shown = lang.layout;
            } else {
              // Attempt to support langs not listed
              lang = languageStackArray.find((lang) =>
                isLanguageMatch(lang[0], layoutName),
              );
              if (!lang) stack.shown = "undef";
              else stack.shown = lang[0];
            }
          },
          "keyboard-layout",
        ),
    });
    widgetRevealer.child = widgetContent;
    return widgetRevealer;
  } catch {
    return null;
  }
};

const OptionalKeyboardLayout = async () => {
  try {
    return await HyprlandXkbKeyboardLayout({
      useFlag: userOptions.appearance.keyboardUseFlag,
    });
  } catch {
    return null;
  }
};

const createKeyboardLayoutInstances = async () => {
  const Hyprland = (
    await import("resource:///com/github/Aylur/ags/service/hyprland.js")
  ).default;
  const monitorsCount = Hyprland.monitors.length;
  const instances = await Promise.all(
    Array.from({ length: monitorsCount }, () => OptionalKeyboardLayout()),
  );
  return instances;
};

const optionalKeyboardLayoutInstances = await createKeyboardLayoutInstances();

const WEATHER_CACHE_FOLDER = `${GLib.get_user_cache_dir()}/ags/weather`;
Utils.exec(`mkdir -p ${WEATHER_CACHE_FOLDER}`);

const BarBatteryProgress = () => {
  const _updateProgress = (circprog) => {
    circprog.css = `font-size: ${Math.abs(Battery.percent)}px;`;
    circprog.toggleClassName(
      "bar-batt-circprog-low",
      Battery.percent <= userOptions.battery.low,
    );
    circprog.toggleClassName("bar-batt-circprog-full", Battery.charged);
  };
  return AnimatedCircProg({
    className: "bar-batt-circprog",
    vpack: "center",
    hpack: "center",
    extraSetup: (self) => self.hook(Battery, _updateProgress),
  });
};

const BarBattery = () =>
  Widget.Box({
    className: "spacing-h-4 bar-batt-txt",
    children: [
      Widget.Revealer({
        transitionDuration: userOptions.animations.durationSmall,
        revealChild: false,
        transition: "slide_right",
        child: MaterialIcon("bolt", "norm", { tooltipText: "Charging" }),
        setup: (self) =>
          self.hook(Battery, (revealer) => {
            self.revealChild = Battery.charging;
          }),
      }),
      Widget.Label({
        className: "txt-smallie",
        setup: (self) =>
          self.hook(Battery, (label) => {
            label.label = `${Number.parseFloat(Battery.percent.toFixed(1))}%`;
          }),
      }),
      Widget.Overlay({
        child: Widget.Box({
          vpack: "center",
          className: "bar-batt",
          homogeneous: true,
          children: [MaterialIcon("battery_full", "small")],
          setup: (self) =>
            self.hook(Battery, (box) => {
              box.toggleClassName(
                "bar-batt-low",
                Battery.percent <= userOptions.battery.low,
              );
              box.toggleClassName("bar-batt-full", Battery.charged);
            }),
        }),
        overlays: [BarBatteryProgress()],
      }),
    ],
  });

const WeatherWidget = () => {
  const updateWeatherDisplay = (self, weather, weatherSymbol, temperature, feelsLike, weatherDesc) => {
    self.children[0].label = weatherSymbol;
    if (userOptions.bar.bluetooth.weatherIconOnlyOnConnect && Bluetooth.connected_devices.length > 0) {
      self.children[1].label = "";
    } else if (userOptions.weather.onlyIcon) {
      self.children[1].label = "";
    } else if (userOptions.weather.short) {
      self.children[1].label = `${temperature}°${userOptions.weather.preferredUnit}`;
    } else {
      self.children[1].label = `${temperature}°${userOptions.weather.preferredUnit} • Feels like ${feelsLike}°${userOptions.weather.preferredUnit}`;
    }
    if (userOptions.weather.onlyIcon || (userOptions.bar.bluetooth.weatherIconOnlyOnConnect && Bluetooth.connected_devices.length > 0)) {
      self.tooltipText = `${temperature}°${userOptions.weather.preferredUnit} • ${weatherDesc}`;
    } else {
      self.tooltipText = weatherDesc;
    }
  };

  const fetchWeather = (self, city) => {
    const WEATHER_CACHE_PATH = WEATHER_CACHE_FOLDER + "/wttr.in.txt";
    Utils.execAsync(`curl https://wttr.in/${city.replace(/ /g, "%20")}?format=j1`)
      .then((output) => {
        const weather = JSON.parse(output);
        Utils.writeFile(JSON.stringify(weather), WEATHER_CACHE_PATH).catch(print);
        const weatherCode = weather.current_condition[0].weatherCode;
        const weatherDesc = weather.current_condition[0].weatherDesc[0].value;
        const temperature = weather.current_condition[0][`temp_${userOptions.weather.preferredUnit}`];
        const feelsLike = weather.current_condition[0][`FeelsLike${userOptions.weather.preferredUnit}`];
        const weatherSymbol = WEATHER_SYMBOL[WWO_CODE[weatherCode]];
        updateWeatherDisplay(self, weather, weatherSymbol, temperature, feelsLike, weatherDesc);
      })
      .catch((err) => {
        try {
          const weather = JSON.parse(Utils.readFile(WEATHER_CACHE_PATH));
          const weatherCode = weather.current_condition[0].weatherCode;
          const weatherDesc = weather.current_condition[0].weatherDesc[0].value;
          const temperature = weather.current_condition[0][`temp_${userOptions.weather.preferredUnit}`];
          const feelsLike = weather.current_condition[0][`FeelsLike${userOptions.weather.preferredUnit}`];
          const weatherSymbol = WEATHER_SYMBOL[WWO_CODE[weatherCode]];
          updateWeatherDisplay(self, weather, weatherSymbol, temperature, feelsLike, weatherDesc);
        } catch (err) {
          print(err);
        }
      });
  };

  return Widget.Box({
    hexpand: userOptions.weather.spacing,
    hpack: "center",
    className: "spacing-h-4 txt-onSurfaceVariant",
    children: [
      MaterialIcon("device_thermostat", "small"),
      Widget.Label({
        label: "Weather",
      }),
    ],
    setup: (self) => {
      const WEATHER_CACHE_PATH = WEATHER_CACHE_FOLDER + "/wttr.in.txt";
      const updateWeatherForCity = (city) => fetchWeather(self, city);

      let wasDisconnected = true;
      self.hook(Network, () => {
        if (Network.primary && Network[Network.primary].internet === "connected" && wasDisconnected) {
          wasDisconnected = false;
          if (userOptions.weather.city != "" && userOptions.weather.city != null) {
            updateWeatherForCity(userOptions.weather.city.replace(/ /g, "%20"));
          } else {
            Utils.execAsync("curl ipinfo.io")
              .then((output) => JSON.parse(output)["city"].toLowerCase())
              .then(updateWeatherForCity)
              .catch(print);
          }
        } else if (!Network.primary || Network[Network.primary].internet !== "connected") {
          wasDisconnected = true;
        }
      }, "notify::primary");

      if (userOptions.bar.bluetooth.weatherIconOnlyOnConnect) {
        self.hook(Bluetooth, () => {
          try {
            const weather = JSON.parse(Utils.readFile(WEATHER_CACHE_PATH));
            const weatherCode = weather.current_condition[0].weatherCode;
            const weatherDesc = weather.current_condition[0].weatherDesc[0].value;
            const temperature = weather.current_condition[0][`temp_${userOptions.weather.preferredUnit}`];
            const feelsLike = weather.current_condition[0][`FeelsLike${userOptions.weather.preferredUnit}`];
            const weatherSymbol = WEATHER_SYMBOL[WWO_CODE[weatherCode]];
            updateWeatherDisplay(self, weather, weatherSymbol, temperature, feelsLike, weatherDesc);
          } catch (err) {
            print(err);
          }
        }, "notify::connected-devices");
      }
    },
  });
};

const VPNIndicator = () => Widget.Revealer({
    child: MaterialIcon('lock', 'norm'),
    transition: 'slide_left',
    revealChild: false,
    transitionDuration: userOptions.animations.durationSmall,
    setup: (self) => self.hook(Network.vpn, (self) => {
        self.revealChild = (Network.vpn.activatedConnections.length > 0);
    })
});

const Utilities = () => {
  const availableUtilities = {
    snip: {
      name: getString('Screen snip'),
      icon: "screenshot_region",
      onClicked: () => {
        Utils.execAsync(`${App.configDir}/scripts/grimblast.sh copy area`).catch(print);
      },
    },
    picker: {
      name: getString('Color picker'),
      icon: "colorize",
      onClicked: () => {
        Utils.execAsync(["hyprpicker", "-a"]).catch(print);
      },
    },
    keyboard: {
      name: getString('Toggle on-screen keyboard'),
      icon: "keyboard",
      onClicked: () => {
        toggleWindowOnAllMonitors("osk");
      },
    },
  };

  const utilityButtons = userOptions.bar.utilities
    .filter((utility) => availableUtilities[utility])
    .map((utility) =>
      UtilButton({
        name: availableUtilities[utility].name,
        icon: availableUtilities[utility].icon,
        onClicked: availableUtilities[utility].onClicked,
      })
    );

  return Widget.Box({
    hpack: "center",
    className: "spacing-h-4",
    children: utilityButtons,
  });
};

const UtilButton = ({ name, icon, onClicked }) =>
  Widget.Button({
    vpack: "center",
    tooltipText: name,
    onClicked: onClicked,
    className: "bar-util-btn icon-material txt-norm",
    label: `${icon}`,
  });

export const StatusIcons = (props = {}, monitor = 0) => {
  const indicators = {
    micMute: MicMuteIndicator(),
    keyboardLayout: optionalKeyboardLayoutInstances[monitor],
    notifications: NotificationIndicator(),
    network: NetworkIndicator(),
    battery: BarGroup({ child: BarBattery() }),
    utilities: Utilities(),
    weather: WeatherWidget(),
    bluetooth: BluetoothIndicator(),
    bluetoothDevices: BluetoothDevices(),
    vpn: VPNIndicator(),
  };

  return Widget.Box({
    ...props,
    child: Widget.Box({
      className: "spacing-h-15",
      children: userOptions.bar.indicators
        .filter((indicator) => indicators[indicator])
        .map((indicator) => indicators[indicator]),
    }),
  });
};