// mods/Just-Enough-Setting/client.mjs
// Just Enough Setting：把系统媒体（Windows SMTC / 媒体浮窗）的三行、标签页标题与 Steam 好友列表里那句
// 「正在玩」交给可拖拽的片段列表编排。系统媒体与标签页是 client 一个人干的；Steam 要登录用户的账号、
// 开长连接，所以那部分走 main 入口（index.cjs），client 只经 rpc 推文本、轮询状态。
//
// 这个入口只做装配：建 controller（运行时总装），然后把面板、播放页探针和命令注册进宿主的注册表，
// 其余实现都在 lib/ 与 ui/ 里。返回值是模组自己的清理函数，宿主停用 / 重载模组时会先调它，
// 再撤下本模组注册的所有条目。
//
// 想改行为的话先看这些位置：
//   lib/config.mjs      片段类型（含逐词歌词 / 播放时长）、五个目标、默认编排、预设、导入导出格式
//   lib/compose.mjs     片段列表 → 一行文本的拼接规则（进度条模板也在这里）
//   lib/clock.mjs       歌词行号与「精确排期到行时间戳 / 词时间戳」
//   lib/media-session.mjs 系统媒体接管层
//   ui/panel.mjs        设置面板；ui/fragment-list.mjs 单个目标栏的拖拽编辑器

// ------------------------------------------------------------- 模块版本戳
//
// 宿主导入入口用的是 `folia-mod://<id>/<client>?v=<内容摘要>`，规范里也写了「指纹变了就是新模块，
// 改完代码重载即生效」——但那只对**入口这一个文件**成立。
//
// 渲染进程的 ES 模块表是按**完整 URL** 缓存的，而相对导入解析出来的 URL 会把基准里的查询串丢掉：
// `./lib/config.mjs` 相对 `client.mjs?v=abc` 解析成 `lib/config.mjs`（没有 ?v=）。于是「改完文件 →
// 重新启用/重载模组」时，入口按新指纹重新求值，它 import 的同级文件却全部命中旧模块——面板上看不出
// 任何变化，只有重启整个应用才能生效（重启会换一个新的渲染进程，模块表随之清空）。
//
// 所以本模组每个文件的同级导入都带上自己 URL 里的查询串。这样一次加载里所有文件共享同一个指纹，
// 同一个模块从哪条路径进来都解析成同一个 URL（不会出现两份实例），而改过的模组整张模块图都是新的。
// `file://` 下 `search` 为空字符串，等价于普通相对导入。
const VERSION = new URL(import.meta.url).search;

const { PRESETS, SETTINGS_SCHEMA } = await import(`./lib/config.mjs${VERSION}`);
const { createController } = await import(`./lib/controller.mjs${VERSION}`);
const { createTranslator, pickLabel } = await import(`./lib/i18n.mjs${VERSION}`);
const { createPanelMount } = await import(`./ui/panel.mjs${VERSION}`);
const { createDiagnosticsStageMount } = await import(`./ui/diagnostics.mjs${VERSION}`);
const { copyText } = await import(`./ui/dom.mjs${VERSION}`);

/** 播放器面板里那个标签页的本地 id。 */
const TAB_ID = 'smtc';
/** 探针 / HUD 那个 stage 层的本地 id。 */
const STAGE_ID = 'diagnostics';

