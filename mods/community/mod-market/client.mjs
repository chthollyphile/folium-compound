// client.mjs — 模组市场的渲染端。
//
// 主页导航末尾多一个整页「模组市场」：直接读官方市场的 catalog.json，把模组按卡片列出来，
// 点「安装」就地完成「下载 → 校验 → 解压 → 装进 mods 目录 → 叫出启用确认」，不用再去浏览器。
// 已装模组会拿 catalog 里的版本比一次，有新版就在卡片上标出来，支持单个更新与全部更新。
//
// 边界：
//   · 下载与解压都不在这里。这里只发 rpc 让 Node 端把包下到缓存并核对 SHA-256，
//     再把落盘路径交给宿主自己的 installModFromZip —— 它才是往 mods 目录写东西的那一个。
//   · 启用同样不绕过：装完调宿主的 setModEnabled，弹的是宿主原生的确认窗口，
//     签名、权限、内容摘要都由宿主自己核对，我们连读都不读。

const CATALOG_ORIGIN = 'https://folium-compound.cielaniska.top';

const PERMISSION_TEXT = {
    'filesystem.data': { zh: '读写它自己的数据文件', en: 'Read and write its own data file' },
    'playback.read': { zh: '读取当前播放状态', en: 'Read the playback state' },
    'playback.control': { zh: '控制播放：播放、暂停、跳转、切歌', en: 'Control playback: play, pause, seek, skip' },
    'playback.queue': { zh: '替换播放队列', en: 'Replace the play queue' },
    'equalizer.control': { zh: '调整均衡器', en: 'Control the equalizer' },
    'render.export': { zh: '导出歌词视频', en: 'Export lyric videos' },
    'net.fetch': { zh: '访问网络', en: 'Access the network' },
    'net.embed': { zh: '嵌入外部网页', en: 'Embed external web pages' },
    stageLayers: { zh: '在播放页上绘制图层', en: 'Draw layers on the player page' },
    'platform.netease.read': { zh: '读取网易云数据', en: 'Read NetEase data' },
    'platform.netease.write': { zh: '修改网易云数据', en: 'Write NetEase data' },
};

const EXPERIMENTAL_TEXT = {
    'platform.raw': { zh: '网易云实验接口', en: 'NetEase experimental API' },
    'omni.hooks': { zh: '音源替换钩子', en: 'Audio source hooks' },
    'omni.providers': { zh: '自定义音源', en: 'Custom providers' },
    'ponder.targets': { zh: '思索教程锚点', en: 'Ponder tutorial anchors' },
    'player.layout': { zh: '播放页布局', en: 'Player layout' },
    'remote.actions': { zh: '遥控窗口动作', en: 'Remote window actions' },
};

// 宿主 installModFromZip / 下载链路的错误码 → 一句人话。
const ERROR_TEXT = {
    'install-not-zip': '这个地址给的不是 zip 包。',
    'install-too-large': '包太大了，超过宿主的 64MB 上限。',
    'install-too-many-files': '包里的文件太多，宿主拒绝安装。',
    'install-corrupt-zip': 'zip 包损坏或读不出来。',
    'install-empty-zip': 'zip 是空的。',
    'install-no-manifest': '包里找不到 mod.json，可能不是模组包。',
    'install-invalid-manifest': 'mod.json 不合规，宿主拒绝安装。',
    'install-main-missing': '包里缺 main 入口文件。',
    'install-client-missing': '包里缺 client 入口文件。',
    'install-unsafe-path': '包里有越界路径，已拒绝安装。',
    'install-main-failed': '安装过程出错了。',
    'mod-system-disabled': '模组系统没有开启，先到设置里打开。',
    'download-checksum-mismatch': '下载到的包与官方公布的 SHA-256 不符，已丢弃。',
    'download-timeout': '下载超时，检查一下网络或代理。',
    'download-empty': '下载到的是空文件，稍后重试。',
    'download-http-404': '官方站上没有这个文件（可能刚更新过，刷新试试）。',
    'market-no-checksum': '这个模组在 catalog 里没有哈希，为安全起见不装。',
    'market-bad-url': '下载地址不在官方站上，已拒绝。',
    'catalog-timeout': '读取模组市场超时。',
    'catalog-not-json': '模组市场返回的内容看不懂。',
    'catalog-unexpected-format': '模组市场的格式变了，本模组可能该更新了。',
    'no-install-bridge': '当前 Folia 版本没有开放安装接口，请把 Folia 升到 0.7.22 以上。',
    'no-bridge': '找不到 Folia 的模组接口，模组系统可能没有开启。',
    'enable-declined': '已安装，但没有启用。',
};

