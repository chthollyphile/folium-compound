// song-comments/client.mjs — 歌曲评论 v1.1.1
//
// 播放页进度条右侧的评论按钮 → 播放器侧栏「评论」页签，显示当前歌曲在网易云音乐的评论。
//
// 宿主兼容：0.7.x 的 song DTO 带 sourceRef{providerId, mediaId}；0.8.0 换成
// source（平台 id）+ id（平台原生曲目 id）+ ref（队列令牌）。两种形态都认，
// 见下面的 songSourceOf / rawIdOf。
//
// 数据来源：Folium 实验性 platform.raw（manifest 里声明 experimental: ["platform.raw"]
// 与 permissions: ["platform.netease.read"]）。用到的白名单 endpoint：
//   comment_hot     热门评论
//   comment_music   全部评论（分页）
//   search          非网易云曲目按歌名 + 歌手匹配一次
// 只读：本模组不点赞、不发表评论、不修改任何账号数据。

const ICON =
  '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>' +
  '</svg>';

const REFRESH_ICON =
  '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/></svg>';

// 页签图标用的遮罩：黑色描边只取 alpha，配合 background-color: currentColor
// 就能跟着按钮的常态 / 选中 / hover 颜色走，不用写死颜色。
const TAB_ICON_MASK =
  'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23000\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z\'/%3E%3C/svg%3E")';

const HEART_ICON =
  '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/></svg>';

// 高度：宿主把页签内容的高度量回去当外层容器的高度（ResizeObserver → st-t-unfold 的
// height），所以这里绝不能把 height 钉成「容器剩下多少」——那是拿自己的高度当输入，
// 一旦某次量到的是矮内容（比如非网易云曲目只有一行提示），就会永久锁死在这个高度。
// 只给 max-height（由 JS 按宿主给的页签可用高度设）：内容矮就自然矮，内容高就撑到
// 上限再内部滚动；拿不到宿主的可用高度就不设上限，让宿主的滚动容器接管。
const CSS = `
.sc-root{color:var(--folium-primary,#e8e8ec);font-family:var(--folium-font,system-ui);display:flex;flex-direction:column;min-width:0;min-height:0;}
.sc-inner{display:flex;flex-direction:column;flex:1 1 auto;min-height:0;}
.sc-head{display:flex;align-items:flex-start;gap:8px;padding:0 0 9px;}
.sc-head-main{min-width:0;flex:1;}
.sc-song{font-size:15px;font-weight:700;line-height:1.35;word-break:break-word;}
.sc-artist{font-size:11.5px;opacity:.6;margin-top:2px;line-height:1.5;word-break:break-word;}
.sc-count{font-size:11px;opacity:.55;white-space:nowrap;padding-top:2px;}
.sc-refresh{flex:none;margin-top:1px;width:24px;height:24px;display:flex;align-items:center;justify-content:center;border:0;border-radius:7px;background:transparent;color:inherit;opacity:.5;cursor:pointer;padding:0;}
.sc-refresh:hover{opacity:.9;background:rgba(128,128,128,.14);}
.sc-match{display:flex;align-items:center;gap:6px;font-size:10.5px;opacity:.5;padding:0 0 9px;line-height:1.5;word-break:break-word;}
.sc-match.is-warn{opacity:.85;color:#d4a13a;}
.sc-match-btn{flex:none;border:1px solid rgba(128,128,128,.32);background:transparent;color:inherit;border-radius:999px;font-size:10px;padding:1px 8px;cursor:pointer;}
.sc-tabs{display:flex;gap:2px;margin:0 0 10px;padding:2px;border-radius:9px;background:rgba(128,128,128,.1);}
.sc-tab{flex:1;border:0;background:transparent;color:inherit;font-size:11.5px;font-family:inherit;padding:5px 0;border-radius:7px;cursor:pointer;opacity:.6;}
.sc-tab.is-on{opacity:1;background:rgba(128,128,128,.2);font-weight:600;}
.sc-body{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;display:flex;flex-direction:column;gap:11px;padding-bottom:4px;}
.sc-body::-webkit-scrollbar{width:6px;}
.sc-body::-webkit-scrollbar-thumb{background:rgba(128,128,128,.3);border-radius:3px;}
.sc-item{display:flex;gap:8px;min-width:0;}
.sc-av{flex:none;width:28px;height:28px;border-radius:50%;object-fit:cover;background:rgba(128,128,128,.22);display:flex;align-items:center;justify-content:center;font-size:11px;opacity:.9;overflow:hidden;}
.sc-main{min-width:0;flex:1;}
.sc-name{display:flex;align-items:baseline;gap:5px;font-size:11px;opacity:.55;line-height:1.4;min-width:0;}
.sc-nick{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:60%;}
.sc-like{display:inline-flex;align-items:center;gap:3px;font-size:10.5px;opacity:.9;white-space:nowrap;flex:none;margin-left:auto;}
.sc-text{font-size:12.5px;line-height:1.62;margin-top:3px;word-break:break-word;overflow-wrap:anywhere;white-space:pre-wrap;}
.sc-text.is-clamp{display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden;}
.sc-more-text{border:0;background:transparent;color:inherit;font-size:11px;font-family:inherit;opacity:.5;padding:3px 0 0;cursor:pointer;}
.sc-quote{font-size:11.5px;line-height:1.55;margin-top:6px;padding:6px 9px;border-radius:8px;background:rgba(128,128,128,.1);opacity:.75;word-break:break-word;}
.sc-reply-to{opacity:.55;margin-right:3px;}
.sc-more{flex:none;align-self:center;border:1px solid rgba(128,128,128,.28);background:transparent;color:inherit;border-radius:999px;font-size:11.5px;font-family:inherit;padding:6px 18px;cursor:pointer;opacity:.75;}
.sc-more:hover{opacity:1;background:rgba(128,128,128,.12);}
.sc-state{font-size:11.5px;line-height:1.7;opacity:.55;padding:14px 2px;text-align:left;}
.sc-state b{font-weight:600;opacity:.9;}
.sc-state.is-err{opacity:.9;color:#e2725b;}
.sc-state.is-err .sc-retry{border:1px solid rgba(128,128,128,.34);background:transparent;color:inherit;border-radius:999px;font-size:11px;font-family:inherit;padding:3px 12px;margin-top:7px;cursor:pointer;display:block;}
.sc-skel{display:flex;flex-direction:column;gap:9px;padding:4px 0;}
.sc-skel-row{height:10px;border-radius:5px;background:rgba(128,128,128,.16);animation:scpulse 1.4s ease-in-out infinite;}
.sc-skel-row:nth-child(1){width:62%;}
.sc-skel-row:nth-child(2){width:92%;}
.sc-skel-row:nth-child(3){width:78%;}
@keyframes scpulse{0%,100%{opacity:.45}50%{opacity:.9}}
`;

