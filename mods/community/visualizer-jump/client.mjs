import { createJumpStage } from './jumpStage.mjs';
import { IMPACT_SECONDS, resolveHopSquash, resolveLandingBurst, resolvePillarSpring } from './jumpCourse.mjs';
import {
    attachChunkTimings,
    buildCharTimings,
    resolveChunkCap,
    resolveGlyphRatio,
    splitJumpChunks,
} from './jumpSplit.mjs';
import {
    buildLineTimeline,
    MIN_IDLE_SECONDS,
    resolveCameraPath,
    resolveIdleMotion,
    resolveLastRelease,
    resolveMotionWindow,
    resolvePathWeights,
    resolveRowReveal,
    resolveRunnerState,
    resolveShiftAirborne,
    resolveTailAirborne,
} from './jumpTimeline.mjs';
import { accumulateRowRoad, resolveBoardRows, rowBlockCenter } from './jumpBoard.mjs';
import {
    boxFaces,
    createProjection,
    placeText,
} from './jumpProject.mjs';
import {
    FACE_SPAN_CELLS,
    MIN_UNIT_CELLS,
    TEXT_FILL,
    resolveBlockShape,
    resolvePillarHeight,
    resolveTextAspect,
} from './jumpShape.mjs';
import { JUMP_DEFAULT_KNOBS, JUMP_SETTINGS_SCHEMA } from './jumpSettings.mjs';
import { resolveJumpPalette } from './jumpPalette.mjs';

// mods/visualizer-jump/client.mjs
// 「跳一跳」：等距场景里，一个小人在一根根带字的长方块上跳。
//
// 一条路，没有分叉（buildBoard / jumpBoard.accumulateRowRoad）
//   第 k 行沿哪条世界轴走只由 k 的奇偶决定：偶数 +Y（屏幕右上）、奇数 +X（左上）。
//   第 k+1 行接住第 k 行的**拐点**，接着朝自己的方向铺：块按**字宽**排，长词是一根长条、
//   短词是一根短条，块与块之间留「柱子间隙」。于是整首歌在屏幕上是一条连续台阶，
//   一右一左地往上铺，像无限画布；实际只挂当前这三行，画布不用真的无限大。
//   关键是位置是**绝对**的：只由 (行号, 块号) 决定，与「现在轮到第几行在写」无关。
//
// 一套投影，没有第二套（jumpProject）
//   方位 45°、俯角 θ 的正交投影。柱子的三个面、柱子的位置、贴面的文字矩阵，全部由它推出
//   ——所以字与柱子之间不再有夹角：字是真躺在那个面上的（等距是仿射的，一个 2D 矩阵
//   就能把字错切到面上，用不着 3D 引擎）。文字可指定贴在顶面 / 正面（沿路的长条面）/
//   侧面（端头）/ 悬浮在上方，**旋钮说的是哪一档就是哪一档**：字号与倾角由那一面在屏幕上
//   的大小推出来，同一面上一整行的字于是同一个大小、同一个倾角，位置只由这一面定。
//   俯角因此是真的在转镜头，不再是一组凑出来的缩放。
//
// 镜头沿路匀速走（paintFrame / jumpTimeline.resolveCameraPath）
//   镜头大致钉住小人此刻踩着的那一块，但**不跟着他的跳走**：他只在腾空那一截前进，
//   落地之后站着不动，照他的曲线走就成了「走一截、停一截」（节奏一快，画面在动—停—动地抖）。
//   所以镜头有自己的到站时刻：一段覆盖「这一跳 + 落地后站着那一截」，段与段首尾相接，
//   行内于是全程匀速，只在每行的最后一块上停一下等跨行。所以整条路不会被拽回来重排，
//   拖动进度、暂停、导出看到的都是同一帧（位置是由时间算出来的，不累加）。
//
// 块是「字有多长就有多长」的长方块（buildBoard / jumpSplit 的字宽）
//   块长按字宽给（长词长条、短词短条），随块厚一起放大，厚与高是常量，块之间留「柱子间隙」；
//   行首行尾各留半个间隙，于是拐点上两块不叠，而两条文字线恰好相交在拐点上。
//
// 亮度（这一版的硬规矩）
//   块与字的颜色不随时间变，进度只由小人站在第几块上表达；
//   正在写的那一行实一点、上下两行淡一档，三行不会糊成一条路。
//   柱面的浓淡走「线框强度」，字的亮度只走行的主次——两者分开，字才不会被柱面那份
//   浓度一起乘掉（以前整根柱子共用一个 opacity，字只剩四成亮度）。
//   柱面与棱线的色相由主题推（jumpPalette），不再是写死的中性冷灰。
//   明暗按**屏幕上的左右**给：哪一面落在左下随这一行的朝向交替，按正/侧上色会一明一暗地闪。
//
// 新的一行怎么登场（revealWindowOf / jumpTimeline.resolveRowReveal）
//   每一行第一次出现在画面上的时刻是「镜头切到它前一行那一刻」——那时它作为下一行出现。
//   从那一刻起，它的块按行内序号错开、从落位点下方滑上来并淡入：序号 0 在本行最下、
//   最后一块在最上，所以整行是从下往上依次亮出来的。整行必须在小人跳上来（这一行接手）
//   之前落位，短句就把错开量压一压。正在写的、已经唱完的两行早已落位，登场偏移为 0，
//   看不出差别。时刻同样只由时间算出来，拖动进度不会把动画留在半路。
//
// 落地那一下（resolveLandingBurst / jumpStage.drawImpact）
//   小人磕在柱顶上的那一瞬，落点上铺开一圈环、溅几粒尘——「落在**哪一根**上」一眼看得见。
//   时刻是时间表里现成的那一秒（跨行那一跳就是下一行开口那一刻），所以特效不累加：
//   拖动进度不会留下半开的环，暂停也不会把它冻在中途。
//
// 柱子的弹性（resolvePillarSpring / jumpTimeline 的 pressTime / releaseTime）
//   小人**落地**把柱子踩沉下去，**起跳**那一刻柱子还在最深处、随即弹回来、冲过头一点，
//   再做几下越来越小的振动约 1 秒后停住；他踩在柱顶上，所以跟着柱子一起沉、一起弹。
//   每根柱子自己记两个时刻（踩上来 / 跳走），三段连续、只由时间算出来，不累加。
//   幅度由「柱子弹性」旋钮给：0 = 柱子纹丝不动（也就是加这档特效之前的样子）。
//
// 分工：jumpProject 管投影（面、位置、贴面矩阵）；jumpBoard 管行朝向、这条路的坐标与
// 跨行那一跳；jumpSplit 管切块与字时刻；jumpTimeline 管时间（含新行登场的过渡）；
// jumpCourse 管这一跳本身（三拍挤压与落地冲击）；jumpStage 管节点；
// 这个文件只做「每帧往哪写、镜头摆在哪」。

/** 量不到容器时按 16:9 摆一版，等能量到再纠正。 */
const FALLBACK_SIZE = { width: 1280, height: 720 };

/**
 * 一条路最多占画面宽的多少：留边给柱顶的字、小人与侧面那块柱身。
 * 左右各留一份柱宽，柱子被顶到边上时字还转得开。
 */
const LANE_WIDTH_SHARE = 0.82;

/** 块长 / 块厚 / 字盒的长宽比都在 jumpShape：client 只消费形状，不再自己定。 */

/**
 * 一行最多几根柱子：再长就把「每块几个字」往粗里放宽到 `MAX_CHUNK_CHARS`。
 * 一行 3–4 根最像跳一跳（每一跳都看得清），长句只会让柱子变小、不会跳得更快。
 */
const MAX_CHUNKS_PER_ROW = 5;

/** 「每块几个字」放宽到这么粗就停：再粗就不像跳一跳了，宁可多几根柱子。 */
const MAX_CHUNK_CHARS = 10;

/**
 * 纵向预算按多长的一行算（格）：取「最多几块」再加两块余量。
 * 一行最多就这么多块，块再长也长不过它——长句多出来的部分往画面外延伸，
 * 不再回头把整屏的柱子压小。「跳一跳」是跟着小人走的近景，路的远端出画是正常的。
 *
 * 这个数是**固定的**（不随正在唱的那一行变）：纵向按它算、横向也按它算，
 * 短句与长句才是同一把尺子，换一行整屏不会缩一下。
 */
const BUDGET_ROW_CELLS = MAX_CHUNKS_PER_ROW + 2;

/** 柱高（格）= 面板里的「柱子高度」× 这个数；投影里竖直 1 格抬 cosθ/√2 个格宽。 */
const PILLAR_RATIO = 1;

/** 小人身高（格）÷ 面板里的「小人尺寸」：人也是竖直的，走同一条 `lift`。 */
const RUNNER_RATIO = 2.6;

/** 一屏之中允许被路占掉的高度份额（剩下的留给边框、柱子与小人）。 */
const FIT_SHARE = 0.92;

/**
 * 一格最小这么多像素：可视区再矮，格子也不会缩到看不见，
 * 小人的落点也不会跑出画面底边（跑出去就只剩半个身子）。
 * 格子大小只由旋钮与屏幕尺寸定——与正在唱的是哪一行无关，一屏才不会呼吸。
 */
