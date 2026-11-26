/**
 * bili-mv-cinema — 客户端入口（渲染进程，ESM）
 *
 * 一个入口 + 一个全屏层。设计原则是「不占地方」：
 *
 *   · 播放栏进度条右侧一个 26px 的 MV 按钮，是全部常驻 UI；
 *   · 点了才去找 MV、才建播放器，退出就把视频源卸掉（不留后台流量）；
 *   · 全屏层挂在宿主公开的 app.overlay 槽位上，不碰容器外任何宿主 DOM；
 *   · 打开时暂停 Folia 的音乐、播 MV 原声，退出把音乐接着放下去。
 *
 * 音画同步：DASH 模式下画面和声音是两条独立流，用 video + audio 双元素，
 * 每 800ms 校一次漂移；muxed 模式（720P 单文件）只有一个元素，天生同步。
 */

import qrcode from './vendor/qrcode.mjs';

// 二维码内容是 ASCII，但用 UTF-8 字节表更保险。
qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];

/** 音量、挑片记录、封面缓存都存在 folium.storage（模组自己的数据目录）里。 */
const VOL_KEY = 'volume';

const label = (zh, en) => ({ 'zh-CN': zh, en });

/* ------------------------------------------------------------------ *
 * 图标
 * ------------------------------------------------------------------ */

const ICON_MV = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M10 10.2v3.6l3.4-1.8z" fill="currentColor" stroke="none"/></svg>`;

/** 封面还没到时的占位：一格胶片 + 播放三角。比一块灰要好认，也和 MV 按钮是同一套形状。 */
const ICON_FRAME = `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2.6" y="4.8" width="18.8" height="14.4" rx="3.4"/><path d="M7.2 4.9v14.2M16.8 4.9v14.2" opacity=".5"/><path d="M10.7 9.5v5l4.1-2.5z" fill="currentColor" stroke="none"/></svg>`;

/* 行内 MV 图标已移除：往宿主歌曲列表里插按钮要认宿主的行结构、类名，还要从 DOM
 * 文本里读歌名歌手，这些都是 Folia 界面的实现细节，不是 Folium 接口，宿主一改版
 * 就会失效。入口保留进度条右侧的 MV 按钮与命令面板。 */

const ICON_BACK = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>`;

const ICON_CLOSE = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`;

const ICON_PLAY = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.4v13.2c0 .7.8 1.1 1.4.7l10-6.6c.5-.4.5-1.1 0-1.4l-10-6.6C8.8 4.3 8 4.7 8 5.4z"/></svg>`;

const ICON_PAUSE = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="5" width="4" height="14" rx="1.4"/><rect x="13.5" y="5" width="4" height="14" rx="1.4"/></svg>`;

const ICON_VOLUME = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.2L12 5.6v12.8L7.2 14.5H4z"/><path d="M15.6 9.2a4 4 0 010 5.6"/><path d="M18 6.6a7.6 7.6 0 010 10.8"/></svg>`;

const ICON_MUTED = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.2L12 5.6v12.8L7.2 14.5H4z"/><path d="M16.5 9.5l4.5 5M21 9.5l-4.5 5"/></svg>`;

/* 整窗全屏按钮已移除：宿主 preload 的私有通道不属于 Folium 公开接口，DOM 全屏
 * 在 Folia 这个窗口又不生效。全屏交给应用右上角自带的按钮，模组只用公开的
 * resize / fullscreenchange 事件跟随，让抽屉标题栏继续给窗口按钮让位。 */

const ICON_LINK = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M10.5 13.5a4 4 0 006 .5l2.2-2.2a4 4 0 00-5.7-5.7l-1.2 1.2"/><path d="M13.5 10.5a4 4 0 00-6-.5L5.3 12.2a4 4 0 005.7 5.7l1.2-1.2"/></svg>`;

const ICON_REPLAY = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10a8 8 0 111.8 7.4"/><path d="M4 5v5h5"/></svg>`;

const ICON_LIST = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h11M4 12h11M4 17h7"/><path d="M18.5 8.6v7.2c0 .5.6.8 1 .5l2.4-3.6a.6.6 0 000-.6l-2.4-3.6c-.4-.3-1 0-1 .5z" fill="currentColor" stroke="none"/></svg>`;

/** 换源：两条反向的箭头，意思是「换一支 MV」 */
const ICON_SWITCH = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8.5h12.5"/><path d="M13.5 5.5l3 3-3 3"/><path d="M20 15.5H7.5"/><path d="M10.5 12.5l-3 3 3 3"/></svg>`;

/** 定位到正在看的那首 */
const ICON_TARGET = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="6.6"/><circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none"/><path d="M12 2.6v2.6M12 18.8v2.6M2.6 12h2.6M18.8 12h2.6"/></svg>`;

/* ------------------------------------------------------------------ *
 * 样式（全部作用在自己这棵树上，shadow root 里也不会串出去）
 * ------------------------------------------------------------------ */

const CSS = `
.mv-root{position:absolute;inset:0;box-sizing:border-box;background:#000;color:#fff;
  font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Helvetica Neue",Arial,sans-serif;
  pointer-events:auto;display:none;opacity:0;transition:opacity .2s ease;overflow:hidden}
.mv-root[data-open="1"]{display:block}
.mv-root[data-shown="1"]{opacity:1}
.mv-root *{box-sizing:border-box}

.mv-video{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000;display:block}

/* 顶部信息条 */
.mv-top{position:absolute;top:0;left:0;right:0;display:flex;align-items:flex-start;gap:13px;
  padding:20px 24px 44px;background:linear-gradient(to bottom,rgba(0,0,0,.66),rgba(0,0,0,.28) 62%,rgba(0,0,0,0));
  transition:opacity .26s ease;pointer-events:none}
.mv-top>*{pointer-events:auto}
.mv-meta{min-width:0;flex:1;padding-top:2px}
.mv-title{font-size:16px;font-weight:600;line-height:1.35;letter-spacing:.01em;
  text-shadow:0 1px 10px rgba(0,0,0,.55);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mv-sub{display:flex;align-items:center;gap:8px;margin-top:6px;font-size:12px;color:rgba(255,255,255,.64);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mv-sub .mv-dot{width:3px;height:3px;border-radius:50%;background:rgba(255,255,255,.34);flex:none}
.mv-chip{flex:none;font-size:10px;font-weight:700;letter-spacing:.07em;padding:2px 6px;border-radius:5px;
  background:rgba(251,114,153,.2);color:#ffa8c0;border:1px solid rgba(251,114,153,.28)}

/* 按钮 */
.mv-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid rgba(255,255,255,.12);
  background:rgba(255,255,255,.09);color:#fff;border-radius:9px;padding:0;cursor:pointer;
  backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);transition:background .16s,transform .12s,border-color .16s;
  font:inherit;font-size:12px}
.mv-btn:hover{background:rgba(255,255,255,.19);border-color:rgba(255,255,255,.24)}
.mv-btn:active{transform:scale(.95)}
.mv-btn[disabled]{opacity:.4;cursor:default}
.mv-btn[data-active="1"]{background:rgba(251,114,153,.2);border-color:rgba(251,114,153,.42);color:#ffc2d4}
.mv-btn.round{width:36px;height:36px;border-radius:50%;flex:none}
.mv-btn.ghost{background:rgba(0,0,0,.34);border-color:rgba(255,255,255,.14)}
.mv-btn.tall{padding:0 11px;height:30px;border-radius:8px}
.mv-btn.compact{padding:0 9px}
.mv-btn.small{width:30px;height:30px;border-radius:8px;flex:none}

/* 底部控制条 */
.mv-bottom{position:absolute;left:0;right:0;bottom:0;padding:46px 24px 18px;
  background:linear-gradient(to top,rgba(0,0,0,.78),rgba(0,0,0,.34) 58%,rgba(0,0,0,0));
  transition:opacity .26s ease;pointer-events:none}
.mv-bottom>*{pointer-events:auto}
.mv-progress-row{display:flex;align-items:center;gap:12px}
.mv-time{font-size:11.5px;font-variant-numeric:tabular-nums;color:rgba(255,255,255,.72);min-width:42px;
  text-align:center;font-feature-settings:"tnum"}
.mv-track{position:relative;flex:1;height:18px;display:flex;align-items:center;cursor:pointer;touch-action:none}
.mv-track::before{content:"";position:absolute;left:0;right:0;height:4px;border-radius:3px;background:rgba(255,255,255,.22)}
.mv-fill{position:absolute;left:0;height:4px;border-radius:3px;background:#fff;width:0;pointer-events:none}
.mv-knob{position:absolute;left:0;width:11px;height:11px;border-radius:50%;background:#fff;
  transform:translateX(-50%);box-shadow:0 1px 7px rgba(0,0,0,.55);pointer-events:none;transition:transform .12s}
.mv-track:hover .mv-knob{transform:translateX(-50%) scale(1.18)}
.mv-controls{display:flex;align-items:center;gap:14px;margin-top:6px}
.mv-volume{display:flex;align-items:center;gap:8px}
.mv-range{-webkit-appearance:none;appearance:none;width:86px;height:16px;background:transparent;cursor:pointer}
.mv-range::-webkit-slider-runnable-track{height:4px;border-radius:3px;background:rgba(255,255,255,.26)}
.mv-range::-webkit-slider-thumb{-webkit-appearance:none;width:11px;height:11px;border-radius:50%;background:#fff;
  margin-top:-3.5px;box-shadow:0 1px 5px rgba(0,0,0,.5)}
.mv-spacer{flex:1}

/* 画质菜单 */
.mv-menu{position:absolute;right:0;bottom:calc(100% + 10px);min-width:156px;padding:6px;
  background:rgba(26,26,29,.97);border:1px solid rgba(255,255,255,.1);border-radius:12px;
  box-shadow:0 18px 44px rgba(0,0,0,.55);backdrop-filter:blur(20px);display:none;z-index:5}
.mv-menu[data-open="1"]{display:block}
.mv-menu-item{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 10px;border-radius:8px;
  font-size:12.5px;color:rgba(255,255,255,.88);cursor:pointer;white-space:nowrap}
.mv-menu-item:hover{background:rgba(255,255,255,.1)}
.mv-menu-item[data-active="1"]{color:#ffa8c0;font-weight:600}
.mv-menu-note{padding:6px 10px 3px;font-size:10.5px;color:rgba(255,255,255,.4);line-height:1.5;white-space:normal}
.mv-wrap-menu{position:relative;display:flex}

/* 中间层：加载 / 错误 / 点击播放 */
.mv-center{position:absolute;inset:0;display:none;align-items:center;justify-content:center;pointer-events:none}
.mv-center[data-open="1"]{display:flex}
.mv-card{pointer-events:auto;width:min(540px,88vw);max-height:78vh;overflow:auto;
  background:rgba(20,20,22,.94);border:1px solid rgba(255,255,255,.09);border-radius:18px;
  padding:24px 24px 18px;box-shadow:0 30px 90px rgba(0,0,0,.66);backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px)}
.mv-card::-webkit-scrollbar{width:8px}
.mv-card::-webkit-scrollbar-thumb{background:rgba(255,255,255,.16);border-radius:4px}
.mv-card-title{font-size:15px;font-weight:600;line-height:1.4}
.mv-card-text{margin-top:8px;font-size:12.5px;line-height:1.65;color:rgba(255,255,255,.58)}
.mv-card-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
.mv-load{padding:6px 2px}
.mv-load-row{display:flex;align-items:center;gap:13px}
.mv-spin{width:26px;height:26px;border-radius:50%;flex:none;
  border:2px solid rgba(255,255,255,.18);border-top-color:#fff;animation:mvspin .85s linear infinite}
@keyframes mvspin{to{transform:rotate(360deg)}}
.mv-search{display:flex;gap:8px;margin-top:14px}
.mv-input{flex:1;min-width:0;height:34px;padding:0 11px;border-radius:9px;color:#fff;font:inherit;font-size:12.5px;
  background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.13);outline:none}
.mv-input:focus{border-color:rgba(251,114,153,.55);background:rgba(255,255,255,.1)}
.mv-cands{margin-top:14px;display:flex;flex-direction:column;gap:2px}
.mv-cand{display:flex;gap:11px;padding:8px;border-radius:10px;cursor:pointer;text-align:left;border:0;background:transparent;
  color:inherit;font:inherit;align-items:center}
.mv-cand:hover{background:rgba(255,255,255,.07)}
.mv-cand-thumb{width:88px;height:50px;border-radius:7px;object-fit:cover;flex:none;background:rgba(255,255,255,.06)}
.mv-cand-body{min-width:0;flex:1}
.mv-cand-title{font-size:12.5px;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.mv-cand-meta{margin-top:3px;font-size:10.5px;color:rgba(255,255,255,.44);display:flex;gap:6px;align-items:center}
.mv-bigplay{pointer-events:auto;width:74px;height:74px;border-radius:50%;border:0;cursor:pointer;
  background:rgba(255,255,255,.14);color:#fff;display:flex;align-items:center;justify-content:center;
  backdrop-filter:blur(14px);transition:background .18s,transform .18s}
.mv-bigplay:hover{background:rgba(255,255,255,.24);transform:scale(1.04)}
.mv-bigplay svg{width:30px;height:30px;margin-left:3px}

/* 播放列表：右侧抽屉，跟 QQ 音乐一样把接下来要看的 MV 都摊开。
   底色通顶（跟播放页的侧栏一样有整块感），但标题栏的内容要让开宿主浮在右上角的
   那簇窗口按钮（上一首 / 播放 / 下一首 / 远程 / 全屏）—— 只让内容往下走，
   黑色背景不动，见 .mv-queue-head 的 padding-top。 */
.mv-queue{position:absolute;top:0;right:0;bottom:0;width:312px;display:flex;flex-direction:column;
  background:linear-gradient(to left,rgba(13,13,15,.97),rgba(13,13,15,.93));
  border-left:1px solid rgba(255,255,255,.07);
  backdrop-filter:blur(26px);-webkit-backdrop-filter:blur(26px);
  transform:translateX(101%);transition:transform .3s cubic-bezier(.22,.7,.3,1);
  pointer-events:auto;z-index:6}
.mv-queue[data-open="1"]{transform:translateX(0)}
/* 顶栏让位用固定值 40px（宿主顶栏 32px + 8px 间距），不扫描宿主 DOM —— 宿主的
 * 类名与结构不属于 Folium 接口。只作用在标题栏内容上，抽屉黑底仍然通顶。 */
.mv-queue-head{display:flex;align-items:center;gap:8px;
  padding:var(--mv-chrome-top,40px) 12px 10px 18px}
.mv-queue-title{font-size:13px;font-weight:600;letter-spacing:.02em}
.mv-queue-count{font-size:11px;color:rgba(255,255,255,.42);font-variant-numeric:tabular-nums}
.mv-queue-list{flex:1;min-height:0;overflow-y:auto;padding:2px 10px 18px}
.mv-queue-list::-webkit-scrollbar{width:6px}
.mv-queue-list::-webkit-scrollbar-thumb{background:rgba(255,255,255,.14);border-radius:3px}
.mv-qrow{display:flex;gap:10px;width:100%;align-items:center;padding:7px 8px;border:0;border-radius:9px;
  background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;transition:background .14s}
.mv-qrow:hover{background:rgba(255,255,255,.07)}
.mv-qrow[data-current="1"]{background:rgba(251,114,153,.14)}
.mv-qthumb{position:relative;width:78px;height:44px;border-radius:7px;overflow:hidden;flex:none;
  background:linear-gradient(135deg,rgba(255,255,255,.10),rgba(255,255,255,.045))}
.mv-qthumb img{width:100%;height:100%;object-fit:cover;display:block;opacity:0;transition:opacity .22s ease}
.mv-qthumb[data-loaded="1"] img{opacity:1}
/* 还没拿到封面时的那块底：圆角跟缩略图一致，描边用 inset 阴影（border 在圆角上会被切角） */
.mv-qph{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  border-radius:7px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.09);
  color:rgba(255,255,255,.38);transition:opacity .22s ease}
.mv-qbadge{position:absolute;left:4px;bottom:4px;font-size:9px;font-weight:700;letter-spacing:.04em;
  padding:1px 4px;border-radius:3px;background:rgba(0,0,0,.6);color:#ffa8c0}
.mv-qbadge[data-official="1"]{background:rgba(251,114,153,.86);color:#fff}
.mv-qbody{min-width:0;flex:1}
.mv-qtitle{font-size:12px;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;
  overflow:hidden}
.mv-qrow[data-current="1"] .mv-qtitle{color:#ffc2d4}
.mv-qsub{margin-top:2px;font-size:10.5px;color:rgba(255,255,255,.42);white-space:nowrap;overflow:hidden;
  text-overflow:ellipsis}
.mv-qbars{display:flex;align-items:flex-end;gap:2px;height:11px;flex:none;padding-left:2px}
.mv-qbars i{width:2px;border-radius:1px;background:#fb7299;animation:mvbars .95s ease-in-out infinite}
.mv-qbars i:nth-child(2){animation-delay:.18s}
.mv-qbars i:nth-child(3){animation-delay:.42s}
@keyframes mvbars{0%,100%{height:3px}50%{height:11px}}
.mv-qempty{padding:18px 12px;font-size:12px;line-height:1.7;color:rgba(255,255,255,.42)}

/* 定位到当前：滚过去之后闪一下，眼睛才跟得上（没有这一步经常「滚了但没看见」） */
.mv-qrow[data-flash="1"]{animation:mvqflash 1.15s ease-out}
@keyframes mvqflash{0%{background:rgba(251,114,153,.46)}100%{background:rgba(251,114,153,.14)}}

/* 换源：同一个抽屉样式，里面列同一首歌的其他 MV 投稿 */
.mv-src-search{display:flex;gap:6px;padding:0 12px 10px 14px}
.mv-src-search .mv-input{height:30px;font-size:12px}
.mv-src-list{flex:1;min-height:0;overflow-y:auto;padding:2px 10px 14px;display:flex;flex-direction:column;gap:2px}
.mv-src-list::-webkit-scrollbar{width:6px}
.mv-src-list::-webkit-scrollbar-thumb{background:rgba(255,255,255,.14);border-radius:3px}
.mv-srow{display:flex;gap:9px;width:100%;align-items:center;padding:7px 8px;border:0;border-radius:9px;
  background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;transition:background .14s}
.mv-srow:hover{background:rgba(255,255,255,.07)}
.mv-srow[data-current="1"]{background:rgba(251,114,153,.14)}
.mv-srow-thumb{position:relative;width:76px;height:43px;border-radius:7px;overflow:hidden;flex:none;
  background:linear-gradient(135deg,rgba(255,255,255,.10),rgba(255,255,255,.045))}
.mv-srow-thumb img{width:100%;height:100%;object-fit:cover;display:block;opacity:0;transition:opacity .22s ease}
.mv-srow-thumb[data-loaded="1"] img{opacity:1}
.mv-srow-thumb[data-loaded="1"] .mv-qph,.mv-qthumb[data-loaded="1"] .mv-qph{opacity:0}
.mv-srow-body{min-width:0;flex:1}
.mv-srow-title{font-size:12px;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;
  overflow:hidden}
.mv-srow[data-current="1"] .mv-srow-title{color:#ffc2d4}
.mv-srow-meta{margin-top:2px;font-size:10.5px;color:rgba(255,255,255,.42);white-space:nowrap;overflow:hidden;
  text-overflow:ellipsis}
.mv-srow-now{flex:none;font-size:9.5px;font-weight:700;letter-spacing:.04em;padding:2px 5px;border-radius:4px;
  background:rgba(251,114,153,.88);color:#fff}
.mv-src-note{padding:14px;font-size:11.5px;line-height:1.75;color:rgba(255,255,255,.42)}

/* 右侧抽屉（播放列表 / 换源）拉开时：控件让出右边那条 */
.mv-root[data-side="1"] .mv-top{right:312px}
.mv-root[data-side="1"] .mv-bottom{right:312px}

/* 控件自动隐藏 */
.mv-root[data-idle="1"] .mv-top,.mv-root[data-idle="1"] .mv-bottom{opacity:0;pointer-events:none}
.mv-root[data-idle="1"] .mv-top>*,.mv-root[data-idle="1"] .mv-bottom>*{pointer-events:none}
.mv-root[data-idle="1"]{cursor:none}
.mv-root[data-idle="1"] .mv-top,.mv-root[data-idle="1"] .mv-bottom{cursor:default}
`;

