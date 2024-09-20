const { GLib } = imports.gi;
import Widget from 'resource:///com/github/Aylur/ags/widget.js';
import * as Utils from 'resource:///com/github/Aylur/ags/utils.js';
import Mpris from 'resource:///com/github/Aylur/ags/service/mpris.js';
import Brightness from "../../../services/brightness.js";
const { Box, Button, EventBox, Label, Overlay, Revealer, Scrollable } = Widget;
const { execAsync, exec } = Utils;
import { AnimatedCircProg } from "../../.commonwidgets/cairo_circularprogress.js";
import { MaterialIcon } from '../../.commonwidgets/materialicon.js';
import { showMusicControls } from '../../../variables.js';

const CUSTOM_MODULE_CONTENT_INTERVAL_FILE = `${GLib.get_user_cache_dir()}/ags/user/scripts/custom-module-interval.txt`;
const CUSTOM_MODULE_CONTENT_SCRIPT = `${GLib.get_user_cache_dir()}/ags/user/scripts/custom-module-poll.sh`;
const CUSTOM_MODULE_LEFTCLICK_SCRIPT = `${GLib.get_user_cache_dir()}/ags/user/scripts/custom-module-leftclick.sh`;
const CUSTOM_MODULE_RIGHTCLICK_SCRIPT = `${GLib.get_user_cache_dir()}/ags/user/scripts/custom-module-rightclick.sh`;
const CUSTOM_MODULE_MIDDLECLICK_SCRIPT = `${GLib.get_user_cache_dir()}/ags/user/scripts/custom-module-middleclick.sh`;
const CUSTOM_MODULE_SCROLLUP_SCRIPT = `${GLib.get_user_cache_dir()}/ags/user/scripts/custom-module-scrollup.sh`;
const CUSTOM_MODULE_SCROLLDOWN_SCRIPT = `${GLib.get_user_cache_dir()}/ags/user/scripts/custom-module-scrolldown.sh`;

function trimTrackTitle(title) {
    if (!title) return '';
    const cleanPatterns = [
        /【[^】]*】/,        // Touhou n weeb stuff
        " [FREE DOWNLOAD]", // F-777
    ];
    cleanPatterns.forEach((expr) => title = title.replace(expr, ''));
    return title;
}

const BarGroup = ({ child }) => Box({
    className: 'bar-group-margin bar-sides',
    children: [
        Box({
            className: 'bar-group bar-group-standalone bar-group-pad-system',
            children: [child],
        }),
    ]
});

const BarResource = (name, icon, command, circprogClassName = 'bar-batt-circprog', textClassName = 'txt-onSurfaceVariant', iconClassName = 'bar-batt') => {
    const resourceCircProg = AnimatedCircProg({
        className: `${circprogClassName}`,
        vpack: 'center',
        hpack: 'center',
    });
    const resourceProgress = Box({
        homogeneous: true,
        children: [Overlay({
            child: Box({
                vpack: 'center',
                className: `${iconClassName}`,
                homogeneous: true,
                children: [
                    MaterialIcon(icon, 'small'),
                ],
            }),
            overlays: [resourceCircProg]
        })]
    });
    const resourceLabel = Label({
        className: `txt-smallie ${textClassName}`,
    });
    const widget = Button({
        onClicked: () => Utils.execAsync(['bash', '-c', `${userOptions.apps.taskManager}`]).catch(print),
        child: Box({
            className: `spacing-h-4 ${textClassName}`,
            children: [
                resourceProgress,
                resourceLabel,
            ],
            setup: (self) => self.poll(5000, () => execAsync(['bash', '-c', command])
                .then((output) => {
                    resourceCircProg.css = `font-size: ${Number(output)}px;`;
                    resourceLabel.label = `${Math.round(Number(output))}%`;
                    widget.tooltipText = `${name}: ${Math.round(Number(output))}%`;
                }).catch(print))
            ,
        })
    });
    return widget;
}

