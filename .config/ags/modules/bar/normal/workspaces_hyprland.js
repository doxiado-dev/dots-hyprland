const { GLib, Gdk, Gtk } = imports.gi;
const Lang = imports.lang;
const Cairo = imports.cairo;
const Pango = imports.gi.Pango;
const PangoCairo = imports.gi.PangoCairo;
import App from "resource:///com/github/Aylur/ags/app.js";
import * as Utils from "resource:///com/github/Aylur/ags/utils.js";
import Widget from "resource:///com/github/Aylur/ags/widget.js";
const { Box, DrawingArea, EventBox } = Widget;
import Brightness from "../../../services/brightness.js";
import Hyprland from "resource:///com/github/Aylur/ags/service/hyprland.js";
import Indicator from "../../../services/indicator.js";

const dummyWs = Box({ className: "bar-ws" }); // Not shown. Only for getting size props
const dummyActiveWs = Box({ className: "bar-ws bar-ws-active" }); // Not shown. Only for getting size props
const dummyOccupiedWs = Box({ className: "bar-ws bar-ws-occupied" }); // Not shown. Only for getting size props

const mix = (value1, value2, perc) => {
  return value1 * perc + value2 * (1 - perc);
};

const getFontWeightName = (weight) => {
  switch (weight) {
    case Pango.Weight.ULTRA_LIGHT:
      return 'UltraLight';
    case Pango.Weight.LIGHT:
      return 'Light';
    case Pango.Weight.NORMAL:
      return 'Normal';
    case Pango.Weight.BOLD:
      return 'Bold';
    case Pango.Weight.ULTRA_BOLD:
      return 'UltraBold';
    case Pango.Weight.HEAVY:
      return 'Heavy';
    default:
      return 'Normal';
  }
};

