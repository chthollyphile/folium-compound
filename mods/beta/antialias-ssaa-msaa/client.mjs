// client.mjs —— 超采样与多重采样抗锯齿（Folium 1.7 模组入口）
// 改 window.devicePixelRatio 让歌词画布按 2 倍光栅化，再给 WebGL 上下文补 MSAA。
//
// 症状：monet / lattice / hanabi / lumiere / fume / cadenza / pendolo 这些把歌词画在 canvas
// 或 WebGL 纹理上的歌词动画，字在缩放、扫光、发光、模糊时边缘有台阶和抖动；classic /
// partita 这类纯 DOM 排版的歌词没有这个问题（它们由浏览器自己光栅化）。
//
// 原因：这些渲染器都按同一套规矩取像素密度，例如
//   latticeLyricResolution      = min(2, max(1, ceil(devicePixelRatio)))
//   resolveLumiereRenderResolution / hanabi 的 MAX_RESOLUTION = min(2, max(1, dpr))
//   fume 的 snapshotScale       = clamp(dpr, 1, 2)
// 1 倍屏上这就是 1：字形只按 1 倍光栅化，随后被动画缩到 0.7~0.9 倍再交给合成器放大，
// 缩小采样既没有 mipmap 也没有额外的采样点，边缘就是锯齿（还有缩放时的高光抖动）。
//
// 做法：把 devicePixelRatio 垫到 2（只升不降）。上面每一处读 dpr 决定画布 / 字形纹理尺寸的
// 代码都会按 2 倍光栅化，最后由合成器做 2:1 降采样 —— 这就是 SSAA（超采样抗锯齿）。模组只能
// 从这里下手：渲染器实例是宿主建的，`renderer.resolution` 在模组里拿不到。
//
// 为什么只垫到 2：应用自己把每个渲染器的分辨率都钳在 2（见上面三处），再高也会被钳回去；
// 而且它是整数，`ceil(2.5)` 这类半档会让字形纹理按 3 倍分配，纯亏显存。
//
// 还有一类锯齿超采样管不到：hanabi 的卡片白边、色块、装饰线是 Texture.WHITE 拉伸出来的四边形
// （collageViews.ts 的 rect/setRect），而它建上下文时写的是 antialias: false
// （createHanabiPixiRuntime.ts 的 contextOptions），几何边完全没有多重采样 —— 旋转两三度就是
// 硬台阶。所以第二层补丁在 getContext 上把 webgl/webgl2 的 antialias 顶成 true。
//
// 两层可以同时开，但代价是相乘的：2 倍超采样已经把默认帧缓冲的像素数变成 4 倍，MSAA 再乘 4 个
// 采样就是 16 倍，一整块全屏画布几百 MB，GPU 进程会崩、整窗黑屏（1.1.0 就是这么出的事）。
// 所以叠加单独有更紧的一档像素预算（COMBINED_PIXEL_BUDGET）：窗口大到叠加后超预算时，
// 自动收掉超采样、留下 MSAA（几何边才是它管的那部分），窗口缩回来再恢复叠加。
//
// 超采样的像素预算：单独开时上限是 2 倍后约 3320 万像素（3840×2160 @2x），只挡 8K 这种极端
// 窗口；与 MSAA 同开时上限收到 2 倍后约 830 万像素（1920×1080 @2x）——乘上 4 个采样后，
// 总采样量正好与「4K 单独超采样」持平。
//
// 动了哪些全局接口（以及为什么躲不开）：
//   window.devicePixelRatio          垫到 2。宿主各渲染器都从这里取像素密度，模组拿不到 renderer.resolution。
//   window.matchMedia('(resolution:)') 只改「等于虚拟倍率」的那类查询，改成 max-resolution，其余原样转发。
//   HTMLCanvasElement.prototype.getContext  webgl/webgl2 补 antialias；2d 只给大画布补高插值质量。
// dpr 是全窗口共用的，所以变的不只是歌词画布：封面、设置页预览、其它模组的画布都会跟着变。
// 因此默认全部关着，由用户自己开；开了也只建议在有歌词画布的页面用。
//
// 视频导出：宿主在导出开头会插一个 `<style data-folia-video-export-cursor-guard>`，导出的取景
// 按 dpr 算，超采样会让画面只剩四分之一。这个判断放在 dpr 的 getter 里同步做（读一次 DOM），
// 因为 `prepareVideoExportWindow` 读 dpr 和插 style 在同一个任务里，异步观察已经来不及。
// 它是宿主的实现细节：哪天换了标记，最坏情况只是导出画面被缩小，不影响其它功能。
//
// 自动重载渲染：宿主只在窗口 resize 与画布容器的 ResizeObserver 里重读 dpr（hanabi 的运行时
// 就是 resizeToHost 里取 `window.devicePixelRatio`），所以光改 dpr 不会让已建好的画布重建。
// 设置一改（或点「重新应用」），这里把覆盖视口的大画布容器抖 1px 再还原 —— ResizeObserver
// 回调两次，运行时当场 renderer.resize 并按新倍率重建场景纹理。
// MSAA 的 antialias 是建上下文时的属性，画布重建也改不了：只能等下一次重建 WebGL 上下文
// （切歌词动画 / 重启）才跟上，日志与命令提示里写明了这一点。