const CSS = `
.mm-root{
  --mm-bg:transparent;
  --mm-ink:#e9e9ef;
  --mm-muted:#8b8b97;
  --mm-line:color-mix(in srgb, var(--mm-ink) 12%, transparent);
  --mm-surface:color-mix(in srgb, var(--mm-ink) 5%, transparent);
  --mm-surface-2:color-mix(in srgb, var(--mm-ink) 9%, transparent);
  --mm-panel:color-mix(in srgb, var(--mm-ink) 6%, var(--mm-bg));
  --mm-accent:#b6a1f0;
  position:relative;height:100%;min-height:0;display:flex;flex-direction:column;color:var(--mm-ink);
  font-family:var(--mm-font,inherit);font-size:13px;line-height:1.5;
}
.mm-root *{box-sizing:border-box}
.mm-root button{font:inherit;color:inherit;background:transparent;border:0;cursor:pointer}
.mm-root button:disabled{cursor:default;opacity:.45}
.mm-root input{font:inherit}
.mm-root ::-webkit-scrollbar{width:8px;height:8px}
.mm-root ::-webkit-scrollbar-thumb{background:color-mix(in srgb,var(--mm-ink) 18%,transparent);border-radius:4px}

.mm-head{display:flex;flex-wrap:wrap;align-items:flex-end;gap:10px 14px;padding:2px 0 12px;flex:none}
.mm-title{font-size:19px;font-weight:700;letter-spacing:.01em;display:flex;align-items:center;gap:8px}
.mm-title small{font-size:11.5px;font-weight:400;color:var(--mm-muted);letter-spacing:0}
.mm-head-actions{margin-left:auto;display:flex;align-items:center;gap:8px}
.mm-meta{flex:1 1 100%;display:flex;flex-wrap:wrap;gap:6px 12px;font-size:11px;color:var(--mm-muted);min-height:0}
.mm-meta a{color:inherit;text-decoration:none;border-bottom:1px dotted var(--mm-line);cursor:pointer}
.mm-meta a:hover{color:var(--mm-ink)}

.mm-btn{display:inline-flex;align-items:center;gap:5px;border-radius:9px;padding:6px 12px;font-size:12px;
  border:1px solid var(--mm-line);background:var(--mm-surface);transition:background .14s,border-color .14s,transform .14s;white-space:nowrap}
.mm-btn:hover:not(:disabled){background:var(--mm-surface-2);border-color:color-mix(in srgb,var(--mm-ink) 24%,transparent)}
.mm-btn.is-primary{background:var(--mm-accent);border-color:transparent;color:#12101a;font-weight:600}
.mm-btn.is-primary:hover:not(:disabled){filter:brightness(1.06)}
.mm-btn.is-ghost{background:transparent}
.mm-btn.is-outline{background:var(--mm-surface-2);border-color:color-mix(in srgb,var(--mm-ink) 26%,transparent)}
.mm-btn.is-small{padding:4px 9px;font-size:11.5px;border-radius:7px}
.mm-btn.is-icon{padding:6px;border-radius:9px}

.mm-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:0 0 12px;flex:none}
.mm-search{position:relative;flex:1 1 200px;min-width:150px}
.mm-search input{width:100%;padding:7px 10px 7px 30px;border-radius:9px;border:1px solid var(--mm-line);
  background:var(--mm-surface);color:var(--mm-ink);outline:none;font-size:12.5px}
.mm-search input:focus{border-color:color-mix(in srgb,var(--mm-accent) 60%,var(--mm-line))}
.mm-search svg{position:absolute;left:9px;top:50%;transform:translateY(-50%);opacity:.45;pointer-events:none}
.mm-chips{display:flex;flex-wrap:wrap;gap:4px}
.mm-chip{border-radius:999px;padding:5px 11px;font-size:11.5px;border:1px solid transparent;
  background:var(--mm-surface);color:var(--mm-muted)}
.mm-chip:hover{color:var(--mm-ink)}
.mm-chip.is-on{background:color-mix(in srgb,var(--mm-accent) 22%,transparent);color:var(--mm-ink);
  border-color:color-mix(in srgb,var(--mm-accent) 45%,transparent);font-weight:600}

.mm-banner{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 12px;padding:9px 12px;border-radius:10px;
  background:color-mix(in srgb,var(--mm-accent) 14%,transparent);border:1px solid color-mix(in srgb,var(--mm-accent) 32%,transparent);font-size:12px}
.mm-banner.is-warn{background:color-mix(in srgb,#e0a13a 14%,transparent);border-color:color-mix(in srgb,#e0a13a 36%,transparent)}
.mm-banner .mm-btn{margin-left:auto}

/* 原生滚动条整个关掉（width:0），换成一条绝对定位的浮层滑块：
   它不参与布局，出现和消失都不占宽度，滚动条再也不可能把内容挤一下。
   之前两轮一直盯着 scrollbar-gutter，本质上还是在赌实现细节，这次直接不赌了。 */
.mm-body-wrap{flex:1;min-height:0;position:relative;display:flex}
.mm-body{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;
  scrollbar-width:none;-ms-overflow-style:none;
  padding:0 2px calc(var(--mm-safe-bottom, 0px) + 26px)}
.mm-body::-webkit-scrollbar{width:0;height:0}
.mm-root.is-sheet-open .mm-body{pointer-events:none}
.mm-sb{position:absolute;top:2px;bottom:2px;right:1px;width:9px;z-index:6;pointer-events:none;
  opacity:0;transition:opacity .24s ease}
.mm-sb.is-on{opacity:1}
.mm-sb i{position:absolute;left:2px;right:2px;border-radius:99px;
  background:color-mix(in srgb,var(--mm-ink) 26%,transparent);will-change:transform}
.mm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(248px,1fr));gap:12px}

.mm-card{display:flex;flex-direction:column;border-radius:13px;overflow:hidden;border:1px solid var(--mm-line);
  background:var(--mm-surface);transition:border-color .16s,transform .16s,background .16s}
.mm-card:hover{border-color:color-mix(in srgb,var(--mm-ink) 26%,transparent);transform:translateY(-1px);
  background:color-mix(in srgb,var(--mm-ink) 7%,transparent)}
.mm-thumb{position:relative;aspect-ratio:16/9;background:color-mix(in srgb,var(--mm-ink) 10%,transparent);overflow:hidden}
/* 还没加载出来的封面：一道很淡的扫光，比纯灰块自然 */
.mm-thumb.is-pending::after{content:'';position:absolute;inset:0;pointer-events:none;
  background:linear-gradient(100deg,transparent 18%,rgba(255,255,255,.07) 42%,transparent 66%);
  background-size:220% 100%;animation:mmShimmer 1.5s linear infinite}
@keyframes mmShimmer{0%{background-position:130% 0}100%{background-position:-90% 0}}
.mm-thumb img{width:100%;height:100%;object-fit:cover;display:block;opacity:0;transition:opacity .34s ease}
.mm-thumb img.is-ready{opacity:1}
.mm-thumb .mm-ph{width:100%;height:100%;display:flex;align-items:center;justify-content:center;
  font-size:26px;font-weight:700;opacity:.28;letter-spacing:.04em}
.mm-card-badges{position:absolute;left:8px;top:8px;display:flex;gap:4px;flex-wrap:wrap;max-width:calc(100% - 16px)}
.mm-tag{font-size:10px;line-height:1.6;padding:0 7px;border-radius:999px;background:rgba(10,10,14,.62);color:#f2f2f7;
  backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,.14);white-space:nowrap}
.mm-tag.is-official{background:rgba(88,64,168,.72);border-color:rgba(180,160,255,.5)}
.mm-tag.is-beta{background:rgba(150,102,20,.72);border-color:rgba(240,190,110,.5)}
.mm-tag.is-update{background:rgba(20,120,90,.78);border-color:rgba(120,230,190,.5)}
.mm-tag.is-installed{background:rgba(20,20,26,.72)}

.mm-card-main{padding:10px 11px 0;display:flex;flex-direction:column;gap:4px;min-width:0}
.mm-card-name{font-size:13.5px;font-weight:650;line-height:1.35;display:flex;align-items:baseline;gap:6px}
.mm-card-name span.mm-ver{font-size:10.5px;font-weight:400;color:var(--mm-muted);flex:none}
.mm-card-by{font-size:11px;color:var(--mm-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mm-card-desc{font-size:11.5px;line-height:1.62;color:color-mix(in srgb,var(--mm-ink) 72%,transparent);
  display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;white-space:pre-wrap;word-break:break-word;margin:2px 0 0}
.mm-card-foot{display:flex;align-items:center;gap:6px;padding:9px 11px 11px;margin-top:auto}
.mm-card-foot .mm-btn:first-child{margin-left:auto}
.mm-perm-dot{font-size:10.5px;color:var(--mm-muted);display:inline-flex;align-items:center;gap:4px;min-width:0;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap}

.mm-progress{height:2px;border-radius:2px;background:color-mix(in srgb,var(--mm-ink) 12%,transparent);overflow:hidden;margin-top:8px}
.mm-progress i{display:block;height:100%;width:38%;border-radius:2px;background:var(--mm-accent);animation:mmSlide 1.1s ease-in-out infinite}
@keyframes mmSlide{0%{transform:translateX(-100%)}100%{transform:translateX(320%)}}
.mm-job{font-size:11px;color:var(--mm-muted);padding:0 11px 10px;display:flex;align-items:center;gap:6px}
.mm-job.is-err{margin:6px 10px 2px;padding:6px 9px;border-radius:8px;line-height:1.55;white-space:normal;
  word-break:break-word;background:color-mix(in srgb,#e2725b 14%,transparent);
  border:1px solid color-mix(in srgb,#e2725b 34%,transparent);color:#e88d7d}

/* ---------------------------------------------------------- 详情：底部卡片 */

/* 详情做成手机那种从底部滑上来的卡片：只有上面两个角是圆的，贴住面板底边。
   用 absolute 挂在 .mm-root 内部而不是 position:fixed —— 宿主外层可能有 transform，
   fixed 会跑出视口；挂在面板里则永远贴着面板的底边。 */
.mm-sheet-wrap{position:absolute;inset:0;z-index:40;display:flex;align-items:flex-end;justify-content:center;
  padding-top:10px;opacity:0;pointer-events:none;transition:opacity .18s ease}
.mm-sheet-wrap[hidden]{display:none}
.mm-sheet-wrap.is-open{opacity:1;pointer-events:auto}
.mm-sheet-backdrop{position:absolute;inset:0;background:rgba(6,6,10,.68)}
.mm-sheet{position:relative;width:min(560px,100%);max-height:100%;display:flex;flex-direction:column;
  background:var(--mm-panel);border-radius:20px 20px 0 0;overflow:hidden;
  box-shadow:0 -18px 56px rgba(0,0,0,.46), inset 0 1px 0 color-mix(in srgb,var(--mm-ink) 10%,transparent);
  transform:translateY(103%);transition:transform .34s cubic-bezier(.22,.9,.28,1)}
.mm-sheet-wrap.is-open .mm-sheet{transform:translateY(0)}
.mm-sheet-grab{position:absolute;top:7px;left:50%;transform:translateX(-50%);width:34px;height:4px;border-radius:99px;
  background:color-mix(in srgb,var(--mm-ink) 26%,transparent);z-index:3}
.mm-sheet-close{position:absolute;right:10px;top:10px;z-index:4;width:30px;height:30px;border-radius:50%;
  display:flex;align-items:center;justify-content:center;background:rgba(10,10,14,.55);backdrop-filter:blur(8px);
  border:1px solid rgba(255,255,255,.18);color:#fff;transition:background .14s,transform .14s}
.mm-sheet-close:hover{background:rgba(10,10,14,.78);transform:scale(1.04)}
/* 同理：详情滚动条也是常驻的，内容再多也不会把字挤窄 8px */
.mm-sheet-scroll{flex:1;min-height:0;overflow-y:scroll;overflow-x:hidden;overscroll-behavior:contain;
  scrollbar-gutter:stable}

.mm-sheet-cover{position:relative;aspect-ratio:16/9;background:color-mix(in srgb,var(--mm-ink) 10%,transparent)}
.mm-sheet-cover img{width:100%;height:100%;object-fit:cover;display:block;opacity:0;transition:opacity .34s ease}
.mm-sheet-cover img.is-ready{opacity:1}
.mm-sheet-cover.is-zoomable{cursor:zoom-in}
.mm-sheet-cover .mm-ph{width:100%;height:100%;display:flex;align-items:center;justify-content:center;
  font-size:34px;font-weight:700;opacity:.26;letter-spacing:.04em}
.mm-zoom{position:absolute;right:10px;bottom:10px;font-size:10.5px;line-height:1.7;padding:1px 9px;border-radius:999px;
  background:rgba(10,10,14,.62);border:1px solid rgba(255,255,255,.2);color:#f2f2f7;display:inline-flex;
  align-items:center;gap:4px;backdrop-filter:blur(6px)}

.mm-sheet-body{padding:15px 16px 20px;display:flex;flex-direction:column;gap:15px}
.mm-sheet-title{font-size:21px;font-weight:750;line-height:1.28;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.mm-sheet-title .mm-ver{font-size:12px;font-weight:400;color:var(--mm-muted)}
.mm-sheet-meta{display:flex;flex-wrap:wrap;gap:5px 16px;font-size:11.5px;color:var(--mm-muted);margin-top:-8px}
.mm-sheet-meta i{font-style:normal;opacity:.7;margin-right:4px}

.mm-linkrow{display:flex;gap:8px;flex-wrap:wrap}
.mm-link-btn{display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:10px;font-size:12px;
  border:1px solid color-mix(in srgb,var(--mm-ink) 20%,transparent);background:var(--mm-surface-2);
  color:var(--mm-ink);cursor:pointer;transition:background .14s,border-color .14s,transform .14s}
.mm-link-btn:hover{background:color-mix(in srgb,var(--mm-ink) 14%,transparent);
  border-color:color-mix(in srgb,var(--mm-accent) 45%,transparent);transform:translateY(-1px)}
.mm-link-btn svg{opacity:.7}

.mm-block{display:flex;flex-direction:column;gap:7px}
.mm-block h4{margin:0;font-size:11.5px;font-weight:600;color:var(--mm-muted);letter-spacing:.03em}
.mm-desc{font-size:12.5px;line-height:1.82;white-space:pre-wrap;word-break:break-word;
  color:color-mix(in srgb,var(--mm-ink) 90%,transparent)}
.mm-desc.is-clamp{display:-webkit-box;-webkit-line-clamp:6;-webkit-box-orient:vertical;overflow:hidden}
.mm-expand{align-self:flex-start;font-size:12px;color:var(--mm-accent);padding:1px 0;display:inline-flex;align-items:center;gap:4px}
/* 作者样式里的 display 会盖掉 UA 的 [hidden]{display:none}，不写这条 hidden 就是个摆设 */
.mm-expand[hidden]{display:none}
.mm-expand:hover{text-decoration:underline}

.mm-list{display:flex;flex-direction:column;gap:6px;font-size:12px}
.mm-list div{display:flex;gap:7px;align-items:baseline;flex-wrap:wrap}
.mm-list em{font-style:normal;color:var(--mm-muted);font-size:11px}
.mm-pill{display:inline-block;font-size:10.5px;padding:1px 7px;border-radius:999px;background:var(--mm-surface-2);
  border:1px solid var(--mm-line);color:var(--mm-muted);white-space:nowrap}
.mm-pill.is-official{background:color-mix(in srgb,var(--mm-accent) 26%,transparent);border-color:transparent;color:var(--mm-ink)}
.mm-pill.is-beta{background:color-mix(in srgb,#e0a13a 30%,transparent);border-color:transparent;color:var(--mm-ink)}
.mm-pill.is-update{background:color-mix(in srgb,#3fbf94 26%,transparent);border-color:transparent;color:var(--mm-ink)}
.mm-kv{display:grid;grid-template-columns:76px 1fr;gap:5px 10px;font-size:11.5px;line-height:1.7}
.mm-kv dt{color:var(--mm-muted)}
.mm-kv dd{margin:0;word-break:break-word}
.mm-kv code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:10.5px;opacity:.8}

.mm-sheet-footer{flex:none;padding:10px 16px calc(12px + var(--mm-safe-bottom, 0px));
  border-top:1px solid var(--mm-line);background:var(--mm-panel)}
.mm-sheet-footer .mm-btn{width:100%;justify-content:center;height:42px;border-radius:12px;font-size:13px;font-weight:600}
.mm-sheet-footer .mm-err{font-size:11.5px;color:#e88d7d;line-height:1.55;margin-bottom:8px;padding:6px 9px;border-radius:8px;
  background:color-mix(in srgb,#e2725b 14%,transparent);border:1px solid color-mix(in srgb,#e2725b 32%,transparent)}

/* 封面放大：盖住整张卡片 */
.mm-lightbox{position:absolute;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;padding:18px;
  background:rgba(4,4,8,.93);opacity:0;pointer-events:none;transition:opacity .2s ease;cursor:zoom-out;
  overflow:hidden}
.mm-lightbox.is-open{opacity:1;pointer-events:auto}
.mm-lightbox img{max-width:100%;max-height:100%;object-fit:contain;border-radius:10px;
  box-shadow:0 24px 70px rgba(0,0,0,.6);transform-origin:center center;will-change:transform;
  transition:transform .12s ease-out;user-select:none;-webkit-user-drag:none}
.mm-lightbox.is-zoomed{cursor:grab}
.mm-lightbox.is-dragging{cursor:grabbing}
.mm-lightbox.is-dragging img{transition:none}
.mm-lb-close{position:absolute;right:14px;top:14px;width:36px;height:36px;border-radius:50%;display:flex;
  align-items:center;justify-content:center;background:rgba(10,10,14,.72);border:1px solid rgba(255,255,255,.24);
  color:#fff;z-index:3;box-shadow:0 6px 20px rgba(0,0,0,.45);backdrop-filter:blur(8px)}
.mm-lb-close:hover{background:rgba(10,10,14,.85)}
.mm-lb-hint{position:absolute;left:14px;top:16px;font-size:11px;color:#fffc;z-index:3;
  background:rgba(10,10,14,.6);border:1px solid rgba(255,255,255,.16);border-radius:999px;padding:4px 12px;
  pointer-events:none;white-space:nowrap;backdrop-filter:blur(8px)}
.mm-lightbox .mm-ph{font-size:40px;opacity:.4}

/* 加载失败：给一个能真的重试的卡片 */
.mm-retry{max-width:400px;margin:44px auto;display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center}
.mm-retry-icon{width:46px;height:46px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  background:color-mix(in srgb,#e0a13a 16%,transparent);color:#e0a13a;
  border:1px solid color-mix(in srgb,#e0a13a 34%,transparent)}
.mm-retry-title{font-size:14px;font-weight:650}
.mm-retry-text{font-size:12px;color:var(--mm-muted);line-height:1.75;max-width:340px}
.mm-retry-actions{display:flex;gap:8px;margin-top:4px;flex-wrap:wrap;justify-content:center}
.mm-state{padding:34px 6px;text-align:center;color:var(--mm-muted);font-size:12.5px;line-height:1.9}
.mm-empty{padding:44px 10px;text-align:center;color:var(--mm-muted);font-size:12.5px}
.mm-card.is-hidden,.mm-empty.is-hidden{display:none}
`.trim();