// Font size = workspace id
const WorkspaceContents = (count = 10) => {
  return DrawingArea({
    className: 'bar-ws-container',
    attribute: {
      initialized: false,
      workspaceMask: 0,
      workspaceGroup: 0,
      updateMask: (self) => {
        const offset =
          Math.floor((Hyprland.active.workspace.id - 1) / count) *
          userOptions.workspaces.shown;
        // if (self.attribute.initialized) return; // We only need this to run once
        const workspaces = Hyprland.workspaces;
        let workspaceMask = 0;
        for (let i = 0; i < workspaces.length; i++) {
          const ws = workspaces[i];
          if (ws.id <= offset || ws.id > offset + count) continue; // Out of range, ignore
          if (workspaces[i].windows > 0) workspaceMask |= 1 << (ws.id - offset);
        }
        // console.log('Mask:', workspaceMask.toString(2));
        self.attribute.workspaceMask = workspaceMask;
        // self.attribute.initialized = true;
        self.queue_draw();
      },
      toggleMask: (self, occupied, name) => {
        if (occupied) self.attribute.workspaceMask |= 1 << parseInt(name);
        else self.attribute.workspaceMask &= ~(1 << parseInt(name));
        self.queue_draw();
      },
    },
    setup: (area) =>
      area
        .hook(Hyprland.active.workspace, (self) => {
          const newActiveWs = ((Hyprland.active.workspace.id - 1) % count) + 1;
          self.setCss(`font-size: ${newActiveWs}px;`);
          self.attribute.lastImmediateActiveWs =
            self.attribute.immediateActiveWs;
          self.attribute.immediateActiveWs = newActiveWs;
          const previousGroup = self.attribute.workspaceGroup;
          const currentGroup = Math.floor(
            (Hyprland.active.workspace.id - 1) / count,
          );
          if (currentGroup !== previousGroup) {
            self.attribute.updateMask(self);
            self.attribute.workspaceGroup = currentGroup;
          }
        })
        .hook(
          Hyprland,
          (self) => self.attribute.updateMask(self),
          "notify::workspaces",
        )
        .on(
          "draw",
          Lang.bind(area, (area, cr) => {
            const offset =
              Math.floor((Hyprland.active.workspace.id - 1) / count) *
              userOptions.workspaces.shown;

            const allocation = area.get_allocation();
            const { width, height } = allocation;

            const workspaceStyleContext = dummyWs.get_style_context();
            const workspaceDiameter = workspaceStyleContext.get_property(
              "min-width",
              Gtk.StateFlags.NORMAL,
            );
            const workspaceRadius = workspaceDiameter / 2;
            const workspaceFontSize =
              (workspaceStyleContext.get_property(
                "font-size",
                Gtk.StateFlags.NORMAL,
              ) /
                4) *
              3;
            const workspaceFontFamily = workspaceStyleContext.get_property(
              "font-family",
              Gtk.StateFlags.NORMAL,
            );
            const workspaceFontWeight = workspaceStyleContext.get_property(
              "font-weight",
              Gtk.StateFlags.NORMAL,
            );
            const wsbg = workspaceStyleContext.get_property(
              "background-color",
              Gtk.StateFlags.NORMAL,
            );
            const wsfg = workspaceStyleContext.get_property(
              "color",
              Gtk.StateFlags.NORMAL,
            );

            const occupiedWorkspaceStyleContext =
              dummyOccupiedWs.get_style_context();
            const occupiedbg = occupiedWorkspaceStyleContext.get_property(
              "background-color",
              Gtk.StateFlags.NORMAL,
            );
            const occupiedfg = occupiedWorkspaceStyleContext.get_property(
              "color",
              Gtk.StateFlags.NORMAL,
            );

            const activeWorkspaceStyleContext =
              dummyActiveWs.get_style_context();
            const activebg = activeWorkspaceStyleContext.get_property(
              "background-color",
              Gtk.StateFlags.NORMAL,
            );
            const activefg = activeWorkspaceStyleContext.get_property(
              "color",
              Gtk.StateFlags.NORMAL,
            );
            area.set_size_request(workspaceDiameter * count, -1);
            const widgetStyleContext = area.get_style_context();
            const activeWs = widgetStyleContext.get_property(
              "font-size",
              Gtk.StateFlags.NORMAL,
            );

            const activeWsCenterX =
              -(workspaceDiameter / 2) + workspaceDiameter * activeWs;
            const activeWsCenterY = height / 2;

            // Font
            const layout = PangoCairo.create_layout(cr);
            const fontDesc = Pango.font_description_from_string(
              `${workspaceFontFamily[0]} ${getFontWeightName(workspaceFontWeight)} ${workspaceFontSize}`,
            );
            layout.set_font_description(fontDesc);
            cr.setAntialias(Cairo.Antialias.BEST);
            // Get kinda min radius for number indicators
            layout.set_text("0".repeat(count.toString().length), -1);
            const [layoutWidth, layoutHeight] = layout.get_pixel_size();
            const indicatorRadius =
              (Math.max(layoutWidth, layoutHeight) / 2) * 1.15; // smaller than sqrt(2)*radius
            const indicatorGap = workspaceRadius - indicatorRadius;

            // Draw workspace numbers
            for (let i = 1; i <= count; i++) {
              const inactivecolors = area.attribute.workspaceMask & (1 << i) ? occupiedfg : wsfg;
              if (i == activeWs) {
                cr.setSourceRGBA(activefg.red, activefg.green, activefg.blue, activefg.alpha);
              } else if ((i == Math.floor(activeWs) && Hyprland.active.workspace.id < activeWs) || (i == Math.ceil(activeWs) && Hyprland.active.workspace.id > activeWs)) {
                cr.setSourceRGBA(mix(activefg.red, inactivecolors.red, 1 - Math.abs(activeWs - i)), mix(activefg.green, inactivecolors.green, 1 - Math.abs(activeWs - i)), mix(activefg.blue, inactivecolors.blue, 1 - Math.abs(activeWs - i)), activefg.alpha);
              } else if ((i == Math.floor(activeWs) && Hyprland.active.workspace.id > activeWs) || (i == Math.ceil(activeWs) && Hyprland.active.workspace.id < activeWs)) {
                cr.setSourceRGBA(mix(activefg.red, inactivecolors.red, 1 - Math.abs(activeWs - i)), mix(activefg.green, inactivecolors.green, 1 - Math.abs(activeWs - i)), mix(activefg.blue, inactivecolors.blue, 1 - Math.abs(activeWs - i)), activefg.alpha);
              } else {
                cr.setSourceRGBA(inactivecolors.red, inactivecolors.green, inactivecolors.blue, inactivecolors.alpha);
              }

              layout.set_text(`${i + offset}`, -1);
              const [layoutWidth, layoutHeight] = layout.get_pixel_size();
              const x = -workspaceRadius + workspaceDiameter * i - layoutWidth / 2;
              const y = (height - layoutHeight) / 2;
              cr.moveTo(x, y);
              PangoCairo.show_layout(cr, layout);
              cr.stroke();
            }

            // Draw active ws
            // base
            cr.setSourceRGBA(
              activebg.red,
              activebg.green,
              activebg.blue,
              activebg.alpha,
            );
            cr.arc(
              activeWsCenterX,
              activeWsCenterY,
              indicatorRadius,
              0,
              2 * Math.PI,
            );
            cr.fill();
            // inner decor
            cr.setSourceRGBA(
              activefg.red,
              activefg.green,
              activefg.blue,
              activefg.alpha,
            );
            cr.arc(
              activeWsCenterX,
              activeWsCenterY,
              indicatorRadius * 0.2,
              0,
              2 * Math.PI,
            );
            cr.fill();
          }),
        ),
  });
};