const CELL_FLOOR_PX = 26;

/** 柱顶的字与边框之间留多少空（占柱宽的比例）：算进最坏情况，画面才不会一屏一屏地变。 */
const FRAME_PAD_CELLS = 0.7;

/**
 * 镜头的前瞻量（格）：小人不钉在正中，而是往路的**后方**偏这么点，
 * 前面那几块还没跳到的柱子才看得全。别给太大——换行要换向，这一笔会被来回甩。
 */
const LOOK_AHEAD_CELLS = 1;

/**
 * 收尾那一截的呼吸幅度：柱子整体再往上顶多少格、小人再抬多少格。
 *
 * 都很小（柱子 4%、人 6%）：这一截要的是「画面没停住」，不是第二套动画。
 */
const IDLE_RISE_CELLS = 0.04;
const IDLE_DRIFT_CELLS = 0.06;

/**
 * 收尾那一刻落在末段里的位置：0…1，越小越靠前。
 *
 * 末段（末块落点 → 下一行开口）整段都在走，这个数只回答「唱完那一刻镜头已经走了几成」：
 * 取一个比 0 明显大的数，于是**镜头运动包住「唱完最后一个字」那一刻**，
 * 不是等唱完了才起步。它只影响 `handoverTime` 这个参考时刻，不再拿去拼排版缓存键。
 */
const HANDOVER_SHARE = 0.22;

/** 新行登场：柱子从落位点下方这么多格处往上滑出来。 */
const REVEAL_RISE_CELLS = 0.9;

/** 新行登场：单根柱子滑上来用多久（秒）。 */
const REVEAL_SECONDS = 0.4;

/** 新行登场：相邻两根柱子之间错开多少（秒）——整行因此是从下往上依次亮出来的。 */
const REVEAL_STAGGER = 0.07;

/**
 * 新行登场最多占掉「从登场到这一行接手」这段时间的几成。
 * 留一成几的余量：跨行那一跳是在这一行接手**之前**就起跳的，柱子必须先站定。
 */
const REVEAL_BUDGET_SHARE = 0.7;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/**
 * 一块字的横向长度（格）：Σ 每个字的字身系数（CJK 1 格、拉丁 0.58 格、空白 0.35 格）。
 * 只按字数算会让「because」和「你好」一样长，英文块于是被拉成一条长廊。
 *
 * 不在这里夹上下限：夹过的数再去反推块长，块就会比字短（字伸出柱子）。
 * 上下限由 jumpShape 在算出块长之后统一夹。
 */
const resolveTextSpan = (text) => Math.max(0, Array.from(text ?? '')
    .reduce((sum, char) => sum + resolveGlyphRatio(char), 0));

/**
 * 这块字里最高的那个字占多高（格）：汉字 / 假名是整格，拉丁字母矮一档。
 * 字盒的长宽比按它算，英文块的字才不会被拉成一张宽扁的字。
 */
const resolveGlyphHeight = (text) => {
    const chars = Array.from(text ?? '').filter((char) => !/\s/u.test(char));
    if (chars.length === 0) return 1;
    return Math.max(...chars.map((char) => clamp(resolveGlyphRatio(char), 0.4, 1)));
};

/** 文字贴在哪个面：顶面 / 正面（沿路的长条面）/ 侧面（端头）/ 悬浮在上方。 */
const TEXT_FACES = ['top', 'front', 'side', 'above'];

/** 读设置：宿主已并入缺省，但非法值（旧版本存下的、面板外写进来的）按缺省回落。 */
const readKnobs = (settings) => {
    const source = settings && typeof settings === 'object' ? settings : {};
    const readNumber = (key) => {
        const raw = Number(source[key]);
        return Number.isFinite(raw) ? raw : JUMP_DEFAULT_KNOBS[key];
    };
    const textFace = typeof source.textFace === 'string' && TEXT_FACES.includes(source.textFace)
        ? source.textFace
        : JUMP_DEFAULT_KNOBS.textFace;
    return {
        pitch: clamp(readNumber('pitch'), 18, 60),
        textFace,
        spacing: clamp(readNumber('spacing'), 0.1, 2),
        pillarHeight: clamp(readNumber('pillarHeight'), 0.2, 3),
        pillarSpring: clamp(readNumber('pillarSpring'), 0, 2),
        chunkChars: Math.round(clamp(readNumber('chunkChars'), 1, 4)),
        preferPair: readNumber('preferPair') >= 0.5,
        flySeconds: clamp(readNumber('flySeconds'), 0.1, 1.2),
        // 上限跟着面板走（`arc` 的上限是 2.4）：默认值 1.2 别顶在滑块尽头，还留得出更高的一档。
        arc: clamp(readNumber('arc'), 0, 2.4),
        runnerScale: clamp(readNumber('runnerScale'), 0.2, 2),
        wireframe: clamp(readNumber('wireframe'), 0, 1),
        trail: clamp(readNumber('trail'), 0, 1),
    };
};

/** 这一行的第一个字开口的时刻：换行就是它，不是 `startTime`。 */
const resolveEnterTime = (line) => {
    if (!line) return Number.NaN;
    const first = Array.isArray(line.words) && line.words.length > 0 ? line.words[0]?.startTime : null;
    if (Number.isFinite(first)) return first;
    return Number.isFinite(line.startTime) ? line.startTime : Number.NaN;
};

/**
 * 这一行最后一个字什么时候唱完：末块自己的收尾（不是这一行的 `endTime`，那个常常是
 * 「整行还能写多久」）。
 *
 * 没有逐字时间时，字时刻是按这一行均分估出来的，估出来的收尾比真实唱完晚一截；
 * 照它算的话镜头会一直等到下一个字才动，画面仍旧停住——所以只有末块真的比行首晚开口
 * （有逐字 / 逐词时间）时才用它，否则返回 `NaN`，由 `resolveMotionWindow` 按下限估。
 */
const resolveVoicedEnd = (line) => {
    const words = Array.isArray(line?.words) ? line.words : [];
    if (words.length === 0) return Number.NaN;
    const lastEnd = Number(words[words.length - 1]?.endTime);
    if (!Number.isFinite(lastEnd)) return Number.NaN;
    // 一个跨整行的词 = 没有真正的逐字时间（jumpSplit.buildCharTimings 也是这么判的）。
    if (words.length === 1 && Math.abs(lastEnd - Number(line?.endTime)) < 1e-6) return Number.NaN;
    return lastEnd;
};

/**
 * 这一次 mount 里每一行的「时间窗」。
 *
 * 三条都按时间算，所以拖动进度、暂停、导出走同一条链：
 *   - `writeStart`：行首字开口的时刻（换行就发生在这之前一点）；
 *   - `writeEnd`：这一行最晚还能跳的时刻 —— 下一行开口之前（留一点跨行的余量），
 *     并且不超过宿主给的 `renderHints.renderEndTime`（那之后这一句就该让位了）；
 *   - `afterStart` / `afterEnd`：**收尾窗**，最后一个字唱完到下一行开口之间。这一截里
 *     原来画面完全停住（人早落地了、镜头也到站了），现在由它来喂「非唱」的那点动静
 *     （见 paintFrame 的 idle 与 jumpTimeline 的 cameraTimes 末段）。
 *
 * `afterEnd` 就是下一行开口（没有下一行时是这一段音乐的收尾），跨行那一跳与镜头的
 * 末段都以它为准：小人那一刻落地，镜头那一刻到站。
 */
const buildWriteWindows = (lines) => {
    const enters = lines.map(resolveEnterTime);
    // 每一段音乐的收尾 = 下一次开口（或整首的收尾）：歌词原文唱完之后往往还挂着伴奏。
    const voicedEnds = lines.map(resolveVoicedEnd);
    return lines.map((line, index) => {
        const start = Number.isFinite(line.startTime) ? line.startTime : 0;
        const writeStart = Number.isFinite(enters[index]) ? enters[index] : start;
        const nextEnter = Number.isFinite(enters[index + 1]) ? enters[index + 1] : null;
        const renderEnd = Number.isFinite(line.renderHints?.renderEndTime)
            ? line.renderHints.renderEndTime
            : line.endTime;
        /*
         * 下一行开口前留出一小截：这一行最后一跳要在这之前落地。
         * 留多少按这一行总长给（长句多留、短句少留），两头夹一下，短句也不会被吃掉半句。
         */
        const ahead = nextEnter !== null ? nextEnter - writeStart : Number.NaN;
        const reserve = Number.isFinite(ahead) ? Math.min(0.28, Math.max(0.12, ahead * 0.15)) : 0.12;
        const handOver = nextEnter !== null ? nextEnter - reserve : null;
        const writeEnd = Math.max(
            writeStart,
            handOver !== null ? Math.min(renderEnd, handOver) : renderEnd,
        );
        /*
         * 收尾窗的止点：下一行开口。最后一句没有下一行，就取宿主给的 `renderEndTime`
         * ——它已经把「这一句还能待多久」算进来（歌词写完之后常还挂着一段伴奏）。
         */
        const afterEnd = nextEnter !== null ? nextEnter : Math.max(writeEnd, renderEnd);
        const motion = resolveMotionWindow({
            start,
            end: writeEnd,
            nextStart: afterEnd,
            voicedEnd: voicedEnds[index],
            motionEnd: renderEnd,
        });
        return {
            writeStart,
            writeEnd,
            afterStart: motion ? motion.afterStart : writeEnd,
            afterEnd: motion ? motion.afterEnd : writeEnd,
        };
    });
};

