// mods/daily-30/client.mjs
// Wires the recorder to the host: settings, the home tab, the commands, and the timer. The client runs
// in the main window; the export window has no accounts, timer or home tab, so it only checks the API.

import { createCapture } from './capture.mjs';
import { registerHomeTab } from './ui.mjs';
import { SETTINGS_SECTION } from './settings.mjs';
import { fill, label, labels } from './labels.mjs';

export default function activate(folium) {
    if (folium.host.folium.major !== 1 || folium.host.folium.minor < 7) {
        throw new Error('每日推荐需要 Folium 1.7（Folia 0.7.22 或更新版本）');
    }
    if (folium.env.context !== 'main') return undefined;

    const section = folium.registries.settingsSections.register(SETTINGS_SECTION);
    const capture = createCapture({ folium, settings: section.settings });
    const home = registerHomeTab(folium, capture, section.settings);

    const open = folium.registries.commands.register({
        id: 'open',
        label: label('打开每日推荐', 'Open Daily Recommendation'),
        description: label('按日期回看网易云的每日推荐。', 'Browse the NetEase daily recommendations by date.'),
        icon: 'calendar-days',
        run: () => folium.ui.openHomeTab('daily-30'),
    });

    const record = folium.registries.commands.register({
        id: 'record',
        label: label('立即记录每日推荐', 'Record the daily recommendation now'),
        description: label('现在检查网易云音乐，并把今天的歌单写进记录。', 'Check NetEase now and write the current list to the archive.'),
        icon: 'refresh-cw',
        run: async () => {
            await capture.captureNow();
            const t = labels(navigator.language || 'zh-CN');
            const result = capture.getStatus().results.netease;
            if (!result) return fill(t.recordFailed, { error: t.errorCodes.unknown });
            const error = t.errorCodes[result.code] || t.errorCodes.unknown;
            return result.ok ? fill(t.recorded, { n: result.count }) : fill(t.recordFailed, { error });
        },
    });

    const stop = capture.start();
    return () => {
        stop();
        home.unregister();
        open.unregister();
        record.unregister();
        section.unregister?.();
    };
}
