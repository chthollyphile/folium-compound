// mods/Just-Enough-Setting/lib/media-session.mjs
// 系统媒体（Windows SMTC / 各平台媒体浮窗）的接管层。
//
// Windows 上的 SMTC 由 Chromium 从渲染进程的 Media Session API 读出来，宿主自己也是这么发 metadata 的
// （src/hooks/useMediaSessionBridge.ts → src/utils/mediaSessionSync.ts）。所以模组不需要动宿主一行代码：
// 只需要在 Web API 这一层拦一道——
//
//   - 给 `MediaSession.prototype.metadata` 的 setter 加一层包装：宿主每次发布，都把它的 init 里的
//     三行换成模组按片段编排出来的文本，并顺手记下它给的封面（模组拿不到封面 URL，但可以沿用宿主的）。
//   - 模组自己要更新时（歌词推进、改配置），直接调原始 setter 写一份新 metadata，不经过包装层，避免递归。
//
// 三行全空时不接管（见 compose.mjs 的 hasSmtcContent）；总开关关闭、用户撤销同意或模组被停用时，
// 把宿主最后发布的那组值原样写回去，不留一个空壳面板。
//
// 这一层只在用户于面板里明确同意之后才会装（见 lib/consent.mjs 与 controller 的 syncHostSurface）：
// 它改的是 Folia 自己的界面状态，不是给模组的公开接口，所以默认一次都不碰。

/** 只保留 MediaImage 里真正有用的三个字段，避免把宿主的对象引用长期挂着。 */
const copyArtwork = (artwork) => (Array.isArray(artwork)
  ? artwork
    .filter((item) => item && typeof item.src === 'string' && item.src !== '')
    .map((item) => ({ src: item.src, sizes: item.sizes ?? '', type: item.type ?? '' }))
  : []);

export const createMediaSessionBridge = ({ log }) => {
  const MediaMetadataCtor = typeof globalThis.MediaMetadata === 'function' ? globalThis.MediaMetadata : null;
  const session = typeof navigator !== 'undefined' ? (navigator.mediaSession ?? null) : null;
  const prototype = MediaMetadataCtor && typeof globalThis.MediaSession === 'function'
    ? globalThis.MediaSession.prototype
    : null;

  let descriptor = null;
  let patched = false;
  let installed = false;

  // 模组自己的当前状态；宿主先发布前这些都是空的。
  let composition = null;
  let enabled = true;
  let sendArtwork = true;
  // 宿主最后发布的三行与封面：停用时要还回去，歌词刷新时要沿用同一张封面。
  let hostFields = null;

  const available = Boolean(MediaMetadataCtor && session && prototype);

  const build = ({ title, artist, album, artwork }) => new MediaMetadataCtor({ title, artist, album, artwork });

  const snapshotHostFields = (value) => ({
    title: typeof value.title === 'string' ? value.title : '',
    artist: typeof value.artist === 'string' ? value.artist : '',
    album: typeof value.album === 'string' ? value.album : '',
    artwork: copyArtwork(value.artwork),
  });

  /** 宿主发布的 init 要不要换成模组的编排。 */
  const rewrite = (value) => {
    if (!value || typeof value !== 'object') return value;
    hostFields = snapshotHostFields(value);
    if (!enabled || !composition || !composition.active) return value;
    return build({
      title: composition.title,
      artist: composition.artist,
      album: composition.album,
      artwork: sendArtwork ? hostFields.artwork : [],
    });
  };

  const write = (metadata) => {
    if (!session) return false;
    try {
      // 走原始 setter：这份 metadata 已经编排好了，不需要再过一遍 rewrite。
      descriptor.set.call(session, metadata);
      return true;
    } catch (error) {
      log?.warn?.('failed to write media session metadata', error);
      return false;
    }
  };

  const restoreHost = () => {
    if (!hostFields) return;
    write(build({ ...hostFields, artwork: sendArtwork ? hostFields.artwork : [] }));
  };

  /**
   * 撤掉拦截并把宿主的值放回去。同意撤销 / 总开关之外还要能单独调用：
   * 撤销之后这个对象仍然可用，重新同意时再 install。
   */
  const detach = () => {
    if (patched && descriptor) {
      try {
        Object.defineProperty(prototype, 'metadata', descriptor);
      } catch (error) {
        log?.warn?.('could not restore the media session metadata setter', error);
      }
    }
    patched = false;
    installed = false;
    restoreHost();
  };

  return {
    available,

    /** 拦下宿主对 navigator.mediaSession.metadata 的每一次赋值。只在用户同意后调用。 */
    install() {
      if (!available) return false;
      if (installed) return true;
      try {
        const found = Object.getOwnPropertyDescriptor(prototype, 'metadata');
        if (!found || typeof found.set !== 'function') return false;
        descriptor = found;
        Object.defineProperty(prototype, 'metadata', {
          ...found,
          set(value) {
            found.set.call(this, rewrite(value));
          },
        });
        patched = true;
        installed = true;
      } catch (error) {
        log?.error?.('could not hook the media session metadata setter', error);
        patched = false;
        installed = false;
      }
      return installed;
    },

    /**
     * 发一份新的系统媒体信息。`composition.active` 为假（三行全空）或总开关关闭时，
     * 交还给宿主自己的三行。
     */
    publish({ composed, active, isEnabled, wantsArtwork }) {
      composition = {
        active: Boolean(active),
        title: composed?.smtcTitle ?? '',
        artist: composed?.smtcArtist ?? '',
        album: composed?.smtcAlbum ?? '',
      };
      enabled = isEnabled !== false;
      sendArtwork = wantsArtwork !== false;
      // 没装（用户没同意 / 已撤销）时这里只是记下状态，一次都不碰宿主。
      if (!installed) return false;
      if (!enabled || !composition.active) {
        restoreHost();
        return false;
      }
      // 宿主还没发布过任何元数据时先不动：此时写出去的三行会和宿主随后发布的状态撞车。
      if (!hostFields) return false;
      return write(build({
        title: composition.title,
        artist: composition.artist,
        album: composition.album,
        artwork: sendArtwork ? hostFields.artwork : [],
      }));
    },

    /** 交给宿主自己的值（诊断面板用）。 */
    describe() {
      if (!available) return null;
      return hostFields ? { ...hostFields, artworkCount: hostFields.artwork.length } : null;
    },

    /** 撤销同意时用：撤掉拦截并把宿主的三行写回去，对象本身还能再用。 */
    detach,

    dispose() {
      // 撤下之前先把自己写的值换回宿主的三行，别让媒体浮窗停在模组的内容上。
      detach();
      hostFields = null;
      composition = null;
    },
  };
};