/**
 * 一行的排版：切块 → 每字时刻 → 每块字宽 → 时间表。
 *
 * 世界坐标的尺度留给投影那一步（`buildBoard` 决定一「格」多少像素），
 * 这里只回答「这一行有几块、每块几个字、什么时候落地」。
 */
const layoutLine = ({ line, folium, knobs, lineIndex, window, cap, nextStart, handover }) => {
    const text = typeof line?.fullText === 'string' ? line.fullText : '';
    if (!text.trim()) return null;

    const segments = typeof folium?.lyrics?.segmentWords === 'function'
        ? folium.lyrics.segmentWords(line)
        : null;
    const source = segments && segments.length > 0 ? segments : [{ segment: text }];

    let chunks = splitJumpChunks(source, { maxChunkChars: knobs.chunkChars, preferPair: knobs.preferPair });
    /*
     * 太碎了就一层层放宽「每块几个字」，直到块数落进 `cap`：
     * 一行十几根柱子的话，每根只剩指甲盖大，字根本读不出来。
     *
     * 一次都没变少就停下：剩下的块是拆不动的拉丁词（`because` 不能被劈成两半），
     * 再放宽也不会变少，一行长英文句就宁可多几根柱子。
     */
    let perChunk = knobs.chunkChars;
    while (chunks.length > cap && perChunk < MAX_CHUNK_CHARS) {
        perChunk += 1;
        const wider = splitJumpChunks(source, { maxChunkChars: perChunk, preferPair: knobs.preferPair });
        if (wider.length >= chunks.length) break;
        chunks = wider;
    }
    if (chunks.length === 0) return null;

    const timed = attachChunkTimings(chunks, buildCharTimings(line));
    const heightCells = resolvePillarHeight(knobs.textFace, knobs.pillarHeight * PILLAR_RATIO);
    /*
     * 排版只看 `display`（去掉首尾空白的这一块）：
     * 分词常把词间的空格留在块尾，空格看不见却占字宽——按它算块长与字盒，
     * 字就被挤到柱子的一头。只剩空白的块干脆不立柱子（否则是一根什么也不写的柱）。
     */
    const units = timed
        .filter((chunk) => (chunk.display ?? chunk.text).length > 0)
        .map((chunk) => {
            const display = chunk.display ?? chunk.text;
            const charCount = Math.max(1, Array.from(display).length);
            // 横向字宽（格）：这一面那一排字排出来有多长。
            const span = resolveTextSpan(display);
            // 这块字里最高的字占多高（格）：字盒的长宽比按它算（拉丁字母比汉字矮一档）。
            const glyph = resolveGlyphHeight(display);
            // 这块柱子的尺寸都由字宽与字盒的长宽比推出来（jumpShape）：面装得下字，柱子跟着字长。
            const shape = resolveBlockShape(knobs.textFace, span, heightCells, glyph);
            return {
                text: display,
                chars: chunk.chars ?? [],
                startTime: chunk.startTime,
                endTime: chunk.endTime,
                // 字宽（格）：这一块的字排出来有多长。
                span,
                glyph,
                len: shape.len,
                depth: shape.depth,
                faceDepth: shape.faceDepth,
                height: shape.height ?? heightCells,
                charCount,
            };
        });
    // 整行只剩空白（分词只吐了几个空格）时没有柱子可摆，这一行就当空行跳过。
    if (units.length === 0) return null;

    /*
     * 时间与字共用一条轴：每块踩在**自己**开唱的那一刻跳过去（见 jumpTimeline）。
     * 收尾上限用 `window.writeEnd`：下一行开口之前这一行的最后一跳必须已经落地。
     */
    const timeline = buildLineTimeline({
        startTime: window.writeStart,
        endTime: window.writeEnd,
        count: units.length,
        // 滞空按秒给：同一行里每一跳的窗口长短不一，几成比例由时间轴自己按窗口算。
        flySeconds: knobs.flySeconds,
        landTimes: units.map((unit) => unit.startTime),
        /*
         * 最后一根柱子什么时候弹回来 = 他跨行那一跳的起步点：**唱完那一刻**（收尾窗的起头）。
         * 之后到下一行开口之间他在路上，柱子则在他离开时弹回来。
         */
        lastRelease: resolveLastRelease({
            end: window.afterStart ?? window.writeEnd,
            nextStart,
        }),
        // 末段的到站时刻：下一行开口（跨行那一跳的落点，与 jumpBoard 的相位同一个时刻）。
        nextStart,
        // 末段（镜头从末块走到下一行首块）的内部节奏：让镜头在收尾那一刻就离站。
        handover,
    });

    return { lineIndex, text, units, timeline };
};