const SVG_SEARCH =
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/></svg>';
const SVG_REFRESH =
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/></svg>';
const SVG_CLOSE =
    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" ' +
    'stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';
const SVG_ZOOM =
    '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="6"/><path d="M11 8v6M8 11h6M20 20l-4.2-4.2"/></svg>';
const SVG_SOURCE =
    '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round"><path d="m9 18-6-6 6-6"/><path d="m15 6 6 6-6 6"/></svg>';
const SVG_GLOBE =
    '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>';
const SVG_DOWNLOAD =
    '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11"/><path d="m7.5 10.5 4.5 4.5 4.5-4.5"/><path d="M5 19h14"/></svg>';
const SVG_CHEVRON =
    '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" ' +
    'stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
const SVG_WARN =
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v5"/><circle cx="12" cy="16.5" r=".6" fill="currentColor"/>' +
    '<path d="M10.3 3.9 2.6 17.2A1.9 1.9 0 0 0 4.3 20h15.4a1.9 1.9 0 0 0 1.7-2.8L13.7 3.9a1.9 1.9 0 0 0-3.4 0Z"/></svg>';

export default function activate(folium) {
    if (!folium || folium.env?.context !== 'main') return undefined;

    let locale = 'zh-CN';
    const isZh = () => /^zh/i.test(String(locale));
    const t = (zh, en) => (isZh() ? zh : en);

    const log = (message) => {
        try {
            folium.log?.info?.(`[市场] ${message}`);
        } catch (_) {}
    };
    const warn = (message) => {
        try {
            folium.log?.warn?.(`[市场] ${message}`);
        } catch (_) {}
    };
    const toast = (message, type) => {
        try {
            folium.ui?.toast?.(message, type ? { type } : undefined);
        } catch (_) {}
    };

    const esc = (value) =>
        String(value ?? '').replace(/[&<>"']/g, (character) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
        })[character]);

    const bridge = () => {
        try {
            return window.electron?.mods ?? null;
        } catch (_) {
            return null;
        }
    };

    const rpc = async (name, payload) => {
        try {
            return await folium.rpc.call(name, payload);
        } catch (error) {
            warn(`rpc ${name} 失败：${String(error?.message || error)}`);
            return { ok: false, error: String(error?.message || error) };
        }
    };

    const humanError = (code) => {
        const raw = String(code ?? '');
        const key = raw.split(':')[0];
        if (ERROR_TEXT[key]) return ERROR_TEXT[key];
        if (raw.startsWith('install-invalid-manifest')) return ERROR_TEXT['install-invalid-manifest'];
        if (/^download-http-\d+$/.test(raw)) return t(`下载失败（HTTP ${raw.slice(-3)}）。`, `Download failed (HTTP ${raw.slice(-3)}).`);
        if (/^catalog-http-\d+$/.test(raw)) return t(`读取模组市场失败（HTTP ${raw.slice(-3)}）。`, `Catalog request failed (HTTP ${raw.slice(-3)}).`);
        return raw || t('未知错误', 'Unknown error');
    };

    /* ------------------------------------------------------------- 设置项 */

    const L = (zh, en) => ({ 'zh-CN': zh, en });

    let settingsHandle = null;
    try {
        settingsHandle = folium.registries?.settingsSections?.register?.({
            id: 'prefs',
            label: L('模组市场', 'Mod market'),
            description: L(
                '市场页在首页导航的末尾，也会在命令面板里出现「打开模组市场」。安装走宿主自己的安装器，装完仍要你在宿主的确认窗口里点头才会启用。',
                'The market lives at the end of the home navigation. Installs go through the host installer, and enabling still asks for your confirmation.'
            ),
            settings: [
                {
                    key: 'autoCheck',
                    type: 'boolean',
                    defaultValue: true,
                    label: L('打开市场时自动刷新', 'Refresh when the market opens'),
                    description: L('关闭后只在点刷新时联网，其余时间用本地缓存。', 'When off, only the refresh button goes online.'),
                },
                {
                    key: 'showPreview',
                    type: 'boolean',
                    defaultValue: true,
                    label: L('显示预览图', 'Show preview images'),
                    description: L('预览图来自官方站，关闭后只显示首字母占位。', 'Previews come from the official site; off shows a letter placeholder.'),
                },
                {
                    key: 'betaChannel',
                    type: 'boolean',
                    defaultValue: false,
                    label: L('显示 Beta 模组', 'Show beta mods'),
                    description: L(
                        'Beta 只过了安全审查，功能可能跑不起来，多数人用不上；过滤条里也能临时切换。',
                        'Beta mods passed the security review only and may not work at all. The filter row can toggle them too.'
                    ),
                },
            ],
        });
    } catch (error) {
        warn(`设置区注册失败：${String(error?.message || error)}`);
    }

    const readSettings = () => {
        let raw = null;
        try {
            raw = settingsHandle?.settings?.get?.() ?? null;
        } catch (_) {
            raw = null;
        }
        const value = raw && typeof raw === 'object' ? raw : {};
        return {
            autoCheck: value.autoCheck !== false,
            showPreview: value.showPreview !== false,
            betaChannel: value.betaChannel === true,
        };
    };

    /* --------------------------------------------------------------- 状态 */

    const state = {
        catalog: null, // { mods, fetchedAt, source, stale, error }
        installed: new Map(), // id -> { version, name, directory }
        host: new Map(), // id -> { enabled, status, signature }
        loading: false,
        error: null,
        query: '',
        filter: 'all', // all | official | community | beta | installed
        detailId: null, // 打开着的那张详情卡片
        expanded: new Set(), // 已经展开全文的模组 id
        jobs: new Map(), // id -> { phase, error }
        mounted: false,
    };

    const parseVersion = (version) => {
        const match = /^(\d+)\.(\d+)\.(\d+)/.exec(String(version ?? '').trim());
        return match ? { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) } : null;
    };

    const compareVersion = (left, right) => {
        const a = parseVersion(left);
        const b = parseVersion(right);
        if (!a || !b) return String(left ?? '').localeCompare(String(right ?? ''));
        if (a.major !== b.major) return a.major - b.major;
        if (a.minor !== b.minor) return a.minor - b.minor;
        return a.patch - b.patch;
    };

    const formatSize = (bytes) => {
        const value = Number(bytes) || 0;
        if (value <= 0) return '';
        if (value < 1024) return `${value} B`;
        if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`;
        return `${(value / 1024 / 1024).toFixed(1)} MB`;
    };

    const formatTime = (stamp) => {
        if (!stamp) return '';
        const date = new Date(stamp);
        if (Number.isNaN(date.getTime())) return '';
        const pad = (value) => String(value).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };

    const relativeTime = (stamp) => {
        const time = Number(stamp) || 0;
        if (!time) return '';
        const diff = Math.max(0, Date.now() - time);
        const minute = 60 * 1000;
        if (diff < minute) return t('刚刚', 'just now');
        if (diff < 60 * minute) return t(`${Math.round(diff / minute)} 分钟前`, `${Math.round(diff / minute)} min ago`);
        if (diff < 24 * 60 * minute) return t(`${Math.round(diff / (60 * minute))} 小时前`, `${Math.round(diff / (60 * minute))} h ago`);
        return t(`${Math.round(diff / (24 * 60 * minute))} 天前`, `${Math.round(diff / (24 * 60 * minute))} d ago`);
    };

    const jobOf = (id) => state.jobs.get(id) ?? null;

    const setJob = (id, job) => {
        if (job) state.jobs.set(id, job);
        else state.jobs.delete(id);
        paint();
    };

    /* ------------------------------------------------------------ 数据合并 */

    const rows = () => {
        const catalogMods = state.catalog?.mods ?? [];
        const list = catalogMods.map((mod) => {
            const installed = state.installed.get(mod.id) ?? null;
            const host = state.host.get(mod.id) ?? null;
            const installedVersion = installed?.version ?? host?.version ?? null;
            const hasUpdate = Boolean(installedVersion) && compareVersion(mod.version, installedVersion) > 0;
            return {
                ...mod,
                installedVersion,
                installed: Boolean(installedVersion),
                enabled: host?.enabled === true,
                status: host?.status ?? null,
                signature: host?.signature ?? null,
                hasUpdate,
            };
        });

        // 装在本地但市场上没有的模组：也列出来，至少能点进目录看看。
        state.installed.forEach((installed, id) => {
            if (catalogMods.some((mod) => mod.id === id)) return;
            const host = state.host.get(id) ?? null;
            list.push({
                id,
                name: installed.name || id,
                version: installed.version || '—',
                author: installed.author || '',
                description: t('这个模组不在官方市场里（本地安装或第三方来源），市场无法为它检查更新。', 'This mod is not in the official market, so updates cannot be checked.'),
                origin: 'local',
                channel: 'release',
                permissions: [],
                experimental: [],
                depends: [],
                owners: [],
                source: '',
                folia: null,
                preview: null,
                page: null,
                download: null,
                installedVersion: installed.version || null,
                installed: true,
                enabled: host?.enabled === true,
                status: host?.status ?? null,
                signature: host?.signature ?? null,
                hasUpdate: false,
                localOnly: true,
            });
        });

        return list.sort((left, right) => left.name.localeCompare(right.name, isZh() ? 'zh-Hans-CN' : 'en'));
    };

    const visibleRows = () => {
        const settings = readSettings();
        const query = state.query.trim().toLowerCase();
        return rows().filter((row) => {
            if (state.filter === 'installed' && !row.installed) return false;
            if (state.filter === 'official' && row.origin !== 'official') return false;
            if (state.filter === 'community' && row.origin !== 'community') return false;
            if (state.filter === 'beta' && row.channel !== 'beta') return false;
            if (!settings.betaChannel && state.filter !== 'beta' && state.filter !== 'installed' && row.channel === 'beta') {
                return false;
            }
            if (!query) return true;
            return [row.name, row.id, row.author, row.description, row.owners.join(' ')]
                .join(' ')
                .toLowerCase()
                .includes(query);
        });
    };

    /* --------------------------------------------------------------- 刷新 */

    /*
     * 每次刷新领一个号。以前这里有 `if (state.loading) return`，网络挂住的那十几秒里
     * 点「重试」直接被吞掉——看起来就是点了没反应。现在旧的请求不再拦新的：
     * 新的一次拿到号，旧的回来时号对不上，结果直接丢掉。
     */
    let loadToken = 0;

    const refresh = async ({ force = false, quiet = false } = {}) => {
        const token = ++loadToken;
        state.loading = true;
        state.error = null; // 先把上一次的报错清掉，点重试立刻有反应
        if (!quiet) paint();

        try {
            const [catalog, installed] = await Promise.all([
                rpc('market.catalog', { force }),
                rpc('market.installed'),
            ]);
            if (token !== loadToken) return; // 已经被更新的一次盖掉了

            if (catalog?.ok) {
                state.catalog = catalog;
                state.error = catalog.stale && catalog.error ? humanError(catalog.error) : null;
            } else if (!state.catalog) {
                state.error = humanError(catalog?.error);
            }

            if (installed?.ok) {
                const map = new Map();
                (installed.mods ?? []).forEach((mod) => {
                    map.set(mod.id, { version: mod.version, name: mod.name, author: mod.author, directory: mod.directory });
                });
                state.installed = map;
            }

            const api = bridge();
            if (api?.listMods) {
                try {
                    const answer = await api.listMods();
                    if (token !== loadToken) return;
                    const map = new Map();
                    (answer?.mods ?? []).forEach((mod) => {
                        map.set(mod.id, {
                            enabled: mod.enabled === true,
                            status: mod.status ?? null,
                            version: mod.version ?? null,
                            signature: mod.signature ?? null,
                        });
                    });
                    state.host = map;
                } catch (error) {
                    warn(`读取已装模组状态失败：${String(error?.message || error)}`);
                }
            }

            const count = state.catalog?.mods?.length ?? 0;
            log(`市场 ${count} 个模组，已装 ${state.installed.size} 个，来源 ${state.catalog?.source ?? 'none'}`);
        } finally {
            if (token === loadToken) {
                state.loading = false;
                paint();
            }
        }
    };

    /* --------------------------------------------------------------- 安装 */

    const enableMod = async (id) => {
        const api = bridge();
        if (!api?.setModEnabled) {
            return { ok: false, error: 'no-bridge' };
        }
        const answer = await api.setModEnabled(id, true);
        return { ok: answer?.ok === true, error: answer?.error ?? null };
    };

    const install = async (row) => {
        if (jobOf(row.id)) return;
        if (!row.download) {
            toast(t('这个模组没有可下载的包。', 'This mod has no downloadable package.'), 'error');
            return;
        }

        setJob(row.id, { phase: 'download' });
        try {
            const download = await rpc('market.download', {
                id: row.id,
                url: row.download.url,
                sha256: row.download.sha256,
                version: row.version,
            });
            if (!download?.ok) {
                const message = humanError(download?.error);
                setJob(row.id, { phase: 'error', error: message });
                toast(t(`「${row.name}」下载失败：${message}`, `${row.name}: ${message}`), 'error');
                return;
            }

            setJob(row.id, { phase: 'install' });
            const api = bridge();
            if (!api?.installModFromZip) {
                setJob(row.id, { phase: 'error', error: humanError('no-install-bridge') });
                return;
            }
            const answer = await api.installModFromZip(download.path);
            if (!answer?.ok) {
                const message = humanError(answer?.error);
                setJob(row.id, { phase: 'error', error: message });
                toast(t(`「${row.name}」安装失败：${message}`, `${row.name}: ${message}`), 'error');
                return;
            }

            // 装好了：宿主的安装器已经做过一次 loadAll，包也不再需要。
            void rpc('market.dropPackage', { path: download.path });

            setJob(row.id, { phase: 'enable' });
            const enabled = await enableMod(row.id);
            setJob(row.id, null);

            if (enabled.ok) {
                toast(t(`「${row.name}」已安装并启用`, `${row.name} installed and enabled`), 'info');
            } else if (String(enabled.error ?? '').includes('declined')) {
                toast(t(`「${row.name}」已安装，你取消了启用`, `${row.name} installed; enabling was cancelled`), 'info');
            } else {
                toast(t(`「${row.name}」已安装，启用时出错了：${humanError(enabled.error)}`, `${row.name} installed but enabling failed`), 'error');
            }
        } catch (error) {
            const message = String(error?.message || error);
            setJob(row.id, { phase: 'error', error: message });
            toast(`${row.name}: ${message}`, 'error');
        } finally {
            await refresh({ force: false, quiet: true });
        }
    };

    const enableOnly = async (row) => {
        if (jobOf(row.id)) return;
        setJob(row.id, { phase: 'enable' });
        const answer = await enableMod(row.id);
        setJob(row.id, null);
        if (!answer.ok) {
            const message = humanError(answer.error);
            if (!String(answer.error ?? '').includes('declined')) {
                toast(`${row.name}: ${message}`, 'error');
            }
        }
        await refresh({ force: false, quiet: true });
    };

    const updateAll = async () => {
        const pending = rows().filter((row) => row.hasUpdate && !jobOf(row.id));
        if (pending.length === 0) return;
        toast(t(`开始更新 ${pending.length} 个模组`, `Updating ${pending.length} mods`), 'info');
        // 一次一个：宿主的 install 会在结尾重载所有模组，并发会把彼此的安装搅在一起。
        for (const row of pending) {
            // eslint-disable-next-line no-await-in-loop
            await install(row);
        }
    };

    const openInBrowser = (url) => {
        if (!url) return;
        const api = window.electron;
        if (api?.openExternalUrl) {
            void api.openExternalUrl(url);
            return;
        }
        try {
            window.open(url, '_blank', 'noopener');
        } catch (error) {
            warn(`打开外部链接失败：${String(error?.message || error)}`);
        }
    };

    /* --------------------------------------------------------------- 绘制 */

    let root = null;
    let body = null;
    let bodyWrap = null;
    let scrollbarEl = null;
    let scrollHideTimer = 0;
    let headMeta = null;
    let toolbar = null;
    let sheetWrap = null;
    let sheetScroll = null;
    let sheetFooter = null;
    let lightbox = null;

    const permissionText = (id) => {
        const entry = PERMISSION_TEXT[id];
        if (!entry) return id;
        return isZh() ? entry.zh : entry.en;
    };

    const experimentalText = (id) => {
        const entry = EXPERIMENTAL_TEXT[id];
        if (!entry) return id;
        return isZh() ? entry.zh : entry.en;
    };

    const badgesOf = (row) => {
        const badges = [];
        if (row.channel === 'beta') {
            badges.push(`<span class="mm-tag is-beta">Beta</span>`);
        } else if (row.origin === 'official') {
            badges.push(`<span class="mm-tag is-official">${esc(t('官方', 'Official'))}</span>`);
        } else if (row.origin === 'community') {
            badges.push(`<span class="mm-tag">${esc(t('社区', 'Community'))}</span>`);
        } else {
            badges.push(`<span class="mm-tag">${esc(t('本地', 'Local'))}</span>`);
        }
        if (row.hasUpdate) {
            badges.push(`<span class="mm-tag is-update">${esc(t('可更新', 'Update'))}</span>`);
        } else if (row.installed) {
            badges.push(`<span class="mm-tag is-installed">${esc(t('已安装', 'Installed'))}</span>`);
        }
        return badges.join('');
    };

    const thumbHtml = (row, settings) => {
        if (settings.showPreview && row.preview?.url) {
            return `<div class="mm-thumb"><img data-src="${esc(row.preview.url)}" alt="" decoding="async" referrerpolicy="no-referrer" data-thumb><div class="mm-card-badges">${badgesOf(row)}</div></div>`;
        }
        return `<div class="mm-thumb"><div class="mm-ph">${esc(String(row.name || row.id).slice(0, 2))}</div><div class="mm-card-badges">${badgesOf(row)}</div></div>`;
    };

    const cardAction = (row) => {
        const job = jobOf(row.id);
        if (job && job.phase !== 'error') {
            const label =
                job.phase === 'download'
                    ? t('下载中…', 'Downloading…')
                    : job.phase === 'install'
                        ? t('安装中…', 'Installing…')
                        : t('等待确认…', 'Waiting…');
            return `<button class="mm-btn is-small" disabled>${esc(label)}</button>`;
        }
        // 出错后把按钮还给用户，改完网络 / 权限能直接重来
        const retry = job?.phase === 'error';
        if (retry) {
            const act = row.hasUpdate || !row.installed ? 'install' : 'enable';
            return `<button class="mm-btn is-small is-primary" data-act="${act}" data-id="${esc(row.id)}">${esc(t('重试', 'Retry'))}</button>`;
        }
        if (row.localOnly) {
            if (!row.installed) {
                return `<button class="mm-btn is-small" disabled>${esc(t('市场外', 'Not in market'))}</button>`;
            }
            return row.enabled
                ? `<button class="mm-btn is-small" disabled>${esc(t('已启用', 'Enabled'))}</button>`
                : `<button class="mm-btn is-small is-primary" data-act="enable" data-id="${esc(row.id)}">${esc(t('启用', 'Enable'))}</button>`;
        }
        if (row.hasUpdate) {
            return `<button class="mm-btn is-small is-primary" data-act="install" data-id="${esc(row.id)}">${esc(t(`更新到 ${row.version}`, `Update to ${row.version}`))}</button>`;
        }
        if (row.installed) {
            if (row.enabled) {
                return `<button class="mm-btn is-small" disabled>${esc(t('已启用', 'Enabled'))}</button>`;
            }
            return `<button class="mm-btn is-small is-primary" data-act="enable" data-id="${esc(row.id)}">${esc(t('启用', 'Enable'))}</button>`;
        }
        return `<button class="mm-btn is-small is-primary" data-act="install" data-id="${esc(row.id)}">${esc(t('安装', 'Install'))}</button>`;
    };

    const cardHtml = (row, settings) => {
        const job = jobOf(row.id);
        const permCount = row.permissions.length;
        const permHint = permCount === 0
            ? t('无需权限', 'No permissions')
            : t(`${permCount} 项权限`, `${permCount} permissions`);
        const jobRow = job
            ? job.phase === 'error'
                ? `<div class="mm-job is-err">${esc(job.error || t('出错了', 'Failed'))}</div>`
                : `<div class="mm-progress"><i></i></div><div class="mm-job">${esc(
                    job.phase === 'download' ? t('正在下载并核对哈希…', 'Downloading and verifying…')
                        : job.phase === 'install' ? t('交给宿主安装…', 'Installing…')
                            : t('等待宿主确认窗口…', 'Waiting for the host dialog…')
                )}</div>`
            : '';
        return (
            `<article class="mm-card" data-card="${esc(row.id)}" data-origin="${esc(row.origin)}"` +
            ` data-channel="${esc(row.channel)}" data-installed="${row.installed ? '1' : '0'}">` +
            thumbHtml(row, settings) +
            `<div class="mm-card-main">` +
            `<div class="mm-card-name">${esc(row.name)}<span class="mm-ver">v${esc(row.version)}</span></div>` +
            `<div class="mm-card-by">${esc(row.author || t('未署名', 'unattributed'))}${
                row.installedVersion && row.installedVersion !== row.version
                    ? ` · ${esc(t(`已装 ${row.installedVersion}`, `installed ${row.installedVersion}`))}`
                    : ''
            }</div>` +
            `<p class="mm-card-desc">${esc(row.description)}</p>` +
            `</div>` +
            jobRow +
            `<div class="mm-card-foot">` +
            `<span class="mm-perm-dot">${esc(permHint)}${row.download && row.download.size ? ` · ${esc(formatSize(row.download.size))}` : ''}</span>` +
            `<button class="mm-btn is-small is-ghost" data-act="detail" data-id="${esc(row.id)}">${esc(t('详情', 'Details'))}</button>` +
            cardAction(row) +
            `</div></article>`
        );
    };

    // 连不上市场时的整页提示：原因写清楚，两个按钮都能真的按下去。
    const retryHtml = () => {
        const busy = state.loading;
        const reason = state.error || t('检查一下网络或代理，然后重试。', 'Check your network or proxy, then retry.');
        return (
            `<div class="mm-retry">` +
            `<div class="mm-retry-icon">${SVG_WARN}</div>` +
            `<div class="mm-retry-title">${esc(t('没能连上模组市场', 'Could not reach the market'))}</div>` +
            `<div class="mm-retry-text">${esc(reason)}</div>` +
            `<div class="mm-retry-actions">` +
            `<button type="button" class="mm-btn is-primary" data-act="retry"${busy ? ' disabled' : ''}>` +
            `${busy ? esc(t('正在重试…', 'Retrying…')) : esc(t('重试', 'Retry'))}</button>` +
            `<button type="button" class="mm-btn is-outline" data-act="external" data-url="${esc(CATALOG_ORIGIN)}">` +
            `${esc(t('在浏览器打开官方站', 'Open the official site'))}</button>` +
            `</div></div>`
        );
    };

    // 搜索用的小写索引：查的时候不打 DOM，改一次数据建一次。
    const searchIndex = new Map();

    const searchTextOf = (row) =>
        [row.name, row.id, row.author, row.description, row.owners.join(' ')].join(' ').toLowerCase();

    const listHtml = () => {
        const settings = readSettings();

        if (!state.catalog) {
            if (state.loading) {
                return `<div class="mm-state">${esc(t('正在读取官方模组市场…', 'Loading the official market…'))}</div>`;
            }
            return retryHtml();
        }

        const list = rows();
        searchIndex.clear();
        list.forEach((row) => searchIndex.set(row.id, searchTextOf(row)));

        const updates = list.filter((row) => row.hasUpdate);
        const banners = [];
        if (state.catalog.stale) {
            banners.push(
                `<div class="mm-banner is-warn">${esc(
                    t(
                        `当前显示的是 ${relativeTime(state.catalog.fetchedAt)}的缓存，没能连上官方站`,
                        `Showing a cache from ${relativeTime(state.catalog.fetchedAt)}; the market is unreachable`
                    )
                )}<button class="mm-btn is-small" data-act="refresh">${esc(t('重新读取', 'Retry'))}</button></div>`
            );
        }
        if (updates.length > 0) {
            banners.push(
                `<div class="mm-banner">${esc(t(`${updates.length} 个模组有新版本`, `${updates.length} updates available`))}` +
                `<button class="mm-btn is-small" data-act="update-all">${esc(t('全部更新', 'Update all'))}</button></div>`
            );
        }

        // 全部卡片一次画完，过滤只切 is-hidden：不再每敲一个字就把整张表重建一遍。
        return (
            banners.join('') +
            `<div class="mm-grid">${list.map((row) => cardHtml(row, settings)).join('')}</div>` +
            `<div class="mm-empty is-hidden" data-empty></div>`
        );
    };

    const applyFilter = () => {
        if (!body) return;
        const settings = readSettings();
        const query = state.query.trim().toLowerCase();
        let shown = 0;

        body.querySelectorAll('[data-card]').forEach((card) => {
            const data = card.dataset;
            let visible = true;
            if (state.filter === 'installed') visible = data.installed === '1';
            else if (state.filter === 'official') visible = data.origin === 'official';
            else if (state.filter === 'community') visible = data.origin === 'community';
            else if (state.filter === 'beta') visible = data.channel === 'beta';
            else if (!settings.betaChannel) visible = data.channel !== 'beta';
            if (visible && query) {
                const text = searchIndex.get(data.card) ?? '';
                visible = text.includes(query);
            }
            card.classList.toggle('is-hidden', !visible);
            if (visible) shown += 1;
        });

        const empty = body.querySelector('[data-empty]');
        if (empty) {
            empty.textContent = query
                ? t('没有匹配的模组，换个关键词试试。', 'No mods match that search.')
                : t('这个过滤条件下没有模组。', 'No mods under this filter.');
            empty.classList.toggle('is-hidden', shown > 0);
        }
        syncScrollbar();
    };

    /* --------------------------------------------------------- 详情卡片 */

    const coverUrlOf = (row) => (readSettings().showPreview && row.preview?.url ? row.preview.url : '');

    const channelPill = (row) => {
        if (row.channel === 'beta') return `<span class="mm-pill is-beta">Beta</span>`;
        if (row.origin === 'official') return `<span class="mm-pill is-official">${esc(t('官方', 'Official'))}</span>`;
        if (row.origin === 'community') return `<span class="mm-pill">${esc(t('社区', 'Community'))}</span>`;
        return `<span class="mm-pill">${esc(t('本地', 'Local'))}</span>`;
    };

    const signedAtOf = (row) => row.signedAt || row.signature?.signedAt || '';

    const sheetActionHtml = (row) => {
        const job = jobOf(row.id);
        if (job && job.phase !== 'error') {
            const label = job.phase === 'download'
                ? t('下载中…', 'Downloading…')
                : job.phase === 'install'
                    ? t('安装中…', 'Installing…')
                    : t('等待确认…', 'Waiting…');
            return `<button type="button" class="mm-btn is-primary" disabled>${esc(label)}</button>`;
        }
        if (job?.phase === 'error') {
            const act = row.hasUpdate || !row.installed ? 'install' : 'enable';
            return `<button type="button" class="mm-btn is-primary" data-act="${act}" data-id="${esc(row.id)}">${esc(t('重试', 'Retry'))}</button>`;
        }
        if (row.localOnly) {
            return `<button type="button" class="mm-btn" data-act="open-dir">${esc(t('打开模组目录', 'Open mods folder'))}</button>`;
        }
        if (row.hasUpdate) {
            return `<button type="button" class="mm-btn is-primary" data-act="install" data-id="${esc(row.id)}">${esc(
                t(`更新到 ${row.version}`, `Update to ${row.version}`)
            )}</button>`;
        }
        if (row.installed) {
            return row.enabled
                ? `<button type="button" class="mm-btn" disabled>${esc(t('已启用', 'Enabled'))}</button>`
                : `<button type="button" class="mm-btn is-primary" data-act="enable" data-id="${esc(row.id)}">${esc(t('启用', 'Enable'))}</button>`;
        }
        return `<button type="button" class="mm-btn is-primary" data-act="install" data-id="${esc(row.id)}">${esc(t('安装', 'Install'))}</button>`;
    };

    /*
     * 卡片内容：封面 → 名字（旁边挂 Beta / 官方 + 版本）→ 作者 / 维护者 / 大小 / 签名时间
     * → 三个链接按钮 → 功能简介（默认 6 行，可展开）→ 其他信息 → 权限（放最后）。
     * 安装按钮不在这里，它固定在卡片底部那条 footer 里。
     */
    const sheetContentHtml = (row) => {
        const cover = coverUrlOf(row);
        const coverHtml = cover
            ? `<div class="mm-sheet-cover is-zoomable" data-act="zoom" data-url="${esc(cover)}" title="${esc(t('点击放大', 'Click to enlarge'))}">` +
              `<img src="${esc(cover)}" alt="" referrerpolicy="no-referrer" data-thumb>` +
              `<span class="mm-zoom">${SVG_ZOOM}${esc(t('点击放大', 'Enlarge'))}</span></div>`
            : `<div class="mm-sheet-cover"><div class="mm-ph">${esc(String(row.name || row.id).slice(0, 2))}</div></div>`;

        const meta = [
            `<span><i>${esc(t('来源', 'From'))}</i>${esc(
                row.origin === 'official' ? t('官方', 'Official') : row.origin === 'community' ? t('社区', 'Community') : t('本地', 'Local')
            )}</span>`,
            `<span><i>${esc(t('作者', 'Author'))}</i>${esc(row.author || t('未署名', 'unattributed'))}</span>`,
        ];
        if (row.owners.length > 0) {
            meta.push(`<span><i>${esc(t('维护者', 'Maintainer'))}</i>${esc(row.owners.join('、'))}</span>`);
        }
        if (row.download?.size) {
            meta.push(`<span><i>${esc(t('大小', 'Size'))}</i>${esc(formatSize(row.download.size))}</span>`);
        }
        if (signedAtOf(row)) {
            meta.push(`<span><i>${esc(t('签名于', 'Signed'))}</i>${esc(formatTime(signedAtOf(row)))}</span>`);
        }

        const links = [];
        if (row.source) {
            links.push(`<button type="button" class="mm-link-btn" data-act="external" data-url="${esc(row.source)}">${SVG_SOURCE}${esc(t('源码仓库', 'Source'))}</button>`);
        }
        if (row.page) {
            links.push(`<button type="button" class="mm-link-btn" data-act="external" data-url="${esc(row.page)}">${SVG_GLOBE}${esc(t('官网页面', 'Official page'))}</button>`);
        }
        if (row.download) {
            links.push(`<button type="button" class="mm-link-btn" data-act="external" data-url="${esc(row.download.url)}">${SVG_DOWNLOAD}${esc(t('直接下载 zip', 'Download zip'))}</button>`);
        }

        const expanded = state.expanded.has(row.id);
        const descHtml =
            `<div class="mm-block"><h4>${esc(t('功能简介', 'About'))}</h4>` +
            `<div class="mm-desc${expanded ? '' : ' is-clamp'}" data-desc>${esc(String(row.description).trim())}</div>` +
            `<button type="button" class="mm-expand" data-act="expand" data-id="${esc(row.id)}" hidden>` +
            `${esc(expanded ? t('收起', 'Show less') : t('展开全部', 'Show more'))}${SVG_CHEVRON}</button>` +
            `</div>`;

        const facts = [];
        if (row.folia) facts.push([t('兼容 Folia', 'Needs Folia'), `<code>${esc(row.folia)}</code>`]);
        if (row.depends.length > 0) facts.push([t('依赖', 'Depends'), esc(row.depends.join('、'))]);
        if (row.experimental.length > 0) {
            facts.push([
                t('实验接口', 'Experimental'),
                row.experimental.map((id) => `<span class="mm-pill">${esc(id)}</span>`).join(' '),
            ]);
        }
        if (row.installedVersion) {
            facts.push([
                t('已安装', 'Installed'),
                esc(`v${row.installedVersion}${row.enabled ? t(' · 已启用', ' · enabled') : ''}`),
            ]);
        }
        const keyLabel = row.signature?.keyLabel
            ? `${row.signature.keyLabel}${row.signature.status ? ` · ${row.signature.status}` : ''}`
            : row.keyLabel || t('未签名', 'Unsigned');
        facts.push([t('签名密钥', 'Signing key'), esc(keyLabel)]);
        if (row.download?.sha256) facts.push([t('包哈希', 'SHA-256'), `<code>${esc(row.download.sha256)}</code>`]);

        const factsHtml =
            `<div class="mm-block"><h4>${esc(t('其他信息', 'Details'))}</h4><dl class="mm-kv">` +
            facts.map(([key, value]) => `<dt>${esc(key)}</dt><dd>${value}</dd>`).join('') +
            `</dl></div>`;

        const permsHtml = row.permissions.length === 0
            ? `<div class="mm-block"><h4>${esc(t('权限', 'Permissions'))}</h4>` +
              `<div class="mm-list"><div><em>${esc(t('不需要任何权限', 'No permissions'))}</em></div></div></div>`
            : `<div class="mm-block"><h4>${esc(t('权限', 'Permissions'))}</h4><div class="mm-list">${row.permissions
                .map((id) => `<div><span class="mm-pill">${esc(id)}</span><span>${esc(permissionText(id))}</span></div>`)
                .join('')}</div></div>`;

        return (
            coverHtml +
            `<div class="mm-sheet-body">` +
            `<div class="mm-sheet-title">${esc(row.name)}<span class="mm-ver">v${esc(row.version)}</span>` +
            channelPill(row) +
            (row.hasUpdate ? `<span class="mm-pill is-update">${esc(t('可更新', 'Update'))}</span>` : '') +
            `</div>` +
            `<div class="mm-sheet-meta">${meta.join('')}</div>` +
            (links.length > 0 ? `<div class="mm-linkrow">${links.join('')}</div>` : '') +
            descHtml +
            factsHtml +
            permsHtml +
            `</div>`
        );
    };

    const sheetFooterHtml = (row) => {
        const job = jobOf(row.id);
        const error = job?.phase === 'error' ? `<div class="mm-err">${esc(job.error || '')}</div>` : '';
        return error + sheetActionHtml(row);
    };

    /*
     * 6 行之外才给「展开」。以前是比像素高度，pre-wrap 下的末尾换行、亚像素行高都会
     * 让「全文高度」比「可见高度」大一点点，于是明明显示全了还挂着展开。
     * 现在换成数行：去掉 clamp 量全文高度，除以行高，超过 6 行才显示按钮。
     */
    const measureDesc = (row) => {
        const desc = sheetScroll?.querySelector('[data-desc]');
        const button = sheetScroll?.querySelector('.mm-expand');
        if (!desc || !button) return;
        if (state.expanded.has(row.id)) {
            button.hidden = false;
            return;
        }
        const clamped = desc.clientHeight;
        desc.classList.remove('is-clamp');
        const full = desc.scrollHeight;
        desc.classList.add('is-clamp');
        if (!clamped) {
            button.hidden = true; // 还没排过版，先别给
            return;
        }
        const lineHeight = parseFloat(window.getComputedStyle(desc).lineHeight) || 22;
        const lines = Math.max(1, Math.round(full / lineHeight));
        button.hidden = lines <= 6;
    };

    const paintSheet = () => {
        if (!sheetWrap || !sheetScroll || sheetWrap.hidden) return;
        const row = rows().find((entry) => entry.id === state.detailId);
        if (!row) {
            closeSheet();
            return;
        }
        const top = sheetScroll.scrollTop;
        sheetScroll.innerHTML = sheetContentHtml(row);
        if (sheetFooter) sheetFooter.innerHTML = sheetFooterHtml(row);
        sheetScroll.scrollTop = top;
        bindThumbs(sheetScroll);
        measureDesc(row);
    };

    const openSheet = (id) => {
        if (!sheetWrap) return;
        const alreadyOpen = !sheetWrap.hidden && sheetWrap.classList.contains('is-open');
        state.detailId = id;
        state.expanded.delete(id); // 每次打开都从折叠开始
        if (!alreadyOpen) {
            // 先把 hidden 摘掉再画内容：paintSheet 在 hidden 时会直接返回，
            // 顺序反了就会开出一张空卡片。
            sheetWrap.hidden = false;
            root?.classList.add('is-sheet-open'); // 锁住下面列表的滚动条
            measureSafeBottom();
            void sheetWrap.offsetWidth; // 让 translateY(103%) 先落地，动画才会真的从下面滑上来
        }
        paintSheet();
        sheetScroll.scrollTop = 0;
        if (!alreadyOpen) sheetWrap.classList.add('is-open');
    };

    const closeSheet = () => {
        if (!sheetWrap || sheetWrap.hidden) return;
        closeLightbox();
        sheetWrap.classList.remove('is-open');
        window.setTimeout(() => {
            if (sheetWrap && !sheetWrap.classList.contains('is-open')) {
                sheetWrap.hidden = true;
                state.detailId = null;
                root?.classList.remove('is-sheet-open');
            }
        }, 340);
    };

    /* ------------------------------------------------ 封面放大（可缩放） */

    let lbScale = 1;
    let lbX = 0;
    let lbY = 0;
    let lbDrag = null;

    const lbImage = () => (lightbox ? lightbox.querySelector('img') : null);

    const applyLightboxTransform = () => {
        const image = lbImage();
        if (!image) return;
        image.style.transform = `translate(${lbX}px, ${lbY}px) scale(${lbScale})`;
        lightbox.classList.toggle('is-zoomed', lbScale > 1.001);
        const hint = lightbox.querySelector('.mm-lb-hint');
        if (hint) {
            hint.textContent = lbScale > 1.001
                ? t('滚轮缩放 · 拖动移动 · 双击还原', 'Scroll to zoom · drag to pan · double-click to reset')
                : t('滚轮缩放 · 点图片外关闭', 'Scroll to zoom · click outside to close');
        }
    };

    const resetLightboxZoom = () => {
        lbScale = 1;
        lbX = 0;
        lbY = 0;
        lbDrag = null;
        lightbox?.classList.remove('is-dragging');
        applyLightboxTransform();
    };

    // 放大后允许平移，但别让图被拖出视野太多。
    const clampLightboxPan = () => {
        const image = lbImage();
        if (!image) return;
        const maxX = (image.clientWidth * (lbScale - 1)) / 2 + 12;
        const maxY = (image.clientHeight * (lbScale - 1)) / 2 + 12;
        lbX = Math.min(maxX, Math.max(-maxX, lbX));
        lbY = Math.min(maxY, Math.max(-maxY, lbY));
    };

    const onLightboxWheel = (event) => {
        if (!lightbox?.classList.contains('is-open')) return;
        const image = lbImage();
        if (!image) return;
        event.preventDefault();
        const factor = Math.exp(-event.deltaY * 0.0016);
        const next = Math.min(5, Math.max(1, lbScale * factor));
        if (Math.abs(next - lbScale) < 0.0005) return;
        // 以指针为锚点缩放：指针底下的那一点不许跑。
        const rect = image.getBoundingClientRect();
        const dx = event.clientX - (rect.left + rect.width / 2);
        const dy = event.clientY - (rect.top + rect.height / 2);
        const ratio = next / lbScale;
        lbX = dx - (dx - lbX) * ratio;
        lbY = dy - (dy - lbY) * ratio;
        lbScale = next;
        if (lbScale <= 1.001) {
            lbScale = 1;
            lbX = 0;
            lbY = 0;
        }
        clampLightboxPan();
        applyLightboxTransform();
    };

    const onLightboxPointerDown = (event) => {
        if (!lightbox?.classList.contains('is-open') || lbScale <= 1.001) return;
        if (event.button !== 0) return;
        lbDrag = { x: event.clientX, y: event.clientY, ox: lbX, oy: lbY, moved: 0 };
        lightbox.classList.add('is-dragging');
        try {
            lightbox.setPointerCapture(event.pointerId);
        } catch (_) {}
    };

    const onLightboxPointerMove = (event) => {
        if (!lbDrag) return;
        const dx = event.clientX - lbDrag.x;
        const dy = event.clientY - lbDrag.y;
        lbX = lbDrag.ox + dx;
        lbY = lbDrag.oy + dy;
        lbDrag.moved = Math.max(lbDrag.moved, Math.abs(dx) + Math.abs(dy));
        clampLightboxPan();
        applyLightboxTransform();
    };

    const onLightboxPointerUp = (event) => {
        if (!lbDrag) return;
        const moved = lbDrag.moved;
        lbDrag = null;
        lightbox.classList.remove('is-dragging');
        try {
            lightbox.releasePointerCapture(event.pointerId);
        } catch (_) {}
        if (moved > 6) lightbox.dataset.suppressClick = '1';
    };

    const onLightboxDoubleClick = (event) => {
        if (!lightbox?.classList.contains('is-open')) return;
        event.preventDefault();
        if (lbScale > 1.001) {
            resetLightboxZoom();
            return;
        }
        lbScale = 2.4;
        lbX = 0;
        lbY = 0;
        applyLightboxTransform();
    };

    const openLightbox = (url) => {
        if (!lightbox || !url) return;
        const image = lbImage();
        if (image) {
            image.src = url;
            image.alt = '';
        }
        resetLightboxZoom();
        lightbox.classList.add('is-open');
    };

    const closeLightbox = () => {
        if (!lightbox) return;
        lightbox.classList.remove('is-open');
        resetLightboxZoom();
    };

    const headMetaHtml = () => {
        const catalog = state.catalog;
        const installedCount = state.installed.size;
        const updateCount = rows().filter((row) => row.hasUpdate).length;
        const pieces = [];

        if (catalog) {
            const where = catalog.source === 'network'
                ? t('刚刚从官方站读取', 'fetched from the official site')
                : t(`缓存于 ${relativeTime(catalog.fetchedAt)}`, `cached ${relativeTime(catalog.fetchedAt)}`);
            pieces.push(`<span>${esc(t(`共 ${catalog.mods.length} 个模组 · ${where}`, `${catalog.mods.length} mods · ${where}`))}</span>`);
        }
        pieces.push(`<span>${esc(t(`已装 ${installedCount} 个`, `${installedCount} installed`))}</span>`);
        if (updateCount > 0) {
            pieces.push(`<span style="color:var(--mm-ink)">${esc(t(`${updateCount} 个可更新`, `${updateCount} updates`))}</span>`);
        }
        if (catalog && catalog.stale && catalog.error) {
            pieces.push(`<span>${esc(t('离线：', 'Offline: '))}${esc(humanError(catalog.error))}</span>`);
        }
        pieces.push(`<a data-act="external" data-url="${esc(CATALOG_ORIGIN)}">${esc(t('在浏览器打开官方站', 'Open the official site'))}</a>`);
        return pieces.join('');
    };

    const paint = () => {
        if (!root || !body) return;
        // 重画列表时把滚动位置带上：innerHTML 一换，列表就会跳回顶部，
        // 安装进度一变就跳一下，看着像画面在抽。
        const keepTop = body.scrollTop;
        if (headMeta) headMeta.innerHTML = headMetaHtml();
        body.innerHTML = listHtml();
        body.scrollTop = keepTop;
        bindThumbs(body);
        applyFilter();
        if (toolbar) {
            toolbar.querySelectorAll('[data-filter]').forEach((element) => {
                element.classList.toggle('is-on', element.dataset.filter === state.filter);
            });
            const input = toolbar.querySelector('input[data-search]');
            if (input && input.value !== state.query) {
                input.value = state.query;
            }
            const refreshButton = toolbar.querySelector('[data-act="refresh"]');
            if (refreshButton) {
                refreshButton.disabled = state.loading;
            }
        }
        // 详情开着时一起刷新：安装进度、启用状态、可更新标记都会在这里变。
        paintSheet();
    };

    /*
     * 封面按需加载：市场上六十多个模组，一次性把六十多张 jpg 全拉下来，首屏被图片挤爆。
     * 卡片先只带 data-src；进入「视口 + 下面两行」这个范围才补 src，解码完再淡入。
     * 两条路都能触发：IntersectionObserver（常态，便宜）和一次手动的矩形比对
     * （挂载后、滚动时）。后者是兜底——某些环境里 IO 的回调会拖到很晚才来。
     */
    let thumbObserver = null;
    const thumbPending = new Set();
    let thumbFrame = 0;
    // 已经出现在屏幕上的封面 URL。列表重画（搜索、装完刷新）时直接按「已就绪」处理，
    // 不然每敲一个字所有封面都要重新淡入一次，看着像在闪。
    const loadedThumbs = new Set();

    const thumbUrl = (image) => image.dataset.src || image.getAttribute('src') || '';

    const loadThumb = (image) => {
        thumbPending.delete(image);
        thumbObserver?.unobserve(image);
        if (!image.getAttribute('src') && image.dataset.src) {
            image.setAttribute('src', image.dataset.src);
        }
    };

    const loadThumbsInView = () => {
        if (!body || thumbPending.size === 0) return;
        const view = body.getBoundingClientRect();
        if (!view.height) return;
        const top = view.top - 160;
        const bottom = view.bottom + 580; // 约两行卡片
        Array.from(thumbPending).forEach((image) => {
            if (!image.isConnected) {
                thumbPending.delete(image);
                return;
            }
            const rect = image.getBoundingClientRect();
            if (rect.bottom < top || rect.top > bottom) return;
            loadThumb(image);
        });
    };

    /* 浮层滚动条：只画不占位。滚的时候亮一下，停手 0.9 秒淡出。 */
    const syncScrollbar = () => {
        if (!body || !scrollbarEl) return;
        const thumb = scrollbarEl.firstElementChild;
        const viewH = body.clientHeight;
        const contentH = body.scrollHeight;
        if (!thumb || viewH <= 0 || contentH <= viewH + 4) {
            scrollbarEl.classList.remove('is-on');
            return false;
        }
        const trackH = scrollbarEl.clientHeight;
        const height = Math.max(30, Math.round((trackH * viewH) / contentH));
        const max = contentH - viewH;
        const ratio = max > 0 ? Math.min(1, Math.max(0, body.scrollTop / max)) : 0;
        thumb.style.height = `${height}px`;
        thumb.style.transform = `translateY(${Math.round((trackH - height) * ratio)}px)`;
        return true;
    };

    const flashScrollbar = () => {
        if (!scrollbarEl) return;
        if (!syncScrollbar()) return; // 内容没超出，没必要亮
        scrollbarEl.classList.add('is-on');
        window.clearTimeout(scrollHideTimer);
        scrollHideTimer = window.setTimeout(() => {
            if (scrollbarEl) scrollbarEl.classList.remove('is-on');
        }, 900);
    };

    const onBodyScroll = () => {
        flashScrollbar();
        queueThumbCheck();
    };

    // 用定时器而不是 rAF 做节流：窗口不在前台时 rAF 会被挂起，封面就再也不补了。
    const queueThumbCheck = () => {
        if (thumbFrame) return;
        thumbFrame = window.setTimeout(() => {
            thumbFrame = 0;
            loadThumbsInView();
        }, 80);
    };

    const ensureThumbObserver = () => {
        if (thumbObserver || typeof IntersectionObserver !== 'function' || !body) return thumbObserver;
        thumbObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) loadThumb(entry.target);
                });
            },
            { root: body, rootMargin: '140px 0px 580px 0px', threshold: 0 }
        );
        return thumbObserver;
    };

    const bindThumbs = (scope) => {
        const rootEl = scope ?? body;
        if (!rootEl) return;
        const isList = rootEl === body;
        if (isList) {
            ensureThumbObserver();
            thumbObserver?.disconnect();
            thumbPending.clear();
        }

        rootEl.querySelectorAll('img[data-thumb]').forEach((image) => {
            const holder = image.parentElement;
            const settle = () => holder?.classList.remove('is-pending');
            const markPending = () => holder?.classList.add('is-pending');

            const ready = () => {
                settle();
                const url = thumbUrl(image);
                if (url) loadedThumbs.add(url);
                delete image.dataset.retried;
                image.classList.add('is-ready');
            };
            const broken = () => {
                // 失败先静默重试一次（带 ?retry=1 绕开可能被缓存的失败），还不行才换成 ♪
                if (image.dataset.retried !== '1' && thumbUrl(image)) {
                    image.dataset.retried = '1';
                    image.classList.remove('is-ready');
                    image.removeAttribute('src');
                    markPending();
                    window.setTimeout(() => {
                        if (!image.isConnected) return;
                        const url = thumbUrl(image);
                        if (!url) return;
                        image.setAttribute('src', url.includes('?') ? `${url}&retry=1` : `${url}?retry=1`);
                    }, 2000);
                    return;
                }
                settle();
                if (!holder) return;
                const fallback = document.createElement('div');
                fallback.className = 'mm-ph';
                fallback.textContent = '♪';
                image.replaceWith(fallback);
            };

            if (image.getAttribute('src') && image.complete && image.naturalWidth > 0) {
                ready();
                return;
            }
            if (loadedThumbs.has(thumbUrl(image))) {
                // 这张图之前就加载过：直接把 src 补上并立刻显示，不再走淡入
                settle();
                image.classList.add('is-ready');
                if (!image.getAttribute('src') && image.dataset.src) image.setAttribute('src', image.dataset.src);
                return;
            }
            if (image.dataset.bound === '1') return;
            image.dataset.bound = '1';
            image.addEventListener('load', ready);
            image.addEventListener('error', broken);

            if (!image.getAttribute('src') && image.dataset.src) {
                markPending();
                thumbPending.add(image);
                thumbObserver?.observe(image);
            }
        });

        // 先按矩形算一遍：首屏和下面两行立刻开始下载，不等 IO 的回调。
        loadThumbsInView();
    };

    /*
     * 播放器的进度条浮在页面底部，悬停还会从 85 长到 130 那种高度，正好压住安装按钮
     * 和列表最后一行。宿主给进度条打了 data-folium-part="progress.root"，顺着它往上
     * 找到还贴着底部的那层容器，把它的高度换成底部安全区。
     */
    let safeBottom = 0;

    const measureSafeBottom = () => {
        if (!root || !root.isConnected) return;
        const rect = root.getBoundingClientRect();
        if (rect.height < 40) return;

        let bar = null;
        try {
            bar = document.querySelector('[data-folium-part="progress.root"]');
        } catch (_) {
            bar = null;
        }
        if (!bar || !bar.getClientRects().length) return;
        const barRect = bar.getBoundingClientRect();
        if (barRect.height <= 0 || barRect.bottom <= 0) return;

        let top = barRect.top;
        let node = bar;
        for (let depth = 0; depth < 8; depth += 1) {
            const parent = node.parentElement;
            if (!parent || parent === document.body || parent === document.documentElement) break;
            if (parent.contains(root)) break;
            const box = parent.getBoundingClientRect();
            if (box.height <= 0 || box.height > 260) break;
            if (box.width < 120) break;
            if (box.bottom < rect.bottom - 48) break;
            top = Math.min(top, box.top);
            node = parent;
        }

        // 悬停展开后还会更高，按 1.5 倍留：宁可在进度条后面多留一点，也别再压住按钮。
        const collapsed = Math.max(0, rect.bottom - top);
        const next = Math.min(240, Math.round(collapsed * 1.5) + 10);
        // 记住历史最大值（避免悬停展开时数值来回跳），但每次都要确认当前这个节点上
        // 真的写进去了——页面被宿主重挂载时是新的 root，旧的 CSS 变量不会跟过来。
        if (next > safeBottom) safeBottom = next;
        const cssValue = `${safeBottom}px`;
        if (root.style.getPropertyValue('--mm-safe-bottom') !== cssValue) {
            root.style.setProperty('--mm-safe-bottom', cssValue);
        }
    };

    /*
     * 点击统一走这里：面板、列表、详情卡片、放大层全挂在 root 里，一个监听器就够。
     * 命中 data-act 的按动作走；没命中的看看是不是点在某张卡片上（整卡可点）。
     */
    const dispatch = (event) => {
        const node = event.target instanceof Element ? event.target : null;
        if (!node) return;

        const actEl = node.closest('[data-act]');
        if (!actEl) {
            const card = node.closest('[data-card]');
            if (card?.dataset.card) openSheet(card.dataset.card);
            return;
        }

        const action = actEl.dataset.act;
        const id = actEl.dataset.id;

        if (action === 'sheet-close') {
            closeSheet();
            return;
        }
        if (action === 'lightbox-close') {
            if (lightbox?.dataset.suppressClick === '1') {
                delete lightbox.dataset.suppressClick; // 刚拖完，这一下是拖动的收尾
                return;
            }
            if (node.tagName === 'IMG') return; // 点图片是缩放/拖动，不关
            closeLightbox();
            return;
        }
        if (action === 'zoom') {
            openLightbox(actEl.dataset.url);
            return;
        }
        if (action === 'expand' && id) {
            if (state.expanded.has(id)) state.expanded.delete(id);
            else state.expanded.add(id);
            paintSheet();
            return;
        }
        if (action === 'refresh' || action === 'retry') {
            void refresh({ force: true });
            return;
        }
        if (action === 'detail' && id) {
            openSheet(id);
            return;
        }
        if (action === 'external') {
            event.preventDefault();
            openInBrowser(actEl.dataset.url);
            return;
        }
        if (action === 'open-dir') {
            void bridge()?.openModsDirectory?.();
            return;
        }
        if (action === 'update-all') {
            void updateAll();
            return;
        }
        if ((action === 'install' || action === 'enable') && id) {
            const row = rows().find((entry) => entry.id === id);
            if (!row) return;
            if (action === 'install') void install(row);
            else void enableOnly(row);
        }
    };

    const onToolbarClick = (event) => {
        const chip = event.target instanceof Element ? event.target.closest('[data-filter]') : null;
        if (chip) {
            state.filter = chip.dataset.filter || 'all';
            toolbar.querySelectorAll('[data-filter]').forEach((element) => {
                element.classList.toggle('is-on', element.dataset.filter === state.filter);
            });
            applyFilter();
        }
    };

    const buildDom = (container, ctx) => {
        // 宿主重载模组时可能先挂新的再卸旧的：先把上一次留下的面板摘掉，避免叠两份。
        try {
            container.querySelectorAll('[data-mm-root]').forEach((node) => node.remove());
        } catch (_) {}

        root = document.createElement('div');
        root.className = 'mm-root';
        root.dataset.mmRoot = '1';

        const style = document.createElement('style');
        style.textContent = CSS;

        const head = document.createElement('div');
        head.className = 'mm-head';
        head.innerHTML =
            `<div class="mm-title">${esc(t('模组市场', 'Mod market'))}<small>${esc(
                t('官方站的全部模组，点安装就不用再走浏览器', 'Every mod from the official market, installable in place')
            )}</small></div>` +
            `<div class="mm-head-actions">` +
            `<button type="button" class="mm-btn is-small is-ghost" data-act="refresh" title="${esc(t('刷新市场', 'Refresh'))}">${SVG_REFRESH}${esc(t('刷新', 'Refresh'))}</button>` +
            `</div>` +
            `<div class="mm-meta"></div>`;

        toolbar = document.createElement('div');
        toolbar.className = 'mm-toolbar';
        toolbar.innerHTML =
            `<label class="mm-search">${SVG_SEARCH}<input type="search" data-search placeholder="${esc(
                t('搜索名称、作者、说明', 'Search name, author, description')
            )}" spellcheck="false"></label>` +
            `<div class="mm-chips">` +
            ['all', 'official', 'community', 'beta', 'installed']
                .map((key) => {
                    const label = {
                        all: t('全部', 'All'),
                        official: t('官方', 'Official'),
                        community: t('社区', 'Community'),
                        beta: 'Beta',
                        installed: t('已安装', 'Installed'),
                    }[key];
                    return `<button type="button" class="mm-chip${state.filter === key ? ' is-on' : ''}" data-filter="${key}">${esc(label)}</button>`;
                })
                .join('') +
            `</div>`;

        bodyWrap = document.createElement('div');
        bodyWrap.className = 'mm-body-wrap';
        body = document.createElement('div');
        body.className = 'mm-body';
        // 滚动：补加载下两行封面 + 点亮浮层滚动条
        body.addEventListener('scroll', onBodyScroll, { passive: true });
        scrollbarEl = document.createElement('div');
        scrollbarEl.className = 'mm-sb';
        scrollbarEl.innerHTML = '<i></i>';
        bodyWrap.append(body, scrollbarEl);

        headMeta = head.querySelector('.mm-meta');

        // 详情：平时 hidden，openSheet 时才从下面滑上来；只有上面两个角是圆的。
        sheetWrap = document.createElement('div');
        sheetWrap.className = 'mm-sheet-wrap';
        sheetWrap.hidden = true;
        sheetWrap.innerHTML =
            `<div class="mm-sheet-backdrop" data-act="sheet-close"></div>` +
            `<section class="mm-sheet" role="dialog" aria-modal="true">` +
            `<div class="mm-sheet-grab"></div>` +
            `<button type="button" class="mm-sheet-close" data-act="sheet-close" aria-label="${esc(t('关闭', 'Close'))}">${SVG_CLOSE}</button>` +
            `<div class="mm-sheet-scroll"></div>` +
            `<div class="mm-sheet-footer"></div>` +
            `</section>`;
        sheetScroll = sheetWrap.querySelector('.mm-sheet-scroll');
        sheetFooter = sheetWrap.querySelector('.mm-sheet-footer');

        lightbox = document.createElement('div');
        lightbox.className = 'mm-lightbox';
        lightbox.dataset.act = 'lightbox-close';
        lightbox.innerHTML =
            '<img alt="" referrerpolicy="no-referrer" draggable="false">' +
            `<div class="mm-lb-hint">${esc(t('滚轮缩放 · 点图片外关闭', 'Scroll to zoom · click outside to close'))}</div>` +
            `<button type="button" class="mm-lb-close" data-act="lightbox-close" aria-label="${esc(t('关闭', 'Close'))}">${SVG_CLOSE}</button>`;
        lightbox.addEventListener('wheel', onLightboxWheel, { passive: false });
        lightbox.addEventListener('pointerdown', onLightboxPointerDown);
        lightbox.addEventListener('pointermove', onLightboxPointerMove);
        lightbox.addEventListener('pointerup', onLightboxPointerUp);
        lightbox.addEventListener('pointercancel', onLightboxPointerUp);
        lightbox.addEventListener('dblclick', onLightboxDoubleClick);

        root.append(style, head, toolbar, bodyWrap, sheetWrap, lightbox);
        container.appendChild(root);

        const onKeyDown = (event) => {
            if (event.key !== 'Escape' && event.key !== 'Esc') return;
            if (lightbox.classList.contains('is-open')) {
                closeLightbox();
                return;
            }
            closeSheet();
        };

        root.addEventListener('click', dispatch);
        document.addEventListener('keydown', onKeyDown);
        let searchTimer = 0;
        toolbar.addEventListener('input', (event) => {
            const input = event.target;
            if (!(input instanceof HTMLInputElement) || input.dataset.search === undefined) return;
            state.query = input.value;
            window.clearTimeout(searchTimer);
            searchTimer = window.setTimeout(applyFilter, 140);
        });
        toolbar.addEventListener('click', onToolbarClick);

        // 主题：宿主可能给的是深色或浅色，颜色全部从 ctx.getTheme() 反推。
        const applyTheme = () => {
            if (!root) return;
            let theme = null;
            try {
                theme = ctx?.getTheme?.() ?? null;
            } catch (_) {
                theme = null;
            }
            if (!theme) return;
            const background = theme.backgroundColor || '#15151b';
            const ink = theme.primaryColor || '#e9e9ef';
            const muted = theme.secondaryColor || '#8b8b97';
            const accent = theme.accentColor || theme.primaryColor || '#b6a1f0';
            root.style.setProperty('--mm-ink', ink);
            root.style.setProperty('--mm-muted', muted);
            root.style.setProperty('--mm-accent', accent);
            root.style.setProperty('--mm-bg', background);
        };
        applyTheme();

        let offTheme = () => {};
        try {
            const subscribe = ctx?.onChange ?? ctx?.subscribe;
            if (typeof subscribe === 'function') {
                const handle = subscribe.call(ctx, applyTheme);
                offTheme = typeof handle === 'function' ? handle : () => {};
            }
        } catch (error) {
            warn(`主题订阅失败：${String(error?.message || error)}`);
        }

        const onResize = () => {
            measureSafeBottom();
            queueThumbCheck();
        };
        window.addEventListener('resize', onResize);

        /*
         * 这块页面是播放器里的一个页签，切走不会销毁、切回来也不会重新挂载。
         * 只在挂载时量一次的话，第二次进来时进度条可能还没布局好，安全区就永远停在 0。
         * 所以补三路：常驻低频轮询、元素尺寸变化、页面重新可见。
         */
        const safeTimer = window.setInterval(measureSafeBottom, 1200);
        let safeObserver = null;
        if (typeof ResizeObserver === 'function') {
            try {
                safeObserver = new ResizeObserver(() => measureSafeBottom());
                safeObserver.observe(root);
            } catch (_) {
                safeObserver = null;
            }
        }
        const onVisible = () => {
            if (document.visibilityState !== 'visible') return;
            window.setTimeout(measureSafeBottom, 60);
            window.setTimeout(queueThumbCheck, 60);
        };
        document.addEventListener('visibilitychange', onVisible);

        const settings = readSettings();
        paint(); // 先落一个骨架，别让页面空白
        void refresh({ force: settings.autoCheck });

        // 宿主可能比我们晚渲染进度条，隔几拍再量两次。
        const raf = typeof requestAnimationFrame === 'function'
            ? requestAnimationFrame
            : (callback) => window.setTimeout(callback, 16);
        raf(() => measureSafeBottom());
        window.setTimeout(measureSafeBottom, 350);
        window.setTimeout(measureSafeBottom, 1200);

        return () => {
            try {
                offTheme();
            } catch (_) {}
            document.removeEventListener('keydown', onKeyDown);
            document.removeEventListener('visibilitychange', onVisible);
            window.removeEventListener('resize', onResize);
            window.clearInterval(safeTimer);
            safeObserver?.disconnect();
            root?.removeEventListener('click', dispatch);
            toolbar?.removeEventListener('click', onToolbarClick);
            body?.removeEventListener('scroll', onBodyScroll);
            if (scrollHideTimer) window.clearTimeout(scrollHideTimer);
            if (thumbFrame) window.clearTimeout(thumbFrame);
            thumbFrame = 0;
            thumbPending.clear();
            thumbObserver?.disconnect();
            thumbObserver = null;
            root?.remove();
            root = null;
            body = null;
            bodyWrap = null;
            scrollbarEl = null;
            toolbar = null;
            headMeta = null;
            sheetWrap = null;
            sheetScroll = null;
            sheetFooter = null;
            lightbox = null;
            state.mounted = false;
            state.detailId = null;
            state.expanded.clear();
        };
    };

    /* ----------------------------------------------------------- 注册入口 */

    const mount = (container, ctx) => {
        if (ctx?.locale) locale = ctx.locale;
        state.mounted = true;
        return buildDom(container, ctx);
    };

    const handles = [];

    try {
        const homeTabs = folium.registries?.homeTabs;
        if (homeTabs?.register) {
            handles.push(
                homeTabs.register({
                    id: 'market',
                    label: L('模组市场', 'Mod market'),
                    order: 900,
                    mount,
                })
            );
        } else if (folium.registries?.playerPanelTabs?.register) {
            // 老宿主没有首页标签页时退到播放器侧栏，至少还能用。
            handles.push(
                folium.registries.playerPanelTabs.register({
                    id: 'market',
                    label: L('模组市场', 'Mod market'),
                    order: 260,
                    mount,
                })
            );
        }
    } catch (error) {
        warn(`市场页面注册失败：${String(error?.message || error)}`);
    }

    try {
        handles.push(
            folium.registries?.commands?.register?.({
                id: 'open-market',
                label: L('打开模组市场', 'Open the mod market'),
                description: L('浏览官方模组市场，一键安装与更新模组', 'Browse the official mod market and install or update mods'),
                run: () => {
                    try {
                        folium.ui.openHomeTab('market');
                    } catch (error) {
                        const message = String(error?.message || error);
                        warn(`openHomeTab 失败：${message}`);
                        toast(t('这个宿主版本没有首页标签页，请从首页导航进入模组市场。', 'This host has no home tabs; open the market from the home navigation.'), 'error');
                    }
                },
            })
        );
    } catch (error) {
        warn(`命令注册失败：${String(error?.message || error)}`);
    }

    // 模组被停用 / 热重载时把注册项一个个还回去。
    return () => {
        handles.forEach((handle) => {
            try {
                handle?.unregister?.();
            } catch (_) {}
        });
        state.jobs.clear();
    };
}