/**
 * 本模组用到的宿主 API（结构类型，不依赖宿主仓库里的类型文件）：
 * - `env.context`：client / main / export 窗口之一，只有 `main` 里才有歌词画布。
 * - `registries.settingsSections.register(section)` → `{ settings: { get(), onChange(cb) } }`
 * - `registries.commands.register(command)`
 * - `log.info` / `log.warn`
 * @typedef {object} FoliumHost
 */

/** 超采样倍率：与应用内各渲染器的分辨率上限一致。 */
const SUPERSAMPLE_RATIO = 2;
/**
 * 单独开超采样时允许的最大帧缓冲像素数（2 倍后）。上限只要挡住 8K 这种极端窗口；
 * 4K 窗口按 2 倍是 33M 像素（一块缓冲约 132MB），桌面独显没问题。
 */
const SUPERSAMPLE_PIXEL_BUDGET = 3840 * 2160 * 4;
/**
 * 超采样 + MSAA 同开时的上限。MSAA 每个像素再多 4 个采样，所以这一档收得更紧：
 * 1920×1080 按 2 倍是 8.3M 像素，乘 4 个采样 = 3320 万采样，与「4K 单独超采样」等同。
 * 超出时收掉超采样、保留 MSAA —— 几何边的台阶只有 MSAA 能压。
 */
const COMBINED_PIXEL_BUDGET = 1920 * 1080 * 4;
/** 同一个模组被重复加载时先收掉上一份补丁，避免两层 dpr 覆盖叠在一起。 */
const INSTANCE_KEY = Symbol.for('folia.mod.antialias-ssaa-msaa');
/** 与 mod.json 的 version 保持一致：启用时打进日志，一眼能看出加载的是哪份构建。 */
const MOD_VERSION = '1.1.7';
/** 宿主视频导出期间插在 head 里的光标守卫（宿主实现细节，换了标记只是导出保护失效）。 */
const EXPORT_GUARD_SELECTOR = 'style[data-folia-video-export-cursor-guard]';
/** 设置变更后等多久再重建渲染：连点几个开关时只重建一次。 */
const RELOAD_DEBOUNCE_MS = 250;
/** 2D 高插值只给这么大的画布用：封面色取样、图标那类小画布用不上，也不该被改行为。 */
const SMOOTH2D_MIN_PX = 64;
/** 记住多少个 MediaQueryList：React 的 dpr 订阅每换一次倍率会新建一个。 */
const TRACKED_MEDIA_QUERIES = 256;