export default async (monitor = 0) => {
  return EventBox({
    onScrollUp: (self, event) => handleScroll(self, event, monitor, "up"),
    onScrollDown: (self, event) => handleScroll(self, event, monitor, "down"),
    onMiddleClick: () => {
      toggleWindowOnAllMonitors("osk");
    },
    onSecondaryClick: () => {
      App.toggleWindow("overview");
    },
    attribute: {
      clicked: false,
      ws_group: 0,
    },
    // Spacer
    child: Box({
      homogeneous: true,
      className: "bar-group-margin",
      children: [
        EventBox({
          onScrollUp: (self, event) => handleScroll(self, event, monitor, "up"),
          onScrollDown: (self, event) =>
            handleScroll(self, event, monitor, "down"),
          onPrimaryClick: (self, event) => handlePrimaryClick(self, event),
          child: Box({
            className: "bar-group bar-group-standalone bar-group-pad",
            css: "min-width: 35px;",
            children: [
              Box({ css: "min-width: 35px;" }),
              WorkspaceContents(userOptions.workspaces.shown),
            ],
          }),
        }),
      ],
    }),
    setup: (self) => {
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
    },
  });
};

function handleScroll(self, event, monitor, direction) {
  const [_, cursorX] = event.get_coords();
  const widgetWidth = self.get_allocation().width;
  if (cursorX < 30) {
    Indicator.popup(1);
    Brightness[monitor].screen_value += direction === "up" ? 0.05 : -0.05;
  } else if (cursorX >= 30 && cursorX <= widgetWidth - 30) {
    Hyprland.messageAsync(
      `dispatch workspace ${direction === "up" ? "-1" : "+1"}`,
    ).catch(print);
  }
}

function handlePrimaryClick(self, event) {
  const [_, cursorX] = event.get_coords();
  const widgetWidth = self.get_allocation().width;
  if (cursorX < 30) {
    App.toggleWindow("sideleft");
  }
}

function handleMotionNotify(self, event) {
  if (!self.attribute.clicked) return;
  const [_, cursorX] = event.get_coords();
  const widgetWidth = self.get_allocation().width;
  if (cursorX >= 30 && cursorX <= widgetWidth - 30) {
    const wsId = Math.ceil(
      (cursorX * userOptions.workspaces.shown) / widgetWidth,
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
    if (cursorX >= 30 && cursorX <= widgetWidth - 30) {
      const wsId = Math.ceil(
        (cursorX * userOptions.workspaces.shown) / widgetWidth,
      );
      Utils.execAsync([
        `${App.configDir}/scripts/hyprland/workspace_action.sh`,
        "workspace",
        `${wsId}`,
      ]).catch(print);
    } else if (button === 1) {
      Hyprland.messageAsync(`dispatch togglespecialworkspace`).catch(print);
    }
  }
}
