const { Gdk } = imports.gi;
import Widget from 'resource:///com/github/Aylur/ags/widget.js';
import Hyprland from 'resource:///com/github/Aylur/ags/service/hyprland.js';
import { enableClickthrough } from "../.widgetutils/clickthrough.js";
import { RoundedCorner } from "../.commonwidgets/cairo_roundedcorner.js";
import Indicator from "../../services/indicator.js";
import Brightness from "../../services/brightness.js";
import Utils from 'resource:///com/github/Aylur/ags/utils.js';
import App from 'resource:///com/github/Aylur/ags/app.js';

function handleScroll(self, event, monitor, direction) {
  const [_, cursorX] = event.get_coords();
  const widgetWidth = self.get_allocation().width;
  if (cursorX < 35) {
    Indicator.popup(1);
    Brightness[monitor].screen_value += direction === "up" ? 0.05 : -0.05;
  } else if (cursorX >= 35 && cursorX <= widgetWidth - 35) {
    Hyprland.messageAsync(
      `dispatch workspace ${direction === "up" ? "-1" : "+1"}`,
    ).catch(print);
  }
}

function handlePrimaryClick(self, event) {
  const [_, cursorX] = event.get_coords();
  const widgetWidth = self.get_allocation().width;

  if (cursorX < 35) {
    App.toggleWindow("sideleft");
  } else if (cursorX >= widgetWidth - 35) {
    Hyprland.messageAsync(
      `dispatch workspace ${userOptions.workspaces.shown}`,
    ).catch(print);
  } else {
    const wsId = Math.ceil(
      ((cursorX - 35) * userOptions.workspaces.shown) / (widgetWidth - 70),
    );
    if (wsId !== Hyprland.active.workspace.id) {
      Utils.execAsync([
        `${App.configDir}/scripts/hyprland/workspace_action.sh`,
        "workspace",
        `${wsId}`,
      ]).catch(print);
    }
  }
}

function handleMotionNotify(self, event) {
  if (!self.attribute.clicked) return;
  const [_, cursorX] = event.get_coords();
  const widgetWidth = self.get_allocation().width;
  if (cursorX >= 35 && cursorX <= widgetWidth - 35) {
    const wsId = Math.ceil(
      ((cursorX - 35) * userOptions.workspaces.shown) / (widgetWidth - 60),
    );
    Utils.execAsync([
      `${App.configDir}/scripts/hyprland/workspace_action.sh`,
      "workspace",
      `${wsId}`,
    ]).catch(print);
  }
}

function handleButtonPress(self, event) {
  const button = event.get_button()[1];
  const [_, cursorX] = event.get_coords();
  const widgetWidth = self.get_allocation().width;
  if (button === 1) {
    self.attribute.clicked = true;
    if (cursorX >= 35 && cursorX <= widgetWidth - 35) {
      const wsId = Math.ceil(
        ((cursorX - 35) * userOptions.workspaces.shown) / (widgetWidth - 60),
      );
      if (wsId !== Hyprland.active.workspace.id) {
        Utils.execAsync([
          `${App.configDir}/scripts/hyprland/workspace_action.sh`,
          "workspace",
          `${wsId}`,
        ]).catch(print);
      }
    }
  }
}

export default (monitor = 0, where = 'bottom left', useOverlayLayer = true) => {
    const positionString = where.replace(/\s/, ""); // remove space
    return Widget.Window({
        monitor,
        name: `corner${positionString}${monitor}`,
        layer: useOverlayLayer ? 'overlay' : 'top',
        anchor: where.split(' '),
        exclusivity: 'ignore',
        visible: true,
        child: RoundedCorner(positionString, { className: 'corner-black', }),
        setup: (self) => {
            enableClickthrough(self);
            self.add_events(
                Gdk.EventMask.POINTER_MOTION_MASK |
                Gdk.EventMask.SCROLL_MASK |
                Gdk.EventMask.BUTTON_PRESS_MASK |
                Gdk.EventMask.BUTTON_RELEASE_MASK,
            );
            self.on("motion-notify-event", (self, event) =>
                handleMotionNotify(self, event),
            );
            self.on("button-press-event", (self, event) =>
                handleButtonPress(self, event),
            );
            self.on("button-release-event", (self) => {
                self.attribute.clicked = false;
            });
            self.on("scroll-event", (self, event) =>
                handleScroll(self, event, monitor, event.get_scroll_direction() === Gdk.ScrollDirection.UP ? "up" : "down"),
            );
            self.on("button-press-event", (self, event) =>
                handlePrimaryClick(self, event),
            );
        },
    });
}