/** @param {FoliumHost} folium */
export default function activate(folium) {
    // 导出窗口里的画面尺寸由窗口本身决定，垫高 dpr 只会改变导出的取景，所以什么都不做。
    if (folium.env && folium.env.context !== 'main') return undefined;

    // 同一份模组被重复加载（重载 / 重新启用）时，先把上一份补丁收掉：
    // 两层 dpr 覆盖叠在一起会让 restore 互相删掉对方定义在 window 上的属性。
    const previous = globalThis[INSTANCE_KEY];
    if (typeof previous === 'function') {
        try {
            previous();
        } catch {
            // 上一份已经收掉了，继续往下装新的。
        }
    }

    const section = folium.registries.settingsSections.register({
        id: 'antialias',
        label: { 'zh-CN': '超采样与多重采样抗锯齿', en: 'Supersampling & MSAA' },
        description: {
            'zh-CN': '减轻 canvas / WebGL 歌词画布上的锯齿。两项默认都关着，按需开：2× 超采样管字形与贴图，MSAA 只抗几何边，可以同时开；叠加时像素预算更紧，超预算会自动先收超采样。',
            en: 'Softens stairsteps on canvas / WebGL lyric layers. Both switches start off: 2× supersampling covers glyphs and textures, MSAA only geometric edges, and they can be on together. Stacking uses a tighter pixel budget, and supersampling is the one dropped when it overflows.',
        },
        settings: [
            {
                key: 'supersample',
                type: 'boolean',
                label: { 'zh-CN': '2× 超采样（4 倍帧缓冲，按需开）', en: '2× supersampling (4× framebuffer, opt-in)' },
                description: {
                    'zh-CN': '按 2 倍像素绘制歌词再降采样。100% / 125% 缩放的屏幕改善最明显；本来就 ≥2 倍的高分屏画面不变。代价是整窗帧缓冲像素数变成 4 倍，核显 / 低配机器可能掉帧，所以默认关闭。单独开时窗口大于 4K 才自动跳过；与 MSAA 同开时预算收得更紧（2 倍后约 830 万像素），超了就先收这一项、只留 MSAA。',
                    en: 'Draws lyrics at twice the pixels and lets the compositor downsample. Most visible on 100% / 125% displays. Quadruples the framebuffer pixels for the whole window, which can cost frames on integrated graphics, so it is off by default. Alone it only steps aside above 4K; stacked with MSAA the budget tightens (~8.3M doubled pixels) and this is the one dropped.',
                },
                defaultValue: false,
            },
            {
                key: 'msaa',
                type: 'boolean',
                label: { 'zh-CN': '强制 MSAA（可与超采样同开）', en: 'Force MSAA (can stack with supersampling)' },
                description: {
                    'zh-CN': 'hanabi 等风格为了性能把 WebGL 的 antialias 关掉了，卡片、色块、装饰线的直边因此是硬台阶。打开后由 MSAA 直接给这些几何边着色。只抗几何边、不改善字形，所以和超采样互补，可以同时开：叠加是 16 倍帧缓冲，预算比单独超采样紧一档（2 倍后约 830 万像素），超了会先收超采样。注意它作用于本窗口内此后新建的每个 WebGL 上下文（不只歌词），所以默认关。改这一项要等下次重建上下文（切歌词动画 / 重启）才生效。',
                    en: 'Styles such as hanabi switch WebGL antialias off for speed, leaving the straight edges of cards and blocks hard. MSAA covers those edges and, since it does nothing for glyphs, stacks with supersampling. Stacking is 16× the framebuffer, so the budget is one notch tighter (~8.3M doubled pixels); over that, supersampling is dropped first. It applies to every WebGL context created afterwards in this window, not only lyrics, so it starts off. Takes effect on the next context rebuild (style switch or restart).',
                },
                defaultValue: false,
            },
            {
                key: 'smooth2d',
                type: 'boolean',
                label: { 'zh-CN': '2D 画布高质量缩放', en: 'High-quality 2D canvas scaling' },
                description: {
                    'zh-CN': '让 canvas 2D 的 drawImage 始终使用高质量插值（fume 的字块快照、cadenza 的叠层等）。几乎不花钱。',
                    en: 'Keeps canvas 2D drawImage on high-quality filtering (fume\'s block snapshots, cadenza\'s overlay). Costs almost nothing.',
                },
                defaultValue: true,
            },
            {
                key: 'exportGuard',
                type: 'boolean',
                label: { 'zh-CN': '视频导出时自动暂停超采样', en: 'Pause supersampling during video export' },
                description: {
                    'zh-CN': '导出时宿主按 dpr 决定窗口大小，超采样会把导出画面缩到四分之一。保持开启，导出会自动按原样进行；关掉这一项就得在导出前手动关掉上面的开关。',
                    en: 'The host sizes the export window from the DPR, so supersampling would shrink the recorded picture to a quarter. Leave this on to pause automatically; turn it off only if you prefer to disable the switch above by hand before exporting.',
                },
                defaultValue: true,
            },
            {
                key: 'autoReload',
                type: 'boolean',
                label: { 'zh-CN': '应用设置后自动重载渲染', en: 'Reload the renderer after a settings change' },
                description: {
                    'zh-CN': '改完上面的开关就地把歌词画布按新设置重建：给画布容器做一次 1px 的尺寸抖动（宿主只在这时才重读 devicePixelRatio），再补一次 resize。不用再切一次歌词动画。关掉它可以用命令面板的「重新应用」手动触发。MSAA 的上下文属性无法就地修改，切换 MSAA 后几何边要等下次重建上下文（切动画 / 重启）才跟上。',
                    en: 'Rebuilds the lyric canvases in place after a switch changes: the canvas hosts get a 1px size nudge (the only moment the host re-reads devicePixelRatio) plus one resize. No style switch needed. Turn it off to trigger the rebuild from the "re-apply" command instead. MSAA context attributes cannot change in place, so geometric edges follow on the next context rebuild (style switch or restart).',
                },
                defaultValue: true,
            },
        ],
    });

    const antialiasing = createAntiAliasing(folium, section.settings);

    folium.registries.commands.register({
        id: 'reapply',
        label: { 'zh-CN': '超采样与 MSAA：重新应用', en: 'Supersampling & MSAA: re-apply' },
        description: {
            'zh-CN': '按当前设置重新应用，并就地让歌词画布按新的像素比重建（抖一次画布容器触发 ResizeObserver，再补一次 resize）。开关改了但画面没动时跑这条。',
            en: 'Applies the current settings again and rebuilds the lyric canvases in place at the new pixel ratio (a 1px host nudge for ResizeObserver plus one resize). Run this when a switch changed but the picture did not.',
        },
        keywords: ['antialias', 'anti-aliasing', 'ssaa', 'supersample', 'msaa', '锯齿', '抗锯齿'],
        run: () => antialiasing.reapply(),
    });

    folium.registries.commands.register({
        id: 'status',
        label: { 'zh-CN': '超采样与 MSAA：诊断', en: 'Supersampling & MSAA: status' },
        description: {
            'zh-CN': '报当前生效的像素比、各画布的后备像素比，以及 WebGL 上下文是否真的拿到了 MSAA。怀疑没生效时先跑这一条。',
            en: 'Reports the effective pixel ratio, each canvas\'s backing-store ratio and whether WebGL contexts really got MSAA. Run this first if you are unsure whether the mod is working.',
        },
        keywords: ['status', 'diagnose', '诊断', '状态', 'dpr'],
        run: () => antialiasing.status(),
    });

    // 设置一变就会被宿主回调，这里绝不能把异常抛回宿主的更新流程；出问题只记一条日志。
    // 应用之后还会自动重载渲染（见「应用设置后自动重载渲染」），不用再切一次歌词动画。
    const unsubscribe = section.settings.onChange(() => {
        try {
            antialiasing.onSettingsChanged();
        } catch (error) {
            folium.log.warn?.(`应用抗锯齿设置失败：${describeError(error)}`);
        }
    });

    try {
        // 冷启动时画布还没建，重载是空转；热启用（运行中点开模组）时它正好把画布重建到新倍率。
        antialiasing.onSettingsChanged();
        // 打一条启用日志：日志里能直接看到版本和生效方式，也顺便证明模组确实被加载了。
        folium.log.info(`超采样与 MSAA v${MOD_VERSION} 已启用：${antialiasing.summary()}`);
        antialiasing.nudgeRebuild();
    } catch (error) {
        folium.log.warn?.(`抗锯齿初始化失败，已自行收手：${describeError(error)}`);
        antialiasing.dispose();
        return undefined;
    }

    const dispose = () => {
        unsubscribe();
        antialiasing.dispose();
        if (globalThis[INSTANCE_KEY] === dispose) delete globalThis[INSTANCE_KEY];
    };

    // 重复加载（重载 / 重新启用）时，上一份补丁必须先收掉，否则两层 dpr 覆盖会叠在一起。
    globalThis[INSTANCE_KEY] = dispose;

    return dispose;
}