const NetworkSpeed = () => {
    if (!userOptions.bar.network.enabled) return null;

    const uploadCircProg = AnimatedCircProg({
        className: 'bar-net-circprog',
        vpack: 'center',
        hpack: 'center',
    });
    const downloadCircProg = AnimatedCircProg({
        className: 'bar-net-circprog',
        vpack: 'center',
        hpack: 'center',
    });

    const uploadProgress = Box({
        homogeneous: true,
        children: [Overlay({
            child: Box({
                vpack: 'center',
                className: 'bar-net-icon',
                homogeneous: true,
                children: [
                    MaterialIcon('upload', 'small'),
                ],
            }),
            overlays: [uploadCircProg]
        })],
    });

    const downloadProgress = Box({
        homogeneous: true,
        children: [Overlay({
            child: Box({
                vpack: 'center',
                className: 'bar-net-icon',
                homogeneous: true,
                children: [
                    MaterialIcon('download', 'small'),
                ],
            }),
            overlays: [downloadCircProg]
        })],
    });

    const uploadLabel = Label({
        className: 'txt-smallie txt-onSurfaceVariant',
    });

    const downloadLabel = Label({
        className: 'txt-smallie txt-onSurfaceVariant',
    });

    const uploadBox = Box({
        className: 'spacing-h-3',
        children: [
            uploadProgress,
            userOptions.bar.network.hideText ? null : uploadLabel,
        ],
        setup: (self) => self.poll(2000, () => execAsync(['bash', '-c', "vnstat -tr 2 --json | jq -r '.tx.bytespersecond' | awk '{printf \"%.2f\", $1/1048576}'"])
            .then((output) => {
                uploadCircProg.css = `font-size: ${Number(output)}px;`;
                uploadLabel.label = `${output.trim()} MB/s`;
                self.tooltipText = `Upload: ${output.trim()} MB/s`;
            }).catch(print))
    });

    const downloadBox = Box({
        className: 'spacing-h-3',
        children: [
            downloadProgress,
            userOptions.bar.network.hideText ? null : downloadLabel,
        ],
        setup: (self) => self.poll(2000, () => execAsync(['bash', '-c', "vnstat -tr 2 --json | jq -r '.rx.bytespersecond' | awk '{printf \"%.2f\", $1/1048576}'"])
            .then((output) => {
                downloadCircProg.css = `font-size: ${Number(output)}px;`;
                downloadLabel.label = `${output.trim()} MB/s`;
                self.tooltipText = `Download: ${output.trim()} MB/s`;
            }).catch(print))
    });

    const widget = Button({
        onClicked: () => Utils.execAsync(['bash', '-c', `${userOptions.apps.taskManager}`]).catch(print),
        child: Box({
            className: 'spacing-h-4 txt-onSurfaceVariant',
            children: [uploadBox, downloadBox],
        })
    });

    return BarGroup({ child: widget });
};

const SystemResourcesOrCustomModule = () => {
    // Check if $XDG_CACHE_HOME/ags/user/scripts/custom-module-poll.sh exists
    if (GLib.file_test(CUSTOM_MODULE_CONTENT_SCRIPT, GLib.FileTest.EXISTS)) {
        const interval = Number(Utils.readFile(CUSTOM_MODULE_CONTENT_INTERVAL_FILE)) || 5000;
        return BarGroup({
            child: Button({
                child: Label({
                    className: 'txt-smallie txt-onSurfaceVariant',
                    useMarkup: true,
                    setup: (self) => Utils.timeout(1, () => {
                        self.label = exec(CUSTOM_MODULE_CONTENT_SCRIPT);
                        self.poll(interval, (self) => {
                            const content = exec(CUSTOM_MODULE_CONTENT_SCRIPT);
                            self.label = content;
                        })
                    })
                }),
                onPrimaryClickRelease: () => execAsync(CUSTOM_MODULE_LEFTCLICK_SCRIPT).catch(print),
                onSecondaryClickRelease: () => execAsync(CUSTOM_MODULE_RIGHTCLICK_SCRIPT).catch(print),
                onMiddleClickRelease: () => execAsync(CUSTOM_MODULE_MIDDLECLICK_SCRIPT).catch(print),
                onScrollUp: () => execAsync(CUSTOM_MODULE_SCROLLUP_SCRIPT).catch(print),
                onScrollDown: () => execAsync(CUSTOM_MODULE_SCROLLDOWN_SCRIPT).catch(print),
            })
        });
    } else return BarGroup({
        child: Box({
            children: [
                BarResource('RAM Usage', 'memory', `LANG=C free | awk '/^Mem/ {printf("%.2f\\n", ($3/$2) * 100)}'`,
                    'bar-ram-circprog', 'bar-ram-txt', 'bar-ram-icon'),
                Revealer({
                    revealChild: true,
                    transition: 'slide_left',
                    transitionDuration: userOptions.animations.durationLarge,
                    child: Box({
                        className: 'spacing-h-10 margin-left-10',
                        children: [
//                            BarResource('Swap Usage', 'swap_horiz', `LANG=C free | awk '/^Swap/ {if ($2 > 0) printf("%.2f\\n", ($3/$2) * 100); else print "0";}'`,
//                                'bar-swap-circprog', 'bar-swap-txt', 'bar-swap-icon'),
                            BarResource('CPU Usage', 'settings_motion_mode', `LANG=C top -bn1 | grep Cpu | sed 's/\\,/\\./g' | awk '{print $2}'`,
                                'bar-cpu-circprog', 'bar-cpu-txt', 'bar-cpu-icon'),
                            NetworkSpeed(),
                        ]
                    }),
                    setup: (self) => {
                        if (userOptions.music.enableMusicWidget) {
                            self.hook(Mpris, label => {
                                const mpris = Mpris.getPlayer('');
                                self.revealChild = (!mpris);
                            });
                        } else {
                            self.revealChild = true; // Always show the resources
                        }
                    }
                })
            ],
        })
    });
}