const mountJump = (folium, container, ctx) => {
    const stage = createJumpStage(container);
    stage.setOpacity(ctx.getDisplay()?.visualizerOpacity ?? 1);

    let knobs = readKnobs(ctx.getSettings());
    // 排版缓存：换行要反复读相邻几行，且旋钮 / 时间窗变一次就整表作废。
    const layoutCache = new Map();
    // 时间窗只跟歌词有关：mount 期间歌词是快照，算一次就够。
    let windows = buildWriteWindows(ctx.lines ?? []);
    let palette = resolveJumpPalette(ctx.getTheme(), folium);

    /**
     * 真的去量一次容器尺寸。
     *
     * 量的时候浏览器要把上一帧写进去的那几百处样式 flush 成一次同步布局，代价很高：
     * 逐帧地量（老写法）等于每帧都强制 layout 一次，会把整屏拖成掉帧。
     * 所以这里改成按「可能变了」标记来量：只有标脏了才真的去量一次。
     */
    const measureMetrics = () => {
        const width = stage.root.clientWidth || container.clientWidth || 0;
        const height = stage.root.clientHeight || container.clientHeight || 0;
        if (width > 0 && height > 0) return { width, height };
        return { ...FALLBACK_SIZE };
    };
    let metrics = { ...FALLBACK_SIZE };
    let metricsDirty = true;
    const readMetrics = () => {
        if (!metricsDirty) return metrics;
        metricsDirty = false;
        const next = measureMetrics();
        const moved = next.width !== metrics.width || next.height !== metrics.height;
        metrics = next;
        // 尺寸变了，`cell` 跟着变：方块缓存的键里带着它，旧条目整批作废。
        if (moved) blockCache.clear();
        return metrics;
    };

    /**
     * 一行的排版（带缓存）。缓存键里带时间窗与旋钮：两者变了整表作废（见 repaint），
     * 所以只按行号存一份就够。
     */
    const layoutOf = (index) => {
        const line = ctx.lines[index];
        if (!line) return null;
        const window = windows[index] ?? { writeStart: line.startTime, writeEnd: line.endTime };
        const charCount = Array.from(typeof line.fullText === 'string' ? line.fullText : '').length;
        const cap = resolveChunkCap({ charCount, maxChunks: MAX_CHUNKS_PER_ROW });
        // 下一行开口时刻也进键：末根柱子的回弹时刻由它推出来（见 resolveLastRelease）。
        // 下一行开口（跨行那一跳的落地时刻，也是这一行收尾窗的止点）。
        const nextStart = windows[index + 1]?.writeStart;
        // 收尾窗也进键：末段（镜头跨行那一段）的节奏由它给。
        const after = `${window.afterStart ?? '-'}:${window.afterEnd ?? '-'}`;
        /*
         * `HANDOVER_SHARE` 不进键：它只挪 `handoverTime` 这个参考时刻，
         * 真正被画出来的位置由 `tailSpan` / `gapShift` 决定，与它无关。
         */
        const key = [
            index, line.fullText, window.writeStart, window.writeEnd, after, nextStart,
            knobs.chunkChars, knobs.preferPair ? 1 : 0, knobs.flySeconds, cap,
        ].join('|');
        const cached = layoutCache.get(index);
        if (cached && cached.key === key) return cached.layout;
        if (charCount === 0) {
            layoutCache.delete(index);
            return null;
        }
        const layout = layoutLine({
            line,
            folium,
            knobs,
            lineIndex: index,
            window,
            cap,
            nextStart,
            handover: HANDOVER_SHARE,
        });
        if (layout) layoutCache.set(index, { key, layout });
        else layoutCache.delete(index);
        return layout;
    };

    /**
     * 每一行有哪些块（按字宽排）：路的形状由它定，块长跟着字走。
     * 块厚只有侧面那一档会随字宽变（见 jumpShape），所以一并带上。
     */
    const resolveRoadRows = () => (ctx.lines ?? []).map((line, index) => {
        const layout = layoutOf(index);
        return {
            index,
            lens: layout ? layout.units.map((unit) => unit.len) : [],
            depths: layout ? layout.units.map((unit) => unit.depth) : [],
            crosses: layout ? layout.units.map((unit) => unit.faceDepth) : [],
        };
    });

    /*
     * 整首歌那条折线的累计坐标只跟歌词与旋钮有关，每帧重算一遍太浪费，按签名缓存。
     * 签名里要带上**柱身宽度**：拐角让位按上一行最宽的那根算（见 `accumulateRowRoad`），
     * 只按块长做签名的话，换了词、块长没变而柱身变了，拐角就会留着上一版的重叠。
     */
    let roadCache = { key: '', road: [] };
    const roadRows = (rows) => {
        // 拐角只跟「这一行最宽的那根柱身」有关，签名里记这一个数就够（见 `accumulateRowRoad`）。
        const shape = rows
            .map((row) => {
                const widest = (row.depths ?? [])
                    .reduce((max, value) => Math.max(max, Number(value) || 0), 0);
                return `${row.lens.join(' ')}@${widest}`;
            })
            .join('|');
        const key = `${shape}|${knobs.spacing}`;
        if (roadCache.key !== key) {
            roadCache = { key, road: accumulateRowRoad({ rows, gap: knobs.spacing }) };
        }
        return roadCache.road;
    };

    /*
     * 方块长相 + 贴面字盒的缓存：同一块长、同一柱身横向、同一柱高、同一朝向、同一俯角、
     * 同一长宽比之下，三个面的多边形与这片字的错切矩阵是一样的，每帧重算纯属白干。
     *
     * `label` 也一起缓存进来：以前 `placeText` 每帧重算六个 `toFixed`，
     * 结果再原封不动写回 DOM；现在和 box 挂在同一个键上吐出去。
     *
     * 键里带着 `cell`（= 尺寸推出来的格子大小）：尺寸或旋钮一变就整表作废
     * （见 repaint / readMetrics）。**不清就是一处泄漏**——拖一次窗口，每个中间尺寸
     * 都会留下一摞永不回收的多边形。
     */
    const blockCache = new Map();
    const blockOf = (projection, unit, along, cells) => {
        const shape = resolveBlockShape(knobs.textFace, unit.span, cells, unit.glyph);
        const aspect = resolveTextAspect(unit.span, unit.glyph);
        const height = shape.height ?? cells;
        const key = [
            along, shape.len.toFixed(3), shape.depth.toFixed(3), height.toFixed(3),
            projection.cell.toFixed(2), projection.pitch, knobs.textFace, aspect.toFixed(3),
        ].join('|');
        const cached = blockCache.get(key);
        if (cached) return cached;
        const box = boxFaces(projection, { along, len: shape.len, depth: shape.depth, height });
        /*
         * 这块字贴哪一面：旋钮说的那一档就是哪一档，永远不换面。
         * 面在屏幕上背着镜头时只翻横轴（从右往左铺），位置、大小、用哪一面都不变。
         * 字盒的长宽比由这块字自己给，字盒于是正正落在面心——四档面共用同一套算法，
         * 不再为侧面那档另取一份投影（换轴量出来的房间与贴面矩阵的方向并不一致，
         * 字就歪在墙的一边，这是上一版「字不在面心」的根因）。
         */
        const label = placeText(projection, box, { face: knobs.textFace, aspect, fill: TEXT_FILL });
        const entry = { box, label };
        blockCache.set(key, entry);
        return entry;
    };

    /**
     * 这一屏的几何：一格多少像素、投影、每一行每一块的位置。
     *
     * 位置一律是**绝对**的：世界坐标由全局行号推出来（`accumulateRowRoad`），再由投影
     * 换成屏幕，与「现在轮到第几行」无关。镜头往前推进只是画布自己的位移，任何一块
     * 都不会因为换行而挪窝——于是整条路是连续的，画面怎么移动都是同一条路。
     */
    const buildBoard = (size) => {
        const rows = resolveRoadRows();
        const road = roadRows(rows);
        /*
         * 柱高：顶面 / 正面就是旋钮给的那个数；侧面那一档往上放宽一点，柱子才装得下字
         * （见 jumpShape.resolvePillarHeight）。一屏里只有一个柱高——字号是柱高的固定几成，
         * 于是同一屏的字号也是同一个，不会「字多就缩小」；跟着字变的只有那面墙的宽度。
         */
        const heightCells = resolvePillarHeight(knobs.textFace, PILLAR_RATIO * knobs.pillarHeight);
        /*
         * 一块的横向尺寸：柱身厚度（= 顶面横向 = 端头墙宽，实心盒子）。
         * 每块有自己的尺寸（字长的块墙面宽一点），预算按**最宽的那一根**算：
         * 格子大小一屏一个数，窄的柱子于是不会顶出画面，各块之间也不会一屏一缩。
         */
        const widestDepth = road.reduce(
            (max, row) => (row.depths ?? []).reduce((inner, value) => Math.max(inner, Number(value) || 0), max),
            resolveBlockShape(knobs.textFace, MIN_UNIT_CELLS, heightCells).depth,
        );
        const widestCross = road.reduce(
            (max, row) => (row.crosses ?? []).reduce((inner, value) => Math.max(inner, Number(value) || 0), max),
            FACE_SPAN_CELLS,
        );
        const depth = widestDepth;
        /*
         * 柱顶那块面在屏幕上的**横宽**：沿路那条边与横向那条边各投成一条斜线，
         * 横向各占 1/√2——顶面横宽 = (块长 + 柱身横向) / √2。预算按最坏一根算。
         */
        const crossCells = (widestDepth + widestCross) / Math.SQRT2;

        /*
         * 纵向预算（单位：格宽）按**最坏情况**算一次固定下来：小人在自己那一行上从头顶
         * 走到脚下，脚下要装得下「这一行走过的路 + 拐点那一截 + 上一行整条」，头顶要装得下
         * 「这一行剩下的路 + 拐点那一截 + 下一行整条」。锚点钉在柱顶，两端各再留一根柱身
         * 的高度。取两端之和，画面就不会一会儿顶出去一会儿又空一块（否则每帧都在改柱宽，
         * 整屏在呼吸）。
         *
         * 行长按 `BUDGET_ROW_CELLS` 封顶：再长的行，多出来的部分本来就在画面外，
         * 把它算进预算只会让看得见的这几根柱子跟着一起变小。
         *
         * 一格路在屏幕上抬多少：沿世界轴走一格 = 横向半格宽、纵向抬 sinθ/2 个格宽。
         */
        const pitchRad = (knobs.pitch * Math.PI) / 180;
        const risePerCell = Math.sin(pitchRad) / 2;
        /*
         * 纵向预算按**块数上限**算，不按这一行真正排出来多长：短句排得短，格子就被放得更大，
         * 长句一来格子又缩回去——同一首歌一换行，整屏就呼吸一次。预算是「最坏情况」，
         * 而最坏就是一行装满上限那么多块，一行最多也就这么长（长句多出来的部分出画）。
         */
        const budgetRow = BUDGET_ROW_CELLS;
        const climbCells = (budgetRow + depth) * risePerCell;
        const laneCells = (budgetRow + knobs.spacing) * risePerCell;
        /*
         * 柱顶那一块在屏幕上占多高：顶面 / 正面的字躺在柱顶上（错切之后最多占一条对角线），
         * 悬浮的字往上还要一格 + 缝隙；侧面的字是**立起来**的，排在端头那面墙里，
         * 那面墙的宽是柱身横向、高是柱高，柱子在屏幕上占的高度就是「柱高 + 墙宽」。
         */
        const cosPitch = Math.cos(pitchRad);
        const pillarCells = heightCells * cosPitch / Math.SQRT2;
        const crownCells = knobs.textFace === 'side'
            ? pillarCells + widestDepth * cosPitch / Math.SQRT2
            : TEXT_FILL * FACE_SPAN_CELLS;
        /*
         * 头顶还要装下**小人自己**：他站在柱顶上，腾空时再抬一整个跳跃高度。
         * 两个都是世界里竖直的一段，和柱身一样按 `cosθ/√2` 换成格宽。
         * 把默认的「小人尺寸 / 跳跃高度」拧大时，格子于是自动让出地方——
         * 人不会顶出画面（顶出去就只剩一个脑袋），也不会因为拧旋钮整屏缩一下。
         */
        const runnerCells = RUNNER_RATIO * knobs.runnerScale * cosPitch / Math.SQRT2;
        const arcCells = knobs.arc * cosPitch / Math.SQRT2;
        /*
         * 「上方」那一档的字浮在柱顶之上：连它一起算进头顶的预算，
         * 切到那一档时字不会顶出画面，也不会因为切档位整屏缩一下。
         */
        const crownTopCells = crownCells
            + Math.max(TEXT_FILL, runnerCells + arcCells)
            + FRAME_PAD_CELLS / 2;
        const belowCells = 2 * climbCells + laneCells + crownCells + FRAME_PAD_CELLS / 2;
        const aboveCells = 2 * climbCells + laneCells + crownTopCells + FRAME_PAD_CELLS / 2;
        const frameCells = belowCells + aboveCells;
        const byHeight = (size.height * FIT_SHARE) / frameCells;
        /*
         * 横向：不再拿这首歌真实排出来的长度估——侧面的字长在横向、块长也长在横向，
         * 而且长句与短句排出来的行长差很多，按真实长度算格子，换一行整屏就缩一次。
         * 这里按**上限**（`budgetRow` 块 + 拐点那一截 + 柱身）算最坏的横向占位，
         * 于是短句长句同一把尺子；真有一行超出上限时，它往画面外铺就是了。
         *
         * 视野里同时铺着三行，一右一左地折，合起来的横宽差不多是三行接起来那么多
         * （每行在屏幕上一边走半边，所以除以 √2）。横向份额按这个数给，别按单行给：
         * 单行算出来只有实际铺开的三分之一，格子被横向挤到下限，整屏缩成一小团。
         */
        const rowSpanCells = (3 * budgetRow) / Math.SQRT2;
        const roadSpread = Math.max(
            rowSpanCells,
            (budgetRow + 2 * depth) / Math.SQRT2,
            (budgetRow + depth) * risePerCell + crossCells,
        );
        const byWidth = (size.width * LANE_WIDTH_SHARE) / Math.max(1, roadSpread);
        // 句子很短时上面的预算会放得很大：压一层上限，别让一块比一行字还高。
        const cellPx = Math.max(CELL_FLOOR_PX, Math.min(byHeight, byWidth, size.height / 2.8, size.width / 3));
        const projection = createProjection({ pitch: knobs.pitch, cell: cellPx });

        /** 一行每一块的屏幕位置：沿本行的世界轴铺开，块心落在路的中心线上。 */
        const placeRow = (lineIndex) => {
            const entry = road[Math.max(0, Math.min(road.length - 1, lineIndex))] ?? null;
            if (!entry) return [];
            return entry.lens.map((len, unitIndex) => {
                /*
                 * 世界坐标：沿本行的轴走到块心，横向就落在中心线上。
                 * 块心由 `jumpBoard.rowBlockCenter` 给——`offsets` 已经是块心，
                 * 这里再补半个块长的话，块就被自己的长度顶出去，间隙成了「随字长变」。
                 */
                const world = rowBlockCenter(entry, unitIndex);
                const screen = projection.project(world.x, world.y, 0);
                // 柱高整屏一个数（见 jumpShape）：跟着字变的只有侧面那面墙的宽度。
                const blockHeight = heightCells;
                return {
                    lineIndex,
                    unitIndex,
                    len,
                    along: entry.along,
                    direction: entry.direction,
                    screen,
                    height: blockHeight,
                    top: projection.project(world.x, world.y, blockHeight),
                };
            });
        };

        return {
            cellPx, depth, crossCells, heightCells, projection,
            road, placeRow,
            // 小人脚下留给上一行的那块高度：镜头把他钉在离画面底边这么高的地方。
            // 一格按最小像素算，一格再小也不会把落点挤出画面底边。
            anchorBelowPx: belowCells * Math.max(cellPx, CELL_FLOOR_PX),
        };
    };

    /*
     * 整屏的几何只由 (容器尺寸, 旋钮, 歌词) 决定，**与时间一点关系都没有**：
     * 从前它排在 paintFrame 里每帧从头算一遍，几百行歌词每行都要拼一次缓存键
     * （这一段是按签名缓存的，但拼签名本身就已经是全表扫描了）。
     * 现在按签名算一次存起来，帧上只取返回值——歌曲多长都不再影响帧成本。
     */
    let boardEpoch = 0;
    let boardCache = { key: '', board: null };
    const boardOf = (size) => {
        const key = `${Math.round(size.width)}|${Math.round(size.height)}|${boardEpoch}`;
        if (boardCache.key !== key) boardCache = { key, board: buildBoard(size) };
        return boardCache.board;
    };

    /**
     * 一屏上要画哪几行、各自是什么角色。
     *
     * 三行是从那条绝对折线上截下来的一段：下面刚唱完的、正在写的、上面等着接的。
     * 行的位置由全局行号给出，换行时谁都不动，动的只有镜头。
     */
    const sceneRows = (rows) => {
        const total = ctx.lines?.length ?? 0;
        const list = [];
        // 刚唱完的那一行同样不一定是紧邻的下标：空行排不出柱子，就往上退一格找。
        for (let index = rows.rowIndex - 1; index >= 0 && index >= rows.rowIndex - 3; index -= 1) {
            if (!layoutOf(index)) continue;
            list.push({ index, role: 'prev' });
            break;
        }
        if (rows.rowIndex >= 0) list.push({ index: rows.rowIndex, role: 'current' });
        // 下一行不一定是紧接着的下标：空行、纯标点行排不出柱子，就跳到第一个能排出柱子的行。
        for (let index = rows.rowIndex + 1; index < total; index += 1) {
            if (!layoutOf(index)) continue;
            list.push({ index, role: 'next' });
            break;
        }
        return list;
    };

    /**
     * 这一行登场的两个时刻：
     *   - `start`：它第一次出现在画面上的时刻——通常是镜头切到它前一行那一刻（那时它
     *     作为「下一行」登场）。两行之间夹了空行时它会被提前挂上来，那时按行号排班的
     *     时刻还在未来，取两者中更早的那个，免得这一行先隐身一段时间再冒出来；
     *   - `budget`：它必须落位完成的秒数 —— 到它自己接手（变成「正在写」的那一行）为止。
     *     短句时这一截很短，错开量会被压一压，免得小人跳上一根还在上升的柱子。
     *
     * 开头那两行从第一句开口起就在画面上，没有登场时刻（`start` 为 null = 一直在）。
     */
    const revealWindowOf = (index, rowIndex) => {
        if (index <= 1) return { start: null, budget: 0 };
        const scheduled = windows[index - 2]?.writeEnd;
        const onScreen = rowIndex >= 1 ? windows[rowIndex - 1]?.writeEnd : null;
        const start = Math.min(
            Number.isFinite(scheduled) ? scheduled : Number.POSITIVE_INFINITY,
            Number.isFinite(onScreen) ? onScreen : Number.POSITIVE_INFINITY,
        );
        if (!Number.isFinite(start)) return { start: null, budget: 0 };
        const handOver = windows[index - 1]?.writeEnd;
        const span = Number.isFinite(handOver) ? Math.max(0, handOver - start) : 0;
        return { start, budget: span * REVEAL_BUDGET_SHARE };
    };

    /**
     * 画一帧：所有位置都由 timeSec 算出来，不累加。
     *
     * 镜头只干一件事：把小人踩着的那根柱子钉在画面的锚点上。他不动画面就是静止的，
     * 他跳一格——行内一格、跨行也是一格——画布就朝反方向挪一格。
     * 于是整条路从头到尾是同一条，不用在某一行唱完之后重排一次。
     */
    const paintFrame = (timeSec) => {
        const size = readMetrics();
        // 跨行那一跳的窗口全由收尾窗与下一行开口决定（见 jumpBoard.resolveShiftAnchor），
        // 这里不再传时长：整段空档就是那一跳的窗口。
        const rows = resolveBoardRows({ windows, time: timeSec });
        const listing = sceneRows(rows);
        if (listing.length === 0) {
            stage.arrange([]);
            stage.paintRunner(null);
            stage.drawTrail([]);
            stage.drawImpact([]);
            stage.moveCanvas(0, 0);
            return;
        }
        const board = boardOf(size);
        const { cellPx, projection } = board;

        /*
         * 三条路一起摆，位置是绝对的：只由 (行号, 块号) 决定，
         * 镜头往后怎么走都不会挪动任何一块。
         */
        const placed = [];
        listing.forEach(({ index, role }) => {
            const layout = layoutOf(index);
            if (!layout) return;
            const debut = revealWindowOf(index, rows.rowIndex);
            board.placeRow(index).forEach((item, unitIndex) => {
                const unit = layout.units[unitIndex];
                if (!unit) return;
                // 时间表一并挂在块上：每帧算「柱子沉多少」时不必再回查排版（查一次要拼一遍缓存键）。
                placed.push({ ...item, unit, role, count: layout.units.length, debut, timeline: layout.timeline });
            });
        });
        const faceOpacity = 0.12 + 0.5 * knobs.wireframe;
        // 新行登场的滑出距离：整块（连它的字）一起从落位点下方这么多像素处升上来。
        const risePx = cellPx * REVEAL_RISE_CELLS;
        // 跳跃高度是世界里竖直的一段：投影里竖直 1 格抬 `lift`。
        const arcPx = knobs.arc * projection.lift;

        // 这一行的时间表：柱子什么时候被踩下去、什么时候弹回来，都由它给（见下面 `sinkPxOf`）。
        const timeline = rows.rowIndex >= 0 ? layoutOf(rows.rowIndex)?.timeline : null;
        /*
         * 收尾那一截里人站着不动的那一小段（末块落地 → 他起跳跨行），把画面交给「呼吸」：
         * 柱子再往上顶一点点、末块的落点亮一点点。窗口取 `pillarRest` 与收尾窗的交集——
         * 他还在空中、或者已经上路的时候不该有这一笔（那两截动的是人自己）。
         *
         * 两头（末块落地那一刻 / 起跳那一刻）都归零，`edge` 再让出这一截两头的起跳与落地，
         * 于是它接得上前后两段，也接得上拖进度与暂停。
         */
        const closing = windows[rows.rowIndex] ?? null;
        const rest = timeline?.pillarRest ?? null;
        const idle = resolveIdleMotion({
            begin: closing?.afterStart,
            end: closing?.afterEnd,
            rest,
            edge: knobs.flySeconds,
            time: timeSec,
        });
        /*
         * 呼吸的幅度都很小：这是「人还在那儿、歌还没唱完」，不是第二套动画。
         * 空档再宽也只在「他没在动」的那一截里起伏：人一上路它就归零。
         */
        const idleRisePx = idle.rise * cellPx * IDLE_RISE_CELLS;
        const idleDriftPx = idle.drift * projection.lift * IDLE_DRIFT_CELLS;

        /**
         * 这一根柱子此刻沉下去多少（像素）：小人踩上来就沉、跳走就弹回来并小幅振动几下。
         *
         * 每块自带**这一行自己的**时间表（挂在 `item.timeline` 上），所以上下三行各算各的：
         * 刚唱完的那一行末块在他跨走那一刻弹回来，正在写的这行跟着他一沉一弹。
         * 幅度由旋钮「柱子弹性」给，0 = 纹丝不动。
         */
        const sinkPxOf = (item) => {
            const spring = item.timeline?.pillars?.[item.unitIndex];
            if (!spring) return 0;
            return resolvePillarSpring({
                time: timeSec,
                pressTime: spring.pressTime,
                releaseTime: spring.releaseTime,
                strength: knobs.pillarSpring,
            }) * projection.lift;
        };

        /*
         * 绘制顺序就是画家算法：屏幕更靠上的先画、更靠下的压在上面，
         * 于是正在写的这一句整条压在上下两行之上，拐角处不会互相盖住。
         * 排序用**落位点**（不含登场偏移）：否则柱子在滑上来的过程中会互相换位、闪。
         */
        placed
            .slice()
            .sort((a, b) => a.screen.y - b.screen.y)
            .forEach((item, order) => {
                item.entry = stage.acquirePillar(order);
                /*
                 * 刚登场的那一行：柱子从下往上依次滑出来并淡入。
                 * 序号 0 在本行最下、最后一根在最上，按序号错开就是「从下往上逐渐显示」。
                 */
                const reveal = resolveRowReveal({
                    time: timeSec,
                    start: item.debut.start,
                    budget: item.debut.budget,
                    order: item.unitIndex,
                    count: item.count,
                    riseSeconds: REVEAL_SECONDS,
                    stagger: REVEAL_STAGGER,
                });
                /*
                 * 柱子被踩下去多少（像素）：小人踩上来就沉、跳走就弹回来并小幅振动几下。
                 * 时刻由这一行自己的时间表给（`pressTime` / `releaseTime`），
                 * 所以上下两行各自算各自的，且同样只由时间算出来、不累加。
                 */
                item.sinkPx = sinkPxOf(item);
                /*
                 * 明暗按**屏幕上的左右**给，不按正/侧给：哪一面落在左下随这一行的朝向交替，
                 * 按正/侧上色会让相邻两行一明一暗地闪。
                 */
                const lit = item.role === 'current' ? palette.front : palette.back;
                const shade = item.role === 'current' ? palette.side : palette.backSide;
                // 行的主次：正在写的那一行是 1，上下两行淡一档。柱面与文字各用各的一份。
                const roleFade = item.role === 'current' ? 1 : 0.72;
                /*
                 * 每根柱子自己的三个尺寸都由这块字的字宽与长宽比推出来（jumpShape）：
                 * 面永远装得下这块字，柱子于是跟着字长——顶面 / 正面那档块变长、柱顶变宽，
                 * 侧面那档端头那面墙变宽，块长只留柱身厚度。
                 *
                 * 几何与它的贴面字盒本来就是一套东西（同一个尺寸 / 旋钮 / 这块字的字宽下
                 * 必然是同一个结果），所以一起由 `blockOf` 按签名缓存：每一帧从这里拿到的是
                 * **同一个对象**，stage 那一边比一次身份就知道要不要重写那三个面。
                 */
                const { box, label } = blockOf(projection, item.unit, item.along, board.heightCells);
                // 收尾那一截的呼吸只加在正在写的这一行上：整行（含末块的字）一起轻轻往上顶。
                const breathe = item.role === 'current' ? idleRisePx : 0;
                stage.paintPillar(item.entry, {
                    // 沉下去的那一份直接加在落位点上：整根柱子（连它的字）一起沉。
                    base: {
                        x: item.screen.x,
                        y: item.screen.y + (1 - reveal) * risePx + item.sinkPx - breathe,
                    },
                    box,
                    colors: {
                        edge: palette.edge,
                        // 正在写的这一行用更实的一块材质，上下两行淡一档：三行不会糊成一条。
                        top: lit,
                        front: item.along === 'x' ? lit : shade,
                        side: item.along === 'x' ? shade : lit,
                    },
                    /*
                     * 柱面与棱线的浓淡只由「线框强度」与行的主次给——**不再连带文字**：
                     * 以前整根柱子共用一个 `opacity`，字被柱面那份浓度一起乘掉（默认
                     * 旋钮下只剩四成亮度），字于是永远读不实。
                     */
                    faceAlpha: faceOpacity * roleFade,
                    // 这一行登场时整块（柱面 + 字）一起淡入：只有 `reveal` 参与。
                    opacity: reveal,
                    label: {
                        text: item.unit.text,
                        // 字盒按面装好（宽、高、字号同比例），这里照抄，不再另外放大缩小。
                        width: label.width,
                        height: label.height,
                        fontSize: label.fontSize,
                        // 贴面：这个面的 2D 矩阵把整块字错切到面上（顶面/正面/侧面），
                        // 矩阵的平移项把字盒的**中心**放到面心；
                        // 「上方」那一档不做变换，屏幕正立浮在柱顶中心的正上方。
                        transform: label.transform,
                        color: palette.text,
                        fontFamily: palette.fontFamily,
                        fontWeight: palette.fontWeight,
                        // 字自己的亮度：只跟着行的主次走，不吃「线框强度」。
                        opacity: roleFade,
                    },
                });
            });
        stage.arrange(placed.map((item) => item.entry).filter(Boolean));

        /*
         * 小人此刻在哪一格都由时间直接推出来，三种状态：
         *   1. 跨行那一跳：上一行唱完到这一行开口之间，他自己从上一行最后一根跳过来；
         *   2. 行内的某一跳：这块词开唱，他就往这块词跳；
         *   3. 都不在：站在自己那一行已经落地的那根柱子上（也含「还没轮到他」的第一根）。
         */
        /*
         * 按**块号**排序：`placed` 是按屏幕上下（画家算法）排过的，不能拿来当行内的顺序，
         * 否则跨行那一跳会从小人脚下那块、而不是这一行第一块起跳。
         */
        const inOrder = (item) => item.unitIndex;
        const current = placed.filter((item) => item.role === 'current').sort((a, b) => inOrder(a) - inOrder(b));
        const previous = placed.filter((item) => item.role === 'prev').sort((a, b) => inOrder(a) - inOrder(b));
        const next = placed.filter((item) => item.role === 'next').sort((a, b) => inOrder(a) - inOrder(b));
        const lastOfPrevious = previous[previous.length - 1];
        /*
         * 谁算「他此刻正在这一屏上跳」，只有一个答案（`hopper`）：
         *   - `shift`：跨行那一跳。窗口见下（`shiftSpans`），与镜头末段的 `tailSpan` 同一个终点；
         *   - `inline`：行内几跳，由这一行自己的时间表给。
         *
         * 以前这里只问 `rows.phase < 1`，而 `jumpBoard` 在**唱完那一刻**就把这一行交给了
         * 下一行：收尾窗里相位是 1，`resolveRunnerState` 又因为他还没到起跳时刻而判「站着」，
         * 于是人被钉在末块上、下一行首块谁也不去——跨行那一跳整个漏掉，看起来就是
         * 「行末直接跳到新行的第二个字」。
         *
         * 起点用 `current` 的末块而不是「上一行」：他在收尾窗里跨过去的时候屏幕上只有这一行
         * （`prev` 那一行要等真的交出去了才挂上来），第 0 行更是根本没有上一行。
         */
        /*
         * 窗口以 `gapShift`（唱完那一刻 → 下一行开口）为准，排不出正宽度时才退回 `tailSpan`：
         * 末块落地之后他还得站着把最后几个字唱完，那之前脚下就是这一行的末块
         * （柱子被压着、人跟着一起沉）；一落地就判「在路上」的话，末块会在落点那一刻
         * 弹回来，踩下去那一下还没压完就被抬起来。
         * 但 `gapShift` 排不出正宽度时（没有下一行开口可依——**第一行**就是这样：
         * `writeEnd` 被 `renderEndTime` 夹到与收尾同刻），绝不能退回「站着」：
         * 那正是「收尾窗里人钉在末块上、下一个字直接瞬移过去」的老毛病。
         * 这种时候按 `tailSpan`（末块落点 → 开口）走，宁可早一点上路。
         */
        const shiftGap = timeline?.gapShift;
        const tailSpan = timeline?.tailSpan;
        const shiftSpans = shiftGap && shiftGap.end > shiftGap.begin
            ? shiftGap
            : { begin: tailSpan?.begin, end: tailSpan?.end };
        const shiftAir = resolveShiftAirborne({ ...shiftSpans, time: timeSec });
        const runner = resolveRunnerState({ timeline, time: timeSec });
        const tailFrom = current[current.length - 1];
        const hopper = shiftAir?.airborne && tailFrom && next.length > 0
            ? { kind: 'shift', from: tailFrom, to: next[0], progress: shiftAir.phase }
            : { kind: 'inline', from: current[runner.from], to: current[runner.to], progress: runner.progress };
        const hopping = hopper.kind === 'shift';
        const fromUnit = hopper.from;
        const toUnit = hopper.to;
        const airProgress = hopper.progress;
        // 真在空中（腾空那一截）才做挤压：站着的帧不该被压扁。
        const airborne = hopping || runner.airborne;

        /*
         * 镜头：把「小人走到路上第几格」钉到画面的锚点上。
         *
         * 锚点横向留一点前瞻（往路的反方向偏），前面那几根还没跳到的柱子才看得全；
         * 跨行时这一笔也在两行的朝向之间平滑换过去，不会出现「跳一下、画面横甩一次」。
         * 纵向的份额由 buildBoard 的预算给：底下装得下上一行，头顶装得下下一行。
         */
        const fallback = lastOfPrevious ?? placed[placed.length - 1];

        /*
         * 镜头走**自己**那一条线，不跟着小人的跳（见 jumpTimeline.resolveCameraPath）：
         * 小人落地之后站着不动，照他的曲线走就是「走一截、停一截」，节奏一快画面就在抖。
         * 行内因此匀速；跨行要拐角，那一跳照旧「起步慢、落定稳」。
         */
        const camera = resolveCameraPath({ timeline, time: timeSec });
        /*
         * 末段：从**这一行末块**走到**下一行首块**。两条路的夹角可能是九十度，
         * 走直线会把拐点切掉，所以沿折线走（三段权重见 `resolvePathWeights`）。
         *
         * 它的窗口是 `tailSpan`（末块落点 → 下一行开口）：
         *   - 起点接上行内那几段，于是末块落地之后镜头一刻都不停；
         *   - 终点就是开口那一刻，与小人跨行那一跳的落地严丝合缝。
         * 唱完那一刻落在它中间，镜头在那之前就已经在走——画面不会在收尾那一刻停住。
         *
         * 窗口与端点都取自**这一行自己**的排版（`timeline` / `current` 的末块），
         * 不看「上一行」：收尾窗里这一行还在手上（`rows.rowIndex` 仍是它），
         * 那一刻画面上根本没有「刚唱完的那一行」可依。第 0 行也照样适用——它没有上一行，
         * 却有下一行要跨。
         */
        const tailFlight = current.length > 0 && next.length > 0
            ? resolveTailAirborne({
                begin: timeline?.tailSpan?.begin,
                end: timeline?.tailSpan?.end,
                time: timeSec,
            })
            : null;
        /*
         * 末段还在走：这一屏上除了它没有别的镜头可走（行内那几段都已经过去了）。
         * 只在「这一行唱完」之后才接手——末段的起点是末块落点，可末块落地之后
         * 他还得站一会儿把最后几个字唱完，那之前镜头仍按行内那套匀速走。
         */
        const tailing = Boolean(tailFlight) && tailFlight.phase < 1
            && timeSec >= (closing?.afterStart ?? Number.POSITIVE_INFINITY);
        const camFrom = hopping || tailing
            ? current[current.length - 1]
            : current[Math.min(camera.index, current.length - 1)];
        const camTo = hopping || tailing
            ? next[0]
            : current[Math.min(camera.index + 1, current.length - 1)];
        const camProgress = hopping || tailing ? tailFlight.phase : camera.progress;
        let focus = alongRoad((camFrom ?? fallback)?.top, (camTo ?? fallback)?.top, camProgress);
        if ((hopping || tailing) && camFrom && camTo) {
            /*
             * 折线：起点 → 拐点（两行的接头）→ 终点。
             * 小人在路上时起点就是他脚下那块，镜头于是**钉着他**；他还站在末块上时
             * （末块落地到起跳之间）这条折线照样在走，正好把那一截填平。
             */
            const weights = resolvePathWeights(camProgress);
            focus = weightedFocus([
                [camFrom.top, weights.first],
                [shiftCorner(camFrom), weights.mid],
                [camTo.top, weights.second],
            ]);
        }
        /*
         * 前瞻那一笔要跟着路的走向换：跨行那一截在两行的朝向之间插值。
         * 末段里「正在写的这一行」还没换手（`tailing`）——那时前瞻仍按**这一行**的朝向给，
         * 否则换手那一帧会横跳一格。
         */
        const lookDir = hopping || tailing
            ? (camFrom?.direction ?? 1) + (((camTo?.direction ?? camFrom?.direction ?? 1) - (camFrom?.direction ?? 1)) * camProgress)
            : (current[0]?.direction ?? lastOfPrevious?.direction ?? 1);
        stage.moveCanvas(
            size.width / 2 - lookDir * board.projection.half * LOOK_AHEAD_CELLS - focus.x,
            // 收尾那一截的呼吸：画布再往下让一点，柱子于是看着是往上顶的（人跟着一起抬）。
            size.height - board.anchorBelowPx - focus.y + idleRisePx,
        );

        if (!fromUnit || !toUnit) {
            stage.paintRunner(null);
        } else {
            stage.paintRunner({
                feet: runnerFeet({
                    from: fromUnit,
                    to: toUnit,
                    progress: airProgress,
                    // 收尾那一截里人还站在末块上：让他随着呼吸再抬一点点，不至于像钉死的图钉。
                    arc: arcPx + idleDriftPx,
                    // 人踩在柱顶上：柱子沉下去（弹回来）多少，他的脚就跟着走多少，
                    // 否则柱子一沉他就悬在半空、柱子一弹他就被顶穿。
                    sinkFrom: fromUnit.sinkPx ?? 0,
                    sinkTo: toUnit.sinkPx ?? 0,
                }),
                // 同一时刻落在线路上的那一点（不含腾空）：影子留在那里，不跟着人飞。
                ground: runnerFeet({
                    from: fromUnit,
                    to: toUnit,
                    progress: airProgress,
                    arc: 0,
                    sinkFrom: fromUnit.sinkPx ?? 0,
                    sinkTo: toUnit.sinkPx ?? 0,
                }),
                // 小人比一个字高一点：跳一跳里人是主角，但不能高到盖住两行。
                // 他是世界里竖直的东西，所以和柱身一样按 `lift` 换算（俯角越大越矮）。
                height: projection.lift * RUNNER_RATIO * knobs.runnerScale,
                color: palette.accent,
                squash: airborne ? resolveHopSquash(airProgress) : 1,
                // 柱顶在屏幕上的扁度：影子照它压扁，才像躺在斜面上而不是浮在半空。
                groundSquash: projection.sin,
            });
        }

        stage.drawTrail(trailSegments({
            placed: current,
            timeline,
            time: timeSec,
            arc: arcPx,
            color: palette.accent,
            opacity: knobs.trail * 0.8,
        }));
        /*
         * 落地那一瞬：柱顶铺开一圈环、溅几粒尘。
         * 落点时刻是时间表里现成的那一秒（跨行那一跳就是下一行开口那一刻），
         * 所以特效同样不累加：拖进度、暂停、导出都不会留下半开的环。
         */
        const landings = [];
        (timeline?.hops ?? []).forEach((hop) => {
            const target = current[hop.to];
            // 环贴在**此刻**的柱顶上：柱子正在往下沉，环跟着它一起沉，不然会脱开一截。
            if (target) landings.push({ landTime: hop.landTime, top: target.top, sink: target.sinkPx ?? 0 });
        });
        const shiftLand = windows[rows.rowIndex]?.writeStart;
        if (rows.rowIndex > 0 && Number.isFinite(shiftLand) && current[0]) {
            landings.push({ landTime: shiftLand, top: current[0].top, sink: current[0].sinkPx ?? 0 });
        }
        /*
         * 收尾那一截：末块的落点再亮一点点（人站在那儿把最后一个字唱完）。
         * 借冲击环那一层画，但强制定时成「整段都亮」——它的两头同样是归零的
         * （见 resolveIdleMotion），所以接得上前后两段，也不会在别的时候冒出来。
         */
        const lastOnRow = current[current.length - 1];
        if (lastOnRow && idle.glow > 0.02) {
            landings.push({
                landTime: timeSec,
                top: lastOnRow.top,
                sink: lastOnRow.sinkPx ?? 0,
                // 环停在一小圈上、只是慢慢淡：这是「亮着」，不是「又落地了一次」。
                burst: { ring: { radius: 0.34, opacity: idle.glow * 0.5 }, dust: [] },
            });
        }
        stage.drawImpact(impactStamps({
            landings,
            time: timeSec,
            // 环铺到柱顶那么宽就停：再大就把相邻那根的落点也圈进去了。
            radius: Math.max(8, cellPx * 0.55),
            squash: projection.sin,
            color: palette.accent,
            // 跟着「跳跃轨迹」那个旋钮一起淡：想要干净的画面就把两者一起关掉。
            opacity: 0.35 + 0.65 * knobs.trail,
        }));
        stage.setOpacity(ctx.getDisplay()?.visualizerOpacity ?? 1);
    };

    /**
     * 几个点按权重加权：跨行那一段沿折线走，位置就是「起点 / 拐点 / 终点」的加权和。
     * 权重由 jumpTimeline 的 `resolvePathWeights` 给（和恒为 1），所以两头必然精确落在块上；
     * 小人与镜头用的是同一把尺子，他跳过的路和镜头绕过的拐角是同一条折线。
     */
    const weightedFocus = (entries) => {
        let x = 0;
        let y = 0;
        let total = 0;
        entries.forEach(([point, weight]) => {
            const w = Number.isFinite(weight) ? weight : 0;
            if (!point || w <= 0) return;
            x += point.x * w;
            y += point.y * w;
            total += w;
        });
        return total > 0 ? { x: x / total, y: y / total } : { x: 0, y: 0 };
    };

    /**
     * 两行接头那一点（拐点）在屏幕上的位置：上一行末块**沿路的外沿**、落在路的中心线上。
     *
     * 它就摆在两条路的交汇处（`accumulateRowRoad` 让下一行从这里起铺），
     * 跨行那一段沿折线走时以它为中途站——镜头这才不会把拐角切掉、从中途飞过去。
     */
    const shiftCorner = (fromItem) => {
        const step = (Number(fromItem?.len) || 0) / Math.SQRT2;
        return {
            x: fromItem.top.x + (fromItem.direction ?? 1) * step,
            y: fromItem.top.y,
        };
    };

    /** 两点之间按 `progress` 取一点：镜头锚的是「它在路上走到哪儿」，不含抛物线那一下。 */
    const alongRoad = (from, to, progress) => {
        const t = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
        if (!from || !to) return from ?? to ?? { x: 0, y: 0 };
        return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
    };

    /**
     * 小人脚下那一点：两块柱顶之间插值，空中再抬一个抛物线（都在屏幕坐标里算）。
     *
     * `sinkFrom` / `sinkTo` 是这两根柱子此刻沉下去的像素：脚下那一点跟着柱子一起动，
     * 起跳时从「压着的柱顶」离地、落地时落到「还没沉的柱顶」上再随它沉下去。
     */
    const runnerFeet = ({ from, to, progress, arc, sinkFrom = 0, sinkTo = 0 }) => {
        const t = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
        const sink = (Number(sinkFrom) || 0) + ((Number(sinkTo) || 0) - (Number(sinkFrom) || 0)) * t;
        return {
            x: from.top.x + (to.top.x - from.top.x) * t,
            y: from.top.y + (to.top.y - from.top.y) * t - arc * Math.sin(t * Math.PI) + sink,
        };
    };

    /**
     * 跳跃轨迹：已经跳过的拱线 + 落点的小坑。
     *
     * 只画「这一行自己落过地」的那几跳；未落地的那一跳交给小人自己表达。
     * 拱线用一串小圆点画，不用「旋转的细长条」：细长条一旦角度算错就会连成一片。
     */
    const trailSegments = ({ placed, timeline, time, arc, color, opacity }) => {
        if (opacity <= 0.01 || !timeline) return [];
        const segments = [];
        (timeline.hops ?? []).forEach((hop) => {
            const from = placed[hop.from];
            const to = placed[hop.to];
            if (!from || !to || time < hop.landTime) return;
            const points = [];
            const steps = 8;
            for (let step = 0; step <= steps; step += 1) {
                const t = step / steps;
                points.push(runnerFeet({ from, to, progress: t, arc }));
            }
            segments.push({ kind: 'path', points, color, opacity: opacity * 0.45 });
            segments.push({
                kind: 'ellipse',
                x: to.top.x,
                y: to.top.y,
                rx: 5,
                ry: 2.5,
                color,
                opacity: opacity * 0.3,
            });
        });
        return segments;
    };

    /**
     * 落地那一瞬的特效（一圈环 + 几粒尘）：`landings` 是这一行（外加跨行那一跳）的落点与时刻。
     *
     * 只把「刚刚落地」的那一下画出来（`resolveLandingBurst` 之外的时间返回 null），
     * 于是这一层绝大多数帧是空的；每一份特效也都只由时刻算出来，不累加。
     */
    const impactStamps = ({ landings, time, radius, squash, color, opacity }) => {
        if (opacity <= 0.02) return [];
        const stamps = [];
        (landings ?? []).forEach((stop) => {
            // 有的落点是现成的（收尾那一截的「亮着」，见 paintFrame），只借这一层的画法。
            const burst = stop.burst
                ?? resolveLandingBurst({ time, landTime: stop.landTime, seconds: IMPACT_SECONDS });
            if (!burst || !stop.top) return;
            // 落点跟着柱子沉：环与尘画在**当下**的柱顶上。
            const sink = Number(stop.sink) || 0;
            stamps.push({
                x: stop.top.x,
                y: stop.top.y + sink,
                radius: radius * burst.ring.radius,
                squash,
                color,
                opacity: opacity * burst.ring.opacity,
                dotSize: Math.max(1.6, radius * 0.09),
                // 尘往外飞的方向由 jumpCourse 给（归一化），纵向照柱顶的扁度压一下。
                dust: burst.dust.map((dot) => ({
                    x: stop.top.x + dot.x * radius,
                    y: stop.top.y + sink + dot.y * radius * squash,
                    opacity: dot.opacity,
                })),
            });
        });
        return stamps;
    };

    let paintedTime = Number.NaN;
    let failedOnce = false;

    /**
     * 画一帧。`force` 给「播放时间一步没走、但输入变了」的那些场合：拖旋钮、换主题、改尺寸。
     */
    const paint = (timeSec, force = false) => {
        if (!Number.isFinite(timeSec)) return;
        // 同一个时刻不画第二遍：`currentTime` 在一帧里可能被写好几次，repaint 也会来一脚。
        if (!force && timeSec === paintedTime) return;
        paintedTime = timeSec;
        try {
            paintFrame(timeSec);
        } catch (error) {
            // 一帧抛异常不能带走订阅链：冻住的整屏比「这一帧没画」糟得多。
            // 但也别每帧都喊——一个稳定的异常就是一秒六十条日志。
            if (!failedOnce) {
                failedOnce = true;
                if (typeof folium?.log?.warn === 'function') folium.log.warn('jump visualizer frame failed', error);
            }
        }
    };

    const repaint = () => {
        const next = readKnobs(ctx.getSettings());
        // 旋钮变了要重排：块数、间距、高度都跟着变，缓存的排版、方块与整屏几何直接作废。
        if (Object.keys(next).some((key) => next[key] !== knobs[key])) {
            layoutCache.clear();
            blockCache.clear();
            boardEpoch += 1;
        }
        knobs = next;
        if (windows.length !== (ctx.lines?.length ?? 0)) {
            windows = buildWriteWindows(ctx.lines ?? []);
            layoutCache.clear();
            blockCache.clear();
            boardEpoch += 1;
        }
        palette = resolveJumpPalette(ctx.getTheme(), folium);
        paint(ctx.currentTime.get(), true);
    };

    /*
     * 尺寸变化不再逐帧去量，改由 ResizeObserver 报一次：
     * 回调里只翻标记（在回调里量尺寸会抖），真正取值是在下一次 paint 的 `readMetrics` 里。
     * 顺手踢一脚强制重画：尺寸变了画面必须重排，而播放时间一步没走，
     * 普通 paint 会被「同一时刻」那道去重挡住。
     */
    const resizeObserver = typeof ResizeObserver === 'function'
        ? new ResizeObserver(() => {
            metricsDirty = true;
            paint(ctx.currentTime.get(), true);
        })
        : null;
    resizeObserver?.observe(container);

    paint(ctx.currentTime.get());
    const offTime = ctx.currentTime.on('change', (value) => paint(value));
    const offChanges = ctx.subscribe(repaint);

    return () => {
        offTime();
        offChanges();
        // 观察器不断开的话，它会一直强引用着已经脱离文档的整棵子树（cinerama 踩过同一个坑）。
        resizeObserver?.disconnect();
        layoutCache.clear();
        blockCache.clear();
        stage.dispose();
    };
};

export default function activate(folium) {
    folium.registries.visualizers.register({
        id: 'jump-course',
        label: { 'zh-CN': '跳一跳', en: 'Hopscotch' },
        order: 440,
        settings: JUMP_SETTINGS_SCHEMA,
        mount: (container, ctx) => mountJump(folium, container, ctx),
    });
}
