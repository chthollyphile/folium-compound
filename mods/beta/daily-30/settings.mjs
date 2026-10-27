// mods/daily-30/settings.mjs
// The mod's own settings section, shown when the mod's row is expanded in Settings → Mods.

import { label } from './labels.mjs';

export const SETTINGS_SECTION = {
    id: 'capture',
    label: label('每日推荐', 'Daily Recommendation'),
    description: label(
        '自动记录每天的网易云音乐「每日推荐」。登录状态来自 Folia 自己的账号，不需要在这里再填一次。',
        'Records the NetEase Daily Recommendation. Sign-in comes from your Folia account; nothing has to be entered here.',
    ),
    settings: [
        {
            key: 'autoCapture',
            type: 'boolean',
            label: label('自动记录', 'Record automatically'),
            description: label(
                '打开后，应用启动时和之后每隔一段时间检查一次。关闭后仍可以在首页点「立即记录」。',
                'Checks at startup and then every interval below. Off still leaves the “Record now” button working.',
            ),
            defaultValue: true,
            group: label('记录', 'Recording'),
        },
        {
            key: 'intervalMinutes',
            type: 'select',
            label: label('检查间隔', 'Check interval'),
            description: label('两次自动检查之间等待多久。', 'How long to wait between automatic checks.'),
            defaultValue: '30',
            options: [
                { value: '15', label: label('15 分钟', '15 minutes') },
                { value: '30', label: label('30 分钟', '30 minutes') },
                { value: '60', label: label('1 小时', '1 hour') },
                { value: '120', label: label('2 小时', '2 hours') },
            ],
            group: label('记录', 'Recording'),
        },
        {
            key: 'captureNetease',
            type: 'boolean',
            label: label('记录网易云音乐', 'Record NetEase'),
            defaultValue: true,
            group: label('平台', 'Platforms'),
        },
        {
            key: 'backfillNetease',
            type: 'boolean',
            label: label('补回网易云历史', 'Recover NetEase history'),
            description: label(
                '首次记录时，尝试把服务器还保留的最近几次「历史日推」补进来（需要黑胶 VIP）。',
                'On the first run, try to recover the few “history recommendations” the server still keeps (Black Vinyl VIP).',
            ),
            defaultValue: true,
            group: label('平台', 'Platforms'),
        },
    ],
};
