// This is for the right pills of the bar.
import Widget from "resource:///com/github/Aylur/ags/widget.js";
import * as Utils from "resource:///com/github/Aylur/ags/utils.js";
const { Box, Label, Button, Overlay, Revealer, Scrollable, Stack, EventBox } =
  Widget;
const { exec, execAsync } = Utils;
const { GLib } = imports.gi;
import { MaterialIcon } from "../../.commonwidgets/materialicon.js";
import {
  WWO_CODE,
  WEATHER_SYMBOL,
  NIGHT_WEATHER_SYMBOL,
} from "../../.commondata/weather.js";

const WEATHER_CACHE_FOLDER = `${GLib.get_user_cache_dir()}/ags/weather`;
Utils.exec(`mkdir -p ${WEATHER_CACHE_FOLDER}`);

const BarClock = () =>
  Widget.Box({
    vpack: "center",
    className: "spacing-h-4 bar-clock-box",
    children: [
      Widget.Label({
        className: "txt-smallie bar-date",
        label: GLib.DateTime.new_now_utc().format(
          userOptions.time.dateFormatLong,
        ),
        setup: (self) =>
          self.poll(userOptions.time.dateInterval, (label) => {
            label.label = GLib.DateTime.new_now_utc().format(
              userOptions.time.dateFormatLong,
            );
          }),
      }),
      Widget.Label({
        className: "txt-norm txt-onLayer1",
        label: "•",
      }),
      Widget.Label({
        className: "bar-time",
        label: GLib.DateTime.new_now_local().format(userOptions.time.format),
        setup: (self) =>
          self.poll(userOptions.time.interval, (label) => {
            label.label = GLib.DateTime.new_now_local().format(
              userOptions.time.format,
            );
          }),
      }),
    ],
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

const switchToRelativeWorkspace = async (self, num) => {
  try {
    const Hyprland = (
      await import("resource:///com/github/Aylur/ags/service/hyprland.js")
    ).default;
    Hyprland.messageAsync(
      `dispatch workspace ${num > 0 ? "+" : ""}${num}`,
    ).catch(print);
  } catch {
    execAsync([
      `${App.configDir}/scripts/sway/swayToRelativeWs.sh`,
      `${num}`,
    ]).catch(print);
  }
};

export default () =>
  Widget.EventBox({
    onScrollUp: (self) => switchToRelativeWorkspace(self, -1),
    onScrollDown: (self) => switchToRelativeWorkspace(self, +1),
    onPrimaryClick: () => App.toggleWindow("sideright"),
    child: Widget.Box({
      className: "bar-group-margin bar-sides",
      children: [
        Widget.Box({
          className: "bar-group bar-group-standalone bar-group-pad-system",
          children: [BarClock()],
        }),
      ],
    }),
  });