/* ------------------------------------------------------------------ *
 * 小工具
 * ------------------------------------------------------------------ */

function fmtTime(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function songTitleOf(song) {
  if (!song) return '';
  return String(song.title ?? song.name ?? '').trim();
}

function songArtistOf(song) {
  if (!song) return '';
  const list = Array.isArray(song.artists)
    ? song.artists
    : typeof song.artists === 'string'
      ? [song.artists]
      : song.artist
        ? [song.artist]
        : [];
  return list
    .map((entry) => (typeof entry === 'string' ? entry : String((entry && entry.name) || '')))
    .filter(Boolean)
    .join(' ');
}

/** 时长归一化成秒：song.duration 是秒，song.durationMs 是毫秒，旧字段还可能混着来。 */
function songDurationSec(song) {
  const raw = Number((song && (song.durationMs ?? song.duration)) ?? 0) || 0;
  if (!raw) return 0;
  return raw > 7200 ? raw / 1000 : raw;
}

function songKey(song) {
  return `${songTitleOf(song)}\u241F${songArtistOf(song)}`.toLowerCase();
}

/* ------------------------------------------------------------------ *
 * activate
 * ------------------------------------------------------------------ */

export default function activate(folium) {
  if (folium.env.context !== 'main') return;

  const log = folium.log;
  const hostMinor = (folium.host && folium.host.folium && folium.host.folium.minor) || 0;
  const supportsSecret = hostMinor >= 7;
  /** 宿主应用版本（0.8.0 起才有这个字段；老宿主为空）。只用于日志。 */
  const hostApp = String((folium.host && folium.host.folia) || '');

  /* 不使用宿主 preload 的私有通道：它不属于 Folium 公开接口。
   * 全屏只通过标准的 resize / fullscreenchange 事件跟随（重新给窗口按钮让位），
   * 不读取也不切换宿主的整窗全屏状态。 */

  /* ---------------------------------------------------------------- *
   * 设置
   * ---------------------------------------------------------------- */

  /**
   * 设置项的**顺序就是界面上看到的顺序**。
   *
   * 只留下「看 MV 这件事本身」的开关：暂停音乐、连播、画质、音量。
   */
  const schema = [
    {
      key: 'pauseMusic',
      type: 'boolean',
      defaultValue: true,
      label: label('看 MV 时暂停音乐', 'Pause the music while the MV plays'),
      description: label(
        '关掉的话两路声音会一起响 —— 除非你只是想看看画面。',
        'Turn it off and both soundtracks play at once.',
      ),
    },
    {
      key: 'autoNext',
      type: 'boolean',
      defaultValue: true,
      label: label('一段放完接着看下一首', 'Roll on to the next MV'),
      description: label(
        '按 Folia 的播放队列顺序连播：一支 MV 放完就切到队列里的下一首，MV 跟着换过去。关掉就停在最后一帧。',
        'Follows the queue order: when an MV ends, the next song in the queue starts and its MV loads.',
      ),
    },
    {
      key: 'quality',
      type: 'select',
      defaultValue: 'auto',
      label: label('画质上限', 'Quality cap'),
      description: label(
        '「自动」：登录了就要 1080P，没登录要 720P（未登录时 B 站多数视频只到 720P，个别能给 1080P）。大会员再把上限调到 1080P60 或 4K。',
        'Auto asks for 1080p when signed in, 720p otherwise. Premium accounts can raise the cap to 1080p60 / 4K.',
      ),
      options: [
        { value: 'auto', label: label('自动', 'Auto') },
        { value: '1080p60', label: label('1080P60', '1080p60') },
        { value: '1080p', label: label('1080P', '1080p') },
        { value: '720p', label: label('720P', '720p') },
        { value: '480p', label: label('480P', '480p') },
      ],
    },
    {
      key: 'volume',
      type: 'number',
      defaultValue: 90,
      min: 0,
      max: 100,
      step: 5,
      label: label('MV 音量（%）', 'MV volume (%)'),
      description: label('和 Folia 的音乐音量分开，只作用于 MV。', 'Separate from the music volume.'),
    },
  ];

  if (supportsSecret) {
    schema.push({
      key: 'cookie',
      type: 'secret',
      label: label('B 站 Cookie（登录用）', 'bilibili cookie (sign-in)'),
      description: label(
        '不填也能看，最高 720P。填了（或扫码登录）才有 1080P / 1080P60 / 4K。值由系统凭证库加密保存，不进设置值、不进日志、不进导出。',
        'Optional. Without it you still get 720p; SESSDATA unlocks 1080p and above. Encrypted by the OS credential store.',
      ),
    });
  }

  const section = folium.registries.settingsSections.register({
    id: 'cinema',
    label: label('MV 影院', 'MV cinema'),
    description: label(
      '播放栏的 MV 按钮点开就是全屏 MV，带原声。搜索、候选、画质都在全屏页里处理，不占主界面。',
      'The MV button in the player bar opens a full-screen MV player with its own audio.',
    ),
    settings: schema,
  });

  function rawSettings() {
    try {
      const holder = section && (section.params || section.settings);
      const value = holder && typeof holder.get === 'function' ? holder.get() : null;
      return value && typeof value === 'object' ? value : {};
    } catch {
      return {};
    }
  }

  /** 白名单归一化：手改配置、旧配置都不会把播放器带沟里。 */
  function settings() {
    const raw = rawSettings();
    const qualityList = ['auto', '1080p60', '1080p', '720p', '480p'];
    const volume = Number(raw.volume);
    return {
      quality: qualityList.includes(raw.quality) ? raw.quality : 'auto',
      pauseMusic: raw.pauseMusic !== false,
      autoNext: raw.autoNext !== false,
      volume: Number.isFinite(volume) ? clamp(volume, 0, 100) : 90,
    };
  }

  /* ---------------------------------------------------------------- *
   * 状态
   * ---------------------------------------------------------------- */

  const state = {
    open: false,
    phase: 'idle', // idle | loading | playing | error | blocked
    song: null,
    info: null,
    candidates: [],
    keyword: '',
    sourceIndex: 0,
    pausedHost: false,
    volume: 0.9,
    muted: false,
    qualityOverride: '',
    lastError: '',
    dragging: false,
    queueOpen: false,
    /**
     * 从播放列表点进来时记住那一行的队列下标。
     *
     * 点一行**不动宿主**（宿主一换歌就会跳到它自己的播放页，MV 页就没了）：
     * 宿主的位置留到退出影院时再同步过去，音乐从那首接着放。
     * null = 没点过列表，跟宿主当前的歌走。
     */
    queueIndex: null,
    /** 换源抽屉开着没（跟播放列表互斥） */
    sourceOpen: false,
    generation: 0,
  };

  const resolvedCache = new Map(); // songKey → info（同一个视频不重复取流）
  const pinned = new Map(); // songKey → bvid（用户手动挑过的）

  let pinnedLoaded = false;
  function loadPinned() {
    if (pinnedLoaded) return;
    pinnedLoaded = true;
    Promise.resolve(folium.storage.get('pinned'))
      .then((saved) => {
        if (saved && typeof saved === 'object') {
          for (const [key, bvid] of Object.entries(saved)) pinned.set(key, String(bvid));
        }
      })
      .catch(() => {});
  }

  let pinnedSaveTimer = 0;
  function persistPinned() {
    if (pinnedSaveTimer) clearTimeout(pinnedSaveTimer);
    pinnedSaveTimer = setTimeout(() => {
      pinnedSaveTimer = 0;
      Promise.resolve(folium.storage.set('pinned', Object.fromEntries(pinned))).catch(() => {});
    }, 400);
  }

  /* 音量记在 folium.storage（模组自己的数据目录），不写宿主页面的本地存储。
   * get 是异步的：先同步读缓存，异步读回来后再补一次 applyVolume；用户手动
   * 调过音量后就不再覆盖。 */
  let savedVolume = null;
  let volumePrimed = false;
  let volumeTouched = false;

  function primeVolume() {
    if (volumePrimed) return;
    volumePrimed = true;
    Promise.resolve(folium.storage.get(VOL_KEY))
      .then((value) => {
        if (value === null || value === undefined || value === '') return; // 没存过，别把 null 当成音量 0
        const n = Number(value);
        if (Number.isFinite(n) && n >= 0 && n <= 1) {
          savedVolume = n;
          if (state.open && !volumeTouched) {
            state.volume = n;
            applyVolume();
          }
        }
      })
      .catch(() => {});
  }

  function loadVolume() {
    primeVolume();
    return savedVolume != null ? savedVolume : settings().volume / 100;
  }

  function saveVolume() {
    volumeTouched = true;
    savedVolume = state.volume;
    Promise.resolve(folium.storage.set(VOL_KEY, state.volume)).catch(() => {});
  }

  /* ---------------------------------------------------------------- *
   * 宿主播放状态
   * ---------------------------------------------------------------- */

  function playbackState() {
    try {
      const playback = folium.playback;
      if (!playback || typeof playback.getState !== 'function') return null;
      const value = playback.getState();
      return value && typeof value === 'object' ? value : null;
    } catch {
      return null;
    }
  }

  function currentSong() {
    const value = playbackState();
    return mergeHostSong((value && value.song) || null, richCurrentSong());
  }

  /* ---- 0.8.0 的 song DTO 少了时长 / 封面，从宿主内部那份补齐 ---- */

  /**
   * 0.8.0 起宿主给模组的 song DTO 只剩 `{ id, title, artist, album, source, ref }`：
   * 时长、封面、多歌手都不在里面了。挑 MV 时时长是很硬的一条信号（对上了 +22 分），
   * 队列列表也要靠封面先顶上去，所以这里从宿主内部 store 里把它们补回来。
   *
   * 用 `folium.internals.stores`（宿主自己也在用同一份数据），全程 try/catch：
   * 哪天这个入口没了，最坏就是回到「没有时长、没有封面」，功能不受影响。
   *
   * 注意：`internals` 只在 manifest 声明 `folium: 1` 时可用（当前就是 1）。Folium 2
   * 会去掉 internals，迁移到 `folium: 2` 时这段要改用公开接口（或退化成没有时长 /
   * 封面），审查时也提示过这一点。
   */
  function hostPlaybackStore() {
    try {
      const stores = folium.internals && folium.internals.stores;
      const store = stores && stores.playback;
      if (!store || typeof store.getState !== 'function') return null;
      const snapshot = store.getState();
      return snapshot && typeof snapshot === 'object' ? snapshot : null;
    } catch {
      return null;
    }
  }

  function richCurrentSong() {
    const snapshot = hostPlaybackStore();
    return (snapshot && snapshot.currentSong) || null;
  }

  function richQueue() {
    const snapshot = hostPlaybackStore();
    const list = snapshot && snapshot.playQueue;
    return Array.isArray(list) ? list : null;
  }

  /** 把完整对象里的时长 / 封面 / 多歌手补到公开 DTO 上；不缺就原样返回同一个对象。 */
  function mergeHostSong(dto, rich) {
    if (!dto || !rich) return dto;
    const cover = (rich.album && typeof rich.album === 'object' && rich.album.coverUrl) || rich.coverUrl || '';
    const needDuration = songDurationSec(dto) <= 0;
    const needCover = !dto.coverUrl;
    const needArtists = !Array.isArray(dto.artists) || !dto.artists.length;
    if (!needDuration && !needCover && !needArtists) return dto;

    const merged = { ...dto };
    if (needDuration) {
      if (rich.durationMs) merged.durationMs = rich.durationMs;
      else if (rich.duration) merged.duration = rich.duration;
    }
    if (needArtists && Array.isArray(rich.artists) && rich.artists.length) merged.artists = rich.artists;
    if (needCover && cover) merged.coverUrl = cover;
    const albumName = rich.album && typeof rich.album === 'object' ? rich.album.name : '';
    if (albumName && !merged.album) merged.album = albumName;
    return merged;
  }

  function pauseHost() {
    const value = playbackState();
    if (!value) return;
    if (String(value.state) !== 'playing') {
      state.pausedHost = false;
      return;
    }
    try {
      folium.playback.pause();
      state.pausedHost = true;
    } catch {
      state.pausedHost = false;
    }
  }

  function resumeHost() {
    if (!state.pausedHost) return;
    state.pausedHost = false;
    try {
      folium.playback.play();
    } catch {
      /* 恢复不了就算了，用户按一下播放键一样 */
    }
  }

  /* ---------------------------------------------------------------- *
   * DOM
   * ---------------------------------------------------------------- */

  const root = document.createElement('div');
  root.className = 'mv-root';
  root.setAttribute('data-open', '0');

  const style = document.createElement('style');
  style.textContent = CSS;
  root.appendChild(style);

  const video = document.createElement('video');
  video.className = 'mv-video';
  video.playsInline = true;
  video.preload = 'auto';
  video.crossOrigin = 'anonymous';
  video.setAttribute('playsinline', '');
  root.appendChild(video);

  /** DASH 模式下的伴音轨。muxed 模式下不用它。 */
  const audio = document.createElement('audio');
  audio.preload = 'auto';
  audio.crossOrigin = 'anonymous';

  /* --- 顶部 --- */
  const top = document.createElement('div');
  top.className = 'mv-top';

  const btnBack = document.createElement('button');
  btnBack.type = 'button';
  btnBack.className = 'mv-btn ghost round';
  btnBack.title = '退出 MV（Esc）';
  btnBack.innerHTML = ICON_BACK;
  top.appendChild(btnBack);

  const meta = document.createElement('div');
  meta.className = 'mv-meta';
  const titleEl = document.createElement('div');
  titleEl.className = 'mv-title';
  titleEl.textContent = '';
  const subEl = document.createElement('div');
  subEl.className = 'mv-sub';
  meta.appendChild(titleEl);
  meta.appendChild(subEl);
  top.appendChild(meta);

  const btnLink = document.createElement('button');
  btnLink.type = 'button';
  btnLink.className = 'mv-btn ghost round';
  btnLink.title = '复制 B 站原视频链接';
  btnLink.innerHTML = ICON_LINK;
  top.appendChild(btnLink);

  const btnClose = document.createElement('button');
  btnClose.type = 'button';
  btnClose.className = 'mv-btn ghost round';
  btnClose.title = '关闭（Esc）';
  btnClose.innerHTML = ICON_CLOSE;
  top.appendChild(btnClose);

  root.appendChild(top);

  /* --- 中间层 --- */
  const center = document.createElement('div');
  center.className = 'mv-center';
  center.setAttribute('data-open', '0');
  root.appendChild(center);

  /** 加载态 */
  const loadBox = document.createElement('div');
  loadBox.className = 'mv-card';
  loadBox.style.display = 'none';
  loadBox.innerHTML = `
    <div class="mv-load">
      <div class="mv-load-row">
        <div class="mv-spin"></div>
        <div>
          <div class="mv-card-title">正在 B 站找这首歌的 MV…</div>
          <div class="mv-card-text" data-role="load-hint"></div>
        </div>
      </div>
    </div>`;
  center.appendChild(loadBox);

  /** 错误态 */
  const errorBox = document.createElement('div');
  errorBox.className = 'mv-card';
  errorBox.style.display = 'none';
  const errTitle = document.createElement('div');
  errTitle.className = 'mv-card-title';
  const errText = document.createElement('div');
  errText.className = 'mv-card-text';
  const searchRow = document.createElement('div');
  searchRow.className = 'mv-search';
  const searchInput = document.createElement('input');
  searchInput.className = 'mv-input';
  searchInput.type = 'text';
  searchInput.placeholder = '换个关键词试试，比如「歌名 歌手 MV」';
  const btnSearch = document.createElement('button');
  btnSearch.type = 'button';
  btnSearch.className = 'mv-btn tall';
  btnSearch.textContent = '重新搜索';
  searchRow.appendChild(searchInput);
  searchRow.appendChild(btnSearch);

  const candList = document.createElement('div');
  candList.className = 'mv-cands';

  const errActions = document.createElement('div');
  errActions.className = 'mv-card-actions';
  const btnExitErr = document.createElement('button');
  btnExitErr.type = 'button';
  btnExitErr.className = 'mv-btn tall';
  btnExitErr.textContent = '退出';
  errActions.appendChild(btnExitErr);

  errorBox.appendChild(errTitle);
  errorBox.appendChild(errText);
  errorBox.appendChild(searchRow);
  errorBox.appendChild(candList);
  errorBox.appendChild(errActions);
  center.appendChild(errorBox);

  /** 自动播放被拦时的大按钮 */
  const bigPlay = document.createElement('button');
  bigPlay.type = 'button';
  bigPlay.className = 'mv-bigplay';
  bigPlay.title = '开始播放';
  bigPlay.innerHTML = ICON_PLAY;
  bigPlay.style.display = 'none';
  center.appendChild(bigPlay);

  /* --- 底部 --- */
  const bottom = document.createElement('div');
  bottom.className = 'mv-bottom';

  const progressRow = document.createElement('div');
  progressRow.className = 'mv-progress-row';

  const timeNow = document.createElement('div');
  timeNow.className = 'mv-time';
  timeNow.textContent = '0:00';

  const track = document.createElement('div');
  track.className = 'mv-track';
  const fill = document.createElement('div');
  fill.className = 'mv-fill';
  const knob = document.createElement('div');
  knob.className = 'mv-knob';
  track.appendChild(fill);
  track.appendChild(knob);

  const timeTotal = document.createElement('div');
  timeTotal.className = 'mv-time';
  timeTotal.textContent = '0:00';

  progressRow.appendChild(timeNow);
  progressRow.appendChild(track);
  progressRow.appendChild(timeTotal);
  bottom.appendChild(progressRow);

  const controls = document.createElement('div');
  controls.className = 'mv-controls';

  const btnPlay = document.createElement('button');
  btnPlay.type = 'button';
  btnPlay.className = 'mv-btn round';
  btnPlay.title = '播放 / 暂停（空格）';
  btnPlay.innerHTML = ICON_PAUSE;
  controls.appendChild(btnPlay);

  const volumeWrap = document.createElement('div');
  volumeWrap.className = 'mv-volume';
  const btnMute = document.createElement('button');
  btnMute.type = 'button';
  btnMute.className = 'mv-btn round';
  btnMute.style.width = '30px';
  btnMute.style.height = '30px';
  btnMute.title = '静音';
  btnMute.innerHTML = ICON_VOLUME;
  const volumeRange = document.createElement('input');
  volumeRange.className = 'mv-range';
  volumeRange.type = 'range';
  volumeRange.min = '0';
  volumeRange.max = '100';
  volumeRange.step = '1';
  volumeRange.value = '90';
  volumeWrap.appendChild(btnMute);
  volumeWrap.appendChild(volumeRange);
  controls.appendChild(volumeWrap);

  const spacer = document.createElement('div');
  spacer.className = 'mv-spacer';
  controls.appendChild(spacer);

  const btnQueue = document.createElement('button');
  btnQueue.type = 'button';
  btnQueue.className = 'mv-btn tall';
  btnQueue.title = '播放列表（L）';
  btnQueue.innerHTML = `${ICON_LIST}<span>列表</span>`;
  controls.appendChild(btnQueue);

  /**
   * 换源：换的是**同一首歌的另一支 MV**（B 站上同一首歌往往有好几个投稿：
   * 官方号、节目片段、饭制）。挑片算法只保证「大概率对」，挑错了总得有个地方改。
   */
  const btnSwitch = document.createElement('button');
  btnSwitch.type = 'button';
  btnSwitch.className = 'mv-btn tall';
  btnSwitch.title = '换一个 MV 源（S）';
  btnSwitch.innerHTML = `${ICON_SWITCH}<span>换源</span>`;
  controls.appendChild(btnSwitch);

  const qualityWrap = document.createElement('div');
  qualityWrap.className = 'mv-wrap-menu';
  const btnQuality = document.createElement('button');
  btnQuality.type = 'button';
  btnQuality.className = 'mv-btn tall';
  btnQuality.textContent = '画质';
  qualityWrap.appendChild(btnQuality);

  const qualityMenu = document.createElement('div');
  qualityMenu.className = 'mv-menu';
  qualityMenu.setAttribute('data-open', '0');
  const QUALITY_OPTIONS = [
    ['auto', '自动'],
    ['1080p60', '1080P60'],
    ['1080p', '1080P'],
    ['720p', '720P'],
    ['480p', '480P'],
  ];
  for (const [value, text] of QUALITY_OPTIONS) {
    const item = document.createElement('div');
    item.className = 'mv-menu-item';
    item.setAttribute('data-role', 'quality');
    item.setAttribute('data-value', value);
    item.textContent = text;
    qualityMenu.appendChild(item);
  }
  const menuNote = document.createElement('div');
  menuNote.className = 'mv-menu-note';
  menuNote.textContent = '换画质会重新取流；未登录一般只有 720P。';
  qualityMenu.appendChild(menuNote);
  qualityWrap.appendChild(qualityMenu);
  controls.appendChild(qualityWrap);

  bottom.appendChild(controls);
  root.appendChild(bottom);

  /* --- 播放列表（右侧抽屉） --- */
  const queuePanel = document.createElement('aside');
  queuePanel.className = 'mv-queue';
  queuePanel.setAttribute('data-open', '0');

  const queueHead = document.createElement('div');
  queueHead.className = 'mv-queue-head';
  const queueTitle = document.createElement('div');
  queueTitle.className = 'mv-queue-title';
  queueTitle.textContent = '播放列表';
  const queueCount = document.createElement('div');
  queueCount.className = 'mv-queue-count';
  const queueSpacer = document.createElement('div');
  queueSpacer.className = 'mv-spacer';
  /** 定位：列表长起来之后一路往下滚，回头找不到「正在看的是哪首」，按一下就跳回去。 */
  const btnLocate = document.createElement('button');
  btnLocate.type = 'button';
  btnLocate.className = 'mv-btn ghost round';
  btnLocate.style.width = '28px';
  btnLocate.style.height = '28px';
  btnLocate.title = '定位到正在看的这首';
  btnLocate.innerHTML = ICON_TARGET;

  const btnQueueClose = document.createElement('button');
  btnQueueClose.type = 'button';
  btnQueueClose.className = 'mv-btn ghost round';
  btnQueueClose.style.width = '28px';
  btnQueueClose.style.height = '28px';
  btnQueueClose.title = '收起列表（L）';
  btnQueueClose.innerHTML = ICON_CLOSE;
  queueHead.appendChild(queueTitle);
  queueHead.appendChild(queueCount);
  queueHead.appendChild(queueSpacer);
  queueHead.appendChild(btnLocate);
  queueHead.appendChild(btnQueueClose);

  const queueList = document.createElement('div');
  queueList.className = 'mv-queue-list';

  queuePanel.appendChild(queueHead);
  queuePanel.appendChild(queueList);
  root.appendChild(queuePanel);

  /* --- 换源（右侧抽屉，跟播放列表同一个位置：同时只开一个） --- */
  const srcPanel = document.createElement('aside');
  srcPanel.className = 'mv-queue mv-src';
  srcPanel.setAttribute('data-open', '0');

  const srcHead = document.createElement('div');
  srcHead.className = 'mv-queue-head';
  const srcTitle = document.createElement('div');
  srcTitle.className = 'mv-queue-title';
  srcTitle.textContent = '换个 MV';
  const srcCount = document.createElement('div');
  srcCount.className = 'mv-queue-count';
  const srcSpacer = document.createElement('div');
  srcSpacer.className = 'mv-spacer';
  const btnSrcClose = document.createElement('button');
  btnSrcClose.type = 'button';
  btnSrcClose.className = 'mv-btn ghost round';
  btnSrcClose.style.width = '28px';
  btnSrcClose.style.height = '28px';
  btnSrcClose.title = '收起（S）';
  btnSrcClose.innerHTML = ICON_CLOSE;
  srcHead.appendChild(srcTitle);
  srcHead.appendChild(srcCount);
  srcHead.appendChild(srcSpacer);
  srcHead.appendChild(btnSrcClose);

  const srcSearch = document.createElement('div');
  srcSearch.className = 'mv-src-search';
  const srcInput = document.createElement('input');
  srcInput.className = 'mv-input';
  srcInput.type = 'text';
  srcInput.placeholder = '换个关键词，比如「歌名 歌手 MV」';
  const btnSrcSearch = document.createElement('button');
  btnSrcSearch.type = 'button';
  btnSrcSearch.className = 'mv-btn tall compact';
  btnSrcSearch.textContent = '搜';
  srcSearch.appendChild(srcInput);
  srcSearch.appendChild(btnSrcSearch);

  const srcList = document.createElement('div');
  srcList.className = 'mv-src-list';

  srcPanel.appendChild(srcHead);
  srcPanel.appendChild(srcSearch);
  srcPanel.appendChild(srcList);
  root.appendChild(srcPanel);

  /* ---------------------------------------------------------------- *
   * 播放器：源切换、同步、控件
   * ---------------------------------------------------------------- */

  let syncTimer = 0;
  let hideTimer = 0;
  let resumeTimer = 0;

  function stopSync() {
    if (syncTimer) {
      clearInterval(syncTimer);
      syncTimer = 0;
    }
  }

  function usingAudioTrack() {
    return Boolean(audio.src);
  }

  /** DASH 双元素：每 800ms 校一次漂移，超过 0.3 秒才纠正（免得一直听到小跳）。 */
  function startSync() {
    stopSync();
    if (!usingAudioTrack()) return;
    syncTimer = setInterval(() => {
      if (!state.open || video.paused || video.seeking) return;
      const drift = audio.currentTime - video.currentTime;
      if (Math.abs(drift) > 0.3) {
        try {
          audio.currentTime = video.currentTime;
        } catch {
          /* 还没 seekable，下次再来 */
        }
      }
      if (audio.paused) {
        const promise = audio.play();
        if (promise && typeof promise.catch === 'function') promise.catch(() => {});
      }
    }, 800);
  }

  function applyVolume() {
    const value = state.muted ? 0 : state.volume;
    if (usingAudioTrack()) {
      video.muted = true;
      audio.volume = value;
      audio.muted = state.muted;
    } else {
      video.muted = state.muted;
      video.volume = value;
    }
    volumeRange.value = String(Math.round(state.volume * 100));
    btnMute.innerHTML = state.muted || state.volume === 0 ? ICON_MUTED : ICON_VOLUME;
  }

  function seekTo(seconds) {
    const target = clamp(seconds, 0, Number.isFinite(video.duration) ? video.duration : seconds);
    try {
      video.currentTime = target;
    } catch {
      return;
    }
    if (usingAudioTrack()) {
      try {
        audio.currentTime = target;
      } catch {
        /* 音轨还没 ready */
      }
    }
    updateProgress();
  }

  function toggle() {
    if (!state.open) return;
    if (video.paused) {
      const promise = video.play();
      if (promise && typeof promise.catch === 'function') {
        promise.catch(() => showBlocked(true));
      }
      if (usingAudioTrack()) {
        const ap = audio.play();
        if (ap && typeof ap.catch === 'function') ap.catch(() => {});
      }
    } else {
      video.pause();
      audio.pause();
    }
    syncPlayIcon();
    poke();
  }

  function syncPlayIcon() {
    btnPlay.innerHTML = video.paused ? ICON_PLAY : ICON_PAUSE;
  }

  function updateProgress() {
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
    const current = video.currentTime || 0;
    const ratio = duration ? clamp(current / duration, 0, 1) : 0;
    fill.style.width = `${ratio * 100}%`;
    knob.style.left = `${ratio * 100}%`;
    timeNow.textContent = fmtTime(current);
    timeTotal.textContent = duration ? fmtTime(duration) : '0:00';
  }

  /* ---- 进度条拖动 ---- */

  function ratioFromEvent(event) {
    const rect = track.getBoundingClientRect();
    if (!rect.width) return 0;
    return clamp((event.clientX - rect.left) / rect.width, 0, 1);
  }

  track.addEventListener('pointerdown', (event) => {
    state.dragging = true;
    track.setPointerCapture(event.pointerId);
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    if (duration) seekTo(ratioFromEvent(event) * duration);
    poke();
  });

  track.addEventListener('pointermove', (event) => {
    if (!state.dragging) return;
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    if (duration) seekTo(ratioFromEvent(event) * duration);
  });

  const endDrag = (event) => {
    if (!state.dragging) return;
    state.dragging = false;
    try {
      track.releasePointerCapture(event.pointerId);
    } catch {
      /* 已经释放了 */
    }
    poke();
  };
  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);

  /* ---- 视频事件 ---- */

  video.addEventListener('timeupdate', () => {
    updateProgress();
  });
  video.addEventListener('durationchange', updateProgress);
  video.addEventListener('loadedmetadata', () => {
    updateProgress();
    startSync();
    syncPlayIcon();
  });
  video.addEventListener('play', () => {
    syncPlayIcon();
    poke();
    if (usingAudioTrack() && audio.paused) {
      const promise = audio.play();
      if (promise && typeof promise.catch === 'function') promise.catch(() => {});
    }
  });
  video.addEventListener('pause', () => {
    audio.pause();
    syncPlayIcon();
    // 不是 poke(true)：暂停只是把控件亮出来给人看状态，停手一样要收回去
    poke();
  });
  video.addEventListener('waiting', () => {
    if (state.phase === 'playing') showLoadingCard('缓冲中…', '网络慢的时候会这样，等一下就好。');
  });
  video.addEventListener('playing', () => {
    hideCenter();
    state.phase = 'playing';
    syncPlayIcon();
  });
  video.addEventListener('ended', () => {
    state.phase = 'playing';
    syncPlayIcon();
    poke(true);
    if (!state.open) return;
    if (!settings().autoNext) return;
    advanceQueue();
  });
  video.addEventListener('error', () => {
    if (!state.open) return;
    tryNextSource('视频源出错');
  });

  audio.addEventListener('error', () => {
    // 伴音轨挂了：退回画面自有音轨（muxed 时本来就有），至少别静音。
    log.info('MV 影院：伴音轨加载失败，改由视频自带音轨发声');
    audio.removeAttribute('src');
    video.muted = state.muted;
  });

  /* ---------------------------------------------------------------- *
   * 播放列表：右侧抽屉
   *
   * 数据来自宿主的播放队列（不是自己去搜一堆歌）：
   *   · 队列里每首歌先拿专辑封面顶上，能立刻显示；
   *   · 再把可视区前几首丢给 main 搜一下，搜到真 MV 就换成 MV 封面 + 角标；
   *   · 点一行 = 切到那首（宿主换歌，这边跟着换 MV）。
   * ---------------------------------------------------------------- */

  const thumbCache = new Map(); // songKey → { cover, official, bvid }
  const thumbInFlight = new Set(); // 已经问出去还没回来的 key，别重复发
  let thumbsRestored = false;

  function queueSnapshot() {
    try {
      const playback = folium.playback;
      if (!playback || typeof playback.getQueue !== 'function') return null;
      const snap = playback.getQueue({ limit: 100 });
      if (!snap || !Array.isArray(snap.items)) return null;
      // 0.8.0 的队列项只剩 { song, index }，时长/封面按 index 回宿主内部队列补齐。
      const rich = richQueue();
      if (!rich || rich.length !== snap.length) return snap;
      const items = snap.items.map((item) => {
        if (!item || !item.song) return item;
        const full = Number.isFinite(Number(item.index)) ? rich[Number(item.index)] : null;
        const merged = mergeHostSong(item.song, full);
        return merged === item.song ? item : { ...item, song: merged };
      });
      return { ...snap, items };
    } catch {
      return null;
    }
  }

  function thumbOf(key) {
    return thumbCache.get(key) || null;
  }

  function applyThumb(row, key) {
    const thumb = thumbOf(key);
    const box = row.querySelector('.mv-qthumb');
    const img = box && box.querySelector('img');
    const badge = row.querySelector('.mv-qbadge');
    if (!thumb || !thumb.cover) {
      if (badge) badge.style.display = 'none';
      return;
    }
    if (img && img.getAttribute('src') !== thumb.cover) {
      // 换了地址就重新走一遍「淡入」：旧图先落掉，不然会看到两张图叠着。
      if (box) box.setAttribute('data-loaded', '0');
      img.setAttribute('src', thumb.cover);
    }
    if (badge) {
      badge.style.display = '';
      badge.textContent = thumb.official ? '官方 MV' : 'MV';
      badge.setAttribute('data-official', thumb.official ? '1' : '0');
    }
  }

  /**
   * 封面表落盘。
   *
   * 「这首歌配的是哪支 MV」基本不变，把「歌 → 封面地址」记下来，下次开播放列表
   * 直接就是有图的状态 —— 不用再等一轮搜索 + 一轮图床。这是「打开就看得见」的关键。
   */
  let thumbSaveTimer = 0;
  function persistThumbs() {
    if (thumbSaveTimer) clearTimeout(thumbSaveTimer);
    thumbSaveTimer = setTimeout(() => {
      thumbSaveTimer = 0;
      const entries = [...thumbCache.entries()].slice(-200);
      Promise.resolve(folium.storage.set('thumbs', Object.fromEntries(entries))).catch(() => {});
    }, 800);
  }

  function restoreThumbs() {
    if (thumbsRestored) return;
    thumbsRestored = true;
    Promise.resolve(folium.storage.get('thumbs'))
      .then((saved) => {
        if (!saved || typeof saved !== 'object') return;
        let added = 0;
        for (const [key, value] of Object.entries(saved)) {
          if (!value || !value.cover || thumbCache.has(key)) continue;
          thumbCache.set(key, {
            cover: String(value.cover),
            official: Number(value.official) || 0,
            bvid: String(value.bvid || ''),
          });
          added += 1;
        }
        if (!added) return;
        // 恢复是异步的，列表可能已经画好了：把还在页面上的行改成有图的版本。
        for (const row of queueList.querySelectorAll('.mv-qrow')) {
          applyThumb(row, row.getAttribute('data-key') || '');
        }
      })
      .catch(() => {});
  }

  /**
   * 问一批封面。
   *
   * 拆成 3 个一组往后发：main 那边一首歌要搜一次 B 站（几百毫秒），8 首一起问
   * 就是「等最慢的那首」，界面上什么都出不来。小批走完一批就先贴一批，
   * 先看见前几行，后面的慢慢补 —— 观感上快很多。
   */
  async function loadThumbs(pending) {
    const ask = [];
    for (const entry of pending) {
      if (!entry || !entry.key) continue;
      if (thumbCache.has(entry.key) || thumbInFlight.has(entry.key)) continue;
      thumbInFlight.add(entry.key);
      ask.push(entry);
    }
    if (!ask.length) return;

    for (let start = 0; start < ask.length; start += 3) {
      const chunk = ask.slice(start, start + 3);
      let result = null;
      try {
        result = await folium.rpc.call('mvPreview', {
          items: chunk.map((entry) => ({
            key: entry.key,
            title: entry.title,
            artist: entry.artist,
            durationMs: entry.durationMs,
          })),
        });
      } catch (err) {
        log.info('MV 影院：播放列表缩略图没拿到', String((err && err.message) || err));
        for (const entry of chunk) thumbInFlight.delete(entry.key);
        continue;
      }

      const rows = Array.isArray(result && result.results) ? result.results : [];
      for (const item of rows) {
        if (!item || !item.key) continue;
        // 没搜到也落一条空记录：这一轮就不再为它反复发请求了。
        thumbCache.set(item.key, {
          cover: item.cover || '',
          official: Number(item.official) || 0,
          bvid: item.bvid || '',
        });
      }
      for (const entry of chunk) thumbInFlight.delete(entry.key);
      persistThumbs();
      // 每回来一批就先贴一批，不等整批
      refreshThumbsOnScreen();
    }

    // 长会话里别把整张表都留着
    while (thumbCache.size > 300) thumbCache.delete(thumbCache.keys().next().value);
  }

  /** 把缓存里已经有的封面贴到还活着的行上（异步回来的图靠它落位）。 */
  function refreshThumbsOnScreen() {
    for (const row of queueList.querySelectorAll('.mv-qrow')) {
      applyThumb(row, row.getAttribute('data-key') || '');
    }
  }

  /**
   * 可视区加载。
   *
   * 封面一首歌一次 B 站搜索，整条队列一次性去要又慢又浪费（用户可能只看前五行）。
   * 所以交给 IntersectionObserver：行滚进可视区（下面多留 180px 预读）才排队，
   * 攒 90ms 合成一个请求。用户往下滑，就跟着一条条补上来。
   */
  const rowMeta = new WeakMap(); // 行元素 → { key, title, artist, durationMs }
  const visibleQueue = new Map(); // key → meta，等着被问
  let thumbObserver = null;
  let visibleTimer = 0;

  function scheduleVisible() {
    if (visibleTimer) return;
    visibleTimer = window.setTimeout(() => {
      visibleTimer = 0;
      if (!visibleQueue.size) return;
      const batch = [];
      for (const [key, meta] of visibleQueue) {
        if (batch.length >= 9) break;
        visibleQueue.delete(key);
        batch.push(meta);
      }
      void loadThumbs(batch);
      if (visibleQueue.size) scheduleVisible();
    }, 90);
  }

  function ensureThumbObserver() {
    if (thumbObserver !== null) return;
    if (typeof IntersectionObserver !== 'function') return; // 老渲染器：退回整批问
    thumbObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const row = entry.target;
          thumbObserver.unobserve(row);
          const meta = rowMeta.get(row);
          if (!meta) continue;
          const known = thumbOf(meta.key);
          if (known && known.cover) {
            applyThumb(row, meta.key);
            continue;
          }
          visibleQueue.set(meta.key, meta);
        }
        scheduleVisible();
      },
      { root: queueList, rootMargin: '0px 0px 180px 0px', threshold: 0 },
    );
  }

  /** 登记一行：已经在缓存里的直接贴图，没有的挂到观察器上等它滚进来。 */
  function watchRow(row, meta) {
    rowMeta.set(row, meta);
    const known = thumbOf(meta.key);
    if (known && known.cover) return;
    if (thumbObserver) {
      thumbObserver.observe(row);
      return;
    }
    // 没有 IntersectionObserver（老宿主 / 测试环境）：直接问，别停在那儿不动
    void loadThumbs([meta]);
  }

  /* ---------------------------------------------------------------- *
   * 换源：同一首歌的其他 MV 投稿
   *
   * 候选来自上一次 resolveMv 顺带返回的 candidates（头部 6 个），不够就自己搜。
   * 点一个 = 记住（下次这首歌还用它）+ 直接按 bvid 取流，不重搜、不动宿主。
   * ---------------------------------------------------------------- */

  function renderSources() {
    srcList.innerHTML = '';
    const currentBvid = (state.info && state.info.bvid) || '';
    let list = Array.isArray(state.candidates) ? state.candidates : [];

    // 正在看的那支不一定还在候选里（手动挑过、或者按 bvid 直取过）：补一行在最前面，
    // 否则用户看不出现在放的是哪一个，也没法确认「已经切过去了」。
    if (currentBvid && !list.some((item) => item && item.bvid === currentBvid) && state.info) {
      list = [
        {
          bvid: currentBvid,
          title: state.info.title || currentBvid,
          author: state.info.author || '',
          cover: state.info.cover || '',
          duration: '',
          score: state.info.score,
          official: state.info.official || 0,
        },
        ...list,
      ];
    }
    srcCount.textContent = list.length ? `${list.length} 个` : '';

    if (!list.length) {
      const note = document.createElement('div');
      note.className = 'mv-src-note';
      note.textContent = '手上还没有别的候选。上面换个关键词搜一下，比如「歌名 歌手 MV」。';
      srcList.appendChild(note);
      return;
    }

    for (const item of list) {
      if (!item || !item.bvid) continue;
      const isCurrent = item.bvid === currentBvid;

      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'mv-srow';
      row.setAttribute('data-current', isCurrent ? '1' : '0');
      row.setAttribute('data-bvid', item.bvid);

      const thumb = document.createElement('div');
      thumb.className = 'mv-srow-thumb';
      const img = document.createElement('img');
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer'; // B 站图床认 Referer，一律不带
      img.addEventListener('load', () => thumb.setAttribute('data-loaded', '1'));
      img.addEventListener('error', () => thumb.setAttribute('data-loaded', '0'));
      if (item.cover) img.setAttribute('src', item.cover);
      thumb.appendChild(img);
      const holder = document.createElement('span');
      holder.className = 'mv-qph';
      holder.innerHTML = ICON_FRAME;
      thumb.appendChild(holder);
      row.appendChild(thumb);

      const body = document.createElement('div');
      body.className = 'mv-srow-body';
      const name = document.createElement('div');
      name.className = 'mv-srow-title';
      name.textContent = item.title || item.bvid;
      const meta = document.createElement('div');
      meta.className = 'mv-srow-meta';
      const parts = [item.author || '', item.duration || ''];
      if (item.official) parts.push('官方');
      // 十几秒的片段照样列出来，但标一下 —— 用户自己愿意点才点。
      if (item.short) parts.push('片段');
      if (Number.isFinite(item.score)) parts.push(`匹配 ${item.score}`);
      meta.textContent = parts.filter(Boolean).join(' · ');
      body.appendChild(name);
      body.appendChild(meta);
      row.appendChild(body);

      if (isCurrent) {
        const now = document.createElement('span');
        now.className = 'mv-srow-now';
        now.textContent = '正在看';
        row.appendChild(now);
      }

      row.addEventListener('click', () => {
        if (isCurrent) {
          folium.ui.toast('现在放的就是这一支', { durationMs: 1400 });
          return;
        }
        pickSource(item);
      });

      srcList.appendChild(row);
    }
  }

  /** 挑中一个候选：记下来（下次这首歌优先用它），再按 bvid 直接取流。 */
  function pickSource(item) {
    if (!item || !item.bvid) return;
    if (state.song) {
      pinned.set(songKey(state.song), item.bvid);
      persistPinned();
    }
    void resolve({ bvid: item.bvid });
  }

  async function searchSources() {
    const keyword = srcInput.value.trim();
    if (!keyword) {
      srcInput.focus();
      return;
    }
    btnSrcSearch.disabled = true;
    btnSrcSearch.textContent = '搜…';
    srcCount.textContent = '搜索中';
    let result = null;
    try {
      result = await folium.rpc.call('searchCandidates', {
        query: keyword,
        artist: songArtistOf(state.song),
      });
    } catch (err) {
      result = { ok: false, error: String((err && err.message) || err) };
    }
    btnSrcSearch.disabled = false;
    btnSrcSearch.textContent = '搜';
    if (!state.open) return;

    if (!result || !result.ok) {
      srcCount.textContent = '';
      srcList.innerHTML = '';
      const note = document.createElement('div');
      note.className = 'mv-src-note';
      note.textContent = /search-empty|no-candidate/.test(String((result && result.error) || ''))
        ? '这个关键词一条都没搜到。换个说法再试，比如「歌名 歌手 MV」。'
        : `没能搜成（${(result && result.error) || '未知原因'}）。`;
      srcList.appendChild(note);
      return;
    }

    state.candidates = Array.isArray(result.candidates) ? result.candidates : [];
    state.keyword = result.keyword || keyword;
    searchInput.value = state.keyword; // 错误卡片上那个输入框也跟着同步
    renderSources();
  }

  function renderQueue() {
    restoreThumbs(); // 先把上次存下来的封面认回来（异步，回来后会自己刷新已画的行）
    // 抽屉没开就不画：换歌时会调到这里，没必要为看不见的列表发请求。
    if (!state.queueOpen) return;

    const snap = queueSnapshot();
    queueList.innerHTML = '';

    if (!snap || !snap.items.length) {
      const empty = document.createElement('div');
      empty.className = 'mv-qempty';
      empty.textContent = '播放队列是空的。在 Folia 里放一张歌单，这里就会列出接下来要看的 MV。';
      queueList.appendChild(empty);
      queueCount.textContent = '';
      return;
    }

    // 正在看的这首未必在宿主队列里：从搜索列表 / 播放器侧栏点 MV 进来时，
    // 宿主队列还是它自己那张歌单，硬拿它的 currentIndex 去高亮就会标到另一首歌上
    // （画面上放的是「快点告诉你」，列表却高亮宿主正在放的「晴天」）。
    // 所以当前项一律按「歌」认；不在队列里，就把它单独置顶成一项。
    const currentKey = state.song ? songKey(state.song) : '';
    const queueIndex = Number.isFinite(state.queueIndex) ? state.queueIndex : null;
    // 整条队列都列出来（当前这首高亮）：点列表不再挪动宿主，往回点几首也该点得到。
    const listed = snap.items.filter((item) => item && item.song).slice(0, 60);
    const inQueue = Boolean(currentKey) && listed.some((item) => songKey(item.song) === currentKey);
    const items = currentKey && !inQueue ? [{ song: state.song, index: null }, ...listed] : listed;

    // 只报「这张列表里有多少首」。宿主的 length 可能是几百首的大歌单，而这里最多列 60 首，
    // 写「48/439」只会让人以为列表丢了东西；完整条数放在 hover 提示里。
    queueCount.textContent = items.length ? `${items.length} 首` : '';
    queueCount.title =
      Number(snap.length) > items.length
        ? `宿主队列共 ${snap.length} 首，这里列出 ${items.length} 首`
        : '';

    ensureThumbObserver();
    let marked = false;

    for (const item of items) {
      const song = item.song;
      const key = songKey(song);
      // 置顶那行没有队列下标 —— 别用 Number(null)（会变成 0，点到队列第一首上去）
      const index = item.index === null || item.index === undefined ? null : Number(item.index);
      // 同名同歌手就算当前这首；队列里有重复版本时只标第一处（置顶那行会先占掉）。
      const isCurrent = currentKey
        ? key === currentKey && !marked
        : index !== null && index === queueIndex;
      if (isCurrent) marked = true;
      // 屏幕上演的那首（state.song）就是它自己：封面手上就有，别再搜一遍。
      const isPlaying = isCurrent || (Boolean(currentKey) && key === currentKey);

      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'mv-qrow';
      row.setAttribute('data-key', key);
      row.setAttribute('data-current', isCurrent ? '1' : '0');

      // 正在播的这首不用再搜：手上就有它的 MV 封面（可能就是用户手动挑过的那个）。
      if (isPlaying && state.info && state.info.cover && !thumbOf(key)) {
        thumbCache.set(key, {
          cover: state.info.cover,
          official: state.info.official || 0,
          bvid: state.info.bvid || '',
        });
      }

      const thumb = document.createElement('div');
      thumb.className = 'mv-qthumb';
      const img = document.createElement('img');
      img.alt = '';
      img.loading = 'lazy';
      // 解码放到别的线程：十几张图一起进可视区时，别让主线程卡一下。
      img.decoding = 'async';
      // B 站图床认 Referer：从别的站点引用会 403，所以一律不带 Referer。
      img.referrerPolicy = 'no-referrer';
      img.addEventListener('load', () => thumb.setAttribute('data-loaded', '1'));
      img.addEventListener('error', () => thumb.setAttribute('data-loaded', '0'));
      const cachedThumb = thumbOf(key);
      const cover =
        (cachedThumb && cachedThumb.cover) || song.coverUrl || song.cover || song.picUrl || '';
      if (cover) img.setAttribute('src', cover);
      thumb.appendChild(img);

      // 图还没来（或者根本没有）时不是一块灰：画一个「影厅」的图标，跟界面上其他空态一个调子
      const holder = document.createElement('span');
      holder.className = 'mv-qph';
      holder.innerHTML = ICON_FRAME;
      thumb.appendChild(holder);

      const badge = document.createElement('span');
      badge.className = 'mv-qbadge';
      badge.style.display = 'none';
      thumb.appendChild(badge);
      row.appendChild(thumb);

      const body = document.createElement('div');
      body.className = 'mv-qbody';
      const name = document.createElement('div');
      name.className = 'mv-qtitle';
      name.textContent = songTitleOf(song) || '未知曲目';
      const sub = document.createElement('div');
      sub.className = 'mv-qsub';
      const seconds = songDurationSec(song);
      sub.textContent = [songArtistOf(song), seconds ? fmtTime(seconds) : ''].filter(Boolean).join(' · ');
      body.appendChild(name);
      body.appendChild(sub);
      row.appendChild(body);

      if (isCurrent) {
        const bars = document.createElement('div');
        bars.className = 'mv-qbars';
        bars.innerHTML = '<i></i><i></i><i></i>';
        row.appendChild(bars);
      }

      if (cachedThumb) applyThumb(row, key);

      row.addEventListener('click', () => {
        // 置顶那行就是正在看的这首（它不在宿主队列里，没有下标可点）：回到开头
        if (!Number.isFinite(index)) {
          seekTo(0);
          return;
        }
        void playQueueRow(index);
      });

      queueList.appendChild(row);

      // 封面不等列表整批画完才问：行滚进可视区才排队，滑到哪儿问到哪儿。
      // 正在播的这首手上就有图，不用再搜。
      if (!isPlaying || !thumbOf(key)) {
        watchRow(row, {
          key,
          title: songTitleOf(song),
          artist: songArtistOf(song),
          durationMs: seconds * 1000,
        });
      }
    }

    refreshThumbsOnScreen();
  }

  function queueItemAt(index) {
    const snap = queueSnapshot();
    if (!snap) return null;
    return snap.items.find((item) => item && Number(item.index) === index) || null;
  }

  /**
   * 点播放列表里的一行：**就地放这一行的 MV**。
   *
   * 关键是「不碰宿主」：宿主的 playQueueItem / playSong 会顺手打开它自己的播放页，
   * 把 MV 页顶掉 —— 用户看到的就是「点了列表里的某一支 MV，却跳去歌曲播放界面」。
   * 所以看片期间只记下这一行的队列下标（退出影院时再让宿主跟过去），
   * 画面这一边用这一行已经搜到的 bvid 直接取流；没有 bvid 才按它的歌名搜一次。
   */
  async function playQueueRow(index) {
    if (!Number.isFinite(index)) return;
    const entry = queueItemAt(index);
    const song = entry && entry.song;
    if (!song) return;

    const key = songKey(song);
    const sameSong = Boolean(state.song) && key === songKey(state.song);

    if (sameSong && state.phase === 'playing' && state.queueIndex === index) {
      seekTo(0);
      return;
    }

    const cached = thumbOf(key);
    const bvid = (cached && cached.bvid) || pinned.get(key) || '';

    state.queueIndex = index;
    state.song = song;
    state.generation += 1;
    state.keyword = '';
    state.candidates = [];
    state.qualityOverride = '';
    clearMedia();
    applyVolume();
    renderQueue();

    if (bvid) void resolve({ bvid });
    else void resolve({});
  }

  /** 两个抽屉共用右边那一条：谁开都让控件往左让 312px。 */
  function syncSide() {
    if (state.queueOpen || state.sourceOpen) root.setAttribute('data-side', '1');
    else root.removeAttribute('data-side');
  }

  function setQueueOpen(flag) {
    state.queueOpen = Boolean(flag);
    if (state.queueOpen) {
      // 同一块地方不叠两层：开列表就把换源收起来
      state.sourceOpen = false;
      srcPanel.setAttribute('data-open', '0');
      btnSwitch.setAttribute('data-active', '0');
    }
    queuePanel.setAttribute('data-open', state.queueOpen ? '1' : '0');
    btnQueue.setAttribute('data-active', state.queueOpen ? '1' : '0');
    syncSide();
    if (state.queueOpen) {
      renderQueue();
      scrollToCurrent(false); // 拉开就落在正在看的那首上，不用自己往下翻
      poke(true);
    }
  }

  function setSourceOpen(flag) {
    state.sourceOpen = Boolean(flag);
    if (state.sourceOpen) {
      state.queueOpen = false;
      queuePanel.setAttribute('data-open', '0');
      btnQueue.setAttribute('data-active', '0');
    }
    srcPanel.setAttribute('data-open', state.sourceOpen ? '1' : '0');
    btnSwitch.setAttribute('data-active', state.sourceOpen ? '1' : '0');
    syncSide();
    if (state.sourceOpen) {
      srcInput.value = state.keyword || '';
      renderSources();
      poke(true);
    }
  }

  /**
   * 定位到正在看的那首：滚到列表中间，再闪一下。
   *
   * 不用 scrollIntoView —— 它会把整个文档一起挪，宿主那边跟着抖；
   * 这里只算行在列表里的偏移，动列表自己的 scrollTop。
   */
  function scrollToCurrent(smooth) {
    const row = queueList.querySelector('.mv-qrow[data-current="1"]');
    if (!row) return;
    // 行的 offsetTop 是相对抽屉算的，要减掉列表自己的位置（头那一条）
    const rowTop = (Number(row.offsetTop) || 0) - (Number(queueList.offsetTop) || 0);
    const rowHeight = Number(row.offsetHeight) || 0;
    const viewHeight = Number(queueList.clientHeight) || 0;
    // 没有布局信息（jsdom）时算出 0，等于滚到顶，也不抛
    const target = Math.max(0, rowTop - Math.max(0, viewHeight - rowHeight) / 2);
    if (smooth && typeof queueList.scrollTo === 'function') {
      queueList.scrollTo({ top: target, behavior: 'smooth' });
    } else {
      queueList.scrollTop = target;
    }
    row.setAttribute('data-flash', '1');
    window.setTimeout(() => row.removeAttribute('data-flash'), 1200);
  }

  /** MV 放完：队列里还有下一首就接着放它的 MV（同样不动宿主）。 */
  function advanceQueue() {
    const snap = queueSnapshot();
    if (!snap) return false;
    const total = Number(snap.length) || snap.items.length;
    const currentIndex = Number.isFinite(state.queueIndex)
      ? state.queueIndex
      : Number.isFinite(snap.currentIndex)
        ? snap.currentIndex
        : 0;
    if (currentIndex + 1 >= total) return false;
    void playQueueRow(currentIndex + 1);
    return true;
  }

  /* ---- 加载 / 错误 / 拦截 三种中间态 ---- */

  function showCenter(kind) {
    center.setAttribute('data-open', kind ? '1' : '0');
    loadBox.style.display = kind === 'loading' ? 'block' : 'none';
    errorBox.style.display = kind === 'error' ? 'block' : 'none';
    bigPlay.style.display = kind === 'blocked' ? 'flex' : 'none';
    if (kind) root.removeAttribute('data-idle');
  }

  function showLoadingCard(title, hint) {
    showCenter('loading');
    const titleNode = loadBox.querySelector('.mv-card-title');
    const hintNode = loadBox.querySelector('[data-role="load-hint"]');
    if (titleNode) titleNode.textContent = title;
    if (hintNode) hintNode.textContent = hint || '';
  }

  function hideCenter() {
    showCenter('');
  }

  function showBlocked(flag) {
    if (flag) showCenter('blocked');
    else hideCenter();
  }

  function errorText(code) {
    const raw = String(code || '');
    if (/search-empty/.test(raw)) return 'B 站没搜到相关的视频。可以换个说法，或者干脆输「歌名 + MV」。';
    // 分P投稿的 P1 经常只有十几秒（预告 / 切片），这种一律不算 MV。
    if (/only-short-clips/.test(raw)) {
      return '搜到的都只有十几秒（分P里的预告、切片之类），没有完整的 MV。换个关键词试试，比如「歌名 歌手 MV」。';
    }
    if (/too-short/.test(raw)) return '这一支只有十几秒，不是完整的 MV。换下面一个候选试试。';
    if (/no-candidate|no-playable-url/.test(raw)) return '搜到了，但没有能播的源（可能被版权或地区限制）。试试换一个候选。';
    if (/search--412/.test(raw)) return '被 B 站的风控拦了一下。过一会儿再点，或者在设置里扫码登录（登录态下风控更宽松）。';
    if (/bad-json|http-|bili-timeout|ECONN|ENOTFOUND|socket/i.test(raw)) {
      return `网络没能连上 B 站（${raw}）。检查一下网络，或者稍后重试。`;
    }
    if (/view-|playurl/.test(raw)) return `B 站返回了异常（${raw}）。换一个候选通常就好了。`;
    return raw || '未知原因';
  }

  function renderCandidates(list) {
    candList.innerHTML = '';
    if (!list || !list.length) return;
    for (const item of list) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'mv-cand';

      const thumb = document.createElement('img');
      thumb.className = 'mv-cand-thumb';
      thumb.loading = 'lazy';
      thumb.referrerPolicy = 'no-referrer';
      if (item.cover) thumb.src = item.cover;
      row.appendChild(thumb);

      const body = document.createElement('div');
      body.className = 'mv-cand-body';
      const name = document.createElement('div');
      name.className = 'mv-cand-title';
      name.textContent = item.title || item.bvid;
      const metaLine = document.createElement('div');
      metaLine.className = 'mv-cand-meta';
      const parts = [item.author || '', item.duration ? String(item.duration) : ''];
      if (item.short) parts.push('片段');
      if (Number.isFinite(item.score)) parts.push(`匹配 ${item.score}`);
      metaLine.textContent = parts.filter(Boolean).join(' · ');
      body.appendChild(name);
      body.appendChild(metaLine);
      row.appendChild(body);

      row.addEventListener('click', () => {
        if (state.song) {
          pinned.set(songKey(state.song), item.bvid);
          persistPinned();
        }
        void resolve({ bvid: item.bvid, keyword: '' });
      });
      candList.appendChild(row);
    }
  }

  function showError(code, candidates) {
    state.phase = 'error';
    state.lastError = String(code || '');
    errTitle.textContent = '这次没看成';
    errText.textContent = errorText(code);
    searchInput.value = state.keyword || '';
    renderCandidates(candidates || []);
    showCenter('error');
    syncPlayIcon();
  }

  /* ---- 取流 ---- */

  function clearMedia() {
    stopSync();
    try {
      video.pause();
    } catch {
      /* ignore */
    }
    video.removeAttribute('src');
    video.load();
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    state.info = null;
    state.sourceIndex = 0;
    timeNow.textContent = '0:00';
    timeTotal.textContent = '0:00';
    fill.style.width = '0%';
    knob.style.left = '0%';
  }

  function playSource(info, index) {
    const source = info.sources && info.sources[index];
    if (!source) {
      showError('no-playable-url', info.candidates);
      return;
    }
    state.sourceIndex = index;
    state.info = info;
    state.phase = 'loading';
    showLoadingCard('正在载入 MV…', '');
    if (state.sourceOpen) renderSources(); // 「正在看」的标记要跟着换

    video.src = source.video;
    if (source.audio) {
      audio.src = source.audio;
      video.muted = true;
    } else {
      audio.removeAttribute('src');
      video.muted = state.muted;
    }
    applyVolume();

    const promise = video.play();
    if (promise && typeof promise.catch === 'function') {
      promise.catch(() => {
        if (!state.open) return;
        state.phase = 'playing';
        showBlocked(true);
        syncPlayIcon();
      });
    }
    if (source.audio) {
      const ap = audio.play();
      if (ap && typeof ap.catch === 'function') ap.catch(() => {});
    }
    startSync();
  }

  function tryNextSource(reason) {
    const info = state.info;
    if (info && info.sources && state.sourceIndex + 1 < info.sources.length) {
      log.info(`MV 影院：${reason}，换下一个源（${info.sources[state.sourceIndex + 1].kind}）`);
      playSource(info, state.sourceIndex + 1);
      return;
    }
    if (info) {
      clearMedia();
      showError('no-playable-url', info.candidates);
    }
  }

  async function resolve(options = {}) {
    const song = state.song;
    if (!song && !options.bvid && !options.keyword) {
      showError('no-song-title');
      return;
    }

    const generation = ++state.generation;
    state.phase = 'loading';
    showLoadingCard(
      options.keyword ? `按「${options.keyword}」重新搜…` : '正在 B 站找这首歌的 MV…',
      options.bvid ? '' : '拿歌名和歌手名去搜，按标题、UP 主、时长挑最像官方的那个。',
    );

    const quality = state.qualityOverride || settings().quality;
    const payload = {
      title: songTitleOf(song),
      artist: songArtistOf(song),
      durationMs: songDurationSec(song) * 1000,
      quality,
      bvid: options.bvid || '',
      query: options.keyword || '',
    };

    let result;
    try {
      result = await folium.rpc.call('resolveMv', payload);
    } catch (err) {
      if (generation !== state.generation) return;
      showError(String((err && err.message) || err));
      return;
    }

    if (generation !== state.generation || !state.open) return;

    if (!result || !result.ok) {
      state.keyword = (result && result.keyword) || payload.query || '';
      showError((result && result.error) || 'unknown', (result && result.candidates) || []);
      return;
    }

    state.keyword = result.keyword || '';
    if (song) resolvedCache.set(songKey(song), result);
    applyInfo(result);
    playSource(result, 0);
  }

  /** 把头部信息画出来。 */
  function applyInfo(info) {
    const song = state.song;
    const title = songTitleOf(song) || info.title || 'MV';
    titleEl.textContent = title;

    subEl.innerHTML = '';
    const chip = document.createElement('span');
    chip.className = 'mv-chip';
    chip.textContent = info.official ? '官方 MV' : 'MV';
    subEl.appendChild(chip);

    const artist = songArtistOf(song);
    if (artist) {
      subEl.appendChild(document.createTextNode(artist));
    }

    const qualityLabel = info.quality && info.quality.label ? info.quality.label : '';
    if (qualityLabel) {
      const dot = document.createElement('span');
      dot.className = 'mv-dot';
      subEl.appendChild(dot);
      subEl.appendChild(document.createTextNode(qualityLabel));
    }
    if (info.typename && info.typename !== 'MV') {
      const dot = document.createElement('span');
      dot.className = 'mv-dot';
      subEl.appendChild(dot);
      subEl.appendChild(document.createTextNode(info.typename));
    }
    if (info.mode === 'silent') {
      const dot = document.createElement('span');
      dot.className = 'mv-dot';
      subEl.appendChild(dot);
      const warn = document.createElement('span');
      warn.textContent = '这条没有音轨';
      subEl.appendChild(warn);
    }

    btnQuality.textContent = qualityLabel || '画质';
    for (const item of qualityMenu.querySelectorAll('[data-role="quality"]')) {
      const active = item.getAttribute('data-value') === (state.qualityOverride || settings().quality);
      item.setAttribute('data-active', active ? '1' : '0');
    }

    // 换源面板列的就是这批候选（resolveMv 顺带返回的头部 6 个）。
    // 按 bvid 直取时 main 那边没有候选表，别把手上这份冲掉 —— 不然换过去就回不来。
    if (Array.isArray(info.candidates) && info.candidates.length) {
      state.candidates = info.candidates;
    }
  }

  /* ---- 打开 / 关闭 ---- */

  function kickoff() {
    poke(true);
    root.setAttribute('data-open', '1');
    requestAnimationFrame(() => root.setAttribute('data-shown', '1'));
    document.addEventListener('keydown', onKey, true);
  }

  /**
   * 进影院。
   *
   * `songOverride` 只在「从宿主列表那一行的 MV 图标进来」时给：那个时点这首歌并
   * 不是宿主的当前曲目（用户只是想看它的 MV），拿宿主的 currentSong 就放错了。
   */
  function open(songOverride) {
    if (state.open) {
      // 已经开着：换成刚点的那一首，不再走一遍「打开」的流程
      const next = songOverride || currentSong();
      if (next && (!state.song || songKey(next) !== songKey(state.song))) followSong(next);
      return;
    }
    const song = songOverride || currentSong();
    if (!song) {
      folium.ui.toast('现在没有正在播放的歌', { durationMs: 1600 });
      return;
    }

    state.open = true;
    state.song = song;
    state.volume = loadVolume();
    state.muted = false;
    state.qualityOverride = '';
    state.candidates = [];
    state.keyword = '';
    state.queueIndex = null;
    setQueueOpen(false);
    setSourceOpen(false);

    kickoff();
    if (settings().pauseMusic) pauseHost();
    applyVolume();

    const cached = resolvedCache.get(songKey(song));
    if (cached) {
      state.keyword = cached.keyword || '';
      applyInfo(cached);
      playSource(cached, 0);
      return;
    }

    const mine = pinned.get(songKey(song));
    void resolve(mine ? { bvid: mine } : {});
  }

  /**
   * 换歌：MV 跟着换，而不是关掉。
   *
   * 队列连播、宿主媒体键切歌都会走到这里。真的没歌声了才关。
   * （在播放列表里点的那一行不走这条路 —— 那条路压根不动宿主。）
   */
  function followSong(song) {
    state.song = song;
    state.generation += 1;
    state.keyword = '';
    state.candidates = [];
    state.qualityOverride = '';
    state.queueIndex = null;
    clearMedia();
    if (settings().pauseMusic) pauseHost();
    applyVolume();
    renderQueue();

    const cached = resolvedCache.get(songKey(song));
    if (cached) {
      state.keyword = cached.keyword || '';
      applyInfo(cached);
      playSource(cached, 0);
      return;
    }

    const mine = pinned.get(songKey(song));
    void resolve(mine ? { bvid: mine } : {});
  }

  /**
   * 把宿主的队列位置挪到刚看的那首 —— **只在退出影院之后做**。
   *
   * 原因：宿主的 playQueueItem / playSong 会顺手打开它自己的播放页，把 MV 页顶掉。
   * 这就是「在列表里点了某一支 MV，却跳去歌曲播放界面」的根源。所以看片期间一律不动宿主，
   * 等 MV 收起来了再把位置补上，音乐从那首接着放。
   */
  function syncHostTo(index) {
    state.pausedHost = false;
    const snap = queueSnapshot();
    const hostIndex = snap && Number.isFinite(snap.currentIndex) ? snap.currentIndex : -1;

    // 切成了就让宿主自己放；没切成（宿主拒收 / 老宿主没这接口）也把刚才那首接着放。
    const settle = () => {
      try {
        folium.playback.play();
      } catch {
        /* 宿主这时可能正在换歌，等它自己稳下来 */
      }
    };

    if (hostIndex === index) {
      settle();
      return;
    }

    Promise.resolve(folium.playback.playQueueItem(index))
      .then(settle)
      .catch((err) => {
        log.info('MV 影院：退出时没能把宿主队列切过去', String((err && err.message) || err));
        settle();
      });
  }

  function close(resume = true) {
    if (!state.open) return;
    const watched = state.queueIndex; // 列表里点的那一行；没点过是 null
    state.queueIndex = null;
    state.open = false;
    state.generation += 1;
    state.phase = 'idle';
    document.removeEventListener('keydown', onKey, true);
    hideCenter();
    clearMedia();
    setQueueOpen(false);
    setSourceOpen(false);
    root.setAttribute('data-shown', '0');
    root.setAttribute('data-idle', '0');
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = 0;
    }
    if (resumeTimer) {
      clearTimeout(resumeTimer);
      resumeTimer = 0;
    }
    resumeTimer = window.setTimeout(() => {
      resumeTimer = 0;
      if (!state.open) root.setAttribute('data-open', '0');
    }, 220);

    if (watched !== null && resume) syncHostTo(watched);
    else if (resume) resumeHost();
    else state.pausedHost = false;
  }

  /* ---- 头顶让位 ----
   *
   * 宿主把窗口按钮浮在窗口右上角，播放列表 / 换源的标题栏原来从顶边开始画，正好
   * 压在按钮底下。现在改用一个**固定值** `--mv-chrome-top: 40px`（见 CSS，宿主顶栏
   * 32px + 8px 间距）把标题栏内容往下让，抽屉黑底仍然通顶。
   *
   * 以前是扫宿主所有 button 量出这一簇的底边 —— 那依赖宿主的 DOM 结构和类名，
   * 不属于 Folium 接口，正式发布不能用，所以整段测量删掉了。
   */

  /* ---- 控件自动隐藏 ---- */

  function poke(force) {
    root.removeAttribute('data-idle');
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = 0;
    }
    // 暂停时也要收：以前只在播放中收，暂停后进度条/音量就永远挂在那儿，
    // 想好好看一帧画面的时候很碍事。拖动进度条时不收，不然松手前就没了。
    const shouldHide =
      state.open &&
      state.phase === 'playing' &&
      !force &&
      !state.dragging &&
      !state.queueOpen &&
      !state.sourceOpen;
    if (!shouldHide) return;
    hideTimer = window.setTimeout(() => {
      hideTimer = 0;
      if (state.open && !state.dragging && !state.queueOpen && !state.sourceOpen) {
        root.setAttribute('data-idle', '1');
      }
    }, 2800);
  }

  root.addEventListener('mousemove', () => poke());
  root.addEventListener('pointerdown', () => poke());

  /* ---- 键盘 ---- */

  function onKey(event) {
    if (!state.open) return;

    // 在搜索框里打字：除了 Esc，别的键都交给输入框。
    const tag = event.target && event.target.tagName ? String(event.target.tagName) : '';
    const typing = tag === 'INPUT' || tag === 'TEXTAREA';

    if (event.key === 'Escape') {
      if (typing) {
        event.target.blur();
        return;
      }
      if (state.sourceOpen) {
        setSourceOpen(false);
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (state.queueOpen) {
        setQueueOpen(false);
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      close();
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (typing) return;

    if (event.code === 'Space' || event.key === ' ') {
      toggle();
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (event.key === 'ArrowLeft') {
      seekTo((video.currentTime || 0) - 5);
      poke();
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (event.key === 'ArrowRight') {
      seekTo((video.currentTime || 0) + 5);
      poke();
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (event.key === 'l' || event.key === 'L') {
      setQueueOpen(!state.queueOpen);
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (event.key === 's' || event.key === 'S') {
      setSourceOpen(!state.sourceOpen);
      event.preventDefault();
      event.stopPropagation();
      return;
    }
  }

  /* ---- 按钮 ---- */

  btnBack.addEventListener('click', () => close());
  btnClose.addEventListener('click', () => close());
  btnPlay.addEventListener('click', () => toggle());
  btnQueue.addEventListener('click', () => setQueueOpen(!state.queueOpen));
  btnQueueClose.addEventListener('click', () => setQueueOpen(false));
  btnLocate.addEventListener('click', () => scrollToCurrent(true));
  btnSwitch.addEventListener('click', () => setSourceOpen(!state.sourceOpen));
  btnSrcClose.addEventListener('click', () => setSourceOpen(false));
  btnSrcSearch.addEventListener('click', () => void searchSources());
  srcInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    event.stopPropagation();
    void searchSources();
  });

  bigPlay.addEventListener('click', () => {
    showBlocked(false);
    toggle();
  });

  /**
   * 点画面本身就能播放 / 暂停。
   *
   * 以前只有左下角那个按钮和空格能控制，鼠标在画面上时还得先找到按钮 ——
   * 跟 QQ 音乐、YouTube 一样，画面就是最大的那个播放键。
   * 中间弹出来的卡片（加载失败、被拦截）上点不算，那上面有自己的按钮。
   */
  root.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (!state.open) return;
    // 点在控件、卡片、播放列表上：那是它们自己的事
    if (target.closest('.mv-top, .mv-bottom, .mv-queue, .mv-center, .mv-login, .mv-src')) return;
    if (!video.getAttribute('src')) return; // 还没取到流：画面是黑的，点了也没意义
    toggle();
  });

  btnMute.addEventListener('click', () => {
    state.muted = !state.muted;
    applyVolume();
  });

  volumeRange.addEventListener('input', () => {
    const value = clamp(Number(volumeRange.value) / 100, 0, 1);
    state.volume = value;
    state.muted = value === 0;
    applyVolume();
    saveVolume();
  });

  btnQuality.addEventListener('click', (event) => {
    event.stopPropagation();
    const openNow = qualityMenu.getAttribute('data-open') === '1';
    qualityMenu.setAttribute('data-open', openNow ? '0' : '1');
  });

  qualityMenu.addEventListener('click', (event) => {
    const item = event.target instanceof Element ? event.target.closest('[data-role="quality"]') : null;
    if (!item) return;
    const value = item.getAttribute('data-value') || 'auto';
    qualityMenu.setAttribute('data-open', '0');
    state.qualityOverride = value;
    if (state.info) {
      const labelText = item.textContent || '';
      btnQuality.textContent = labelText;
    }
    void resolve({ bvid: state.info ? state.info.bvid : '', keyword: state.keyword });
  });

  function onDocumentClick(event) {
    if (qualityMenu.getAttribute('data-open') !== '1') return;
    if (event.composedPath && event.composedPath().includes(qualityWrap)) return;
    qualityMenu.setAttribute('data-open', '0');
  }
  document.addEventListener('click', onDocumentClick);

  btnLink.addEventListener('click', () => {
    const url = (state.info && state.info.url) || '';
    if (!url) return;
    const copy = navigator.clipboard && navigator.clipboard.writeText(url);
    if (copy && typeof copy.then === 'function') {
      copy
        .then(() => folium.ui.toast('B 站链接已复制', { type: 'success', durationMs: 1600 }))
        .catch(() => folium.ui.toast(url, { durationMs: 3000 }));
    } else {
      folium.ui.toast(url, { durationMs: 3000 });
    }
  });

  btnSearch.addEventListener('click', () => {
    const keyword = searchInput.value.trim();
    if (!keyword) {
      searchInput.focus();
      return;
    }
    void resolve({ keyword });
  });

  searchInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    event.stopPropagation();
    btnSearch.click();
  });

  btnExitErr.addEventListener('click', () => close());

  /* ---------------------------------------------------------------- *
   * 行内 MV 图标已整条移除
   *
   * 之前的做法是靠宿主歌曲列表行的类名与结构定位，往里插按钮、再从 DOM 文本里
   * 读歌名歌手。这些是 Folia 界面的实现细节，不属于 Folium 接口；宿主一改版
   * 按钮就会消失或插错位置，读出来的歌名也可能不对，所以正式发布不能依赖。
   *
   * 现在入口只保留两处：进度条右侧的 MV 按钮、命令面板的「看这首歌的 MV」。
   * 如果以后确实需要「行级按钮」，要向宿主申请公开接口（folium.ui / 行级槽位），
   * 不在模组里猜宿主 DOM。
   * ---------------------------------------------------------------- */

  log.info(
    `MV 影院：客户端就绪（Folia ${hostApp || '未知'} / 模组 API 1.${hostMinor}）`,
  );

  /* ---------------------------------------------------------------- *
   * 注册
   * ---------------------------------------------------------------- */

  // 进度条右侧的 MV 按钮 —— 全模组唯一的常驻 UI。
  const disposeButton = folium.registries.progressButtons.register({
    id: 'open-cinema',
    slot: 'progress.trailing',
    order: 380,
    hideWhenCollapsed: true,
    mount(container, ctx) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.title = '看这首歌的 MV';
      btn.setAttribute('aria-label', '看这首歌的 MV');

      let color = 'inherit';
      try {
        const colors = ctx && typeof ctx.getColors === 'function' ? ctx.getColors() : null;
        if (colors && colors.text) color = colors.text;
      } catch {
        /* 老宿主没有 getColors */
      }

      btn.style.cssText =
        'display:flex;align-items:center;justify-content:center;width:26px;height:26px;border:0;' +
        'background:transparent;border-radius:7px;padding:0;cursor:pointer;flex:none;' +
        `color:${color};transition:background .15s,opacity .15s;`;
      btn.innerHTML = ICON_MV;

      btn.addEventListener('mouseenter', () => {
        btn.style.background = 'rgba(127,127,127,.16)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = 'transparent';
      });

      let disposed = false;
      const sync = () => {
        if (disposed) return;
        const song = currentSong();
        btn.style.opacity = song ? '1' : '.35';
        btn.style.cursor = song ? 'pointer' : 'default';
      };

      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        open();
      });

      const unsubscribers = [];
      try {
        if (folium.events && typeof folium.events.on === 'function') {
          unsubscribers.push(folium.events.on('playback.songChanged', sync));
        }
      } catch {
        /* 没有事件总线就算了，按钮照样能点 */
      }

      sync();
      container.appendChild(btn);

      return () => {
        disposed = true;
        for (const off of unsubscribers) {
          try {
            if (typeof off === 'function') off();
            else if (off && typeof off.unsubscribe === 'function') off.unsubscribe();
          } catch {
            /* ignore */
          }
        }
        btn.remove();
      };
    },
  });

  // 全屏层。interactive 留 false：宿主那层 pointer-events:none，
  // 由我们自己的 .mv-root 打开 auto，关掉时整棵树 display:none，绝不吃点击。
  const disposeLayer = folium.registries.stageLayers.register({
    id: 'cinema',
    slot: 'app.overlay',
    order: 940,
    interactive: false,
    mount(container) {
      container.appendChild(root);
      return () => {
        close(false);
        root.remove();
      };
    },
  });

  // 换歌：MV 跟着换（宿主媒体键 / 自动下一首都走这条路）。
  const unsubscribers = [];
  function subscribe(name, handler) {
    try {
      if (!folium.events || typeof folium.events.on !== 'function') return;
      const off = folium.events.on(name, handler);
      unsubscribers.push(off);
    } catch {
      /* ignore */
    }
  }

  subscribe('playback.songChanged', ({ song }) => {
    if (!state.open) return;
    if (!song) {
      close(false);
      return;
    }
    if (state.song && songKey(song) === songKey(state.song)) return;
    followSong(song);
  });

  subscribe('playback.queueChanged', () => {
    if (state.open && state.queueOpen) renderQueue();
  });

  subscribe('playback.stateChanged', ({ state: next }) => {
    // 用户在后台把音乐又按了播放（媒体键 / 遥控窗口）：MV 开着时压回去。
    if (!state.open || !settings().pauseMusic) return;
    if (!next || String(next) !== 'playing') return;
    if (!state.pausedHost) return;
    try {
      folium.playback.pause();
    } catch {
      /* ignore */
    }
  });

  subscribe('account.changed', () => {
    resolvedCache.clear();
  });

  /* ---- 命令面板 ---- */

  const disposeCommands = [
    folium.registries.commands.register({
      id: 'open-cinema',
      label: label('看这首歌的 MV', 'Watch this song’s MV'),
      keywords: ['mv', 'bilibili', 'b站', '视频', '全屏', 'cinema'],
      run() {
        const song = currentSong();
        if (!song) return '现在没有正在播放的歌';
        open();
        return `正在找《${songTitleOf(song)}》的 MV`;
      },
    }),
    folium.registries.commands.register({
      id: 'login',
      label: label('B站账号：扫码登录（解锁 1080P）', 'bilibili: sign in by QR'),
      keywords: ['b站', 'bilibili', '扫码', '登录', 'cookie', '1080p'],
      run() {
        openLogin();
        return '正在打开扫码登录';
      },
    }),
    folium.registries.commands.register({
      id: 'status',
      label: label('B站账号：检查登录状态', 'bilibili: check sign-in'),
      keywords: ['b站', 'bilibili', '登录', '状态', 'cookie'],
      async run() {
        let status;
        try {
          status = await folium.rpc.call('biliStatus');
        } catch (err) {
          return `检查失败：${String((err && err.message) || err)}`;
        }
        if (!status || !status.ok) return `检查失败：${(status && status.error) || 'unknown'}`;
        if (!status.loggedIn) {
          return status.hasCookie
            ? 'Cookie 读到了，但 B 站说没登录 —— SESSDATA 大概过期了，重新扫一次'
            : '还没登录：命令面板「B站账号：扫码登录」，或设置里粘 Cookie';
        }
        const plan = status.vip ? '大会员：1080P60 / 4K 可用' : '普通账号：最高 1080P';
        folium.ui.toast(`已登录：${status.uname}（${plan}）`, { type: 'success', durationMs: 3000 });
        return `已登录：${status.uname} · ${plan}`;
      },
    }),
  ];

  /* ---------------------------------------------------------------- *
   * 扫码登录
   *
   * 画二维码要 qrcode 那个库；不用它也行 —— 退化成「把链接贴到浏览器」。
   * ---------------------------------------------------------------- */

  let loginUi = null;

  function openLogin() {
    if (!supportsSecret) {
      folium.ui.toast('当前 Folium 版本没有 secret 字段，扫码登录用不了（需要 1.7+）', {
        type: 'error',
        durationMs: 4200,
      });
      return;
    }
    if (loginUi) {
      loginUi.show();
      return;
    }

    const wrap = document.createElement('div');
    wrap.style.cssText =
      'position:fixed;inset:0;z-index:2147483000;display:none;align-items:center;justify-content:center;' +
      'background:rgba(0,0,0,.62);backdrop-filter:blur(6px);pointer-events:auto;';

    const card = document.createElement('div');
    card.style.cssText =
      'width:320px;padding:22px;border-radius:16px;background:#1c1c1f;color:#fff;' +
      'font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;' +
      'box-shadow:0 26px 72px rgba(0,0,0,.62);border:1px solid rgba(255,255,255,.08);text-align:center;';
    wrap.appendChild(card);

    const heading = document.createElement('div');
    heading.textContent = '扫码登录 B 站';
    heading.style.cssText = 'font-size:15px;font-weight:600;';
    card.appendChild(heading);

    const hint = document.createElement('div');
    hint.textContent = '登录后 MV 能拿到 1080P / 1080P60 / 4K';
    hint.style.cssText = 'margin-top:6px;font-size:11.5px;color:rgba(255,255,255,.55);line-height:1.6;';
    card.appendChild(hint);

    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    canvas.style.cssText = 'margin:16px auto 0;display:block;border-radius:10px;background:#fff;padding:8px;';
    card.appendChild(canvas);

    const stateText = document.createElement('div');
    stateText.textContent = '正在向 B 站要二维码…';
    stateText.style.cssText = 'margin-top:12px;font-size:12px;color:rgba(255,255,255,.62);min-height:18px;';
    card.appendChild(stateText);

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:8px;justify-content:center;margin-top:14px;';
    const btnRefresh = document.createElement('button');
    btnRefresh.type = 'button';
    btnRefresh.textContent = '换一张';
    const btnClose = document.createElement('button');
    btnClose.type = 'button';
    btnClose.textContent = '关闭';
    for (const btn of [btnRefresh, btnClose]) {
      btn.style.cssText =
        'height:30px;padding:0 12px;border-radius:8px;border:1px solid rgba(255,255,255,.14);' +
        'background:rgba(255,255,255,.08);color:#fff;font-size:12px;cursor:pointer;';
      actions.appendChild(btn);
    }
    card.appendChild(actions);

    document.body.appendChild(wrap);

    let key = '';
    let timer = 0;
    let stopped = false;

    const stopPoll = () => {
      stopped = true;
      if (timer) {
        clearTimeout(timer);
        timer = 0;
      }
    };

    const paint = (text) => {
      if (text) stateText.textContent = text;
    };

    const poll = async () => {
      if (stopped || !key) return;
      let result;
      try {
        result = await folium.rpc.call('qrPoll', key);
      } catch {
        timer = window.setTimeout(poll, 2500);
        return;
      }
      if (stopped) return;

      if (result && result.state === 'confirmed' && result.cookie) {
        try {
          await folium.secrets.set('cookie', result.cookie);
          folium.ui.toast('B 站登录成功，MV 画质已解锁', { type: 'success', durationMs: 3000 });
        } catch (err) {
          paint(`登录成功，但写进凭证库失败：${String((err && err.message) || err)}`);
          return;
        }
        resolvedCache.clear();
        hide();
        return;
      }

      if (result && result.state === 'expired') {
        paint(result.message || '二维码过期了，点「换一张」');
        return;
      }

      paint((result && result.message) || '等待扫码…');
      timer = window.setTimeout(poll, 2000);
    };

    const draw = (text) => {
      try {
        const qr = qrcode(0, 'M');
        qr.addData(text);
        qr.make();
        const count = qr.getModuleCount();
        const ctx = canvas.getContext('2d');
        const size = canvas.width;
        const cell = size / (count + 8);
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = '#111';
        for (let row = 0; row < count; row += 1) {
          for (let col = 0; col < count; col += 1) {
            if (qr.isDark(row, col)) {
              ctx.fillRect(cell * (col + 4), cell * (row + 4), Math.ceil(cell), Math.ceil(cell));
            }
          }
        }
      } catch (err) {
        log.error('二维码生成失败', String((err && err.message) || err));
        paint('二维码画不出来，点「换一张」试试');
      }
    };

    const refresh = async () => {
      stopped = false;
      paint('正在向 B 站要二维码…');
      let result;
      try {
        result = await folium.rpc.call('qrGenerate');
      } catch (err) {
        paint(`要二维码失败：${String((err && err.message) || err)}`);
        return;
      }
      if (!result || !result.ok) {
        paint(`要二维码失败：${(result && result.error) || 'unknown'}`);
        return;
      }
      key = result.key;
      draw(result.url);
      paint('用 B 站 App 扫一下');
      stopPoll();
      stopped = false;
      timer = window.setTimeout(poll, 1800);
    };

    const show = () => {
      wrap.style.display = 'flex';
      void refresh();
    };

    const hide = () => {
      stopPoll();
      wrap.style.display = 'none';
    };

    btnRefresh.addEventListener('click', () => void refresh());
    btnClose.addEventListener('click', () => hide());
    wrap.addEventListener('click', (event) => {
      if (event.target === wrap) hide();
    });

    loginUi = { show, hide, dispose: () => { stopPoll(); wrap.remove(); loginUi = null; } };
    show();
  }



  /* ---------------------------------------------------------------- *
   * 退出
   * ---------------------------------------------------------------- */
  return () => {
    close(false);
    document.removeEventListener('click', onDocumentClick);
    for (const off of unsubscribers) {
      try {
        if (typeof off === 'function') off();
        else if (off && typeof off.unsubscribe === 'function') off.unsubscribe();
      } catch {
        /* ignore */
      }
    }
    for (const handle of disposeCommands) {
      try {
        if (typeof handle === 'function') handle();
        else if (handle && typeof handle.unregister === 'function') handle.unregister();
      } catch {
        /* ignore */
      }
    }
    try {
      if (typeof disposeLayer === 'function') disposeLayer();
      else if (disposeLayer && disposeLayer.unregister) disposeLayer.unregister();
      if (typeof disposeButton === 'function') disposeButton();
      else if (disposeButton && disposeButton.unregister) disposeButton.unregister();
    } catch {
      /* ignore */
    }
    if (loginUi) loginUi.dispose();
    if (pinnedSaveTimer) clearTimeout(pinnedSaveTimer);
    stopSync();
    resolvedCache.clear();
  };
}
