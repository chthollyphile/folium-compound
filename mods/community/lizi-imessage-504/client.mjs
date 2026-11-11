// mods/lizi-imessage-504/client.mjs
// Folium client entry for LIZI's stage 504, "已发送": an iMessage conversation
// built out of the current song's lyric lines. Pure renderer code; no main
// entry, no permissions, no host services beyond the stage context.

/** @typedef {import('../folium').FoliumClientApi} Folium */
/** @typedef {import('../folium').FoliumSetting} FoliumSetting */

import { mountDelivered } from './stage.mjs';

/** @type {FoliumSetting[]} */
const settings = [
  {
    key: 'mode',
    type: 'select',
    label: { 'zh-CN': '镜头', en: 'Camera' },
    description: {
      'zh-CN': '自动运镜会随歌词切镜；「自由视角」可以直接拖手机、滚轮缩放。',
      en: 'Auto cuts between shots with the lyrics; Free lets you drag the phone and zoom with the wheel.',
    },
    defaultValue: 'auto',
    options: [
      { value: 'auto', label: { 'zh-CN': '自动运镜', en: 'Auto' } },
      { value: 'hold', label: { 'zh-CN': '固定视角', en: 'Hold a shot' } },
      { value: 'free', label: { 'zh-CN': '自由视角', en: 'Free camera' } },
    ],
  },
  {
    key: 'shot',
    type: 'select',
    label: { 'zh-CN': '固定在哪', en: 'Held shot' },
    description: {
      'zh-CN': '「固定视角」时使用的机位。',
      en: 'The shot used while the camera is held.',
    },
    defaultValue: '0',
    options: [
      { value: '0', label: { 'zh-CN': '① 近景·偏左', en: '1 Close, left' } },
      { value: '1', label: { 'zh-CN': '② 近景·偏右', en: '2 Close, right' } },
      { value: '2', label: { 'zh-CN': '③ 中景·左倾', en: '3 Medium, tilted left' } },
      { value: '3', label: { 'zh-CN': '④ 特写', en: '4 Close-up' } },
      { value: '4', label: { 'zh-CN': '⑤ 仰拍', en: '5 Low angle' } },
      { value: '5', label: { 'zh-CN': '⑥ 全景', en: '6 Wide' } },
      { value: '6', label: { 'zh-CN': '⑦ 微距', en: '7 Macro' } },
      { value: '7', label: { 'zh-CN': '⑧ 侧移', en: '8 Side drift' } },
    ],
  },
  {
    key: 'every',
    type: 'select',
    label: { 'zh-CN': '几句换一次镜', en: 'Cut every' },
    description: {
      'zh-CN': '自动运镜时，每几句歌词换一个机位。',
      en: 'How many lyric lines each shot lasts in Auto.',
    },
    defaultValue: '1',
    options: [
      { value: '1', label: { 'zh-CN': '每句都换', en: 'Every line' } },
      { value: '2', label: { 'zh-CN': '2 句', en: '2 lines' } },
      { value: '3', label: { 'zh-CN': '3 句', en: '3 lines' } },
      { value: '4', label: { 'zh-CN': '4 句', en: '4 lines' } },
    ],
  },
  {
    key: 'meta',
    type: 'boolean',
    label: { 'zh-CN': '左侧歌曲信息', en: 'Song info on the left' },
    description: {
      'zh-CN': '在画面左侧显示歌名、歌手与播放进度。',
      en: 'Show the title, artist and progress on the left of the stage.',
    },
    defaultValue: false,
  },
];

/** @param {Folium} folium */
export default function activate(folium) {
  folium.registries.visualizers.register({
    id: 'delivered',
    label: { 'zh-CN': '已发送', en: 'Delivered' },
    order: 504,
    mount: (container, ctx) => mountDelivered(folium, container, ctx),
    settings,
    // The stage paints its own full-screen black set and its own lyrics; the
    // host's background and bottom subtitles would sit on top of / behind it.
    hostLayers: { background: false, subtitles: false },
  });
}
