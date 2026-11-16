// mods/bili-mv-window/client.mjs
//
// B站 MV 小窗 —— client 入口（渲染进程）
//
// 换歌 → 把歌名歌手交给 main 入口去 B 站搜 → 拿回「纯视频轨」的播放地址 →
// 在播放页角落用小窗播出来。
//
// 「屏蔽视频里的音乐」不是靠 <video muted> 糊过去的：B 站的 DASH 把画面和声音放在
// 两个独立的文件里，这里只取 video 那一份，播放器手里从头到尾就没有音轨。
// muted / volume=0 只是第二道保险（兜底源 durl 是有音轨的整段 mp4，那种情况必须靠它）。
//
// 扫码登录的二维码在本地画：vendor/qrcode.mjs 是 kazuhikoarase/qrcode-generator（MIT），
// 只改了末尾的模块包装。跑不了第三方图床，也躲开了 CSP 对 <img> 的限制。

import qrcode from './vendor/qrcode.mjs';

// B 站的二维码内容是 ASCII，但用 UTF-8 字节表更保险。
qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];

const SLOT = 'player.stage.front';
const ORDER = 420;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function label(zh, en) {
  return { 'zh-CN': zh, en };
}

export default function activate(folium) {
  if (folium.env.context !== 'main') return;
  const log = folium.log;

  /* ---------------------------------------------------------------- *
   * 设置
   * ---------------------------------------------------------------- */

  // secret 字段是 Folium 1.7 才有的：老宿主上整块不显示，其余功能照常。
  const hostMinor = (folium.host && folium.host.folium && folium.host.folium.minor) || 0;
  const supportsSecret = hostMinor >= 7;

  const loginSettings = supportsSecret
    ? [
        {
          key: 'cookie',
          type: 'secret',
          label: label('B 站 Cookie（登录用）', 'bilibili cookie (sign-in)'),
          description: label(
            '在浏览器登录 bilibili.com，从开发者工具里复制整段 Cookie 粘进来。含 SESSDATA 就能解锁 1080P / 1080P60 / 4K。值由系统凭证库加密保存，不进设置值、不进日志、不进导出。',
            'Paste the whole cookie string from a signed-in bilibili.com tab. SESSDATA unlocks 1080P / 1080P60 / 4K. Encrypted by the OS credential store; never in settings values, logs or exports.',
          ),
        },
      ]
    : [];

  const section = folium.registries.settingsSections.register({
    id: 'prefs',
    label: label('MV 小窗', 'MV window'),
    description: label(
      '换歌时自动在哔哩哔哩搜索这首歌的 MV，在播放页角落用小窗播放。只取视频轨，小窗里物理上没有声音。',
      'Looks the current song up on bilibili and plays its MV in a corner window. Video track only — there is no audio at all.',
    ),
    settings: [
      {
        key: 'enabled',
        type: 'boolean',
        label: label('启用小窗', 'Enable window'),
        defaultValue: true,
      },
      ...loginSettings,
      {
        key: 'size',
        type: 'select',
        label: label('小窗大小', 'Window size'),
        description: label(
          '三挡，分别约占视口宽度的 22% / 32% / 44%。位置直接拖动小窗，拖到哪记到哪。',
          'Three steps, roughly 22% / 32% / 44% of the viewport width. Drag the window itself to move it.',
        ),
        defaultValue: 'medium',
        options: [
          { value: 'small', label: label('小', 'Small') },
          { value: 'medium', label: label('中', 'Medium') },
          { value: 'large', label: label('大', 'Large') },
        ],
      },
      {
        key: 'opacity',
        type: 'number',
        label: label('不透明度（%）', 'Opacity (%)'),
        min: 20,
        max: 100,
        step: 1,
        defaultValue: 92,
      },
      {
        key: 'followPlayback',
        type: 'boolean',
        label: label('跟随播放 / 暂停', 'Follow play / pause'),
        description: label(
          '歌曲暂停时视频也暂停，歌曲继续时视频接着播。关掉就让它自己转。',
          'Pause the video with the song and resume with it. Off: the window runs on its own.',
        ),
        defaultValue: true,
      },
      {
        key: 'offsetMs',
        type: 'number',
        label: label('音画偏移（毫秒）', 'A/V offset (ms)'),
        description: label(
          '正数让视频比歌曲晚一点，负数早一点。MV 有片头时用它微调。',
          'Positive makes the video later than the song, negative earlier. Use it to compensate for an MV intro.',
        ),
        min: -5000,
        max: 5000,
        step: 100,
        defaultValue: 0,
      },
      {
        key: 'quality',
        type: 'select',
        label: label('清晰度上限', 'Quality cap'),
        description: label(
          '这是上限。未登录只有 480P/360P；粘了 Cookie 才有 1080P，大会员才有 1080P60/4K。实际拿到哪一档会写在小窗标题条上。',
          'A cap, not a promise. Signed out you only get 480p/360p; with a cookie 1080P; premium accounts 1080P60/4K. The caption shows what you actually got.',
        ),
        defaultValue: '1080p',
        options: [
          { value: '4k', label: label('4K', '4K') },
          { value: '1080p60', label: label('1080P60', '1080P60') },
          { value: '1080p', label: label('1080P', '1080P') },
          { value: '720p', label: label('720P', '720P') },
          { value: '480p', label: label('480P', '480P') },
        ],
      },
      {
        key: 'matchIgnoreCase',
        type: 'boolean',
        label: label('歌手匹配忽略大小写', 'Case-insensitive artist match'),
        description: label(
          '开：歌手名和 UP 主名都归一化成小写去比，「周杰伦」能匹配「ZHOUJIELUN」「周 杰 伦」。关：原文逐字比。',
          'On: both names get lowercased before comparing. Off: exact characters.',
        ),
        defaultValue: true,
      },
      {
        key: 'cacheMode',
        type: 'select',
        label: label('把视频存到本地', 'Save videos locally'),
        description: label(
          '存下来之后同一首 MV 秒开，B 站 CDN 抽风也能放。只存 DASH 的视频轨，落盘的本来就是无音轨的纯视频。',
          'Cached videos open instantly and survive a flaky CDN. Only the DASH video track is stored, so what lands on disk has no audio.',
        ),
        defaultValue: 'off',
        options: [
          { value: 'off', label: label('不保存', 'Off') },
          { value: 'picked', label: label('只存我手选的', 'Picked only') },
          { value: 'best', label: label('自动存匹配度最高的', 'Best match') },
        ],
      },
      {
        key: 'preferLocal',
        type: 'boolean',
        label: label('优先用本地文件', 'Prefer local files'),
        description: label(
          '开：换歌时先按「歌名 - 歌手」找本地文件，找到就直接放。关：每次都重新联网取；缓存照常存，你手动指定的 BV 也仍然走本地。',
          'On: look for a local file named after the song first. Off: always fetch online — though a BV you pick explicitly still plays from disk.',
        ),
        defaultValue: true,
      },
      {
        key: 'cacheLimitMb',
        type: 'number',
        label: label('本地占用上限（MB）', 'Local limit (MB)'),
        description: label(
          '超了就按最久没看的先删。',
          'Oldest entries are removed first when the limit is exceeded.',
        ),
        min: 100,
        max: 20000,
        step: 100,
        defaultValue: 2048,
      },
      {
        key: 'cacheDirMode',
        type: 'select',
        label: label('存放位置', 'Storage location'),
        description: label(
          '换位置不会自动搬走已经存好的文件，旧目录里的还留着，需要自己清理。',
          'Changing this does not move files you already saved; the old folder keeps them.',
        ),
        defaultValue: 'auto',
        options: [
          { value: 'auto', label: label('模组缓存目录（默认）', 'Mod cache folder') },
          { value: 'videos', label: label('系统「视频」文件夹', 'System Videos') },
          { value: 'downloads', label: label('系统「下载」文件夹', 'System Downloads') },
          { value: 'music', label: label('系统「音乐」文件夹', 'System Music') },
          { value: 'custom', label: label('自定义路径', 'Custom path') },
        ],
      },
      {
        key: 'cacheDirPath',
        type: 'text',
        label: label('自定义路径（绝对路径）', 'Custom path (absolute)'),
        description: label(
          '只在上面选了「自定义路径」时生效，例如 D:\\MV 或 /home/me/Videos/MV。目录不存在会自动建。',
          'Only used when "Custom path" is selected above. The folder is created if missing.',
        ),
        defaultValue: '',
      },
      {
        key: 'fit',
        type: 'select',
        label: label('画面填充', 'Fit'),
        defaultValue: 'cover',
        options: [
          { value: 'cover', label: label('裁切铺满', 'Cover') },
          { value: 'contain', label: label('完整显示（黑边）', 'Contain') },
        ],
      },
      {
        key: 'forceMute',
        type: 'boolean',
        label: label('强制静音（第二道保险）', 'Force mute (second guard)'),
        description: label(
          '每 250 毫秒把 muted 和 volume 拉回静音，防止被别处改回来。',
          'Puts muted and volume back to silent every 250 ms.',
        ),
        defaultValue: true,
      },
      {
        key: 'hideCaption',
        type: 'boolean',
        label: label('隐藏标题条', 'Hide caption'),
        defaultValue: false,
      },
      {
        key: 'allowEmbedFallback',
        type: 'boolean',
        label: label('允许嵌入播放器兜底', 'Allow embedded player fallback'),
        description: label(
          '直链和本地代理都拿不到时，退到 B 站官方 iframe。那个播放器跨域，没法替它静音，可能有声音。',
          'Falls back to the official bilibili iframe when every direct source fails. That player is cross-origin and cannot be muted — it may make sound.',
        ),
        defaultValue: false,
      },
    ],
  });

  const settings = () => section.settings.get();

  /** 当前缓存位置配置，传给 main 入口解析成绝对路径。 */
  function cacheSpec() {
    const value = settings();
    return {
      mode: value.cacheDirMode || 'auto',
      path: String(value.cacheDirPath || '').trim(),
    };
  }

  /* ---------------------------------------------------------------- *
   * DOM
   * ---------------------------------------------------------------- */

  // 状态要先于界面元素声明：偏移条一建好就会读 state.info.bvid。
  const state = {
    song: null,
    want: null,
    info: null,
    sources: [],
    sourceIndex: 0,
    manualHidden: false,
    loading: false,
    triedDurl: false,
    flashUntil: 0,
    generation: 0,
    lastCandidates: [],
  };

  /** 运行时外壳状态。背景模式、模糊、歌词开关都存 storage —— client 改不了宿主的设置值。 */
  const shell = { bgMode: false, blur: 0, lyricsOff: false, loaded: false };

  /** MV 当背景时，video 会被搬进这个全屏容器。 */
  const bgWrap = document.createElement('div');
  bgWrap.style.cssText =
    'position:absolute;inset:0;overflow:hidden;background:#050505;display:none';

  async function loadShellState() {
    if (shell.loaded) return;
    shell.loaded = true;
    try {
      const [bg, blur, lyricsOff] = await Promise.all([
        folium.storage.get('bgMode'),
        folium.storage.get('blurPx'),
        folium.storage.get('lyricsOff'),
      ]);
      if (typeof bg === 'boolean') shell.bgMode = bg;
      if (Number.isFinite(blur)) shell.blur = clamp(Number(blur), 0, 40);
      if (typeof lyricsOff === 'boolean') shell.lyricsOff = lyricsOff;
    } catch {
      /* 没权限就用默认值 */
    }
    applyLayout();
    if (shell.lyricsOff) applyLyricsOff();
  }

  function setBgMode(on) {
    shell.bgMode = Boolean(on);
    shell.loaded = true;
    folium.storage.set('bgMode', shell.bgMode).catch(() => {});
    applyLayout();
    folium.ui.toast(shell.bgMode ? 'MV 已铺成播放页背景' : 'MV 回到小窗', {
      durationMs: 1600,
    });
  }

  function setBlur(px) {
    shell.blur = clamp(Math.round(Number(px) || 0), 0, 40);
    shell.loaded = true;
    folium.storage.set('blurPx', shell.blur).catch(() => {});
    applyLayout();
  }

  /* ---- 歌词开关：借一个「什么都不画」的歌词模式 ---- */

  const LYRICS_OFF_MODE = () => `mod:${folium.modId}:lyrics-off`;
  let savedLyricMode = null;

  function lyricsApiReady() {
    return Boolean(
      folium.visualizer &&
        typeof folium.visualizer.setMode === 'function' &&
        typeof folium.visualizer.getMode === 'function',
    );
  }

  function applyLyricsOff() {
    if (!lyricsApiReady()) return false;
    try {
      if (savedLyricMode === null) {
        const current = folium.visualizer.getMode();
        if (current !== LYRICS_OFF_MODE()) savedLyricMode = current;
      }
      folium.visualizer.setMode(LYRICS_OFF_MODE());
      return true;
    } catch (err) {
      log.warn('切歌词模式失败', String((err && err.message) || err));
      return false;
    }
  }

  function setLyricsOff(on) {
    if (!lyricsApiReady()) {
      folium.ui.toast('当前 Folium 版本不支持切换歌词模式（需要 1.8+）', {
        type: 'error',
        durationMs: 3500,
      });
      return;
    }

    shell.lyricsOff = Boolean(on);
    shell.loaded = true;
    folium.storage.set('lyricsOff', shell.lyricsOff).catch(() => {});

    try {
      if (shell.lyricsOff) {
        applyLyricsOff();
      } else if (savedLyricMode) {
        folium.visualizer.setMode(savedLyricMode);
        savedLyricMode = null;
      }
    } catch (err) {
      log.warn('切歌词模式失败', String((err && err.message) || err));
    }
  }

  /** 同一个 video 元素在小窗和背景容器之间搬家。 */
  function placeVideo() {
    video.style.objectFit = settings().fit === 'contain' ? 'contain' : 'cover';

    // 模糊会让画面边缘露出底下的黑色，稍微放大一点把边糊到画外
    if (shell.blur > 0) {
      video.style.filter = `blur(${shell.blur}px)`;
      video.style.transform = 'scale(1.04)';
    } else {
      video.style.filter = 'none';
      video.style.transform = 'none';
    }

    if (shell.bgMode) {
      if (video.parentElement !== bgWrap) bgWrap.appendChild(video);
      bgWrap.style.display = 'block';
      return;
    }

    bgWrap.style.display = 'none';
    if (video.parentElement !== root) root.appendChild(video);
  }

  const root = document.createElement('div');
  root.style.cssText = [
    'position:absolute',
    'pointer-events:auto',
    'overflow:hidden',
    'border-radius:14px',
    'background:#050505',
    'box-shadow:0 18px 52px rgba(0,0,0,.55)',
    'aspect-ratio:16 / 9',
    'display:none',
    'transition:opacity .2s ease',
    'font-family:var(--folium-font, system-ui, -apple-system, "Segoe UI", sans-serif)',
    'z-index:6',
  ].join(';');

  const video = document.createElement('video');
  video.autoplay = true;
  video.loop = true;
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('disablepictureinpicture', '');
  video.volume = 0;
  video.style.cssText = [
    'display:block',
    'position:absolute',
    'left:0',
    'top:0',
    'width:100%',
    'height:100%',
    'object-fit:cover',
    'background:#050505',
    'z-index:0',
  ].join(';');
  root.appendChild(video);

  const statusLayer = document.createElement('div');
  statusLayer.style.cssText = [
    'position:absolute',
    'inset:0',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'padding:14px',
    'box-sizing:border-box',
    'text-align:center',
    'font-size:12px',
    'line-height:1.55',
    'color:#cfd6e4',
    'background:rgba(4,4,6,.68)',
    'pointer-events:none',
    'opacity:0',
    'transition:opacity .2s ease',
    'z-index:2',
  ].join(';');
  root.appendChild(statusLayer);

  const caption = document.createElement('div');
  caption.style.cssText = [
    'position:absolute',
    'left:0',
    'right:0',
    'bottom:0',
    'padding:20px 12px 8px',
    'box-sizing:border-box',
    'font-size:11px',
    'line-height:1.4',
    'color:#fff',
    'text-shadow:0 1px 3px rgba(0,0,0,.8)',
    'background:linear-gradient(transparent, rgba(0,0,0,.8))',
    'opacity:0',
    'transition:opacity .2s ease',
    'pointer-events:none',
    'white-space:nowrap',
    'overflow:hidden',
    'text-overflow:ellipsis',
    'z-index:1',
  ].join(';');
  root.appendChild(caption);

  /* ---------------------------------------------------------------- *
   * 偏移微调条：叠在画面上，点一下 ±100ms，按住连续调
   * ---------------------------------------------------------------- */

  const offsetBar = document.createElement('div');
  offsetBar.style.cssText = [
    'position:absolute',
    'left:50%',
    'bottom:28px',
    'transform:translateX(-50%)',
    'display:flex',
    'align-items:center',
    'gap:1px',
    'padding:2px',
    'border-radius:999px',
    'background:rgba(8,9,12,.8)',
    'border:1px solid rgba(255,255,255,.16)',
    'backdrop-filter:blur(8px)',
    'box-shadow:0 6px 18px rgba(0,0,0,.45)',
    'opacity:0',
    'transition:opacity .18s ease',
    'pointer-events:auto',
    'user-select:none',
    'z-index:3',
  ].join(';');
  root.appendChild(offsetBar);

  function makeOffsetButton(text, title) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = text;
    button.title = title;
    button.style.cssText = [
      'pointer-events:auto',
      'cursor:pointer',
      'width:24px',
      'height:22px',
      'line-height:20px',
      'padding:0',
      'font-size:13px',
      'border-radius:999px',
      'border:0',
      'background:transparent',
      'color:#dfe6f2',
      'transition:background .12s ease',
    ].join(';');
    button.addEventListener('pointerenter', () => {
      button.style.background = 'rgba(255,255,255,.14)';
    });
    button.addEventListener('pointerleave', () => {
      button.style.background = 'transparent';
    });
    offsetBar.appendChild(button);
    return button;
  }

  const btnOffsetDown = makeOffsetButton('−', '视频比歌曲更早 100ms（按住连续）');
  const offsetLabel = document.createElement('button');
  offsetLabel.type = 'button';
  offsetLabel.title = '点一下归零';
  offsetLabel.textContent = '0.0s';
  offsetLabel.style.cssText = [
    'pointer-events:auto',
    'cursor:pointer',
    'min-width:46px',
    'height:22px',
    'padding:0 4px',
    'font-size:11.5px',
    'font-variant-numeric:tabular-nums',
    'border-radius:999px',
    'border:0',
    'background:transparent',
    'color:#9fb3d1',
  ].join(';');
  offsetBar.appendChild(offsetLabel);
  const btnOffsetUp = makeOffsetButton('＋', '视频比歌曲更晚 100ms（按住连续）');

  /** 每个视频各记各的偏移：{ [bvid]: ms }。设置面板里的 offsetMs 只当没有记录时的基准。 */
  const offsets = { map: {}, loaded: false };

  function currentBvid() {
    return (state.info && state.info.bvid) || '';
  }

  function currentOffsetMs() {
    const bvid = currentBvid();
    const stored = bvid ? offsets.map[bvid] : undefined;
    if (Number.isFinite(stored)) return stored;
    return Number(settings().offsetMs) || 0;
  }

  function renderOffset() {
    const ms = currentOffsetMs();
    const abs = Math.abs(ms / 1000).toFixed(1);
    offsetLabel.textContent = `${ms > 0 ? '+' : ms < 0 ? '−' : ''}${abs}s`;
    offsetLabel.style.color = ms === 0 ? '#9fb3d1' : '#8fc4ff';
  }

  let offsetSaveTimer = 0;

  function persistOffsets() {
    if (offsetSaveTimer) clearTimeout(offsetSaveTimer);
    offsetSaveTimer = setTimeout(() => {
      offsetSaveTimer = 0;
      folium.storage.set('avOffsets', { ...offsets.map }).catch(() => {
        /* 没 filesystem.data 权限就只记在内存里 */
      });
    }, 300);
    timers.add(offsetSaveTimer);
  }

  function setOffset(ms) {
    const bvid = currentBvid();
    if (!bvid) return;
    offsets.map[bvid] = clamp(Math.round(Number(ms) / 100) * 100, -5000, 5000);
    renderOffset();
    persistOffsets();
    forceAlign('offset');
  }

  function nudgeOffset(deltaMs) {
    setOffset(currentOffsetMs() + deltaMs);
  }

  /** 按住不放连续调，松开或移出就停。 */
  function bindRepeat(button, deltaMs) {
    let repeatTimer = 0;
    const stop = () => {
      if (repeatTimer) {
        clearInterval(repeatTimer);
        repeatTimer = 0;
      }
    };

    button.addEventListener('pointerdown', (event) => {
      event.stopPropagation(); // 别让小窗把它当成拖拽
      event.preventDefault();
      nudgeOffset(deltaMs);
      stop();
      repeatTimer = setInterval(() => nudgeOffset(deltaMs), 140);
      timers.add(repeatTimer);
    });

    for (const type of ['pointerup', 'pointerleave', 'pointercancel']) {
      button.addEventListener(type, stop);
    }
  }

  bindRepeat(btnOffsetDown, -100);
  bindRepeat(btnOffsetUp, 100);

  offsetLabel.addEventListener('pointerdown', (event) => {
    event.stopPropagation();
    event.preventDefault();
    setOffset(0);
  });

  offsetBar.addEventListener('pointerdown', (event) => {
    // 点在胶囊空白处也不要触发拖拽
    event.stopPropagation();
  });

  async function loadOffsets() {
    if (offsets.loaded) return;
    offsets.loaded = true;
    try {
      const saved = await folium.storage.get('avOffsets');
      // 加载完成前用户可能已经点过 +，内存里的值优先，别被旧数据盖掉
      if (saved && typeof saved === 'object') offsets.map = { ...saved, ...offsets.map };
    } catch {
      /* 没权限就算了，全用设置里的基准值 */
    }
    renderOffset();
  }

  void loadOffsets();
  renderOffset();

  // 偏移条平时完全透明（但仍接得到指针），鼠标移到它身上才浮出来。
  offsetBar.addEventListener('pointerenter', () => {
    offsetBar.style.opacity = '1';
  });
  offsetBar.addEventListener('pointerleave', () => {
    offsetBar.style.opacity = '0';
  });

  // 标题条还是跟着整个小窗的悬停。
  root.addEventListener('pointerenter', () => {
    if (!settings().hideCaption) caption.style.opacity = '1';
  });
  root.addEventListener('pointerleave', () => {
    caption.style.opacity = '0';
  });

  /* ---------------------------------------------------------------- *
   * 手选的视频：{ [歌名⋮歌手]: bvid }
   * ---------------------------------------------------------------- */

  const pinned = { map: {}, loaded: false };

  /** 歌曲的稳定 key。同一首歌不管来自本地还是在线源，都能对上。 */
  function songKeyOf(song) {
    if (!song) return '';
    const title = String(song.title ?? song.name ?? '').trim();
    const list = Array.isArray(song.artists)
      ? song.artists
      : typeof song.artists === 'string'
        ? [song.artists]
        : song.artist
          ? [song.artist]
          : [];
    const artist = list
      .map((entry) => (typeof entry === 'string' ? entry : String((entry && entry.name) || '')))
      .filter(Boolean)
      .join(' ');
    return `${title}\u241F${artist}`.toLowerCase();
  }

  let pinnedSaveTimer = 0;

  function persistPinned() {
    if (pinnedSaveTimer) clearTimeout(pinnedSaveTimer);
    pinnedSaveTimer = setTimeout(() => {
      pinnedSaveTimer = 0;
      folium.storage.set('pinnedMv', { ...pinned.map }).catch(() => {});
    }, 300);
    timers.add(pinnedSaveTimer);
  }

  async function loadPinned() {
    if (pinned.loaded) return;
    pinned.loaded = true;
    try {
      const saved = await folium.storage.get('pinnedMv');
      if (saved && typeof saved === 'object') pinned.map = { ...saved, ...pinned.map };
    } catch {
      /* 没权限就算了 */
    }
  }

  void loadPinned();

  let statusTimer = 0;
  const timers = new Set();

  function showStatus(text, autoHideMs = 0) {
    if (statusTimer) {
      clearTimeout(statusTimer);
      statusTimer = 0;
    }
    if (!text) {
      statusLayer.style.opacity = '0';
      return;
    }
    statusLayer.textContent = text;
    statusLayer.style.opacity = '1';
    if (autoHideMs > 0) {
      statusTimer = setTimeout(() => {
        statusTimer = 0;
        statusLayer.style.opacity = '0';
      }, autoHideMs);
      timers.add(statusTimer);
    }
  }

  /** 让空窗亮一下、把一句话说清楚，然后自己收回去。 */
  function flashFor(ms) {
    state.flashUntil = Date.now() + ms;
    applyLayout();
    const timer = setTimeout(() => {
      state.flashUntil = 0;
      timers.delete(timer);
      applyLayout();
    }, ms + 40);
    timers.add(timer);
  }

  /* ---------------------------------------------------------------- *
   * 状态
   * ---------------------------------------------------------------- */

  let embedFrame = null;
  let disposeEmbed = null;
  let warnedNoLogin = false;

  function teardownEmbed() {
    if (disposeEmbed) {
      try {
        disposeEmbed();
      } catch {
        /* ignore */
      }
      disposeEmbed = null;
    }
    if (embedFrame) {
      embedFrame.remove();
      embedFrame = null;
    }
  }

  function keepSilent() {
    if (settings().forceMute === false) return;
    if (!video.muted) video.muted = true;
    if (video.volume !== 0) video.volume = 0;
    if (video.defaultMuted !== true) video.defaultMuted = true;
  }

  /** 三挡宽度，占 stage 宽度的百分比。 */
  const SIZE_VW = { small: 22, medium: 32, large: 44 };

  /** 位置是 0..1 的比例（相对舞台），拖拽后写进模组数据里。 */
  const position = { x: 0.62, y: 0.58, loaded: false, saveTimer: 0 };

  function scheduleSavePosition() {
    if (position.saveTimer) clearTimeout(position.saveTimer);
    position.saveTimer = setTimeout(() => {
      position.saveTimer = 0;
      folium.storage
        .set('windowPosition', { x: position.x, y: position.y })
        .catch(() => {
          /* 没 filesystem.data 权限就只记在内存里 */
        });
    }, 400);
    timers.add(position.saveTimer);
  }

  async function loadPosition() {
    if (position.loaded) return;
    position.loaded = true;
    try {
      const saved = await folium.storage.get('windowPosition');
      if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
        position.x = clamp(Number(saved.x), 0, 1);
        position.y = clamp(Number(saved.y), 0, 1);
        applyGeometry();
      }
    } catch {
      /* 没权限就算了，用默认位置 */
    }
  }

  /** 按舞台实际尺寸算出 px 位置，窗口再大也不会跑出边界。 */
  function applyGeometry() {
    const stage = root.parentElement;
    if (!stage) return;

    const stageRect = stage.getBoundingClientRect();
    if (!stageRect.width || !stageRect.height) return;

    const value = settings();
    const pct = SIZE_VW[value.size] || SIZE_VW.medium;
    const boxW = (stageRect.width * pct) / 100;
    const boxH = (boxW * 9) / 16;

    const maxX = Math.max(0, stageRect.width - boxW);
    const maxY = Math.max(0, stageRect.height - boxH);
    const x = Math.min(Math.max(0, position.x * stageRect.width), maxX);
    const y = Math.min(Math.max(0, position.y * stageRect.height), maxY);

    root.style.width = `${Math.round(boxW)}px`;
    root.style.left = `${Math.round(x)}px`;
    root.style.top = `${Math.round(y)}px`;
    root.style.right = 'auto';
    root.style.bottom = 'auto';
  }

  function applyLayout() {
    const value = settings();
    const opacity = clamp(Number(value.opacity) || 92, 20, 100) / 100;

    root.style.opacity = String(opacity);
    caption.style.display = value.hideCaption ? 'none' : 'block';

    // 先决定 video 待在小窗里还是铺成背景，再决定小窗本身要不要露出来
    placeVideo();
    applyGeometry();

    const shouldShow =
      Boolean(value.enabled) &&
      !shell.bgMode &&
      !state.manualHidden &&
      Boolean(state.song) &&
      (state.loading ||
        state.sources.length > 0 ||
        Boolean(state.info) ||
        state.flashUntil > Date.now());

    root.style.display = shouldShow ? 'block' : 'none';
    keepSilent();
    // 任何一次重排都顺手把偏移条刷成「当前这个 bvid」的值
    renderOffset();
  }

  /* ---------------------------------------------------------------- *
   * 拖拽
   * ---------------------------------------------------------------- */

  let drag = null;

  root.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || !root.isConnected) return;
    const stage = root.parentElement;
    if (!stage) return;

    const stageRect = stage.getBoundingClientRect();
    const rect = root.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origX: rect.left - stageRect.left,
      origY: rect.top - stageRect.top,
      w: rect.width,
      h: rect.height,
      stageW: stageRect.width,
      stageH: stageRect.height,
      moved: false,
    };

    try {
      root.setPointerCapture(event.pointerId);
    } catch {
      /* 某些环境下拿不到捕获，靠 pointermove 也能凑合 */
    }
    event.preventDefault();
  });

  root.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;

    if (!drag.moved) {
      if (Math.hypot(dx, dy) < 4) return;
      drag.moved = true;
      root.style.cursor = 'grabbing';
    }

    const maxX = Math.max(0, drag.stageW - drag.w);
    const maxY = Math.max(0, drag.stageH - drag.h);
    const x = Math.min(Math.max(0, drag.origX + dx), maxX);
    const y = Math.min(Math.max(0, drag.origY + dy), maxY);

    root.style.left = `${Math.round(x)}px`;
    root.style.top = `${Math.round(y)}px`;
    root.style.right = 'auto';
    root.style.bottom = 'auto';
  });

  function endDrag(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;

    const moved = drag.moved;
    drag = null;
    root.style.cursor = '';

    if (!moved) {
      // 没拖动 = 点了一下，打开候选列表
      applyLayout();
      void openPicker();
      return;
    }

    const stage = root.parentElement;
    if (!stage) return;
    const stageRect = stage.getBoundingClientRect();
    const rect = root.getBoundingClientRect();
    if (!stageRect.width || !stageRect.height) return;

    position.x = clamp((rect.left - stageRect.left) / stageRect.width, 0, 1);
    position.y = clamp((rect.top - stageRect.top) / stageRect.height, 0, 1);

    scheduleSavePosition();
    // 用比例重算一次 px，顺便把宽度拉回当前挡位，避免拖完和边界夹取打架
    applyLayout();
  }

  root.addEventListener('pointerup', endDrag);
  root.addEventListener('pointercancel', endDrag);
  root.style.cursor = 'grab';

  window.addEventListener('resize', () => {
    if (root.isConnected) applyGeometry();
  });

  void loadPosition();
  void loadShellState();

  /* ---------------------------------------------------------------- *
   * 扫码登录
   * ---------------------------------------------------------------- */

  const login = {
    open: false,
    key: '',
    state: 'idle',
    message: '',
    busy: false,
    generation: 0,
  };

  const loginRoot = document.createElement('div');
  loginRoot.style.cssText = [
    'position:absolute',
    'inset:0',
    'display:none',
    'z-index:40',
    'font-family:var(--folium-font, system-ui, -apple-system, "Segoe UI", sans-serif)',
  ].join(';');

  const backdrop = document.createElement('div');
  backdrop.style.cssText = [
    'position:absolute',
    'inset:0',
    'pointer-events:auto',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'background:rgba(6,7,10,.68)',
    'backdrop-filter:blur(6px)',
  ].join(';');
  loginRoot.appendChild(backdrop);

  const card = document.createElement('div');
  card.style.cssText = [
    'position:relative',
    'pointer-events:auto',
    'width:min(360px, 88vw)',
    'padding:20px 20px 16px',
    'box-sizing:border-box',
    'border-radius:16px',
    'background:#15161b',
    'border:1px solid rgba(255,255,255,.09)',
    'box-shadow:0 26px 72px rgba(0,0,0,.62)',
    'color:#e9edf5',
    'text-align:center',
  ].join(';');
  backdrop.appendChild(card);

  const cardTitle = document.createElement('div');
  cardTitle.textContent = '扫码登录 B 站';
  cardTitle.style.cssText = 'font-size:15px;font-weight:600;letter-spacing:.02em';
  card.appendChild(cardTitle);

  const cardHint = document.createElement('div');
  cardHint.textContent = '登录后 MV 能拿到 1080P / 1080P60 / 4K';
  cardHint.style.cssText = 'margin-top:6px;font-size:12px;color:#9aa4b8';
  card.appendChild(cardHint);

  const loginCanvas = document.createElement('canvas');
  loginCanvas.style.cssText =
    'display:block;margin:16px auto 0;width:240px;height:240px;border-radius:10px;background:#fff';
  card.appendChild(loginCanvas);

  const loginStateText = document.createElement('div');
  loginStateText.style.cssText =
    'margin-top:14px;font-size:12.5px;line-height:1.55;color:#c6cede;min-height:20px';
  card.appendChild(loginStateText);

  const loginActions = document.createElement('div');
  loginActions.style.cssText = 'margin-top:14px;display:flex;gap:10px;justify-content:center';
  card.appendChild(loginActions);

  const btnRefreshQr = document.createElement('button');
  btnRefreshQr.textContent = '换一张';
  const btnCloseLogin = document.createElement('button');
  btnCloseLogin.textContent = '关闭';
  for (const button of [btnRefreshQr, btnCloseLogin]) {
    button.style.cssText = [
      'pointer-events:auto',
      'cursor:pointer',
      'padding:7px 16px',
      'font-size:12.5px',
      'border-radius:9px',
      'border:1px solid rgba(255,255,255,.14)',
      'background:rgba(255,255,255,.06)',
      'color:#e9edf5',
      'transition:background .15s ease',
    ].join(';');
    loginActions.appendChild(button);
  }

  /** 把二维码矩阵画到 canvas 上，留 4 模块静区。 */
  function drawQr(text) {
    let qr;
    let count = 0;
    const matrix = [];

    try {
      qr = qrcode(0, 'M');
      qr.addData(text);
      qr.make();
      count = qr.getModuleCount();
      for (let row = 0; row < count; row += 1) {
        const cells = new Array(count);
        for (let col = 0; col < count; col += 1) cells[col] = qr.isDark(row, col);
        matrix.push(cells);
      }
    } catch (err) {
      log.error('二维码生成失败', String((err && err.message) || err));
      return false;
    }

    const quiet = 4;
    const total = count + quiet * 2;
    const dpr = window.devicePixelRatio || 1;
    const px = Math.round(240 * dpr);

    loginCanvas.width = px;
    loginCanvas.height = px;

    const ctx = loginCanvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, px, px);

    const cell = px / total;
    ctx.fillStyle = '#000000';
    for (let row = 0; row < count; row += 1) {
      for (let col = 0; col < count; col += 1) {
        if (!matrix[row][col]) continue;
        ctx.fillRect(
          Math.round((col + quiet) * cell),
          Math.round((row + quiet) * cell),
          Math.ceil(cell),
          Math.ceil(cell),
        );
      }
    }
    return true;
  }

  function syncLogin() {
    loginRoot.style.display = login.open ? 'block' : 'none';
    loginStateText.textContent = login.message || '';
    const refreshLocked = login.state === 'loading' || login.state === 'confirmed' || login.busy;
    btnRefreshQr.disabled = refreshLocked;
    btnRefreshQr.style.opacity = refreshLocked ? '0.45' : '1';
  }

  async function refreshQr() {
    if (!login.open) return;

    const generation = login.generation;
    login.busy = true;
    login.state = 'loading';
    login.message = '正在向 B 站要二维码…';
    syncLogin();

    let result;
    try {
      result = await folium.rpc.call('qrGenerate');
    } catch (err) {
      if (generation !== login.generation) return;
      login.busy = false;
      login.state = 'error';
      login.message = `要二维码失败：${String((err && err.message) || err)}`;
      syncLogin();
      return;
    }

    if (generation !== login.generation || !login.open) return;
    login.busy = false;

    if (!result || !result.ok) {
      login.state = 'error';
      login.message = `要二维码失败：${(result && result.error) || 'unknown'}`;
      syncLogin();
      return;
    }

    login.key = result.key;
    login.state = 'waiting';

    if (!drawQr(result.url)) {
      login.state = 'error';
      login.message = '二维码画不出来';
      syncLogin();
      return;
    }

    login.message = '用 B 站手机 App 扫一下这张码';
    syncLogin();
  }

  async function finishLogin(cookie) {
    login.busy = true;
    login.message = '登录成功，正在保存…';
    syncLogin();

    try {
      await folium.secrets.set('cookie', cookie);
    } catch (err) {
      log.error('保存 cookie 失败', String((err && err.message) || err));
      login.busy = false;
      login.message = `登录成功，但写进凭证库失败：${String((err && err.message) || err)}`;
      syncLogin();
      return;
    }

    login.message = '登录成功，正在按新账号重新取流';
    syncLogin();
    folium.ui.toast('B 站登录成功，MV 画质已解锁', { type: 'success', durationMs: 3000 });

    try {
      await folium.rpc.call('refreshSession');
    } catch {
      /* 忽略，下面重新取流会自己刷新 */
    }

    warnedNoLogin = false;

    const timer = setTimeout(() => {
      timers.delete(timer);
      closeLogin();
    }, 1200);
    timers.add(timer);

    const song = state.song || peekCurrentSong();
    if (song) await load(song);

    login.busy = false;
    syncLogin();
  }

  function closeLogin() {
    login.open = false;
    login.generation += 1;
    login.key = '';
    login.state = 'idle';
    login.message = '';
    syncLogin();
  }

  async function pollLogin() {
    if (!login.open || login.busy || !login.key) return;
    if (login.state === 'confirmed' || login.state === 'expired' || login.state === 'error') return;

    const generation = login.generation;
    login.busy = true;

    let result;
    try {
      result = await folium.rpc.call('qrPoll', login.key);
    } catch {
      login.busy = false;
      return;
    }

    if (generation !== login.generation || !login.open) {
      login.busy = false;
      return;
    }

    login.busy = false;
    if (!result) return;

    switch (result.state) {
      case 'waiting':
        if (login.state !== 'waiting') {
          login.state = 'waiting';
          login.message = result.message || '等待扫码…';
          syncLogin();
        }
        return;

      case 'scanned':
        login.state = 'scanned';
        login.message = result.message || '扫到了，在手机上点确认';
        syncLogin();
        return;

      case 'expired':
        login.state = 'expired';
        login.message = result.message || '二维码过期了，点「换一张」';
        syncLogin();
        return;

      case 'confirmed':
        login.state = 'confirmed';
        await finishLogin(result.cookie);
        return;

      default:
        login.state = 'error';
        login.message = result.message || '未知状态';
        syncLogin();
    }
  }

  async function openLogin() {
    if (!supportsSecret) {
      folium.ui.toast('当前 Folium 版本没有 secret 字段，扫码登录用不了（需要 1.7+）', {
        type: 'error',
        durationMs: 4000,
      });
      return;
    }

    login.open = true;
    login.generation += 1;
    login.state = 'loading';
    login.message = '正在向 B 站要二维码…';
    syncLogin();

    if (!loginRoot.isConnected) {
      folium.ui.navigate('player');
      // app.overlay 图层要等播放页挂载，晚一帧再同步一次可见性
      const timer = setTimeout(() => {
        timers.delete(timer);
        syncLogin();
      }, 400);
      timers.add(timer);
    }

    await refreshQr();
  }

  backdrop.addEventListener('pointerdown', (event) => {
    if (event.target === backdrop) closeLogin();
  });
  btnCloseLogin.addEventListener('click', () => closeLogin());
  btnRefreshQr.addEventListener('click', () => {
    void refreshQr();
  });

  /* ---------------------------------------------------------------- *
   * 候选选择：按匹配度排 5 个，用户自己点
   * ---------------------------------------------------------------- */

  const picker = {
    open: false,
    items: [],
    current: '',
    subtitle: '',
  };

  const pickerRoot = document.createElement('div');
  pickerRoot.style.cssText = [
    'position:absolute',
    'inset:0',
    'display:none',
    'z-index:41',
    'font-family:var(--folium-font, system-ui, -apple-system, "Segoe UI", sans-serif)',
  ].join(';');

  const pickerBackdrop = document.createElement('div');
  pickerBackdrop.style.cssText = [
    'position:absolute',
    'inset:0',
    'pointer-events:auto',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'background:rgba(6,7,10,.66)',
    'backdrop-filter:blur(6px)',
  ].join(';');
  pickerRoot.appendChild(pickerBackdrop);

  const pickerCard = document.createElement('div');
  pickerCard.style.cssText = [
    'position:relative',
    'pointer-events:auto',
    'width:min(520px, 92vw)',
    'max-height:76vh',
    'overflow:auto',
    'padding:18px',
    'box-sizing:border-box',
    'border-radius:16px',
    'background:#15161b',
    'border:1px solid rgba(255,255,255,.09)',
    'box-shadow:0 26px 72px rgba(0,0,0,.62)',
    'color:#e9edf5',
  ].join(';');
  pickerBackdrop.appendChild(pickerCard);

  const pickerHead = document.createElement('div');
  pickerHead.style.cssText =
    'display:flex;align-items:baseline;justify-content:space-between;margin-bottom:4px';
  pickerCard.appendChild(pickerHead);

  const pickerTitle = document.createElement('div');
  pickerTitle.textContent = '自己挑一个 MV';
  pickerTitle.style.cssText = 'font-size:15px;font-weight:600';
  pickerHead.appendChild(pickerTitle);

  const pickerSub = document.createElement('div');
  pickerSub.style.cssText = 'font-size:11.5px;color:#8f99ad';
  pickerHead.appendChild(pickerSub);

  const pickerList = document.createElement('div');
  pickerList.style.cssText = 'margin-top:12px;display:flex;flex-direction:column;gap:8px';
  pickerCard.appendChild(pickerList);

  const pickerFoot = document.createElement('div');
  pickerFoot.style.cssText = 'margin-top:14px;display:flex;justify-content:flex-end';
  pickerCard.appendChild(pickerFoot);

  const btnClosePicker = document.createElement('button');
  btnClosePicker.textContent = '关闭';
  btnClosePicker.style.cssText = [
    'pointer-events:auto',
    'cursor:pointer',
    'padding:7px 18px',
    'font-size:12.5px',
    'border-radius:9px',
    'border:1px solid rgba(255,255,255,.14)',
    'background:rgba(255,255,255,.06)',
    'color:#e9edf5',
  ].join(';');
  pickerFoot.appendChild(btnClosePicker);

  /* ---- 第 6 格：自由搜索 ---- */

  const pickerSearch = document.createElement('div');
  pickerSearch.setAttribute('data-row', 'picker-search');
  pickerSearch.style.cssText = [
    'margin-top:12px',
    'padding-top:12px',
    'border-top:1px solid rgba(255,255,255,.09)',
    'display:flex',
    'flex-direction:column',
    'gap:7px',
  ].join(';');

  const searchLine = document.createElement('div');
  searchLine.style.cssText = 'display:flex;gap:8px;align-items:center';

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = '搜点别的…';
  searchInput.style.cssText = [
    'pointer-events:auto',
    'flex:1',
    'min-width:0',
    'padding:7px 10px',
    'font-size:12.5px',
    'font-family:inherit',
    'border-radius:9px',
    'border:1px solid rgba(255,255,255,.14)',
    'background:rgba(255,255,255,.05)',
    'color:inherit',
    'outline:none',
  ].join(';');

  const btnSearch = document.createElement('button');
  btnSearch.type = 'button';
  btnSearch.textContent = '搜索';
  btnSearch.style.cssText = [
    'pointer-events:auto',
    'cursor:pointer',
    'padding:7px 14px',
    'font-size:12.5px',
    'border-radius:9px',
    'border:1px solid rgba(255,255,255,.14)',
    'background:rgba(255,255,255,.06)',
    'color:#e9edf5',
    'flex:none',
  ].join(';');

  searchLine.append(searchInput, btnSearch);

  const searchHint = document.createElement('div');
  searchHint.style.cssText = 'font-size:11px;color:#8f99ad;line-height:1.45';
  searchHint.textContent = '当前：—';

  pickerSearch.append(searchLine, searchHint);
  pickerCard.insertBefore(pickerSearch, pickerFoot);

  let searching = false;

  function describeCurrentSong() {
    const song = state.song || peekCurrentSong();
    if (!song) return '当前：—';

    const title = String(song.title ?? song.name ?? '').trim();
    const list = Array.isArray(song.artists)
      ? song.artists
      : typeof song.artists === 'string'
        ? [song.artists]
        : song.artist
          ? [song.artist]
          : [];
    const artist = list
      .map((entry) => (typeof entry === 'string' ? entry : String((entry && entry.name) || '')))
      .filter(Boolean)
      .join(' ');

    if (!title && !artist) return '当前：—';
    return `当前：${title}${artist ? ` · ${artist}` : ''}`;
  }

  async function runFreeSearch() {
    const query = searchInput.value.trim();
    if (!query || searching) return;

    searching = true;
    btnSearch.disabled = true;
    btnSearch.textContent = '搜索中';
    picker.subtitle = `正在搜「${query}」…`;
    pickerSub.textContent = picker.subtitle;

    let result;
    try {
      result = await folium.rpc.call('searchCandidates', {
        query,
        matchIgnoreCase: settings().matchIgnoreCase !== false,
      });
    } catch (err) {
      result = { ok: false, error: String((err && err.message) || err) };
    }

    searching = false;
    btnSearch.disabled = false;
    btnSearch.textContent = '搜索';

    if (!result || !result.ok) {
      picker.subtitle = `没搜到（${(result && result.error) || 'unknown'}）`;
      pickerSub.textContent = picker.subtitle;
      return;
    }

    picker.items = Array.isArray(result.candidates) ? result.candidates : [];
    picker.current = '';
    picker.subtitle = `「${query}」· ${picker.items.length} 个`;
    renderPicker();
  }

  btnSearch.addEventListener('click', () => {
    void runFreeSearch();
  });

  searchInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    // 别让宿主把这次回车当成全局快捷键
    if (typeof event.stopPropagation === 'function') event.stopPropagation();
    if (typeof event.preventDefault === 'function') event.preventDefault();
    void runFreeSearch();
  });

  function formatTime(seconds) {
    const total = Math.max(0, Math.round(Number(seconds) || 0));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function syncPicker() {
    pickerRoot.style.display = picker.open ? 'block' : 'none';
  }

  function renderPicker() {
    pickerList.replaceChildren();
    pickerSub.textContent = picker.subtitle || `按匹配度排序 · 共 ${picker.items.length} 个`;

    if (!picker.items.length) {
      const empty = document.createElement('div');
      empty.textContent = '这一轮没搜到候选，先用命令里的「重新搜索」换个词试试。';
      empty.style.cssText = 'padding:18px;text-align:center;font-size:12.5px;color:#8f99ad';
      pickerList.appendChild(empty);
      return;
    }

    picker.items.forEach((item, index) => {
      const isCurrent = item.bvid === picker.current;

      const row = document.createElement('button');
      row.type = 'button';
      row.style.cssText = [
        'pointer-events:auto',
        'cursor:pointer',
        'display:block',
        'width:100%',
        'text-align:left',
        'padding:10px 12px',
        'box-sizing:border-box',
        'border-radius:10px',
        'border:1px solid ' + (isCurrent ? 'rgba(120,180,255,.55)' : 'rgba(255,255,255,.08)'),
        'background:' + (isCurrent ? 'rgba(90,150,255,.14)' : 'rgba(255,255,255,.03)'),
        'color:inherit',
        'font:inherit',
      ].join(';');

      const line1 = document.createElement('div');
      line1.style.cssText =
        'display:flex;gap:8px;align-items:baseline;font-size:13px;line-height:1.4';
      const idx = document.createElement('span');
      idx.textContent = `${index + 1}.`;
      idx.style.cssText = 'color:#7f8aa0;flex:none';
      const name = document.createElement('span');
      name.textContent = item.title || item.bvid;
      name.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      line1.append(idx, name);
      row.appendChild(line1);

      const line2 = document.createElement('div');
      line2.style.cssText =
        'margin-top:5px;font-size:11.5px;color:#8f99ad;display:flex;gap:10px;flex-wrap:wrap';
      const artistLabel =
        item.artistSource === 'uploader'
          ? 'UP主 ✓'
          : item.artistSource === 'title'
            ? '标题 ✓'
            : '歌手 ✗';
      const parts = [
        item.author || '未知 UP',
        formatTime(item.durationSec),
        `${item.nameHit ? '歌名 ✓' : '歌名 ✗'} ${item.nameScore > 0 ? '+' : ''}${item.nameScore}`,
        `${artistLabel} ${item.artistScore > 0 ? '+' : ''}${item.artistScore}`,
        `匹配 ${item.score}`,
      ];
      for (const text of parts) {
        const chip = document.createElement('span');
        chip.textContent = text;
        line2.appendChild(chip);
      }
      row.appendChild(line2);

      row.addEventListener('click', () => {
        void pickCandidate(item);
      });
      pickerList.appendChild(row);
    });
  }

  function openPicker() {
    picker.items = state.lastCandidates || (state.info && state.info.candidates) || [];
    picker.current = (state.info && state.info.bvid) || '';
    picker.subtitle = '';
    picker.open = true;
    syncPicker();

    // 第 6 格那行「当前：歌名 · 歌手」
    searchHint.textContent = describeCurrentSong();
    searchInput.value = '';

    if (!pickerRoot.isConnected) folium.ui.navigate('player');

    renderPicker();
  }

  function closePicker() {
    picker.open = false;
    syncPicker();
  }

  async function pickCandidate(candidate) {
    closePicker();
    const song = state.song || peekCurrentSong();
    if (!song) return;

    // 记住这次手选：下次再放到这首歌，还是用它
    pinned.map[songKeyOf(song)] = candidate.bvid;
    pinned.loaded = true;
    persistPinned();

    // 「只存我手选的」：把那一条视频轨落到本地，文件名用「歌名 - 歌手」
    if (settings().cacheMode === 'picked') {
      void folium.rpc
        .call('cacheVideo', {
          bvid: candidate.bvid,
          title: (state.want && state.want.title) || '',
          artist: (state.want && state.want.artist) || '',
          cacheLimitMb: Number(settings().cacheLimitMb) || 2048,
          cacheDir: cacheSpec(),
        })
        .then((result) => {
          if (result && result.ok && !result.already) {
            folium.ui.toast(`已存到本地：${result.slug || candidate.bvid}`, { durationMs: 2400 });
          }
        })
        .catch(() => {});
    }

    await load(song, { bvid: candidate.bvid });
  }

  pickerBackdrop.addEventListener('pointerdown', (event) => {
    if (event.target === pickerBackdrop) closePicker();
  });
  btnClosePicker.addEventListener('click', () => closePicker());

  /* ---------------------------------------------------------------- *
   * 播放
   * ---------------------------------------------------------------- */

  function playSource(index) {
    const source = state.sources[index];
    if (!source) {
      showStatus('没有可用的视频源');
      return;
    }

    teardownEmbed();
    state.sourceIndex = index;

    try {
      video.pause();
      video.removeAttribute('src');
      video.load();
    } catch {
      /* ignore */
    }

    video.src = source.url;
    keepSilent();

    const quality = state.info && state.info.quality;
    const tag =
      quality && quality.height
        ? ` · ${quality.height}P${quality.codec ? ` ${quality.codec}` : ''}`
        : '';

    showStatus(
      source.videoOnly
        ? `载入纯视频轨（无音轨）${tag}…`
        : `载入（该源含音轨，已强制静音）${tag}…`,
    );

    const playback = getPlaybackState();
    const shouldPlay = !settings().followPlayback || !playback || playback.state === 'playing';

    if (shouldPlay) {
      const promise = video.play();
      if (promise && typeof promise.catch === 'function') {
        promise.catch(() => {
          // 自动播放被拦时不报错，画面已经在那儿了；loadeddata 那一步还会再试一次。
          showStatus('自动播放被拦住了，切一下歌或点播放', 6000);
        });
      }
    }
  }

  /** 读一次播放状态；老宿主或导出窗口里拿不到就返回 null。 */
  function getPlaybackState() {
    try {
      const playback = folium.playback;
      if (!playback || typeof playback.getState !== 'function') return null;
      const stateNow = playback.getState();
      return stateNow && typeof stateNow === 'object' ? stateNow : null;
    } catch {
      return null;
    }
  }

  /**
   * 把视频拉到和歌曲同一个位置。
   *
   * 之前是「视频从头播」，而歌曲早就在第 1 分 30 秒了 —— 搜 MV 的 1.5 秒 + 载入流的 2 秒，
   * 时间全算成延后，所以越看越不对劲。现在每换一次源、每次 loadeddata 都对齐一次。
   */
  /* 对齐的防抖：seek 会重新触发 canplay，没防住就会自己喂自己 */
  let aligning = false;
  let alignUnlockTimer = 0;
  let lastAlignAt = 0;
  let alignBurst = 0;
  let alignBurstAt = 0;

  function unlockAlign() {
    aligning = false;
    if (alignUnlockTimer) {
      clearTimeout(alignUnlockTimer);
      timers.delete(alignUnlockTimer);
      alignUnlockTimer = 0;
    }
  }

  function alignToSong(reason) {
    // 正在 seek 中就别再进来
    if (aligning) return;

    // 窗口在后台时完全不对齐。后台媒体会被系统节流，seek 不生效，
    // 而 seek 又会重新触发 canplay —— 那样会无限自己喂自己，把渲染进程拖死。
    if (typeof document !== 'undefined' && document.hidden) return;

    const now = Date.now();
    if (now - lastAlignAt < 1200) return;
    lastAlignAt = now;

    // 病态保护：5 秒内已经 seek 过 3 次，说明对齐一直在失败，先停手
    if (now - alignBurstAt > 5000) {
      alignBurstAt = now;
      alignBurst = 0;
    }

    const playback = getPlaybackState();
    if (!playback) return;

    if (
      Number.isFinite(playback.position) &&
      Number.isFinite(video.duration) &&
      video.duration > 0
    ) {
      const offsetSec = currentOffsetMs() / 1000;
      const target = clamp(playback.position - offsetSec, 0, Math.max(0, video.duration - 0.5));

      if (Math.abs(video.currentTime - target) > 1.5) {
        if (alignBurst >= 3) {
          log.warn('对齐反复失败，先停一会儿', { reason, target, at: video.currentTime });
        } else {
          alignBurst += 1;
          aligning = true;
          try {
            video.currentTime = target;
          } catch {
            unlockAlign();
          }
          if (aligning) {
            // seeked 迟迟不来（后台被挂起）也要能解锁
            alignUnlockTimer = setTimeout(unlockAlign, 2500);
            timers.add(alignUnlockTimer);
          }
        }
      }
    }

    syncPlaybackState(playback.state);
  }

  /** 用户主动触发的对齐（调偏移、拖进度条）：清掉冷却和病态计数，立刻执行。 */
  function forceAlign(reason) {
    lastAlignAt = 0;
    alignBurst = 0;
    alignBurstAt = 0;
    unlockAlign();
    alignToSong(reason);
  }

  /** 跟随歌曲的播放 / 暂停 / 停止。 */
  function syncPlaybackState(playbackState) {
    if (!settings().followPlayback) {
      if (video.paused) {
        const promise = video.play();
        if (promise && typeof promise.catch === 'function') promise.catch(() => {});
      }
      return;
    }

    if (playbackState === 'playing') {
      if (video.paused) {
        const promise = video.play();
        if (promise && typeof promise.catch === 'function') promise.catch(() => {});
      }
      return;
    }

    if (!video.paused) video.pause();
  }

  function fallbackToEmbed() {
    const value = settings();
    if (!value.allowEmbedFallback || !state.info || !state.info.embedUrl) {
      showStatus('播放失败：直链被 B 站防盗链挡了，本地代理也没拿到字节。换个清晰度再试一次。');
      return;
    }

    teardownEmbed();
    embedFrame = document.createElement('div');
    embedFrame.style.cssText = 'position:absolute;inset:0;background:#000';
    root.appendChild(embedFrame);

    try {
      disposeEmbed = folium.ui.embed(embedFrame, state.info.embedUrl, {
        title: state.info.title || 'bilibili MV',
      });
      showStatus('直链失败，已退到 B 站官方播放器（它可能带声音）', 6000);
      folium.ui.toast('MV 小窗：直链失败，退到了官方播放器，这一次可能带声音', {
        type: 'info',
        durationMs: 4000,
      });
    } catch (err) {
      log.error('ui.embed 兜底失败', String((err && err.message) || err));
      showStatus('兜底播放器也起不来');
    }
  }

  video.addEventListener('error', () => {
    if (state.loading) return;
    if (!state.sources.length) return;

    const next = state.sourceIndex + 1;
    if (next < state.sources.length) {
      log.info(`视频源 ${state.sources[state.sourceIndex].kind} 失败，换下一个`);
      playSource(next);
      return;
    }

    void retryWithDurl();
  });

  /**
   * DASH 这条路全军覆没时的最后一招：回头找 B 站要 durl（整段 mp4）。
   * 它有音轨，所以 keepSilent() 会死死按住静音。
   */
  async function retryWithDurl() {
    if (state.triedDurl || !state.want) {
      fallbackToEmbed();
      return;
    }
    state.triedDurl = true;

    const generation = state.generation;
    showStatus('纯视频轨拿不到字节，回头要一份 durl 再说…');

    let again;
    try {
      again = await folium.rpc.call('resolveMv', {
        ...state.want,
        ...(state.info && state.info.bvid ? { bvid: state.info.bvid } : {}),
        quality: settings().quality,
        durlOnly: true,
      });
    } catch (err) {
      log.error('durl 重取失败', String((err && err.message) || err));
      fallbackToEmbed();
      return;
    }

    if (generation !== state.generation) return;

    if (!again || !again.ok || !again.sources || !again.sources.length) {
      fallbackToEmbed();
      return;
    }

    state.info = again;
    state.sources = again.sources;
    state.sourceIndex = 0;
    playSource(0);
    folium.ui.toast('MV 小窗：纯视频轨失败，已退到含音轨的源（强制静音）', {
      type: 'info',
      durationMs: 3500,
    });
  }

  video.addEventListener('loadeddata', () => {
    showStatus('', 0);
    forceAlign('loadeddata');
  });
  video.addEventListener('canplay', () => alignToSong('canplay'));
  video.addEventListener('seeked', unlockAlign);
  video.addEventListener('playing', () => showStatus('', 0));

  // 回到前台时补一次对齐 —— 后台期间我们没跟，回来要追上来。
  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        unlockAlign();
        return;
      }
      lastAlignAt = 0;
      alignBurst = 0;
      forceAlign('visible');
    });
  }

  /* ---------------------------------------------------------------- *
   * 换歌 → 搜 MV
   * ---------------------------------------------------------------- */

  async function load(song, options = {}) {
    if (!song) return;

    await loadPinned();
    await loadOffsets();

    // 这首歌用户手动选过视频就照旧用它，不再重新搜索
    if (!options.bvid) {
      const chosen = pinned.map[songKeyOf(song)];
      if (chosen) options = { ...options, bvid: chosen };
    }

    state.generation += 1;
    const generation = state.generation;
    const stale = () => generation !== state.generation;

    state.song = song;
    state.info = null;
    state.sources = [];
    state.sourceIndex = 0;
    state.loading = true;
    state.manualHidden = false;
    state.triedDurl = false;
    state.want = null;

    try {
      video.pause();
      video.removeAttribute('src');
      video.load();
    } catch {
      /* ignore */
    }
    teardownEmbed();

    const title = String(song.title ?? song.name ?? '').trim();
    const artistList = Array.isArray(song.artists)
      ? song.artists
      : typeof song.artists === 'string'
        ? [song.artists]
        : song.artist
          ? [song.artist]
          : [];
    const artist = artistList
      .map((entry) => (typeof entry === 'string' ? entry : String((entry && entry.name) || '')))
      .filter(Boolean)
      .join(' ');

    if (!title) {
      state.loading = false;
      showStatus('这首歌没有标题，跳过');
      flashFor(3200);
      return;
    }

    caption.textContent = '正在 B 站找 MV…';
    showStatus(`正在搜索：${title}${artist ? ` · ${artist}` : ''}`);
    applyLayout();

    const durationMs = Number(song.durationMs ?? song.duration ?? 0) || 0;
    state.want = { title, artist, durationMs };

    let result;
    try {
      result = await folium.rpc.call('resolveMv', {
        ...state.want,
        quality: settings().quality,
        matchIgnoreCase: settings().matchIgnoreCase !== false,
        cache: settings().cacheMode || 'off',
        preferLocal: settings().preferLocal !== false,
        cacheLimitMb: Number(settings().cacheLimitMb) || 2048,
        cacheDir: cacheSpec(),
        ...(options.bvid ? { bvid: options.bvid } : {}),
      });
    } catch (err) {
      if (stale()) return;
      state.loading = false;
      log.error('resolveMv 调用失败', String((err && err.message) || err));
      showStatus(`搜索失败：${String((err && err.message) || err)}`);
      flashFor(4500);
      return;
    }

    if (stale()) return;

    state.loading = false;

    if (!result || !result.ok) {
      const reason = (result && result.error) || 'unknown';
      showStatus(`没找到 MV（${reason}）\n${title}`);
      flashFor(4500);
      log.info(`没找到 MV：${reason}`, result && result.keyword);
      return;
    }

    state.info = result;
    state.sources = Array.isArray(result.sources) ? result.sources : [];

    // 候选只在搜索时更新；手动挑了某个 BV 之后列表要留着，不然换不回去。
    if (Array.isArray(result.candidates) && result.candidates.length) {
      state.lastCandidates = result.candidates;
    }

    const quality = result.quality;
    const qualityTag = quality && quality.height ? ` ${quality.height}P` : '';
    caption.textContent =
      `${result.title}${result.author ? ` · ${result.author}` : ''}${qualityTag}`;

    // bvid 换了，偏移条要立刻显示这个视频自己的偏移值，
    // 否则会留着上一个视频的数字，用户一按 +/− 就把旧值写进新视频了。
    renderOffset();

    applyLayout();
    playSource(0);

    if (
      !warnedNoLogin &&
      result.login &&
      !result.login.loggedIn &&
      ['1080p', '1080p60', '4k'].includes(settings().quality)
    ) {
      warnedNoLogin = true;
      folium.ui.toast(
        `MV 小窗：没登录 B 站，只有低清${qualityTag}。设置区粘一段 Cookie 就有 1080P。`,
        { type: 'info', durationMs: 6000 },
      );
    }

    log.info(
      `MV：${result.bvid} ${result.title}（分数 ${result.score}，${state.sources.length} 个源）`,
    );
  }

  /** 尽量拿到「当前正在放的歌」，不同宿主版本成员名不完全一样，全都试一遍。 */
  function peekCurrentSong() {
    const playback = folium.playback;
    if (!playback) return null;
    for (const method of ['getCurrentSong', 'getState', 'getSnapshot']) {
      if (typeof playback[method] !== 'function') continue;
      try {
        const value = playback[method]();
        if (!value) continue;
        if (value.song) return value.song;
        if (value.title || value.name) return value;
      } catch {
        /* 缺权限或还没有歌 */
      }
    }
    return null;
  }

  /* ---------------------------------------------------------------- *
   * 注册
   * ---------------------------------------------------------------- */

  // 一个什么都不画的歌词模式。歌词开关靠切到它实现 —— 宿主没给模组隐藏歌词的接口，
  // 但「换一个歌词模式」是公开能力，切过来就等于把歌词关了。
  folium.registries.visualizers.register({
    id: 'lyrics-off',
    label: label('（不显示歌词）', '(no lyrics)'),
    order: 9999,
    hostLayers: { background: true, subtitles: false },
    mount() {
      return () => {};
    },
  });

  folium.registries.playerPanelTabs.register({
    id: 'video',
    label: label('视频', 'Video'),
    icon: 'film',
    order: 400,
    mount(container, ctx) {
      container.style.cssText = [
        'display:flex',
        'flex-direction:column',
        'gap:14px',
        'padding:2px',
        'color:var(--folium-primary, #e9edf5)',
        'font-size:13px',
      ].join(';');

      /* 背景模式开关 */
      const bgRow = document.createElement('label');
      bgRow.setAttribute('data-row', 'bg');
      bgRow.style.cssText =
        'display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer';

      const bgText = document.createElement('div');
      const bgTitle = document.createElement('div');
      bgTitle.textContent = '作为播放页背景';
      const bgHint = document.createElement('div');
      bgHint.textContent = 'MV 铺满整页，不再占小窗';
      bgHint.style.cssText =
        'margin-top:3px;font-size:11.5px;color:var(--folium-secondary, #8f99ad)';
      bgText.append(bgTitle, bgHint);

      const bgToggle = document.createElement('input');
      bgToggle.type = 'checkbox';
      bgToggle.checked = shell.bgMode;
      bgToggle.style.cssText =
        'width:16px;height:16px;flex:none;cursor:pointer;accent-color:var(--folium-accent, #7aa2ff)';
      bgToggle.addEventListener('change', () => {
        setBgMode(bgToggle.checked);
        refresh();
      });

      bgRow.append(bgText, bgToggle);
      container.appendChild(bgRow);

      /* 歌词开关 */
      const lyricRow = document.createElement('label');
      lyricRow.setAttribute('data-row', 'lyrics');
      lyricRow.style.cssText =
        'display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer';

      const lyricText = document.createElement('div');
      const lyricTitle = document.createElement('div');
      lyricTitle.textContent = '显示歌词';
      const lyricHint = document.createElement('div');
      lyricHint.textContent = '关掉后整个播放页不显示歌词';
      lyricHint.style.cssText =
        'margin-top:3px;font-size:11.5px;color:var(--folium-secondary, #8f99ad)';
      lyricText.append(lyricTitle, lyricHint);

      const lyricToggle = document.createElement('input');
      lyricToggle.type = 'checkbox';
      lyricToggle.checked = !shell.lyricsOff;
      lyricToggle.style.cssText =
        'width:16px;height:16px;flex:none;cursor:pointer;accent-color:var(--folium-accent, #7aa2ff)';
      lyricToggle.addEventListener('change', () => {
        setLyricsOff(!lyricToggle.checked);
        refresh();
      });

      lyricRow.append(lyricText, lyricToggle);
      container.appendChild(lyricRow);

      /* 当前视频 */
      const info = document.createElement('div');
      info.style.cssText = [
        'font-size:11.5px',
        'line-height:1.55',
        'color:var(--folium-secondary, #8f99ad)',
        'word-break:break-all',
        'white-space:pre-line',
        'min-height:34px',
      ].join(';');
      container.appendChild(info);

      const btnRow = document.createElement('div');
      btnRow.style.cssText = 'display:flex;gap:8px';
      container.appendChild(btnRow);

      function makeButton(text, onClick) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = text;
        button.style.cssText = [
          'flex:1',
          'cursor:pointer',
          'padding:7px 10px',
          'font-size:12px',
          'border-radius:9px',
          'border:1px solid rgba(255,255,255,.12)',
          'background:rgba(255,255,255,.05)',
          'color:inherit',
        ].join(';');
        button.addEventListener('click', onClick);
        btnRow.appendChild(button);
        return button;
      }

      makeButton('换一个视频', () => {
        openPicker();
      });
      makeButton('重新搜索', () => {
        const song = state.song || peekCurrentSong();
        if (song) void load(song);
      });

      /* 画面模糊 */
      const blurRow = document.createElement('div');
      blurRow.setAttribute('data-row', 'blur');
      blurRow.style.cssText = [
        'display:flex',
        'flex-direction:column',
        'gap:6px',
        'padding-top:10px',
        'border-top:1px solid rgba(255,255,255,.08)',
      ].join(';');

      const blurHead = document.createElement('div');
      blurHead.style.cssText =
        'display:flex;align-items:center;justify-content:space-between';
      const blurLabel = document.createElement('span');
      blurLabel.textContent = '画面模糊';
      blurLabel.style.cssText = 'font-size:12.5px';
      const blurValue = document.createElement('span');
      blurValue.style.cssText =
        'font-size:11.5px;font-variant-numeric:tabular-nums;color:var(--folium-secondary, #8f99ad)';
      blurHead.append(blurLabel, blurValue);

      const blurSlider = document.createElement('input');
      blurSlider.type = 'range';
      blurSlider.min = '0';
      blurSlider.max = '40';
      blurSlider.step = '1';
      blurSlider.value = String(shell.blur);
      blurSlider.style.cssText =
        'width:100%;accent-color:var(--folium-accent, #7aa2ff);cursor:pointer';
      blurSlider.addEventListener('input', () => {
        setBlur(Number(blurSlider.value));
        blurValue.textContent = shell.blur > 0 ? `${shell.blur}px` : '关';
      });

      blurRow.append(blurHead, blurSlider);
      container.appendChild(blurRow);

      /* 音画偏移 */
      const offsetRow = document.createElement('div');
      offsetRow.setAttribute('data-row', 'offset');
      offsetRow.style.cssText = [
        'display:flex',
        'align-items:center',
        'justify-content:space-between',
        'gap:8px',
        'padding-top:10px',
        'border-top:1px solid rgba(255,255,255,.08)',
      ].join(';');

      const offsetText = document.createElement('div');
      offsetText.textContent = '音画偏移';
      offsetText.style.cssText = 'font-size:12.5px';

      const offsetCtrl = document.createElement('div');
      offsetCtrl.style.cssText = 'display:flex;align-items:center;gap:3px';

      function makeStepButton(text, delta) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = text;
        button.style.cssText = [
          'width:26px',
          'height:24px',
          'padding:0',
          'font-size:14px',
          'line-height:22px',
          'border-radius:8px',
          'border:1px solid rgba(255,255,255,.12)',
          'background:rgba(255,255,255,.05)',
          'color:inherit',
          'cursor:pointer',
        ].join(';');
        button.addEventListener('click', () => {
          nudgeOffset(delta);
          refresh();
        });
        offsetCtrl.appendChild(button);
      }

      makeStepButton('−', -100);

      const offsetValue = document.createElement('button');
      offsetValue.type = 'button';
      offsetValue.title = '点一下归零';
      offsetValue.style.cssText = [
        'min-width:62px',
        'height:24px',
        'padding:0 6px',
        'font-size:12px',
        'font-variant-numeric:tabular-nums',
        'border-radius:8px',
        'border:1px solid rgba(255,255,255,.12)',
        'background:rgba(255,255,255,.05)',
        'color:inherit',
        'cursor:pointer',
      ].join(';');
      offsetValue.addEventListener('click', () => {
        setOffset(0);
        refresh();
      });
      offsetCtrl.appendChild(offsetValue);

      makeStepButton('＋', 100);

      offsetRow.append(offsetText, offsetCtrl);
      container.appendChild(offsetRow);

      /* 本地缓存 */
      const cacheRow = document.createElement('div');
      cacheRow.setAttribute('data-row', 'cache');
      cacheRow.style.cssText = [
        'display:flex',
        'align-items:center',
        'justify-content:space-between',
        'gap:8px',
        'padding-top:10px',
        'border-top:1px solid rgba(255,255,255,.08)',
      ].join(';');

      const cacheInfo = document.createElement('div');
      cacheInfo.style.cssText = [
        'font-size:11.5px',
        'color:var(--folium-secondary, #8f99ad)',
        'font-variant-numeric:tabular-nums',
        'white-space:pre-line',
        'word-break:break-all',
        'line-height:1.45',
      ].join(';');
      cacheInfo.textContent = '本地：—';

      const btnClearCache = document.createElement('button');
      btnClearCache.type = 'button';
      btnClearCache.textContent = '清空缓存';
      btnClearCache.style.cssText = [
        'cursor:pointer',
        'padding:5px 12px',
        'font-size:11.5px',
        'border-radius:8px',
        'border:1px solid rgba(255,255,255,.12)',
        'background:rgba(255,255,255,.05)',
        'color:inherit',
      ].join(';');
      btnClearCache.addEventListener('click', () => {
        void folium.rpc
          .call('clearCache', { cacheDir: cacheSpec() })
          .then((result) => {
            updateCacheInfo(result);
            folium.ui.toast(`已清掉 ${(result && result.removed) || 0} 个本地视频`, {
              durationMs: 2000,
            });
          })
          .catch(() => {});
      });

      const btnRemoveThis = document.createElement('button');
      btnRemoveThis.type = 'button';
      btnRemoveThis.textContent = '删除这首';
      btnRemoveThis.title = '只删掉当前这个视频的缓存文件';
      btnRemoveThis.style.cssText = [
        'cursor:pointer',
        'padding:5px 12px',
        'font-size:11.5px',
        'border-radius:8px',
        'border:1px solid rgba(255,255,255,.12)',
        'background:rgba(255,255,255,.05)',
        'color:inherit',
        'flex:none',
      ].join(';');
      btnRemoveThis.addEventListener('click', () => {
        const song = state.song || peekCurrentSong();
        void folium.rpc
          .call('removeCache', {
            bvid: currentBvid(),
            title: (state.want && state.want.title) || (song && song.title) || '',
            artist: (state.want && state.want.artist) || '',
            cacheDir: cacheSpec(),
          })
          .then((result) => {
            if (result && result.ok) {
              updateCacheInfo(result);
              folium.ui.toast(`已删除：${result.slug}`, { durationMs: 2200 });
            } else {
              folium.ui.toast(
                (result && result.error) === 'not-cached' ? '这个视频没有缓存' : '删除失败',
                { type: 'error', durationMs: 2000 },
              );
            }
          })
          .catch(() => {});
      });

      const cacheButtons = document.createElement('div');
      cacheButtons.style.cssText = 'display:flex;gap:6px;flex:none';
      cacheButtons.append(btnRemoveThis, btnClearCache);

      cacheRow.append(cacheInfo, cacheButtons);
      container.appendChild(cacheRow);

      function formatBytes(bytes) {
        const n = Number(bytes) || 0;
        if (n >= 1024 * 1024 * 1024) return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`;
        if (n >= 1024 * 1024) return `${Math.round(n / 1024 / 1024)} MB`;
        if (n >= 1024) return `${Math.round(n / 1024)} KB`;
        return `${n} B`;
      }

      function updateCacheInfo(stats) {
        const count = stats && Number.isFinite(stats.count) ? stats.count : 0;
        const bytes = stats && Number.isFinite(stats.bytes) ? stats.bytes : 0;
        const dir = (stats && stats.dir) || '';

        const head = count ? `本地 ${count} 个 · ${formatBytes(bytes)}` : '本地 0 个';
        cacheInfo.textContent = dir ? `${head}\n${dir}` : head;
        cacheInfo.title = dir;
      }

      function pollCacheStats() {
        void folium.rpc.call('cacheStats', { cacheDir: cacheSpec() }).then(updateCacheInfo).catch(() => {});
      }

      pollCacheStats();

      function refresh() {
        bgToggle.checked = shell.bgMode;
        lyricToggle.checked = !shell.lyricsOff;
        blurSlider.value = String(shell.blur);
        blurValue.textContent = shell.blur > 0 ? `${shell.blur}px` : '关';

        const bvid = currentBvid();
        info.textContent = bvid
          ? `${(state.info && state.info.title) || bvid}\n${bvid}`
          : '还没有 MV。换歌后会自动搜一个。';

        const ms = currentOffsetMs();
        const abs = Math.abs(ms / 1000).toFixed(1);
        offsetValue.textContent = `${ms > 0 ? '+' : ms < 0 ? '−' : ''}${abs}s`;
        offsetValue.style.color =
          ms === 0 ? 'var(--folium-secondary, #8f99ad)' : '#8fc4ff';
      }

      refresh();
      const stoppers = [];
      if (typeof ctx.every === 'function') {
        stoppers.push(ctx.every(600, refresh));
        stoppers.push(ctx.every(5000, pollCacheStats));
      }

      return () => {
        for (const stop of stoppers) {
          if (typeof stop === 'function') stop();
        }
        container.replaceChildren();
      };
    },
  });

  folium.events.on('playback.songChanged', ({ song }) => {
    void load(song);
  });

  // 歌曲暂停 / 继续 / 停止时，视频跟着走。这是「音乐停了视频还在放」的直接修法。
  folium.events.on('playback.stateChanged', ({ state: playbackState }) => {
    syncPlaybackState(playbackState);
  });

  // 用户拖动歌曲进度条后，视频重新对齐，不要越差越远。
  folium.events.on('playback.seeked', () => {
    forceAlign('seeked');
  });

  folium.registries.stageLayers.register({
    id: 'window',
    slot: SLOT,
    order: ORDER,
    interactive: false,
    mount(container) {
      container.appendChild(root);
      applyLayout();
      return () => {
        root.remove();
      };
    },
  });

  folium.registries.stageLayers.register({
    id: 'backdrop',
    slot: 'player.stage.back',
    order: 100,
    interactive: false,
    mount(container) {
      container.appendChild(bgWrap);
      placeVideo();
      return () => {
        bgWrap.remove();
        // video 可能还在背景里，先搬回小窗，免得跟着容器一起消失
        if (video.parentElement !== root) root.appendChild(video);
        applyLayout();
      };
    },
  });

  folium.registries.stageLayers.register({
    id: 'login',
    slot: 'app.overlay',
    order: 900,
    interactive: false,
    mount(container) {
      container.appendChild(loginRoot);
      syncLogin();
      return () => {
        loginRoot.remove();
      };
    },
  });

  folium.registries.stageLayers.register({
    id: 'picker',
    slot: 'app.overlay',
    order: 910,
    interactive: false,
    mount(container) {
      container.appendChild(pickerRoot);
      syncPicker();
      return () => {
        pickerRoot.remove();
      };
    },
  });

  folium.registries.commands.register({
    id: 'toggle',
    label: label('BV 小窗：显示 / 隐藏', 'MV window: show / hide'),
    keywords: ['mv', 'bilibili', 'b站', '小窗', 'video'],
    run() {
      state.manualHidden = !state.manualHidden;
      applyLayout();
      folium.ui.toast(state.manualHidden ? 'MV 小窗已隐藏' : 'MV 小窗已显示', {
        durationMs: 1200,
      });
    },
  });

  folium.registries.commands.register({
    id: 'pick-video',
    label: label('BV 小窗：换一个视频', 'MV window: pick another video'),
    keywords: ['mv', 'pick', '候选', '选择', '换', 'bilibili'],
    run() {
      openPicker();
      return picker.items.length ? `候选 ${picker.items.length} 个` : '还没搜到候选';
    },
  });

  folium.registries.commands.register({
    id: 'reset-position',
    label: label('BV 小窗：重置位置和大小', 'MV window: reset position'),
    keywords: ['mv', 'reset', '位置', '重置', '拖动'],
    run() {
      position.x = 0.62;
      position.y = 0.58;
      scheduleSavePosition();
      applyLayout();
      folium.ui.toast('小窗回到右下角', { durationMs: 1500 });
      return '已重置';
    },
  });

  folium.registries.commands.register({
    id: 'toggle-lyrics',
    label: label('歌词：显示 / 隐藏', 'Lyrics: show / hide'),
    keywords: ['lyrics', '歌词', '隐藏', 'hide', 'subtitle'],
    run() {
      setLyricsOff(!shell.lyricsOff);
      return shell.lyricsOff ? '歌词已隐藏' : '歌词已显示';
    },
  });

  folium.registries.commands.register({
    id: 'forget-pick',
    label: label('BV 小窗：忘掉这首歌的手选', 'MV window: forget this pick'),
    keywords: ['mv', 'forget', '重置', '手选', '恢复'],
    run() {
      const song = state.song || peekCurrentSong();
      if (!song) return '现在没有正在播放的歌';
      const key = songKeyOf(song);
      if (!pinned.map[key]) return '这首歌本来就没手选过';
      delete pinned.map[key];
      persistPinned();
      void load(song);
      folium.ui.toast('已恢复自动挑选', { durationMs: 1600 });
      return '已恢复自动挑选';
    },
  });

  folium.registries.commands.register({
    id: 'research',
    label: label('BV 小窗：重新搜索', 'MV window: search again'),
    keywords: ['mv', 'search', '重搜', 'b站'],
    params: [
      {
        key: 'query',
        type: 'text',
        label: label('搜索词（留空＝用当前歌曲）', 'Query (empty = current song)'),
        defaultValue: '',
      },
    ],
    async run(ctx) {
      const query = String((ctx && ctx.values && ctx.values.query) || '').trim();
      if (query) {
        await load({ title: query, artists: [] });
        return `搜索：${query}`;
      }
      const song = state.song || peekCurrentSong();
      if (!song) return '现在没有正在播放的歌';
      await load(song);
      return '已重新搜索';
    },
  });

  folium.registries.commands.register({
    id: 'next-source',
    label: label('BV 小窗：换一个视频源', 'MV window: next source'),
    keywords: ['mv', 'source', '换源'],
    run() {
      if (state.sources.length < 2) return '只有一个可用源';
      const next = (state.sourceIndex + 1) % state.sources.length;
      playSource(next);
      return `切到 ${state.sources[next].kind}`;
    },
  });

  folium.registries.commands.register({
    id: 'qr-login',
    label: label('B站账号：扫码登录', 'bilibili: sign in by QR'),
    keywords: ['b站', 'bilibili', 'qrcode', '扫码', '登录', 'login', 'cookie'],
    run() {
      void openLogin();
      return '正在打开扫码登录';
    },
  });

  folium.registries.commands.register({
    id: 'bili-status',
    label: label('B站账号：检查登录状态', 'bilibili: check sign-in'),
    keywords: ['b站', 'bilibili', 'login', '登录', 'cookie', 'sessdata'],
    async run() {
      let status;
      try {
        status = await folium.rpc.call('biliStatus');
      } catch (err) {
        return `检查失败：${String((err && err.message) || err)}`;
      }

      if (!status || !status.ok) {
        return `检查失败：${(status && status.error) || 'unknown'}`;
      }
      if (!status.loggedIn) {
        return status.hasCookie
          ? 'Cookie 读到了，但 B 站说没登录 —— SESSDATA 大概过期了，重新复制一段'
          : '还没填 Cookie：设置 → 模组 → 本模组 → B 站 Cookie';
      }

      const plan = status.vip ? '大会员：1080P60 / 4K 可用' : '普通账号：最高 1080P';
      folium.ui.toast(`已登录：${status.uname}（${plan}）`, {
        type: 'success',
        durationMs: 3000,
      });
      return `已登录：${status.uname} · ${plan}`;
    },
  });

  folium.registries.commands.register({
    id: 'refresh-session',
    label: label('B站账号：刷新会话', 'bilibili: refresh session'),
    keywords: ['b站', 'bilibili', 'refresh', '刷新', 'cookie'],
    async run() {
      try {
        await folium.rpc.call('refreshSession');
      } catch (err) {
        return `刷新失败：${String((err && err.message) || err)}`;
      }
      warnedNoLogin = false;
      const song = state.song || peekCurrentSong();
      if (song) void load(song);
      return '会话已刷新，正在重新取流';
    },
  });

  // 设置一改，布局、静音策略立刻跟上。
  let lastSettingsOffset = Number(settings().offsetMs) || 0;

  const disposeSettings = section.settings.onChange(() => {
    const settingsOffset = Number(settings().offsetMs) || 0;

    // 用户在设置面板动了「音画偏移」→ 当前这个视频回落到新基准，清掉它的单独记录。
    // 其他视频各自记的偏移不动（每个视频独立）。
    if (settingsOffset !== lastSettingsOffset) {
      const bvid = currentBvid();
      if (bvid) delete offsets.map[bvid];
      persistOffsets();
      renderOffset();
      forceAlign('settings');
    }
    lastSettingsOffset = settingsOffset;

    applyLayout();
  });

  // 静音守护：每 250ms 拉回静音（forceMute 关掉时这个函数直接返回）。
  folium.every(250, keepSilent);

  // 扫码轮询：没开面板时 pollLogin 自己会立刻返回，不产生请求。
  folium.every(2000, () => {
    void pollLogin();
  });

  // 启动时如果已经在放歌，先把 MV 找出来，不用等下一次切歌。
  const first = peekCurrentSong();
  if (first) void load(first);

  log.info('bili-mv-window：client 入口已启动');

  return () => {
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
    if (statusTimer) clearTimeout(statusTimer);
    try {
      if (typeof disposeSettings === 'function') disposeSettings();
    } catch {
      /* ignore */
    }
    teardownEmbed();
    try {
      video.pause();
      video.removeAttribute('src');
      video.load();
    } catch {
      /* ignore */
    }
    root.remove();
  };
}