const switchToRelativeWorkspace = async (self, num) => {
    try {
        const Hyprland = (await import('resource:///com/github/Aylur/ags/service/hyprland.js')).default;
        Hyprland.messageAsync(`dispatch workspace ${num > 0 ? '+' : ''}${num}`).catch(print);
    } catch {
        execAsync([`${App.configDir}/scripts/sway/swayToRelativeWs.sh`, `${num}`]).catch(print);
    }
}

const SpaceLeftDefaultClicks = (child) =>
    EventBox({
        onPrimaryClick: () => App.toggleWindow("sideleft"),
        onSecondaryClick: () =>
            execAsync([
                "bash",
                "-c",
                'playerctl previous || playerctl position `bc <<< "100 * $(playerctl metadata mpris:length) / 1000000 / 100"` &',
            ]).catch(print),
        onMiddleClick: () => execAsync("playerctl play-pause").catch(print),
        child: Box({
            className: 'bar-spaceright',
            children: [child],
        }),
    });

const handleScroll = (self, event, monitor, direction) => {
    Brightness[monitor].screen_value += direction === "up" ? 0.05 : -0.05;
}

const TrackProgress = () => {
    const _updateProgress = (circprog) => {
        const mpris = Mpris.getPlayer('');
        if (!mpris) return;
        // Set circular progress value
        circprog.css = `font-size: ${Math.max(mpris.position / mpris.length * 100, 0)}px;`;
    }
    return AnimatedCircProg({
        className: 'bar-music-circprog',
        vpack: 'center',
        hpack: 'center',
        extraSetup: (self) => self
            .hook(Mpris, _updateProgress)
            .poll(3000, _updateProgress),
    });
}

const MusicWidget = () => {
    const playingState = Box({
        homogeneous: true,
        children: [Overlay({
            child: Box({
                vpack: 'center',
                className: 'bar-music-playstate',
                homogeneous: true,
                children: [Label({
                    vpack: 'center',
                    className: 'bar-music-playstate-txt',
                    justification: 'center',
                    setup: (self) => self.hook(Mpris, label => {
                        const mpris = Mpris.getPlayer('');
                        label.label = `${mpris !== null && mpris.playBackStatus == 'Playing' ? 'pause' : 'play_arrow'}`;
                    }),
                })],
                setup: (self) => self.hook(Mpris, label => {
                    const mpris = Mpris.getPlayer('');
                    if (!mpris) return;
                    label.toggleClassName('bar-music-playstate-playing', mpris !== null && mpris.playBackStatus == 'Playing');
                    label.toggleClassName('bar-music-playstate', mpris !== null || mpris.playBackStatus == 'Paused');
                }),
            }),
            overlays: [TrackProgress()],
        })],
    });

    const trackTitle = Label({
        hexpand: true,
        className: 'txt-smallie bar-music-txt',
        truncate: 'end',
        maxWidthChars: 1,
        setup: (self) => self.hook(Mpris, label => {
            const mpris = Mpris.getPlayer('');
            if (mpris) label.label = `${trimTrackTitle(mpris.trackTitle)} • ${mpris.trackArtists.join(', ')}`;
            else label.label = 'No media';
        }),
    });

    const musicStuff = Box({
        className: 'spacing-h-10',
        hexpand: true,
        children: [playingState, trackTitle],
    });

    return EventBox({
        child: BarGroup({ child: musicStuff }),
        onPrimaryClick: () => showMusicControls.setValue(!showMusicControls.value),
        onSecondaryClick: () => execAsync(['bash', '-c', 'playerctl next || playerctl position `bc <<< "100 * $(playerctl metadata mpris:length) / 1000000 / 100"` &']).catch(print),
        onMiddleClick: () => execAsync('playerctl play-pause').catch(print),
        setup: (self) => self.on('button-press-event', (self, event) => {
            if (event.get_button()[1] === 8) // Side button
                execAsync('playerctl previous').catch(print);
        }),
    });
}

export default () => {
    return EventBox({
        onScrollUp: (self, event) => handleScroll(self, event, 0, "up"),
        onScrollDown: (self, event) => handleScroll(self, event, 0, "down"),
        child: Box({
            className: 'spacing-h-4',
            children: [
                SystemResourcesOrCustomModule(),
                userOptions.music.enableMusicWidget ? MusicWidget() : null,
                SpaceLeftDefaultClicks(Box({ hexpand: true })),
            ]
        })
    });
}