/** @param {unknown} error */
function describeError(error) {
    if (error instanceof Error) return error.message;
    return String(error);
}

/**
 * 全部补丁的安装、还原与状态。返回的 `dispose` 把 window 上的每一处改动都退回去。
 * @param {FoliumHost} folium
 * @param {{ get: () => object, onChange: (cb: () => void) => () => void }} settings
 */
function createAntiAliasing(folium, settings) {
    // 必须在定义自己的 devicePixelRatio 之前读出来，否则读到的就是自己的 getter。
    const readRealRatio = findRealRatioGetter();
    const ownRatioDescriptor = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
    const nativeMatchMedia = window.matchMedia;
    const nativeGetContext = HTMLCanvasElement.prototype.getContext;

    /** @type {MediaQueryList[]} */
    const trackedMediaQueries = [];
    /** @type {Array<() => void>} */
    const undo = [];

    let factor = 0;
    let ratioOverridden = false;
    let budgetOk = true;
    let pendingNotify = 0;
    let matchMediaOverridden = false;
    /** getContext 上的包装是否装着（2D 插值与 MSAA 共用一层）。 */
    let contextsPatched = false;
    let smooth2dEnabled = false;
    let msaaEnabled = false;
    /** 是否在导出期间自动让出（用户可关）。 */
    let guardEnabled = true;
    /** 观察 head 只用于日志与通知；真正的判断在 getter 里同步做。 */
    let guardObserver = null;
    /** 上一次看到的导出状态，用来只在切换时记一条日志。 */
    let guardSeen = false;
    /** 上一次应用出去的 MSAA 状态；null 表示还没应用过（冷启动时不用提醒）。 */
    let appliedMsaa = null;
    /** 「应用设置后自动重载渲染」的合并计时器：连点几个开关只重建一次。 */
    let reloadTimer = 0;

    const values = () => {
        const stored = settings.get() || {};
        return {
            // 这两项默认关：超采样会把这个窗口的帧缓冲放大 4 倍，MSAA 会改本窗口所有 WebGL 上下文。
            // 用 `=== true` 而不是 `!== false`：宿主没写过的键就是 undefined，必须按「关」处理。
            supersample: stored.supersample === true,
            msaa: stored.msaa === true,
            smooth2d: stored.smooth2d !== false,
            exportGuard: stored.exportGuard !== false,
            autoReload: stored.autoReload !== false,
        };
    };

    /** 当前档位的像素上限：同时开 MSAA 时每个像素还要乘 4 个采样，所以用更紧的那一档。 */
    const pixelBudget = () => (msaaEnabled ? COMBINED_PIXEL_BUDGET : SUPERSAMPLE_PIXEL_BUDGET);

    /** 2 倍缓冲的像素数；量不到窗口时返回 0（视为不超预算）。 */
    const doubledPixels = () => {
        const width = Number(window.innerWidth) || 0;
        const height = Number(window.innerHeight) || 0;
        return width <= 0 || height <= 0 ? 0 : width * height * SUPERSAMPLE_RATIO * SUPERSAMPLE_RATIO;
    };

    /**
     * 2 倍缓冲是否还在预算内。只在窗口尺寸变化或叠加档位切换时重算：这个值会被渲染期的
     * getter 读到，不能在里面量窗口（读 innerWidth 可能触发一次强制布局）。
     */
    const refreshPixelBudget = () => {
        const pixels = doubledPixels();
        budgetOk = pixels <= 0 || pixels <= pixelBudget();
    };

    /**
     * 宿主是否正在准备视频导出。只看 head 里有没有那个光标守卫 —— 是宿主实现细节，
     * 但它是唯一能在同步上下文里拿到的信号；读一次 DOM 很便宜（head 的子节点很少）。
     */
    const hasExportGuard = () => {
        try {
            // 只查 head：守卫插在 head 里，范围小到可以忽略不计。
            return document.head.querySelector(EXPORT_GUARD_SELECTOR) !== null;
        } catch {
            return false;
        }
    };

    /** 导出期间自动让出超采样：用户关掉这一项就完全不看导出的状态。 */
    const exportPaused = () => guardEnabled && hasExportGuard();

    /** 宿主看到的像素比：垫高过就是 max(真实, 2)，导出中、超预算或关闭时就是真实值。 */
    const currentRatio = () => {
        const real = readRealRatio();
        if (!ratioOverridden || factor <= 1 || !budgetOk || exportPaused()) return real;
        return real > factor ? real : factor;
    };

    // ---------------------------------------------------------------- 超采样

    const overrideRatio = () => {
        Object.defineProperty(window, 'devicePixelRatio', {
            configurable: true,
            enumerable: true,
            get: currentRatio,
        });
        ratioOverridden = true;
    };

    const restoreRatio = () => {
        if (!ratioOverridden) return;
        ratioOverridden = false;
        if (ownRatioDescriptor) Object.defineProperty(window, 'devicePixelRatio', ownRatioDescriptor);
        else delete window.devicePixelRatio;
    };

    /**
     * 把「按当前虚拟 dpr 固定下来」的分辨率查询改成区间查询，让 useDevicePixelRatio 那一类
     * 订阅在垫高 dpr 之后仍然认为查询命中，并在真实 dpr 变化时照常收到 change。
     */
    const rewriteQuery = (query) => {
        const scale = factor;
        if (!ratioOverridden || scale <= 1 || exportPaused() || !/resolution/i.test(query)) return query;
        return query.replace(
            /\(\s*resolution\s*:\s*([0-9.]+)\s*(dppx|dpi)\s*\)/gi,
            (match, value, unit) => {
                const dppx = unit.toLowerCase() === 'dpi' ? Number(value) / 96 : Number(value);
                if (!Number.isFinite(dppx) || dppx !== scale) return match;
                return `(max-resolution: ${value}${unit.toLowerCase()})`;
            },
        );
    };

    /** matchMedia 的替身：查询改写后交给原生实现，并把实例记下来用于主动通知。 */
    const matchMediaProxy = (query) => {
        const mediaQueryList = nativeMatchMedia.call(window, rewriteQuery(String(query)));
        if (trackedMediaQueries.length >= TRACKED_MEDIA_QUERIES) trackedMediaQueries.shift();
        trackedMediaQueries.push(mediaQueryList);
        return mediaQueryList;
    };

    const overrideMatchMedia = () => {
        if (matchMediaOverridden) return;
        window.matchMedia = matchMediaProxy;
        matchMediaOverridden = true;
    };

    const restoreMatchMedia = () => {
        if (!matchMediaOverridden) return;
        matchMediaOverridden = false;
        // 删掉自己加的属性，退回 Window.prototype 上的原生实现；改回去会在 window 上留下一层多余的自有属性。
        delete window.matchMedia;
    };

    /**
     * 告诉订阅者像素比变了：React 那两个 hook 挂在 MediaQueryList 的 change 上。
     *
     * 两条克制：只碰分辨率相关的 MQL（不去惊动 prefers-reduced-motion、断点之类的监听），
     * 并且一律延到下一个任务再发 —— 这个函数会在宿主更新设置的过程中被调用，同步重渲染
     * 容易把宿主的提交搅乱。也不再伪造 window 的 resize：那会连带触发宿主的窗口/导出逻辑。
     */
    const flushRatioChange = () => {
        pendingNotify = 0;
        for (const mediaQueryList of trackedMediaQueries) {
            if (!/resolution/i.test(String(mediaQueryList.media || ''))) continue;
            try {
                mediaQueryList.dispatchEvent(new Event('change'));
            } catch {
                // 已经跟着 effect 清理掉的实例不再有监听，忽略。
            }
        }
    };

    const scheduleRatioChange = () => {
        if (pendingNotify) return;
        pendingNotify = setTimeout(flushRatioChange, 0);
    };

    /** @param {boolean} enabled */
    const applySupersample = (enabled) => {
        const before = currentRatio();
        factor = enabled ? SUPERSAMPLE_RATIO : 0;
        if (enabled) {
            refreshPixelBudget();
            overrideRatio();
            overrideMatchMedia();
        } else {
            restoreMatchMedia();
            restoreRatio();
        }
        if (before !== currentRatio()) scheduleRatioChange();
    };

    // ------------------------------------------------------------ 导出保护

    /**
     * 导出状态本身由 `exportPaused()` 在 getter 里同步判断，这里只做两件事：
     * 状态切换时通知订阅者（异步就行），以及在日志里留一句。
     * 用 MutationObserver 观察 head，不包装 appendChild，也就不影响宿主插任何别的节点。
     */
    const watchExportGuard = () => {
        if (guardObserver || !guardEnabled) return;
        guardSeen = hasExportGuard();
        guardObserver = new MutationObserver(() => {
            const now = hasExportGuard();
            if (now === guardSeen) return;
            guardSeen = now;
            folium.log.info(now ? '检测到视频导出：超采样暂时让出' : '导出结束：超采样恢复');
            scheduleRatioChange();
        });
        guardObserver.observe(document.head, { childList: true, subtree: false });
        undo.push(() => {
            guardObserver?.disconnect();
            guardObserver = null;
        });
    };

    const unwatchExportGuard = () => {
        guardObserver?.disconnect();
        guardObserver = null;
    };

    /** 窗口尺寸变化后重算预算：窗口大到超预算时让出超采样，缩回来再恢复。 */
    const onWindowResize = () => {
        const before = currentRatio();
        refreshPixelBudget();
        if (before !== currentRatio()) scheduleRatioChange();
    };

    // ------------------------------------------- 2D 插值质量 + WebGL 多重采样

    /**
     * 一层 getContext 包装，管两件事：
     * - '2d'：把 drawImage 的插值质量顶到 high；
     * - 'webgl' / 'webgl2'：把 antialias 顶成 true。
     *
     * 后者是这次真正对症的部分：hanabi 用 antialias:false 建上下文（为了省性能），而它的卡片
     * 白边、色块、装饰线都是 Texture.WHITE 拉伸出来的四边形，边是纯几何边，没有 MSAA 就是硬台阶，
     * 超采样只能把台阶减半。MSAA 直接给这些边多采样，两者互补。
     *
     * 各项是否生效由 smooth2dEnabled / msaaEnabled 在调用时决定，所以改设置不用重装包装；
     * 但已经建好的上下文改不了属性，改 MSAA 要重启或重建渲染器（切换歌词动画）。
     */
    const patchCanvasContexts = () => {
        if (contextsPatched) return;
        contextsPatched = true;
        const smoothedContexts = new WeakSet();
        HTMLCanvasElement.prototype.getContext = function getContext(type, options) {
            if (msaaEnabled && (type === 'webgl2' || type === 'webgl' || type === 'experimental-webgl')) {
                const multisampled = nativeGetContext.call(this, type, { ...(options || {}), antialias: true });
                // 极少数驱动上「MSAA + desynchronized」这类组合会直接返回 null，宿主拿不到上下文会抛异常。
                // 宁可退回原参数，也不要给宿主一个 null。
                if (multisampled) return multisampled;
                return nativeGetContext.call(this, type, options);
            }
            const context = nativeGetContext.call(this, type, options);
            if (!context || type !== '2d' || !smooth2dEnabled || smoothedContexts.has(context)) return context;
            // 小画布（封面色取样、图标、缩略图）不动：它们本来就不做缩放取样，改了只是白白多一层包装。
            if (this.width < SMOOTH2D_MIN_PX || this.height < SMOOTH2D_MIN_PX) return context;
            smoothedContexts.add(context);
            const nativeDrawImage = context.drawImage;
            // canvas 的 width/height 一改，绘制状态就被重置（imageSmoothingQuality 回到 low），
            // 而歌词画布每帧都在按 dpr 改宽度，所以这里在每次绘制前补一次。
            context.drawImage = function drawImage(...args) {
                if (this.imageSmoothingQuality !== 'high') {
                    try {
                        this.imageSmoothingEnabled = true;
                        this.imageSmoothingQuality = 'high';
                    } catch {
                        // 老引擎没有这个属性，忽略。
                    }
                }
                return nativeDrawImage.apply(this, args);
            };
            return context;
        };
    };

    const unpatchCanvasContexts = () => {
        if (!contextsPatched) return;
        contextsPatched = false;
        HTMLCanvasElement.prototype.getContext = nativeGetContext;
    };

    // ---------------------------------------------------------------- 对外

    /**
     * 当前真正生效的方式。两层可以叠（ssaa+msaa）；叠加档预算更紧，超了就先收超采样、
     * 留下 MSAA —— 几何边的台阶只有 MSAA 能压，而超采样能压的那部分此时已被像素预算挡住。
     */
    const effectiveMode = () => {
        const next = values();
        const supersample = next.supersample && budgetOk;
        if (supersample) return next.msaa ? 'ssaa+msaa' : 'ssaa';
        if (next.msaa) return 'msaa';
        return next.supersample ? 'budget' : 'off';
    };

    /** 一句话描述当前生效的方式：日志、命令提示、「诊断」共用。 */
    const modeLabel = () => {
        const next = values();
        switch (effectiveMode()) {
            case 'ssaa+msaa':
                return `${SUPERSAMPLE_RATIO}× 超采样 + MSAA`;
            case 'ssaa':
                return `${SUPERSAMPLE_RATIO}× 超采样`;
            case 'msaa':
                return next.supersample && !budgetOk
                    ? 'MSAA（叠加后超预算，超采样暂不生效；关掉 MSAA 可换回超采样）'
                    : 'MSAA';
            case 'budget':
                return '超采样暂不生效（2 倍缓冲超出预算）';
            default:
                return '关闭';
        }
    };

    /**
     * 补一次 resize：hanabi / lumiere 这类运行时是在 resize 里重算分辨率、重建纹理的，
     * 光改 dpr 不会让已经建好的画布重建。延到下一个任务，避开宿主的提交过程。
     */
    const nudgeRebuild = () => {
        setTimeout(() => {
            try {
                window.dispatchEvent(new Event('resize'));
            } catch {
                // 窗口正在销毁时忽略。
            }
        }, 0);
    };

    /**
     * 让画布宿主重新量一次尺寸。
     *
     * 宿主只在两个地方重读 `devicePixelRatio`：窗口 resize，和画布容器的 ResizeObserver。
     * 前者靠 `nudgeRebuild`，但窗口尺寸没变时只是把事件派发一遍，Pixi 那类（hanabi / tempera /
     * sonnet）挂在 ResizeObserver 上的回调根本不会响 —— 这就是「改了设置得切一次歌词动画」的原因。
     * 所以这里把容器尺寸临时减 1px 再还原：ResizeObserver 会因此回调两次，运行时就按新的像素比
     * `renderer.resize()` 并重建场景纹理，肉眼几乎看不出这一像素。
     */
    const nudgeHosts = () => {
        if (typeof window.requestAnimationFrame !== 'function') return;
        if (document.hidden) return;
        const viewport = (Number(window.innerWidth) || 0) * (Number(window.innerHeight) || 0);
        /** @type {HTMLElement[]} */
        const hosts = [];
        for (const canvas of document.querySelectorAll('canvas')) {
            const box = canvas.getBoundingClientRect();
            // 只认覆盖视口一大块的画布（歌词舞台）：图集、封面取色、缩略图、别的模组的小画布都不碰。
            if (box.width < 64 || box.height < 64) continue;
            if (viewport > 0 && box.width * box.height < viewport * 0.2) continue;
            const host = canvas.parentElement;
            if (!host || hosts.includes(host)) continue;
            if (host === document.body || host === document.documentElement) continue;
            // 再退一步：只认「容器就是这个画布」的父元素，整个舞台容器（含字幕、背景、其它层）不抖，
            // 免得把别的层也带着位移。
            const stage = host.getBoundingClientRect();
            if (Math.abs(stage.width - box.width) > 2 || Math.abs(stage.height - box.height) > 2) continue;
            hosts.push(host);
            if (hosts.length >= 4) break;
        }
        if (!hosts.length) return;
        const saved = hosts.map(host => ({
            host,
            width: host.style.width,
            height: host.style.height,
        }));
        window.requestAnimationFrame(() => {
            for (const { host } of saved) {
                try {
                    const box = host.getBoundingClientRect();
                    if (box.width < 2 || box.height < 2) continue;
                    host.style.width = `${Math.round(box.width) - 1}px`;
                    host.style.height = `${Math.round(box.height) - 1}px`;
                } catch {
                    // 元素在抖动之前被宿主移除了，跳过。
                }
            }
            window.requestAnimationFrame(() => {
                for (const { host, width, height } of saved) {
                    try {
                        // 还原成原来那行内联样式；宿主若中途重写过，退回 CSS 类布局也不会错。
                        host.style.width = width;
                        host.style.height = height;
                    } catch {
                        // 同上：节点已经没了就不用还原。
                    }
                }
                // 还原之后再补一次真 resize：量窗口的那类 2D 画布认这个。
                nudgeRebuild();
            });
        });
    };

    /** 一次完整的重载：先应用补丁，再让画布按新设置重建。 */
    const reloadRender = () => {
        apply();
        nudgeHosts();
        nudgeRebuild();
    };

    /** 设置刚变：立刻应用；「自动重载渲染」开着时再合并一次画布重建。 */
    const onSettingsChanged = () => {
        apply();
        if (values().autoReload) scheduleReload();
    };

    /** 合并连续设置变更：一次只重建一回，免得来回点开关时画布反复重建。 */
    const scheduleReload = () => {
        if (reloadTimer) clearTimeout(reloadTimer);
        reloadTimer = setTimeout(() => {
            reloadTimer = 0;
            reloadRender();
        }, RELOAD_DEBOUNCE_MS);
    };

    /** 一行摘要，给启动日志和「诊断」共用。 */
    const summary = () => {
        const suffix = exportPaused() ? '（导出中已暂停）' : '';
        return `${modeLabel()}${suffix}，dpr ${readRealRatio().toFixed(2)}→${currentRatio().toFixed(2)}`;
    };

    const apply = () => {
        const next = values();
        const before = currentRatio();
        // MSAA 是建上下文时的属性，改成 true 不会让已经存在的 WebGL 上下文多出采样点：
        // 这里记一笔，重建渲染时把「还没真正跟上」这件事写进日志，免得白等。
        if (next.msaa !== appliedMsaa && appliedMsaa !== null) {
            folium.log.info(next.msaa
                ? 'MSAA 已开启：新的 WebGL 上下文才带采样点，正在重建的画布会跟上；当前上下文要等下次重建（切动画 / 重启）'
                : 'MSAA 已关闭：已有上下文仍带采样点，切一次歌词动画或重启后彻底关掉');
        }
        appliedMsaa = next.msaa;
        // 先落两个开关再算预算：叠加档的上限更紧，refreshPixelBudget 要用到新的 msaaEnabled。
        smooth2dEnabled = next.smooth2d;
        msaaEnabled = next.msaa;
        applySupersample(next.supersample);
        // MSAA 与超采样的开销是相乘的，有没有 MSAA 会改变超采样是否还在预算内，所以这里统一通知一次。
        if (before !== currentRatio()) scheduleRatioChange();
        if (smooth2dEnabled || msaaEnabled) patchCanvasContexts();
        else unpatchCanvasContexts();
        guardEnabled = next.exportGuard;
        if (guardEnabled) watchExportGuard();
        else unwatchExportGuard();
    };

    const dispose = () => {
        const before = currentRatio();
        while (undo.length) {
            const restore = undo.pop();
            try {
                restore();
            } catch {
                // 还原失败不应打断后续还原。
            }
        }
        if (pendingNotify) {
            clearTimeout(pendingNotify);
            pendingNotify = 0;
        }
        if (reloadTimer) {
            clearTimeout(reloadTimer);
            reloadTimer = 0;
        }
        window.removeEventListener('resize', onWindowResize);
        smooth2dEnabled = false;
        msaaEnabled = false;
        unpatchCanvasContexts();
        restoreMatchMedia();
        restoreRatio();
        if (before !== currentRatio()) scheduleRatioChange();
        unwatchExportGuard();
        guardEnabled = true;
        appliedMsaa = null;
        factor = 0;
    };

    const reapply = () => {
        // 应用 + 重载渲染：画布容器抖 1px 触发 ResizeObserver，再补一次 resize。
        if (reloadTimer) {
            clearTimeout(reloadTimer);
            reloadTimer = 0;
        }
        reloadRender();
        scheduleRatioChange();
        const mode = effectiveMode();
        if (mode === 'off') return { message: '超采样与 MSAA 都关着，没有可应用的设置。' };
        if (exportPaused()) return { message: '宿主正在导出视频，超采样暂时让出，导出结束后会自动恢复。' };
        return { message: `已应用并重载渲染：${modeLabel()}。画布已按新像素比重建；若几何边没变化，那是 MSAA 的上下文属性还没随新的 WebGL 上下文一起建起来——切一次歌词动画或重启即可。` };
    };

    /** 诊断：当前 dpr、生效方式、各画布的后备像素比、WebGL 上下文的 MSAA 属性。 */
    const status = () => {
        const real = readRealRatio();
        refreshPixelBudget();
        const current = values();
        const mode = effectiveMode();
        const parts = [
            `dpr 真实 ${real.toFixed(2)} → 生效 ${currentRatio().toFixed(2)}`,
            `方式 ${modeLabel()}${exportPaused() ? '（导出中已让出）' : ''}`,
            `开关 超采样${current.supersample ? '开' : '关'} / MSAA${current.msaa ? '开' : '关'} / 2D插值${current.smooth2d ? '开' : '关'}`,
        ];
        // 预算分两档，把当前档和实际像素数摊开：叠加后突然不够用时，这是唯一能看出原因的地方。
        const pixels = doubledPixels();
        if (pixels > 0) {
            const cap = pixelBudget();
            parts.push(`预算 2 倍缓冲 ${(pixels / 1e6).toFixed(1)}M 像素 / 上限 ${(cap / 1e6).toFixed(1)}M（${current.msaa ? '叠加 MSAA 档' : '单独超采样档'}）`);
        }
        const canvases = [];
        for (const canvas of document.querySelectorAll('canvas')) {
            const box = canvas.getBoundingClientRect();
            if (box.width < 8 || box.height < 8 || canvases.length >= 6) continue;
            const ratio = canvas.width / Math.max(1, box.width);
            let msaa = '';
            if (current.msaa) {
                try {
                    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
                    const attributes = gl && typeof gl.getContextAttributes === 'function' ? gl.getContextAttributes() : null;
                    if (attributes) msaa = attributes.antialias ? ' MSAA开' : ' MSAA关';
                } catch {
                    // 上下文取不回来就不报这一项。
                }
            }
            canvases.push(`${Math.round(box.width)}×${Math.round(box.height)}→${ratio.toFixed(2)}×${msaa}`);
        }
        parts.push(canvases.length ? `画布：${canvases.join('；')}` : '当前没有画布（先播一首有歌词的歌）');
        if (mode === 'ssaa' || mode === 'ssaa+msaa') {
            parts.push(mode === 'ssaa'
                ? '若画布已是 2.00× 但 hanabi 的字仍糊：字形图集被 4096 上限钳住，模组够不到（见 README）；卡片白边 / 色块这类纯几何硬边不吃超采样，打开 MSAA 可叠加上'
                : '超采样管字形与贴图，MSAA 管卡片白边 / 色块这类几何硬边；hanabi 的字若仍糊，是字形图集被 4096 上限钳住（见 README）');
        }
        return { message: parts.join(' ｜ ') };
    };

    // 预算跟窗口尺寸走：只在真实 resize 时重算，不在 getter 里量窗口。
    window.addEventListener('resize', onWindowResize);
    refreshPixelBudget();

    return { apply, dispose, reapply, status, summary, nudgeRebuild, onSettingsChanged, reloadRender };
}

/** devicePixelRatio 的真实 getter：先于任何覆盖读出来，之后一直用它。 */
function findRealRatioGetter() {
    for (let proto = window; proto; proto = Object.getPrototypeOf(proto)) {
        const descriptor = Object.getOwnPropertyDescriptor(proto, 'devicePixelRatio');
        if (!descriptor) continue;
        if (typeof descriptor.get === 'function') return () => descriptor.get.call(window);
        if ('value' in descriptor) {
            const fixed = Number(descriptor.value) || 1;
            return () => fixed;
        }
    }
    const fixed = window.devicePixelRatio || 1;
    return () => fixed;
}
