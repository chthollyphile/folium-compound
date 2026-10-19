// client.mjs —— 主窗口入口：设置分区（左侧可超出多少像素）与一条状态命令。
// 值同时写进模组存储与主进程，所以窗口已经在开、页面还没加载时主进程也能拿到上次的值。

const OVERHANG_KEY = 'overhang';
const DEFAULT_OVERHANG = 178;
const MAX_OVERHANG = 278;

/** 导出窗口里 settingsSections 的 handle 没有面板，退回默认值。 */
const readAccess = (section) => section.settings ?? section.params ?? {
    get: () => ({ [OVERHANG_KEY]: DEFAULT_OVERHANG }),
    subscribe: () => () => {},
};

export default function activate(folium) {
    const section = folium.registries.settingsSections.register({
        id: 'edge',
        label: { 'zh-CN': '小窗拖边', en: 'Remote window edge' },
        description: {
            'zh-CN': '远程控制小窗往屏幕左侧能拖多远。放歌时小窗左边有 178 px 是空的判定区，'
                + '原来它把可见卡片顶在离屏幕左边缘 178 px 的地方，再往左拖不动。',
            en: 'How far the remote control window may be dragged past the left edge of the screen. '
                + 'In use, the 178 px left of its card are empty, and used to hold the card 178 px '
                + 'away from the screen edge.',
        },
        settings: [{
            key: OVERHANG_KEY,
            type: 'number',
            label: { 'zh-CN': '左侧可超出（px）', en: 'Left overhang (px)' },
            description: {
                'zh-CN': '0 = 可见卡片最多贴到屏幕左边缘；178 = 卡片可以再往左超出 178 px，'
                    + '正好吃掉那块空的判定区。',
                en: '0 = the visible card stops at the screen edge; 178 = it may go 178 px past it, '
                    + 'which is exactly the empty strip.',
            },
            defaultValue: DEFAULT_OVERHANG,
            min: 0,
            max: MAX_OVERHANG,
            step: 1,
        }],
    });

    const access = readAccess(section);

    const sync = async () => {
        const value = Number(access.get()?.[OVERHANG_KEY]);
        if (!Number.isFinite(value)) return;
        try {
            await folium.rpc.call('overhang', value);
        } catch (error) {
            // 导出窗口没有 rpc，主进程也会自己读存储，不碍事。
        }
        try {
            await folium.storage.set(OVERHANG_KEY, value);
        } catch (error) {
            folium.log.warn('[remote-window-edge] could not save the overhang', error);
        }
    };

    const off = typeof access.subscribe === 'function' ? access.subscribe(() => { void sync(); }) : null;
    void sync();

    const command = folium.registries.commands.register({
        id: 'status',
        label: { 'zh-CN': '小窗拖边：状态', en: 'Remote window edge: status' },
        description: {
            'zh-CN': '读主进程里生效的超出像素与小窗数量。',
            en: 'Reads the overhang in force and how many remote windows are open.',
        },
        async run() {
            const value = Number(access.get()?.[OVERHANG_KEY]);
            try {
                const status = await folium.rpc.call('status');
                return `设置 ${value} px，主进程生效 ${status.overhang} px（上限 ${status.maxOverhang}），小窗 ${status.remoteWindows} 个`;
            } catch (error) {
                return `设置 ${value} px，读不到主进程：${error?.message ?? error}`;
            }
        },
    });

    return () => {
        if (typeof off === 'function') off();
        command.unregister();
        section.unregister();
    };
}