export default function activate(folium) {
  if (!folium || folium.env?.context !== 'main') return undefined;

  let locale = 'zh-CN';
  const isZh = () => /^zh/i.test(String(locale));
  const t = (zhText, enText) => (isZh() ? zhText : enText);

  const log = (message) => {
    try {
      if (typeof folium.log?.info === 'function') folium.log.info(`[song-comments] ${message}`);
      else if (typeof folium.log?.warn === 'function') folium.log.warn(`[song-comments] ${message}`);
    } catch (_) {}
  };
  const warn = (message) => {
    try {
      if (typeof folium.log?.warn === 'function') folium.log.warn(`[song-comments] ${message}`);
    } catch (_) {}
  };

  // 宿主版本写进日志：以后排查「到底是哪个版本不兼容」省事。
  {
    const minor = Number(folium.host?.folium?.minor) || 0;
    const app = String(folium.host?.folia || '');
    log(`ready (Folia ${app || 'unknown'} / mod API 1.${minor})`);
  }

  /* ------------------------------------------------------------------ 设置 */

  const DEFAULTS = { pageSize: 20, matchBySearch: true, showAvatar: true };

  const normalizeSettings = (raw) => {
    const value = raw && typeof raw === 'object' ? raw : {};
    const pageSize = Number(value.pageSize);
    return {
      pageSize: Number.isFinite(pageSize) ? Math.min(50, Math.max(5, Math.round(pageSize))) : DEFAULTS.pageSize,
      matchBySearch: value.matchBySearch === undefined ? DEFAULTS.matchBySearch : value.matchBySearch !== false,
      showAvatar: value.showAvatar === undefined ? DEFAULTS.showAvatar : value.showAvatar !== false,
    };
  };

  // 宿主的 schema 解析只认对象形式的文案：`label: '文字'` 会被丢掉（typeof !== 'object'），
  // 界面上就退回显示原始 key。所以这里一律给 { 'zh-CN': ..., en: ... }。
  const L = (zh, en) => ({ 'zh-CN': zh, en });

  let settingsHandle = null;
  try {
    settingsHandle = folium.registries?.settingsSections?.register?.({
      id: 'settings',
      label: L('歌曲评论', 'Song comments'),
      description: L(
        '评论来自网易云音乐，只读；非网易云曲目会按歌名与歌手匹配一次。',
        'Comments come from NetEase Cloud Music and are read-only; songs from other sources are matched once by title and artist.'
      ),
      settings: [
        {
          key: 'pageSize',
          type: 'number',
          defaultValue: DEFAULTS.pageSize,
          min: 5,
          max: 50,
          step: 5,
          label: L('每页评论条数', 'Comments per page'),
          description: L('每次加载的条数，点「加载更多」继续。', 'How many comments load at a time.'),
        },
        {
          key: 'matchBySearch',
          type: 'boolean',
          defaultValue: DEFAULTS.matchBySearch,
          label: L('按歌名匹配其他平台', 'Match other sources by title'),
          description: L(
            '本地文件、QQ 音乐、Spotify 等曲目没有网易云 ID，开启后用歌名 + 歌手检索一次并取最接近的曲目；关闭则这些曲目没有评论。',
            'Local files, QQ Music and Spotify tracks have no NetEase id. When on, the title and artist are searched once and the closest track is used; when off, those tracks show no comments.'
          ),
        },
        {
          key: 'showAvatar',
          type: 'boolean',
          defaultValue: DEFAULTS.showAvatar,
          label: L('显示评论者头像', 'Show commenter avatars'),
          description: L('关闭后只显示昵称首字。', 'Off shows the first letter of the nickname instead.'),
        },
      ],
    });
  } catch (error) {
    warn(`settings section register failed: ${String(error?.message || error)}`);
  }

  const readSettings = () => {
    try {
      const value = settingsHandle?.settings?.get?.();
      return normalizeSettings(value);
    } catch (_) {
      return normalizeSettings(null);
    }
  };

  /* ------------------------------------------------------- 平台接口（只读） */

  const rawApi = () => {
    const experimental = folium.experimental;
    if (!experimental) return null;
    const raw = experimental['platform.raw'];
    return raw && typeof raw.request === 'function' ? raw : null;
  };

  const friendlyError = (error) => {
    const code = String(error?.code || error?.message || '');
    if (code.startsWith('permission-denied')) {
      return t(
        '模组没有拿到「读取网易云数据」的权限。请在模组管理里重新启用本模组并同意权限。',
        'The mod has no permission to read NetEase data. Re-enable it in Mod Manager and accept the permission.'
      );
    }
    if (code === 'endpoint-denied' || code === 'unsupported') {
      return t(
        '宿主没有开放这个网易云接口（可能是 Folia / Folium 版本变了）。',
        'The host does not open this NetEase endpoint (the Folia / Folium version may have changed).'
      );
    }
    if (code === 'aborted') return t('已取消。', 'Cancelled.');
    if (code === 'not-signed-in' || code === 'session-expired') {
      return t(
        '网易云账号未登录或登录已过期。在 Folia 里重新登录网易云后再试。',
        'The NetEase account is not signed in, or the session expired. Sign in again in Folia and retry.'
      );
    }
    if (code === 'rate-limited') return t('请求太频繁，稍等一下再点刷新。', 'Too many requests; try the refresh button in a moment.');
    if (code === 'network') return t('网络请求失败，检查一下网络或代理。', 'The request failed; check the network or proxy.');
    if (code === 'vip-required') return t('这个接口需要会员账号。', 'This endpoint needs a subscription account.');
    if (code === 'account-changed') return t('账号在请求过程中变了，重新加载一下。', 'The account changed mid-request; reload.');
    return t('请求失败：', 'Request failed: ') + (String(error?.message || code) || 'unknown');
  };

  const rawRequest = async (endpoint, params, signal) => {
    const api = rawApi();
    if (!api) {
      const error = new Error('platform.raw is not available');
      error.code = 'unsupported';
      throw error;
    }
    const answer = await api.request('netease', endpoint, params, signal ? { signal } : undefined);
    return answer?.body ?? null;
  };

  /* --------------------------------------------------------------- 曲目匹配 */

  const PLATFORM_LABEL = {
    netease: '网易云音乐',
    qq: 'QQ 音乐',
    kugou: '酷狗音乐',
    qishui: '汽水音乐',
    spotify: 'Spotify',
    ytm: 'YouTube Music',
    local: '本地文件',
    navidrome: 'Navidrome',
    stage: '外部播放',
  };

  const platformLabel = (providerId) => PLATFORM_LABEL[providerId] || String(providerId || '');

  const normalizeText = (value) =>
    String(value || '')
      .toLowerCase()
      .replace(/[（(][^）)]*[）)]/g, ' ')
      .replace(/\b(feat|ft|featuring)\.?\b.*$/g, ' ')
      .replace(/[\s\-_·•,.，。!！?？'"“”‘’/\\]+/g, '')
      .trim();

  const baseTitle = (value) => String(value || '').replace(/\s*[-–—]\s*(remaster(ed)?|live|demo|acoustic|version).*$/i, '');

  const scoreCandidate = (song, title, artist) => {
    const wantTitle = normalizeText(baseTitle(title));
    const wantArtist = normalizeText(artist);
    const gotTitle = normalizeText(baseTitle(song?.name));
    const artists = Array.isArray(song?.artists) ? song.artists : Array.isArray(song?.ar) ? song.ar : [];
    const gotArtist = normalizeText(artists.map((entry) => entry?.name).filter(Boolean).join(' '));
    if (!wantTitle || !gotTitle) return -1;

    let score = 0;
    if (wantTitle === gotTitle) score += 60;
    else if (wantTitle.includes(gotTitle) || gotTitle.includes(wantTitle)) score += 38;
    else return -1;

    if (wantArtist && gotArtist) {
      if (gotArtist.includes(wantArtist) || wantArtist.includes(gotArtist)) score += 25;
      else {
        const pieces = String(artist || '')
          .split(/[,&/、·]+/)
          .map((piece) => normalizeText(piece))
          .filter(Boolean);
        if (pieces.some((piece) => gotArtist.includes(piece))) score += 12;
      }
    }
    const duration = Number(song?.duration ?? song?.dt ?? 0);
    if (duration > 0) score += 4; // 有曲长信息的更像正式曲目
    return score;
  };

  // 0.7.x：song.sourceRef = { kind:'online', providerId, mediaId }
  // 0.8.0：song.source = 'netease' | 'qq' | 'local' | 'navidrome' | 'stage'，且没有 sourceRef。
  const songSourceOf = (song) => {
    const ref = song?.sourceRef;
    if (ref && typeof ref === 'object' && ref.providerId) return String(ref.providerId);
    if (typeof song?.source === 'string' && song.source) return song.source;
    return '';
  };

  const songArtistOf = (song) => {
    if (!song) return '';
    if (typeof song.artist === 'string') return song.artist.trim();
    const list = Array.isArray(song.artists) ? song.artists : [];
    return list
      .map((entry) => (typeof entry === 'string' ? entry : String(entry?.name || '')))
      .filter(Boolean)
      .join(' / ');
  };

  // 0.8.0 的 album 是字符串，0.7 的可能是 { name }。两种都读。
  const songAlbumOf = (song) => {
    const album = song?.album;
    if (typeof album === 'string') return album;
    if (album && typeof album === 'object') return String(album.name || '');
    return '';
  };

  const rawIdOf = (song) => {
    const ref = song?.sourceRef;
    if (ref && ref.providerId === 'netease' && ref.mediaId) return String(ref.mediaId);
    if (song && typeof song.source === 'string') {
      if (song.source !== 'netease') return null;
      // 0.8.0 公开 DTO 的 id 是平台原生曲目 id（宿主 oe() 里就是 String(e.id)）。
      // 网易云曲目 id 一定是纯数字；不是的话宁可走歌名检索，也别拿别的平台的号码去查评论。
      const id = song.id === undefined || song.id === null ? '' : String(song.id);
      if (/^\d+$/.test(id)) return id;
    }
    return null;
  };

  const searchOnce = async (title, artist, signal) => {
    const keywords = `${String(title || '').trim()} ${String(artist || '').trim()}`.trim();
    if (!keywords) return null;
    const body = await rawRequest('search', { keywords, type: 1, limit: 10, offset: 0 }, signal);
    const songs = Array.isArray(body?.result?.songs) ? body.result.songs : [];
    let best = null;
    let bestScore = -1;
    songs.forEach((song) => {
      const score = scoreCandidate(song, title, artist);
      if (score > bestScore) {
        bestScore = score;
        best = song;
      }
    });
    if (!best || bestScore < 38) return null;
    return {
      id: String(best.id),
      title: String(best.name || ''),
      artist: (Array.isArray(best.artists) ? best.artists : Array.isArray(best.ar) ? best.ar : [])
        .map((entry) => entry?.name)
        .filter(Boolean)
        .join(' / '),
      score: bestScore,
    };
  };

  /* ------------------------------------------------------------- 评论数据结构 */

  const normalizeComment = (raw) => {
    const user = raw?.user || {};
    const replied = Array.isArray(raw?.beReplied) && raw.beReplied.length > 0 ? raw.beReplied[0] : null;
    return {
      id: String(raw?.commentId ?? raw?.id ?? Math.random()),
      name: String(user.nickname || t('匿名用户', 'Anonymous')),
      avatar: String(user.avatarUrl || ''),
      content: String(raw?.content || ''),
      liked: Number(raw?.likedCount || 0) || 0,
      time: Number(raw?.time || 0) || 0,
      quotedName: replied ? String(replied?.user?.nickname || '') : '',
      quotedText: replied ? String(replied?.content || '') : '',
    };
  };

  const relativeTime = (ms) => {
    if (!ms) return '';
    const diff = Date.now() - ms;
    if (diff < 0) return '';
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    if (diff < hour) return t(`${Math.max(1, Math.round(diff / minute))} 分钟前`, `${Math.max(1, Math.round(diff / minute))} min ago`);
    if (diff < day) return t(`${Math.round(diff / hour)} 小时前`, `${Math.round(diff / hour)} h ago`);
    if (diff < 30 * day) return t(`${Math.round(diff / day)} 天前`, `${Math.round(diff / day)} d ago`);
    if (diff < 365 * day) return t(`${Math.round(diff / (30 * day))} 个月前`, `${Math.round(diff / (30 * day))} mo ago`);
    const years = diff / (365 * day);
    return years < 10
      ? t(`${years.toFixed(1)} 年前`, `${years.toFixed(1)} y ago`)
      : t(`${Math.round(years)} 年前`, `${Math.round(years)} y ago`);
  };

  const countText = (value) => {
    const number = Number(value) || 0;
    if (number < 10000) return String(number);
    const wan = number / 10000;
    return `${wan >= 100 ? Math.round(wan) : wan.toFixed(1)}${t('万', 'w')}`;
  };

  const esc = (value) =>
    String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[character]);

  /* --------------------------------------------------------------- 评论加载 */

  const cache = new Map();
  const CACHE_LIMIT = 40;
  const CACHE_TTL = 10 * 60 * 1000;

  const cacheGet = (key) => {
    const hit = cache.get(key);
    if (!hit || Date.now() - hit.at > CACHE_TTL) return null;
    return hit;
  };
  const cacheSet = (key, value) => {
    if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
    cache.set(key, { at: Date.now(), ...value });
  };

  // 不同版本的网易云接口把热门评论放在 hotComments / comments 里，也可能整包塞在 data 下。
  const unwrap = (body) => (body?.data && typeof body.data === 'object' ? body.data : body);

  const collectHot = (body) => {
    const root = unwrap(body);
    if (!root) return [];
    if (Array.isArray(root.hotComments) && root.hotComments.length > 0) return root.hotComments.map(normalizeComment);
    if (Array.isArray(root.comments) && root.comments.length > 0) return root.comments.map(normalizeComment);
    return [];
  };

  // 热门走两级：comment_hot 直取；拿不到就用 comment_music 自带的 hotComments，
  // 再退一步按点赞数给前 N 条。这样宿主端点是哪种形态都能出内容。
  const fetchHot = async ({ id, pageSize, signal }) => {
    let body = null;
    let failure = null;
    try {
      body = await rawRequest('comment_hot', { id, type: 0, limit: pageSize, offset: 0 }, signal);
    } catch (error) {
      if (String(error?.code || '') === 'aborted') throw error;
      failure = error;
      warn(`comment_hot failed, trying comment_music: ${String(error?.code || error?.message || error)}`);
    }

    let list = collectHot(body);
    let total = Number(unwrap(body)?.total || 0) || 0;

    if (list.length === 0) {
      try {
        const fallback = await rawRequest('comment_music', { id, limit: pageSize, offset: 0 }, signal);
        total = Number(unwrap(fallback)?.total || 0) || total;
        list = collectHot(fallback);
        if (list.length === 0) {
          list = (Array.isArray(unwrap(fallback)?.comments) ? unwrap(fallback).comments : [])
            .map(normalizeComment)
            .sort((left, right) => right.liked - left.liked)
            .slice(0, pageSize);
        }
      } catch (error) {
        if (String(error?.code || '') === 'aborted') throw error;
        warn(`comment_music fallback failed: ${String(error?.code || error?.message || error)}`);
        if (failure) throw failure;
        throw error;
      }
    }

    if (list.length > pageSize) list = list.slice(0, pageSize);
    return {
      list,
      total: total || list.length,
      hasMore: false,
    };
  };

  const fetchPage = async ({ id, tab, offset, pageSize, signal }) => {
    if (tab === 'hot') return fetchHot({ id, pageSize, signal });

    const limit = pageSize;
    const body = await rawRequest('comment_music', { id, limit, offset }, signal);
    const root = unwrap(body);
    const list = (Array.isArray(root?.comments) ? root.comments : []).map(normalizeComment);
    const total = Number(root?.total || 0) || 0;
    return {
      list,
      total,
      hasMore: list.length >= limit && (total === 0 ? true : offset + list.length < total),
    };
  };

  /* --------------------------------------------------------------- 进度条按钮 */

  try {
    folium.registries?.progressButtons?.register?.({
      id: 'song-comments-btn',
      slot: 'progress.trailing',
      order: 420,
      hideWhenCollapsed: true,
      mount: (container, ctx) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.title = t('查看歌曲评论', 'Song comments');
        button.setAttribute('aria-label', t('查看歌曲评论', 'Song comments'));
        let color = 'inherit';
        try {
          color = ctx?.getColors?.()?.text || 'inherit';
        } catch (_) {}
        button.style.cssText =
          'display:flex;align-items:center;justify-content:center;width:26px;height:26px;border:0;background:transparent;' +
          `color:${color};cursor:pointer;border-radius:6px;padding:0;`;
        button.innerHTML = ICON;
        const onClick = () => {
          try {
            folium.ui.openPlayerPanel('song-comments');
          } catch (error) {
            warn(`openPlayerPanel failed: ${String(error?.message || error)}`);
          }
        };
        button.addEventListener('click', onClick);
        container.appendChild(button);

        const isMini = () => window.innerWidth < 600 || window.innerHeight < 220;
        const applyMini = () => {
          button.style.display = isMini() ? 'none' : 'flex';
        };
        applyMini();
        window.addEventListener('resize', applyMini);

        return () => {
          window.removeEventListener('resize', applyMini);
          button.removeEventListener('click', onClick);
          button.remove();
        };
      },
    });
  } catch (error) {
    warn(`progress button register failed: ${String(error?.message || error)}`);
  }

  /* --------------------------------------------------------------- 页签图标 */

  // 宿主 0.7.x 的 playerPanelTabs 只收 id / label / order / mount，注册项里的 icon 会被
  // 丢掉，所有模组页签统一画成同一个拼图；而且只有侧栏窄到放不下文字时才画图标。
  // 官方没给改图标的入口，这里用 styles 注册表（宿主会把它包进 @layer folium-mods 插到
  // head）只覆盖自己那一个按钮：宿主画了图标就换成评论气泡，标签模式完全不动。
  // 用 * 匹配 data-ponder-panel-tab-button 的值，宿主改 id 拼接格式也不会误伤别的页签。
  const TAB_SEL = '[data-ponder-panel-tab-button*="song-comments"]';
  const TAB_ICON_CSS = `
${TAB_SEL} svg{display:none !important;}
${TAB_SEL} > span:has(svg)::before,
${TAB_SEL}:has(> svg)::before{
  content:"";
  flex:0 0 auto;
  width:16px;
  height:16px;
  background-color:currentColor;
  -webkit-mask-image:${TAB_ICON_MASK};
  mask-image:${TAB_ICON_MASK};
  -webkit-mask-repeat:no-repeat;
  mask-repeat:no-repeat;
  -webkit-mask-position:center;
  mask-position:center;
  -webkit-mask-size:16px 16px;
  mask-size:16px 16px;
}
`;

  const registerTabIcon = () => {
    // 模组被重新激活时别重复注入（styles 注册表对同 id 重复注册的处理各版本不一致）。
    try {
      if (typeof document !== 'undefined' && document.documentElement.hasAttribute('data-song-comments-tab-icon')) return;
    } catch (_) {}
    try {
      const styles = folium.registries?.styles;
      if (styles && typeof styles.register === 'function') {
        styles.register({ id: 'tab-icon', css: TAB_ICON_CSS });
        document.documentElement.setAttribute('data-song-comments-tab-icon', 'registry');
        return;
      }
    } catch (error) {
      warn(`tab icon style register failed: ${String(error?.message || error)}`);
    }
    // 老宿主没有 styles 注册表：自己插一张表。效果一样，只是不进 @layer folium-mods。
    try {
      if (typeof document === 'undefined' || !document.head) return;
      const el = document.createElement('style');
      el.setAttribute('data-song-comments-tab-icon', '');
      el.textContent = TAB_ICON_CSS;
      document.head.appendChild(el);
      document.documentElement.setAttribute('data-song-comments-tab-icon', 'inline');
    } catch (_) {}
  };
  registerTabIcon();

  /* ------------------------------------------------------------------ 面板 */

  try {
    folium.registries?.playerPanelTabs?.register?.({
      id: 'song-comments',
      label: { 'zh-CN': '评论', en: 'Comments' },
      order: 120,
      mount: (container, ctx) => {
        if (ctx?.locale) locale = ctx.locale;

        const root = document.createElement('div');
        root.className = 'sc-root';
        const style = document.createElement('style');
        style.textContent = CSS;
        const inner = document.createElement('div');
        inner.className = 'sc-inner';
        inner.innerHTML =
          '<div class="sc-head">' +
          '<div class="sc-head-main"><div class="sc-song">—</div><div class="sc-artist"></div></div>' +
          '<div class="sc-count"></div>' +
          `<button type="button" class="sc-refresh" data-act="refresh" title="${esc(t('重新加载', 'Reload'))}">${REFRESH_ICON}</button>` +
          '</div>' +
          '<div class="sc-match" hidden></div>' +
          '<div class="sc-tabs">' +
          `<button type="button" class="sc-tab is-on" data-act="tab" data-tab="hot">${esc(t('热门', 'Top'))}</button>` +
          `<button type="button" class="sc-tab" data-act="tab" data-tab="new">${esc(t('最新', 'Newest'))}</button>` +
          '</div>' +
          '<div class="sc-body"></div>';
        root.appendChild(style);
        root.appendChild(inner);
        container.appendChild(root);

        const headTitle = inner.querySelector('.sc-song');
        const headArtist = inner.querySelector('.sc-artist');
        const headCount = inner.querySelector('.sc-count');
        const matchRow = inner.querySelector('.sc-match');
        const tabs = Array.from(inner.querySelectorAll('.sc-tab'));
        const body = inner.querySelector('.sc-body');

        const view = {
          songKey: null,
          song: null,
          songSource: '', // 'netease' | 'qq' | 'local' …（0.8.0 的 source 字段）
          id: null,
          source: null, // 'exact' | 'search'
          match: null,
          tab: 'hot',
          total: 0,
          list: [],
          hasMore: false,
          loading: false,
          error: null,
          expanded: new Set(),
          token: 0,
          controller: null,
        };

        let disposed = false;

        /* ----------------------------- 高度自适应 -----------------------------
           宿主的页签容器不给高度，而且它的高度是从我们这里量出去的：
           ResizeObserver 量「内容区」的高度 → 写回外层折叠容器的 height。
           所以任何「量容器剩下多少、再把自己的高度钉成那个值」的写法都是回环：
           一旦某次量到的是矮内容（非网易云曲目只有一行提示），外层容器矮了，
           下次再量还是那么矮，高度就永久卡死，切到有评论的曲目也长不回来。

           正确做法是只单向地给上限，不读自己的高度：
             · 用宿主给的页签可用高度 --pn-tab-room（宿主官方页签也用这个值算高度；
               自定义属性会继承进 shadow root，读到的是宿主算好的数）；
             · 读不到就不设上限，让宿主的滚动容器接管——宁可让整块面板滚，
               也不能拿一个猜出来的上限把内容锁死。
           内容矮 → 自然矮；内容高 → 撑到上限，列表内部滚动。两头都不会卡死。
        ------------------------------------------------------------------ */

        const MAX_HEIGHT_MARGIN = 12;
        let appliedMaxHeight = '';
        let roomLogged = false;

        // 宿主把「页签内容的可用高度」放在 --pn-tab-room 上（它自己的队列页签也用这个值
        // 算列表高度）。自定义属性会继承进 shadow root，所以直接读到的是宿主算好的数，
        // 不用自己去猜 header / 底栏占了多少。
        const hostTabRoom = () => {
          try {
            const value = getComputedStyle(root).getPropertyValue('--pn-tab-room').trim();
            return value && value !== 'initial' && value !== 'none' ? value : '';
          } catch (_) {
            return '';
          }
        };

        const applyMaxHeight = () => {
          if (disposed || !root.isConnected) return;
          if (!root.getBoundingClientRect().width) return; // 不在前台，量不到就不用算
          const room = hostTabRoom();
          // 拿不到宿主变量就干脆不设上限：内容自然排开，交给宿主的滚动容器去滚。
          // 退而用「视口底 − 我的顶」是不行的——面板底边锚定、高度由内容撑出来，
          // 内容一矮顶就下移，兜底值跟着变小，又会把高度锁死在矮内容那一档。
          const next = room ? `calc(${room} - ${MAX_HEIGHT_MARGIN}px)` : '';
          if (!roomLogged) {
            roomLogged = true;
            // 宿主换了变量名的话，这行会变成 room=-，高度就退回「让宿主自己滚」。
            log(`height cap room=${room || '-'} maxHeight=${next || 'none'}`);
          }
          if (next === appliedMaxHeight) return;
          appliedMaxHeight = next;
          root.style.maxHeight = next;
        };

        // 内容变化（骨架 → 列表 / 列表 → 状态文案）后立刻重算一次，别等 ticker。
        const scheduleMaxHeight = () => {
          const raf = typeof requestAnimationFrame === 'function'
            ? requestAnimationFrame
            : (callback) => setTimeout(callback, 16);
          raf(() => applyMaxHeight());
        };

        const setTab = (tab) => {
          if (view.tab === tab) return;
          view.tab = tab === 'new' ? 'new' : 'hot';
          view.list = [];
          view.total = 0;
          view.hasMore = false;
          view.expanded.clear();
          tabs.forEach((element) => {
            element.classList.toggle('is-on', element.dataset.tab === view.tab);
          });
          body.scrollTop = 0;
          void load(true);
        };

        const paintSkeleton = () => {
          body.innerHTML =
            '<div class="sc-skel">' +
            '<div class="sc-skel-row"></div><div class="sc-skel-row"></div><div class="sc-skel-row"></div>' +
            '<div class="sc-skel-row"></div><div class="sc-skel-row"></div>' +
            '</div>';
        };

        const paintState = (html, isError) => {
          body.innerHTML = `<div class="sc-state${isError ? ' is-err' : ''}">${html}</div>`;
        };

        const itemHtml = (comment, settings) => {
          const longText = comment.content.length > 150;
          const open = view.expanded.has(comment.id);
          const avatar = settings.showAvatar && comment.avatar
            ? `<img class="sc-av" src="${esc(comment.avatar)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-avatar>`
            : `<div class="sc-av">${esc(comment.name.slice(0, 1))}</div>`;
          const quote = comment.quotedText
            ? `<div class="sc-quote"><span class="sc-reply-to">@${esc(comment.quotedName || t('某人', 'someone'))}：</span>${esc(comment.quotedText)}</div>`
            : '';
          const moreButton = longText
            ? `<button type="button" class="sc-more-text" data-act="expand" data-id="${esc(comment.id)}">${open ? esc(t('收起', 'Show less')) : esc(t('展开', 'Show more'))}</button>`
            : '';
          const like = comment.liked > 0
            ? '<span class="sc-like">' + HEART_ICON + countText(comment.liked) + '</span>'
            : '';
          return (
            '<div class="sc-item" data-id="' + esc(comment.id) + '">' +
            avatar +
            '<div class="sc-main">' +
            '<div class="sc-name"><span class="sc-nick">' + esc(comment.name) + '</span>' +
            (comment.time ? '<span>' + esc(relativeTime(comment.time)) + '</span>' : '') +
            like +
            '</div>' +
            '<div class="sc-text' + (longText && !open ? ' is-clamp' : '') + '">' + esc(comment.content) + '</div>' +
            moreButton +
            quote +
            '</div></div>'
          );
        };

        const paintList = () => {
          const settings = readSettings();
          const top = body.scrollTop;
          const html = view.list.map((comment) => itemHtml(comment, settings)).join('');
          // 热门只有一屏，底部给一个去「最新」的入口，别让人以为评论就这么几条。
          const moreRow = view.tab === 'hot'
            ? `<button type="button" class="sc-more" data-act="all">${esc(t('查看全部评论', 'See all comments'))}</button>`
            : view.hasMore
              ? `<button type="button" class="sc-more" data-act="more"${view.loading ? ' disabled' : ''}>${esc(
                  view.loading ? t('加载中…', 'Loading…') : t('加载更多', 'Load more')
                )}</button>`
              : '';
          body.innerHTML = html + moreRow;
          body.scrollTop = top; // 展开/收起时不要跳回顶部
          bindAvatars();
        };

        const bindAvatars = () => {
          body.querySelectorAll('img[data-avatar]').forEach((image) => {
            image.addEventListener(
              'error',
              () => {
                const fallback = document.createElement('div');
                fallback.className = 'sc-av';
                fallback.textContent = '♪';
                image.replaceWith(fallback);
              },
              { once: true }
            );
          });
        };

        const paintHead = () => {
          const song = view.song;
          headTitle.textContent = song?.title || t('没有播放中的歌曲', 'Nothing is playing');
          headArtist.textContent = song
            ? [song.artist, song.album].filter(Boolean).join(' · ')
            : '';
          headCount.textContent = view.total > 0
            ? t(`${countText(view.total)}条评论`, `${countText(view.total)} comments`)
            : '';

          if (!view.source || !song) {
            matchRow.hidden = true;
            return;
          }
          matchRow.hidden = false;
          if (view.source === 'exact') {
            matchRow.classList.remove('is-warn');
            matchRow.innerHTML = `<span>${esc(t('来自网易云音乐', 'From NetEase Cloud Music'))}</span>`;
            return;
          }
          const matched = view.match;
          matchRow.classList.add('is-warn');
          matchRow.innerHTML =
            `<span>${esc(
              t(
                `按歌名匹配到《${matched?.title || ''}》${matched?.artist ? ' - ' + matched.artist : ''}`,
                `Matched 《${matched?.title || ''}》${matched?.artist ? ' - ' + matched.artist : ''}`
              )
            )}</span>` +
            `<button type="button" class="sc-match-btn" data-act="rematch">${esc(t('重新匹配', 'Match again'))}</button>`;
        };

        const paintAll = () => {
          scheduleMaxHeight();
          paintHead();
          if (view.loading && view.list.length === 0) {
            paintSkeleton();
            return;
          }
          if (view.error && view.list.length === 0) {
            paintState(
              `${esc(view.error)}<button type="button" class="sc-retry" data-act="refresh">${esc(t('重试', 'Retry'))}</button>`,
              true
            );
            return;
          }
          if (view.list.length === 0) {
            if (!view.id) {
              if (!view.song) {
                paintState(esc(t('播放一首歌再来看评论。', 'Play a song to read its comments.')));
                return;
              }
              const settings = readSettings();
              if (!settings.matchBySearch) {
                paintState(
                  esc(
                    t(
                      '「非网易云曲目按歌名匹配」是关着的，这类曲目不会去网易云找版本。可在设置里打开。',
                      '"Match other sources by title" is off, so NetEase is not searched for this track. You can turn it on in the settings.'
                    )
                  )
                );
                return;
              }
              const title = view.song.title || '';
              const from = platformLabel(view.songSource);
              paintState(
                esc(
                  t(
                    from
                      ? `在网易云没找到《${title}》的对应版本（当前是${from}的曲目）。`
                      : `在网易云没找到《${title}》的对应版本。`,
                    from
                      ? `No NetEase version of 《${title}》 was found (this track comes from ${from}).`
                      : `No NetEase version of 《${title}》 was found.`
                  )
                )
              );
              return;
            }
            paintState(
              view.tab === 'hot'
                ? esc(t('这首还没有热门评论，去「最新」看看。', 'No top comments yet — try "Newest".'))
                : esc(t('还没有人评论这首。', 'No one has commented on this song yet.'))
            );
            return;
          }
          paintList();
          if (view.error) {
            const row = document.createElement('div');
            row.className = 'sc-state is-err';
            row.innerHTML = `${esc(view.error)}<button type="button" class="sc-retry" data-act="more">${esc(t('重试', 'Retry'))}</button>`;
            body.appendChild(row);
          }
        };

        const resolveSong = async (song, signal) => {
          const direct = rawIdOf(song);
          if (direct) return { id: direct, source: 'exact', match: null };
          const settings = readSettings();
          if (!settings.matchBySearch) return { id: null, source: null, match: null };
          const title = String(song?.title || '').trim();
          const artist = songArtistOf(song);
          if (!title) return { id: null, source: null, match: null };
          const found = await searchOnce(title, artist, signal);
          if (!found) return { id: null, source: null, match: null };
          return { id: found.id, source: 'search', match: found };
        };

        const currentSong = () => {
          try {
            const snapshot = folium.playback?.getState?.();
            return snapshot?.song ?? null;
          } catch (_) {
            return null;
          }
        };

        const load = async (reset) => {
          if (disposed) return;
          const token = ++view.token;
          if (view.controller) {
            try {
              view.controller.abort();
            } catch (_) {}
          }
          const controller = typeof AbortController === 'function' ? new AbortController() : null;
          view.controller = controller;

          view.loading = reset ? true : view.loading;
          view.error = null;
          if (reset) {
            view.list = [];
            view.hasMore = false;
          }
          paintAll();

          const settings = readSettings();
          const song = currentSong();
          if (!song) {
            view.loading = false;
            view.song = null;
            view.songSource = '';
            view.id = null;
            view.source = null;
            view.list = [];
            view.total = 0;
            paintAll();
            return;
          }

          try {
            if (reset || !view.id) {
              const resolution = await resolveSong(song, controller?.signal);
              if (disposed || token !== view.token) return;
              view.id = resolution.id;
              view.source = resolution.source;
              view.match = resolution.match;
              // 一行诊断：宿主换了 DTO 形态时，这行能直接看出取到了什么。
              log(
                `resolve "${view.song?.title || ''}" source=${songSourceOf(song) || '-'} ` +
                  `dtoId=${song?.id ?? '-'} neteaseId=${view.id || '-'} via=${view.source || 'none'}`
              );
            }
            if (!view.id) {
              view.loading = false;
              view.list = [];
              view.total = 0;
              paintAll();
              return;
            }

            const offset = reset ? 0 : view.list.length;
            const key = `${view.id}:${view.tab}:${offset}:${settings.pageSize}`;
            const cached = reset ? cacheGet(`${view.id}:${view.tab}:0:${settings.pageSize}`) : cacheGet(key);
            if (cached) {
              if (disposed || token !== view.token) return;
              view.list = reset ? cached.list.slice() : view.list.concat(cached.list);
              view.total = cached.total || cached.list.length;
              view.hasMore = Boolean(cached.hasMore);
              view.loading = false;
              paintAll();
              return;
            }

            const page = await fetchPage({
              id: view.id,
              tab: view.tab,
              offset,
              pageSize: settings.pageSize,
              signal: controller?.signal,
            });
            if (disposed || token !== view.token) return;
            cacheSet(key, page);
            view.list = reset ? page.list : view.list.concat(page.list);
            view.total = page.total || page.list.length;
            view.hasMore = page.hasMore;
            view.loading = false;
            paintAll();
            log(`${view.id} ${view.tab} ${page.list.length}/${page.total} (${view.source})`);
          } catch (error) {
            if (disposed || token !== view.token) return;
            if (String(error?.code || '') === 'aborted') return;
            view.loading = false;
            view.error = friendlyError(error);
            warn(`load failed: ${String(error?.code || error?.message || error)}`);
            paintAll();
          }
        };

        const syncSong = () => {
          const song = currentSong();
          const source = songSourceOf(song);
          const key = [song?.id || '', song?.title || '', songArtistOf(song), source].join('\u0001');
          if (key === view.songKey) return false;
          view.songKey = key;
          view.songSource = source;
          view.song = song
            ? { title: String(song.title || ''), artist: songArtistOf(song), album: songAlbumOf(song) }
            : null;
          view.id = null;
          view.source = null;
          view.match = null;
          view.total = 0;
          view.expanded.clear();
          return true;
        };

        const onRootClick = (event) => {
          const target = event.target instanceof Element ? event.target.closest('[data-act]') : null;
          if (!target) return;
          const action = target.getAttribute('data-act');
          if (action === 'refresh') {
            cache.clear();
            view.expanded.clear();
            void load(true);
            return;
          }
          if (action === 'rematch') {
            cache.clear();
            view.source = null;
            view.id = null;
            void load(true);
            return;
          }
          if (action === 'tab') {
            setTab(target.getAttribute('data-tab'));
            return;
          }
          if (action === 'all') {
            setTab('new');
            return;
          }
          if (action === 'more') {
            if (view.loading) return;
            view.loading = true;
            paintAll();
            void load(false);
            return;
          }
          if (action === 'expand') {
            const id = target.getAttribute('data-id');
            if (!id) return;
            if (view.expanded.has(id)) view.expanded.delete(id);
            else view.expanded.add(id);
            paintAll();
          }
        };

        const onSongChanged = () => {
          if (disposed) return;
          if (!syncSong()) return;
          void load(true);
        };

        root.addEventListener('click', onRootClick);

        let offSongChanged = () => {};
        try {
          offSongChanged = folium.events?.on?.('playback.songChanged', onSongChanged) || (() => {});
        } catch (error) {
          warn(`playback.songChanged subscribe failed: ${String(error?.message || error)}`);
          offSongChanged = () => {};
        }

        // 面板可能在没有事件的情况下被切到前台（例如先挂载后播放），低频兜底同步。
        const ticker = setInterval(() => {
          if (disposed) return;
          if (!root.isConnected) return;
          const visible = root.offsetWidth > 0 || root.offsetHeight > 0 || root.getClientRects().length > 0;
          if (!visible) return;
          applyMaxHeight();
          if (syncSong()) void load(true);
        }, 2000);

        const onResize = () => applyMaxHeight();
        window.addEventListener('resize', onResize);

        syncSong();
        void load(true);
        // 刚挂载时容器可能还在布局，下一帧再量一次。
        const raf = typeof requestAnimationFrame === 'function'
          ? requestAnimationFrame
          : (callback) => setTimeout(callback, 16);
        raf(() => applyMaxHeight());

        return () => {
          disposed = true;
          view.token += 1;
          if (view.controller) {
            try {
              view.controller.abort();
            } catch (_) {}
          }
          clearInterval(ticker);
          window.removeEventListener('resize', onResize);
          try {
            offSongChanged();
          } catch (_) {}
          root.removeEventListener('click', onRootClick);
          root.remove();
        };
      },
    });
  } catch (error) {
    warn(`player panel tab register failed: ${String(error?.message || error)}`);
  }

  return undefined;
}