export default function activate(folium) {
  // 系统媒体与标签页标题只存在于主窗口。导出窗口里界面类注册表本来就是空实现、
  // 服务调用会抛错，所以在那里干脆什么都不注册。
  if (folium.env.context !== 'main') return undefined;

  const t = () => createTranslator(document.documentElement.lang || navigator.language);
  const toast = (message, type = 'info') => {
    try {
      folium.ui.toast(message, { type, durationMs: 2400 });
    } catch { /* 提示条失败不影响功能 */ }
  };

  let controller = null;
  let panelMount = null;

  // 面板挂载点在注册之后才建得出来（要先拿到 settingsSections 的设置句柄），
  // 所以这里先给一层惰性转发：宿主挂载发生在 activate 返回之后，一定拿得到真身。
  const section = folium.registries.settingsSections.register({
    id: 'panel',
    label: { 'zh-CN': 'SMTC 设置', en: 'SMTC settings' },
    description: {
      'zh-CN': '系统媒体三行与标签页标题的片段编排、歌词延迟、预设与导入导出。接管 Folia 自己的界面状态需要你在这里明确同意。',
      en: 'Fragment layout for the three system media rows and the tab title, lyric delay, presets, import/export. Taking over Folia’s own interface state needs your explicit consent here.',
    },
    settings: SETTINGS_SCHEMA,
    settingsPanel: (container, ctx) => panelMount?.(container, ctx),
  });

  // `section.settings` 是宿主给的设置读写面（get / set / onChange）；Folium 1.5 把它叫 `params`。
  controller = createController({ folium, settings: section.settings, log: folium.log });
  panelMount = createPanelMount({ folium, controller, variant: 'section' });

  // 播放器面板里的独立标签页：同一份界面，空间更宽裕。
  folium.registries.playerPanelTabs.register({
    id: TAB_ID,
    label: { 'zh-CN': 'SMTC 设置', en: 'SMTC settings' },
    order: 460,
    mount: createPanelMount({ folium, controller, variant: 'tab' }),
  });

  // 播放页上的诊断层。这个层始终注册，因为它是宿主歌词时钟的探针——
  // 只在播放页上，模组才能拿到与页面完全一致的歌词时钟和行号（见 lib/clock.mjs）；
  // HUD 开关只决定画不画那半透明的浮层。拿不到 stageLayers（清单没声明这个权限的旧宿主）时
  // 纯属少了个精度来源，功能照常。
  try {
    folium.registries.stageLayers.register({
      id: STAGE_ID,
      slot: 'player.stage.front',
      order: 900,
      interactive: false,
      mount: createDiagnosticsStageMount({
        controller,
        getTranslator: () => t(),
      }),
    });
  } catch (error) {
    folium.log.warn('diagnostics stage layer is unavailable; lyrics fall back to the playback-time estimate', error);
  }

  // ---------------------------------------------------------------- 命令
  // 功能性动作与设置都注册成命令，这样模组面板和命令面板里都能直接调用。
  const commands = folium.registries.commands;

  commands.register({
    id: 'open-panel',
    label: { 'zh-CN': '打开 SMTC 设置面板', en: 'Open the SMTC settings panel' },
    description: { 'zh-CN': '在播放器面板里打开片段编排与诊断。', en: 'Open the fragment editor and diagnostics in the player panel.' },
    keywords: ['smtc', 'system media', 'media session', 'tab title', '系统媒体', '标签页标题', '媒体浮窗', '封面'],
    run: () => {
      folium.ui.openPlayerPanel(TAB_ID);
      return { message: t()('message.panelOpened') };
    },
  });

  commands.register({
    id: 'apply-preset',
    label: { 'zh-CN': '套用 SMTC 预设', en: 'Apply an SMTC preset' },
    description: { 'zh-CN': '一键套用整套编排与相关选项。', en: 'Apply a whole layout and the options that go with it.' },
    keywords: ['smtc', 'preset', '预设', '编排', '模板'],
    params: [{
      key: 'preset',
      type: 'select',
      label: { 'zh-CN': '预设', en: 'Preset' },
      options: PRESETS.map((preset) => ({ value: preset.id, label: preset.label })),
      defaultValue: PRESETS[0].id,
    }],
    run: ({ values }) => {
      const preset = PRESETS.find((item) => item.id === values.preset);
      if (!preset || !controller.applyPreset(preset.id)) {
        return { message: t()('message.importFailed') };
      }
      return { message: `${t()('message.presetApplied')} · ${pickLabel(preset.label, document.documentElement.lang)}` };
    },
  });

  commands.register({
    id: 'toggle',
    label: { 'zh-CN': '开关 SMTC 自定义', en: 'Toggle SMTC customization' },
    description: { 'zh-CN': '关闭后系统媒体恢复宿主原本的三行。', en: 'Off restores the host’s own three rows.' },
    keywords: ['smtc', 'toggle', '开关', '系统媒体'],
    run: () => {
      const next = !controller.getConfig().options.enabled;
      controller.setOption('enabled', next);
      return { message: next ? t()('status.enabled') : t()('status.disabled') };
    },
  });

  commands.register({
    id: 'sync-mode',
    label: { 'zh-CN': 'SMTC 歌词延迟模式', en: 'SMTC lyric delay mode' },
    description: { 'zh-CN': '自动精确排期到行时间戳，或改为手动延迟。', en: 'Schedule to the line timestamps, or switch to a manual delay.' },
    keywords: ['smtc', 'lyric delay', 'sync', '歌词延迟', '同步'],
    params: [{
      key: 'mode',
      type: 'select',
      label: { 'zh-CN': '模式', en: 'Mode' },
      options: [
        { value: 'auto', label: { 'zh-CN': '自动（精确排期到行时间戳）', en: 'Auto (line timestamps)' } },
        { value: 'manual', label: { 'zh-CN': '手动（±3 秒）', en: 'Manual (±3 s)' } },
      ],
      defaultValue: 'auto',
    }],
    run: ({ values }) => {
      controller.setOption('lyricSyncMode', values.mode);
      return { message: controller.describeStatus() };
    },
  });

  commands.register({
    id: 'manual-offset',
    label: { 'zh-CN': '设置 SMTC 歌词手动延迟', en: 'Set the SMTC manual lyric delay' },
    description: { 'zh-CN': '正值推迟、负值提前，单位秒；会同时切到手动模式。', en: 'Positive delays, negative advances, in seconds; also switches to manual mode.' },
    keywords: ['smtc', 'offset', 'delay', '歌词延迟', '偏移'],
    params: [{
      key: 'seconds',
      type: 'number',
      label: { 'zh-CN': '延迟（秒）', en: 'Delay (s)' },
      min: -3,
      max: 3,
      step: 0.05,
      defaultValue: 0,
    }],
    run: ({ values }) => {
      const seconds = Number(values.seconds) || 0;
      controller.setOption('manualOffsetSeconds', seconds);
      controller.setOption('lyricSyncMode', 'manual');
      return { message: `${t()('option.manualOffset')} ${seconds >= 0 ? '+' : ''}${seconds.toFixed(2)} s` };
    },
  });

  commands.register({
    id: 'copy-config',
    label: { 'zh-CN': '复制 SMTC 配置 JSON', en: 'Copy the SMTC config JSON' },
    description: { 'zh-CN': '把当前编排与选项复制到剪贴板。', en: 'Copy the current layout and options to the clipboard.' },
    keywords: ['smtc', 'export', 'json', '导出', '复制', '配置'],
    run: async () => {
      const text = controller.getConfigText();
      const copied = await copyText(text);
      return { message: copied ? t()('message.copied') : t()('message.copyFailed') };
    },
  });

  commands.register({
    id: 'reset',
    label: { 'zh-CN': '重置 SMTC 配置', en: 'Reset the SMTC config' },
    description: { 'zh-CN': '编排与选项都回到默认值。', en: 'Restore the default layout and options.' },
    keywords: ['smtc', 'reset', 'default', '重置', '恢复默认'],
    run: () => {
      controller.resetConfig();
      return { message: t()('message.reset') };
    },
  });

  commands.register({
    id: 'diagnostics',
    label: { 'zh-CN': '查看 SMTC 诊断摘要', en: 'Show the SMTC diagnostics summary' },
    description: { 'zh-CN': '歌曲、歌曲 ID、歌词行数、播放进度与当前歌词。', en: 'Song, song id, lyric line count, progress and the current lyric.' },
    keywords: ['smtc', 'diagnostics', 'debug', '诊断', '排查', '歌词不显示'],
    run: () => ({ message: controller.describeStatus() }),
  });

  controller.start();

  return () => {
    controller.dispose();
  };
}
