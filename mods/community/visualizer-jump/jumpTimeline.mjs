// mods/visualizer-jump/jumpTimeline.mjs
// 时间那一层：「小人什么时候跳」。纯计算，不碰 DOM。
//
// 一行歌词有自己的起止时间。第 k 块踩在**它自己**开唱的那一刻：起跳只占一小截，
// 其余时间小人站在那根柱子上。于是「进度」与「唱到哪个词」是同一件事。
// 这一行没有逐字时间时，才把几个块**均分**在这一行的时长里。
// 柱子不再按时间去「立起来」、也没有整行淡出：画面一直在呼吸就分不清进度。
//
// 一条规矩：**所有位置都由时间算出来**，不累加。拖动进度、暂停、导出走的是同一条链。

/**
 * 「非唱」那一截的最小宽度（秒）：一段音乐总得走过去，再紧凑的连唱也别让镜头一闪。
 */
export const MIN_IDLE_SECONDS = 0.16;

/**
 * 跨行那一跳的起步点：末根柱子弹回来的时刻，也是小人离开末块的那一刻。
 *
 * 它就是**这一行唱完那一刻**（`end`，收尾窗的起头）。
 *
 * 别改成「下一行开口」：那一跳的窗口铺满整段空档（唱完那一刻起跳、下一行开口落地，
 * 见 jumpBoard.resolveShiftAnchor），起步点晚一秒，收尾窗里他就会被判成「还没走」、
 * 一直钉在末块上——画面在动、人却不动，等下一个字才「瞬移」到下一行去，
 * 跨行那一跳整个消失（看着就是行末直接闪到新行的第二个字）。
 *
 * 没有下一行、或者时间排得奇怪时也回它：那时窗口是零宽，原地起步、原地落地。
 */
export const resolveLastRelease = (options = {}) => {
    const end = Number.isFinite(options.end) ? options.end : null;
    return end === null ? null : end;
};

/** 空档的时间窗：`begin`（起跳）到 `end`（落地）；排不出正宽度的空档返回 `null`。 */
const resolveGap = (options = {}) => {
    const begin = Number.isFinite(options.begin) ? options.begin : null;
    const end = Number.isFinite(options.end) ? options.end : null;
    if (begin === null || end === null || !(end > begin)) return null;
    return { begin, end, span: end - begin };
};

const clamp01 = (value) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

/** 平滑进出：空档两头的起跳与落地都「起步慢、落定稳」，不能是匀速平移。 */
const smooth = (value) => {
    const x = clamp01(value);
    return x * x * (3 - 2 * x);
};

/**
 * 空档走到第 `phase`（0…1）时，位置该按「起点 / 拐点 / 终点」三点怎么加权，权重和为 1。
 *
 * 两段各占一半时间：起点 → 拐点（`a`）、拐点 → 终点（`b`），各自 `smoothstep`。
 * 两条路在屏幕上可能差着九十度，直接插值会把拐角切掉、看着像整屏被横甩；
 * 分段之后两头必然是纯一点（`phase = 0` 只剩起点、`1` 只剩终点），中间不会出现三权重全 0 的空洞。
 *
 * 小人与镜头共用这一把尺子：他在路上的位置就是这三点加权出来的点，镜头钉着他，
 * 于是「他跳过拐角」和「镜头绕开拐角」是同一件事。
 */
export const resolvePathWeights = (phase) => {
    const t = clamp01(phase);
    const a = t <= 0.5 ? smooth(t * 2) : 1;
    const b = t <= 0.5 ? 0 : smooth((t - 0.5) * 2);
    return { first: 1 - a, mid: a - b, second: b };
};

/**
 * 空档里的相位：`{ phase, airborne }` —— 走到几成，以及「此刻还该画成在空中吗」。
 *
 * `airborne` 只覆盖两头之内那一截：越过起点和越过终点都已经落地，那是正常的站立姿势。
 * 收尾窗里的「呼吸」和被压住的柱子都靠它避开：人一旦上路，柱子就得弹回来。
 */
const phaseAtGap = (gap, time) => {
    const rest = { phase: 0, airborne: false };
    if (!gap) return rest;
    if (time <= gap.begin) return rest;
    if (time >= gap.end) return { phase: 1, airborne: false };
    return { phase: (time - gap.begin) / gap.span, airborne: true };
};

/**
 * 跨行那一跳：这一行的空档里他走到几成。没给时间窗（或时间落在窗口外）返回 `null`。
 *
 * 窗口就是**整段空档**（唱完那一刻起跳、下一行开口落地，见 jumpBoard.resolveShiftAnchor），
 * 与小人的起跳 / 落地严格同一个时刻，于是「镜头在路上」和「小人在空中」永远对得上。
 */
export const resolveShiftAirborne = (options = {}) => {
    const gap = resolveGap(options);
    const time = Number.isFinite(options.time) ? options.time : null;
    if (!gap || time === null) return null;
    const { phase, airborne } = phaseAtGap(gap, time);
    return { phase, airborne };
};

/**
 * 末段（末块 → 下一行首块）走到了几成，以及此刻还在不在路上。
 *
 * 它不是「唱完之后才开始」：起点是末块落点、终点是下一行开口，所以这一段**横跨**唱完那一刻
 * ——镜头运动把收尾那一刻包在里面。窗口之外返回 `null`（那时该由行内那几段接手）。
 */
export const resolveTailAirborne = (options = {}) => {
    const gap = resolveGap(options);
    const time = Number.isFinite(options.time) ? options.time : null;
    if (!gap || time === null) return null;
    return phaseAtGap(gap, time);
};

/**
 * 这一行的**收尾窗**：`{ afterStart, afterEnd }` —— 最后一个字唱完到下一行开口之间。
 *
 * 唱满一行之后、下一行开口之前那一截里，原来什么都不动：小人还站在末块上（他早落地了），
 * 画面于是停住，等下一个字才「啪」地跳一下。这一截就是用来把它填平的，但它得先知道
 * 「唱完」是哪一刻：
 *
 *   - 有逐字 / 逐词时间时，末块唱完 = 最后一个词自己的 `endTime`（不是这一行的 `endTime`，
 *     那个常常是整行还剩多久）；
 *   - 没有逐字时间时，最后一块**唱完 = 唱到它**：字时刻是按这一行均分估出来的，
 *     估出来的收尾比真实唱完晚一截，照它算的话镜头会等在那里、画面还是不动。
 *
 * 收尾窗止于下一行开口（跨行那一跳的落点），并且不窄于 `MIN_IDLE_SECONDS`：
 * 连唱时它很短，间奏里它很长，两种都要有东西在动（见 resolveLineMotion 与 cameraTimes）。
 *
 * `motionEnd` 是这一段音乐的收尾（调用方按歌词原文给，见 client 的 buildWriteWindows）：
 * 歌词原文唱完到下一行开口之间通常还挂着伴奏，那一段同样要算进「非唱」里。
 */
export const resolveMotionWindow = (options = {}) => {
    const start = Number.isFinite(options.start) ? options.start : 0;
    const end = Number.isFinite(options.end) ? options.end : start;
    const nextStart = Number.isFinite(options.nextStart) ? options.nextStart : null;
    const voiced = Number.isFinite(options.voicedEnd) ? options.voicedEnd : end;
    const target = nextStart !== null ? nextStart : end;
    if (!(target > start)) return null;
    /*
     * 收尾窗别把整行都吞进去：没有逐字时间时字时刻是均分估出来的，`voicedEnd` 会顶到这一行的
     * 收尾；末块唱得极晚时也一样。两种都按「这一行最后几成」兜一下，收尾窗才真的落在收尾处。
     * `motionEnd` 用的是歌词原文的收尾——`voicedEnd` 若超过了它（估出来的轴常常超过），
     * 就更没法当成真实收尾了。
     */
    const span = target - start;
    const fallback = start + Math.max(
        0,
        Math.min(span, Math.min(
            Number.isFinite(options.motionEnd) ? Math.max(0, options.motionEnd - start) : span,
            span * (options.holdShare ?? 0.85),
        )),
    );
    const estimate = !Number.isFinite(voiced)
        || (Number.isFinite(options.motionEnd) && voiced > options.motionEnd + 1e-6);
    const voicedEnd = estimate ? fallback : Math.min(Math.max(voiced, start), target);
    const afterStart = Math.min(voicedEnd, target - MIN_IDLE_SECONDS);
    return { afterStart: Math.max(start, afterStart), afterEnd: target };
};

/**
 * 一行的时间表：每根柱子的落点时刻 + 每次跳跃的窗口。
 * 间隔再大也得让所有柱子在这行唱完之前落完，否则后半句只剩一根柱子。
 *
 * `endTime` 是**这一行还能写多久**的上限，不是歌词自己的收尾：这里的最后一跳要落在
 * 下一行开口之前（跨行那一跳的落点就是那一刻），所以行内的跳必须在那之前落地，
 * 否则画面上会出现「镜头已经在走、小人还在上一行跳」。
 * 这个上限由调用方按相邻两行算好传进来（见 client 的 buildWriteWindows）。
 */
/** 一跳在空中待多久的下限与上限（占这一跳窗口的比例）：再快也留一点站着，再慢也别飞一整段。 */
export const MIN_FLY_SHARE = 0.15;
export const MAX_FLY_SHARE = 0.95;

export const buildLineTimeline = (options = {}) => {
    const { startTime, endTime } = options;
    // 滞空是**几秒**，不是「占这一跳几成」：同一首歌里唱得快、唱得慢，跳这一下本身一样快。
    const flySeconds = Math.max(0.05, Math.min(3, Number.isFinite(options.flySeconds) ? options.flySeconds : 0.45));
    const count = options.count;
    const start = Number.isFinite(startTime) ? startTime : 0;
    const end = Number.isFinite(endTime) && endTime > start ? endTime : start + 2;
    const total = Math.max(0, Math.round(Number(count) || 0));
    const span = end - start;
    const steps = span / Math.max(1, total);
    /*
     * 每块的落点：先按词块自己的开唱时刻，再强制「不早于上一跳落地后一点」。
     * 两次起跳至少隔 `minGap`，否则一行里挤三五十块时会跳成一片残影；
     * 但这个词块要是还没唱到，就不能提前站过去——站过去就是剧透，进度也就和歌词脱钩了。
     */
    const minGap = Math.max(0.06, Math.min(0.3, steps * 0.35));

    const landings = [];
    let previous = start;
    for (let index = 0; index < total; index += 1) {
        const due = Number.isFinite(options.landTimes?.[index]) ? options.landTimes[index] : start + steps * index;
        const landing = index === 0
            ? Math.min(start, due)
            : Math.max(due, Math.min(previous + minGap, end));
        landings.push(Math.max(previous, landing));
        previous = landings[index];
    }

    /*
     * 每一跳各自占窗口的几成：`滞空秒数 ÷ 这一跳的窗口`。
     * 窗口长（慢歌）时飞的比例小——跳完就站着等；窗口短（快歌）时几乎整段在飞。
     * 上下限兜住两头：再快也留一点站着的时间（不然落地那一下没有停顿感），
     * 再慢也别让他在空中飘一整段。
     */
    const flyShares = [];
    for (let index = 0; index < Math.max(0, total - 1); index += 1) {
        const window = Math.max(0.05, landings[index + 1] - landings[index]);
        flyShares.push(Math.max(MIN_FLY_SHARE, Math.min(MAX_FLY_SHARE, flySeconds / window)));
    }
    /*
     * 镜头自己的到站时刻：第 k 块在 `landings[k] − lag × 上一跳的间隔` 到站。
     *
     * 小人只在腾空那一截前进、落地之后站着不动；镜头要是照他的曲线走，就成了
     * 「走一截、停一截」——节奏一快，画面就在「动—停—动」地抖。所以镜头走**匀速**：
     * 每一段的窗口覆盖「这一跳 + 落地后站着那一截」，段与段首尾相接，行内于是全程在走。
     *
     * `lag` 取「站着那一截」的一半：镜头比小人晚半截到站（他落地时镜头还在走），
     * 也比他早半截离站——两头各摊半截，镜头落在小人身后 / 身前都不超过半截，不会一头偏到底。
     * 站着多久每一跳都不一样（见 flyShares），所以 `lag` 也按跳算。
     */
    const cameraTimes = landings.map((landing, index) => (
        index === 0 ? landing : landing - ((1 - (flyShares[index - 1] ?? MAX_FLY_SHARE)) / 2) * (landing - landings[index - 1])
    ));
    // 末根柱子的回弹时刻：跨行那一跳的起步点（缺省按这一行唱完算，见 resolveLastRelease）。
    const lastRelease = Number.isFinite(options.lastRelease) ? options.lastRelease : end;
    /*
     * 末段：镜头从最后一根柱子走到**下一行第一根**（`cameraTimes` 的最后一项就是它）。
     *
     * 以前镜头到末块就停住，一直到下一个字开口才「啪」地换行——唱完最后一个字到下一行
     * 开口之间，整屏是一张不动的图。现在这一段单独算，而且分成两个时刻：
     *   1. `handoverTime`：这一行唱完那一刻（最后一个字收尾，见 resolveMotionWindow），
     *      镜头从这一刻开始慢慢离站 —— **镜头运动跨过收尾那一刻**；
     *   2. 到站时刻 = 下一行开口那一刻，与小人跨行那一跳的落地重合
     *      （他从末块起跳也在那一刻，见 resolveLastRelease）。
     *
     * 中间这一截的播放位置由调用方按 `handover` 混出来（0…1，末段里「离站」落在第几成）：
     * 末段沿折线走（末块 → 拐点 → 下一行首块），见 resolvePathWeights。
     */
    const handover = Number.isFinite(options.handover) ? Math.max(0, Math.min(0.9, options.handover)) : 0;
    const lastLanding = landings[total - 1];
    /*
     * 末段的到站时刻由调用方给（`nextStart` = 下一行开口）：它比末块落点晚、而且不比
     * 跨行那一跳的起步点早，末段才成立。没给 `nextStart` 时退回旧的写法（`lastRelease`
     * 当到站），没有下一行的场合两者都不成立，镜头就停在末块上。
     */
    const tailEnd = Number.isFinite(options.nextStart)
        ? Math.max(lastRelease, options.nextStart)
        : lastRelease;
    /*
     * 末段从**末块落点**出发（不是从唱完那一刻）：镜头要一路都在走，起点就得接上
     * 行内那几段——否则末块落地到唱完之间镜头会停着等。于是这一段**横跨**唱完那一刻：
     * `handoverTime` 落在它中间，镜头在那之前就已经在走。
     */
    const tailRelease = Number.isFinite(tailEnd) && tailEnd > lastLanding + 1e-6;
    const handoverTime = tailRelease ? lastLanding + (tailEnd - lastLanding) * handover : null;
    if (tailRelease) cameraTimes.push(tailEnd);
    /*
     * 末段（末块落点 → 下一行开口）不参与 `cameraTimes` 那套「块号的匀速轴」：
     * 它是由 `tailSpan` 单独驱动的一段折线（见 client 的 `tailFlight`），
     * 所以上面那一项只是给 `resolveCameraPath` 留个到站记号，
     * 真正画出来的位置一律走 `resolveTailAirborne`。
     */
    const hops = [];
    for (let index = 0; index < Math.max(0, total - 1); index += 1) {
        const hopStart = landings[index];
        const hopEnd = landings[index + 1];
        hops.push({
            index,
            from: index,
            to: index + 1,
            start: hopStart,
            // 起跳只占一小截：其余时间小人站在柱子上，跟着这句词一起唱。
            landTime: hopStart + (hopEnd - hopStart) * (flyShares[index] ?? MAX_FLY_SHARE),
            end: hopEnd,
        });
    }
    /*
     * 每根柱子自己的两个时刻（柱子被踩下去 / 弹回来，见 jumpCourse.resolvePillarSpring）：
     *   - `pressTime`：小人**落**在它上面的那一刻 —— 第 0 根是这一行开口（他从上一行
     *     跨过来就落在它上面），其余是上一跳的落点 `hops[index - 1].landTime`；
     *   - `releaseTime`：他**跳走**的那一刻 —— 这一跳的起跳 `landings[index]`
     *     （最后一根是跨行那一跳的起步点，由 `lastRelease` 给；缺省按这一行唱完算）。
     */
    const pillars = landings.map((landing, index) => ({
        index,
        riseTime: index === 0 ? start : landing - minGap,
        pressTime: index === 0 ? start : (hops[index - 1]?.landTime ?? start),
        releaseTime: index < hops.length ? hops[index].start : lastRelease,
    }));
    return {
        start,
        end,
        gap: total > 1 && landings[total - 1] > landings[0]
            ? (landings[total - 1] - landings[0]) / (total - 1)
            : steps,
        pillars,
        hops,
        landings,
        cameraTimes,
        // 这一行唱完那一刻（收尾窗的起点）：镜头在这之前就已经在路上（`handoverTime` 落在末段中间）。
        handoverTime,
        // 末段的时间窗（末块落点 → 下一行开口）：给镜头画折线那两段用。
        handoverFrom: landings[total - 1],
        handoverTo: tailRelease ? tailEnd : lastLanding,
        lastRiseTime: pillars.length > 0 ? pillars[pillars.length - 1].riseTime : end,
        lastRelease: Number.isFinite(lastRelease) ? lastRelease : end,
        /*
         * 末块落点 → 下一行开口：小人「在路上」的那一整段（跨行那一跳）。
         * `client` 拿它同时喂小人和镜头——两边同一个窗口、同一把尺子（见 resolvePathWeights）。
         */
        tailSpan: {
            begin: lastLanding,
            end: tailRelease ? tailEnd : lastLanding,
        },
        /*
         * 空档里**人站着不动**的那一截：`pillarRest` 到 `gapShift` 之间。
         * 收尾窗的「呼吸」只该长在这里——末块上人还在唱的时候，或者他已经在路上之后，
         * 画面该由人自己动，不是柱子跟着一顶一顶。
         */
        pillarRest: { begin: lastLanding, end: lastRelease },
        gapShift: tailRelease ? { begin: lastRelease, end: tailEnd } : null,
    };
};

/**
 * 新一行登场的过渡：整行从下往上依次落位。
 *
 * `order` 是这根柱子在本行的序号——行内第 0 根在最下、最后一根在最上，
 * 所以按序号错开就是「从下往上逐渐显示」：先底下的柱子，再一路往上。
 *
 * 返回 0…1：0 还没登场（调用方把它摆到落位点的下方、画成全透明），1 已经站定。
 * 同样只由时间算出来、不累加，拖动进度、暂停、导出看到的都是同一帧。
 * `start` 为空表示「这一行一直在画面上」（开头那两行），直接返回 1。
 *
 * `budget` 是这一行必须在多久之内全部落位（到它接手为止）：整行排完要
 * `riseSeconds + stagger × (count − 1)`，超出就按比例压一压——短句唱得快，
 * 不能让小人跳上一根还在往上升的柱子。`riseSeconds` 压到 0.12 就不再压了。
 */
export const resolveRowReveal = (options = {}) => {
    const time = Number.isFinite(options.time) ? options.time : 0;
    const start = Number.isFinite(options.start) ? options.start : null;
    if (start === null) return 1;
    const order = Math.max(0, Math.round(Number(options.order) || 0));
    const count = Math.max(1, Math.round(Number(options.count) || 1));
    let rise = Math.max(0.05, Number.isFinite(options.riseSeconds) ? options.riseSeconds : 0.4);
    let stagger = Math.max(0, Number.isFinite(options.stagger) ? options.stagger : 0.07);
    const budget = Math.max(0, Number.isFinite(options.budget) ? options.budget : 0);
    const total = rise + stagger * (count - 1);
    if (budget > 0 && total > budget) {
        const scale = budget / total;
        stagger *= scale;
        rise = Math.max(0.12, rise * scale);
    }
    const begin = start + order * stagger;
    if (time <= begin) return 0;
    const t = (time - begin) / rise;
    if (t >= 1) return 1;
    // 缓出：起步快、落定稳，柱子像被从地里顶出来。
    return 1 - Math.pow(1 - t, 3);
};

/**
 * 某一时刻小人在哪：站在第几根柱子上，或者正从第 from 根跳到第 to 根（progress 0..1）。
 * 行还没开始 = 停在第 0 根；最后一跳落地之后 = 停在最后一根上。
 *
 * `timeline.gapShift`（唱完那一刻 → 下一行开口）是收尾窗里那一截：他在这一截里一路走向
 * 下一行首块，不走行内的跳。所以先把它答掉——否则「最后一跳落地之后」会把他按在末块上
 * 一整段空档。`from` / `to` 仍是末块号：跨行那一跳的另一端在**下一行**，由调用方接。
 */
export const resolveRunnerState = (options = {}) => {
    const { timeline, time } = options;
    if (!timeline || timeline.pillars.length === 0) {
        return { index: 0, from: 0, to: 0, progress: 1, airborne: false };
    }
    const t = Number.isFinite(time) ? time : timeline.start;
    const last = timeline.pillars.length - 1;
    if (t < timeline.start) return { index: 0, from: 0, to: 0, progress: 0, airborne: false };
    const shift = timeline.gapShift;
    if (shift) {
        const cross = resolveShiftAirborne({ begin: shift.begin, end: shift.end, time: t });
        if (cross?.airborne) {
            return { index: last, from: last, to: last, progress: cross.phase, airborne: true };
        }
    }

    for (const hop of timeline.hops) {
        if (t < hop.start) return { index: hop.from, from: hop.from, to: hop.from, progress: 1, airborne: false };
        if (t < hop.landTime) {
            return {
                index: hop.to,
                from: hop.from,
                to: hop.to,
                progress: (t - hop.start) / Math.max(1e-6, hop.landTime - hop.start),
                airborne: true,
            };
        }
        if (t < hop.end) return { index: hop.to, from: hop.to, to: hop.to, progress: 1, airborne: false };
    }
    return { index: last, from: last, to: last, progress: 1, airborne: false };
};

/**
 * 镜头此刻在路上的哪一截：返回 `{ index, progress, path }` —— 从第 `index` 块走向第 `index + 1` 块，
 * `progress` 是**线性的**（匀速），`path` 是这一段是不是跨行那一段（`'inline'` / `'gap'`）。
 *
 * 它故意不与小人同步：小人落地之后站着不动，镜头若照他的曲线走就是「走一截、停一截」。
 * 到站时刻（`cameraTimes`）把「站着那一截」也摊进相邻两段，段与段首尾相接，
 * 于是行内全程都在走、速度只随这一段的间隔变化；镜头与小人的偏差不超过半截（见 buildLineTimeline）。
 *
 * **最后那一段是跨行段**：从末块走到下一行首块，覆盖「唱完最后一个字」到下一行开口，
 * 于是换行那一下不再是「停住 → 突然换一张图」，而是整段都在走。那一段的进度不是线性的，
 * 由调用方按 `progress` 沿折线插值（见 resolvePathWeights 与 client 的 weightedFocus）。
 */
export const resolveCameraPath = (options = {}) => {
    const stops = options.timeline?.cameraTimes;
    const time = Number.isFinite(options.time) ? options.time : 0;
    if (!Array.isArray(stops) || stops.length === 0) return { index: 0, progress: 0, path: 'inline' };
    const last = stops.length - 1;
    if (last === 0) return { index: 0, progress: 0, path: 'inline' };
    if (time <= stops[0]) return { index: 0, progress: 0, path: 'inline' };
    for (let index = 0; index < last; index += 1) {
        const end = stops[index + 1];
        if (time >= end) continue;
        const begin = stops[index];
        return {
            index,
            progress: (time - begin) / Math.max(1e-6, end - begin),
            // 多出来的那一段（index === 块数 − 1）就是跨行段：它通向下一行的第一根。
            path: index === stops.length - 2 ? 'gap' : 'inline',
        };
    }
    // 已经走完：停在下一行第一根上（或末块上），等这一行自己的行内段接手。
    return { index: Math.max(0, last - 1), progress: 1, path: 'gap' };
};

/**
 * 一段「没在唱」的时刻里，该给画布灌多少东西：返回 `{ rise, drift, glow }`，都是 0…1。
 *
 * 唱完最后一个字到下一行开口之间，柱子、字和末块的落点原本什么都不动——整屏于是停住，
 * 等下一个字才「啪」地跳一下。这一层就是给那一截用的：柱子再往上顶一点点、
 * 末块的落点亮一点点，两头（唱完那一刻 / 下一行开口那一刻）都归零，
 * 所以它接得上前后两段，也接得上拖动进度与暂停。
 *
 * `rest` 是这一截里**人不会在动**的那一段（`timeline.pillarRest` / `timeline.gapShift`）：
 * 它才是呼吸的正主。空档太长时两头都留出跳跃的窗口，中间才起伏（见 buildLineTimeline）。
 *
 * `lead` 是两头的淡入淡出宽度（占这一段的几成，短空隙里会被压扁，不会因此冲不到顶）；
 * 整段的形状是 `sin²`：起落都平，中间满，一眼看得出「这一段在呼吸」而不是「抖了一下」。
 */
export const resolveIdleMotion = (options = {}) => {
    const time = Number.isFinite(options.time) ? options.time : 0;
    const quiet = { rise: 0, drift: 0, glow: 0 };
    /*
     * 他站着不动的那一截（`rest`：末块落地 → 起跳跨行）：呼吸只在它中间更里面那一段起伏。
     * 人在空中、或者已经上路的那几截里动的是他自己，画面不该跟着一顶一顶。
     */
    const away = options.rest ?? null;
    let inRest = false;
    if (away
        && time > (Number.isFinite(away.begin) ? away.begin : Number.NEGATIVE_INFINITY)
        && time < (Number.isFinite(away.end) ? away.end : Number.POSITIVE_INFINITY)) inRest = true;
    // 给了 `rest` 却不在那一截里：人正在空中 / 已经在路上，画面交给他的动作。
    if (away && !inRest) return quiet;
    const begin = Number.isFinite(options.begin) ? options.begin : null;
    const end = Number.isFinite(options.end) ? options.end : null;
    if (begin === null || end === null || !(end > begin) || time <= begin || time >= end) return quiet;
    /*
     * 还有两个「他本来就在动」的边缘：这一截自己的起跳 / 落地（`edge`），
     * 以及 `rest` 的两头（末块落地那一刻、起跳那一刻）——两头都归零，接得上前后两段。
     */
    const span = end - begin;
    const edge = Math.max(0, Math.min(span / 3, Number.isFinite(options.edge) ? options.edge : 0));
    const liveBegin = Math.max(
        begin + edge,
        Number.isFinite(away?.begin) ? away.begin : Number.NEGATIVE_INFINITY,
    );
    const liveEnd = Math.min(
        end - edge,
        Number.isFinite(away?.end) ? away.end : Number.POSITIVE_INFINITY,
    );
    if (!(liveEnd > liveBegin)) return quiet;
    const lead = Math.min(0.42, Math.max(0.06, Number.isFinite(options.lead) ? options.lead : 0.3));
    const fade = Math.min(lead * (liveEnd - liveBegin), (liveEnd - liveBegin) / 2);
    const rise = Math.max(0, Math.min(1, (time - liveBegin) / Math.max(1e-6, fade)));
    const fall = Math.max(0, Math.min(1, (liveEnd - time) / Math.max(1e-6, fade)));
    const shape = Math.pow(Math.sin(Math.PI * Math.min(rise, fall) / 2), 2);
    return { rise: shape, drift: shape, glow: shape };
};

/** 第 index 根柱子此刻的起立进度：0 还没出现，1 已经立稳（起立时略冲过头再落定）。 */
export const resolvePillarRise = (options = {}) => {
    const { timeline, index, time } = options;
    const riseSeconds = Number.isFinite(options.riseSeconds) ? options.riseSeconds : 0.28;
    const pillar = timeline?.pillars?.[index];
    if (!pillar) return 0;
    const t = Number.isFinite(time) ? time : 0;
    if (t < pillar.riseTime) return 0;
    const progress = Math.min(1, (t - pillar.riseTime) / Math.max(0.05, riseSeconds));
    return progress < 1 ? Math.min(1.03, progress * (1 + 0.06 * Math.sin(progress * Math.PI))) : 1;
};

/** 这一块里已经亮了几个字（没给逐字时刻的块整块算亮）。 */
export const resolveLitChars = (options = {}) => {
    const { unit, time } = options;
    const chars = unit?.chars ?? [];
    let lit = 0;
    chars.forEach((char) => {
        if (Number.isFinite(char?.start) && time >= char.start) lit += 1;
    });
    return lit;
};

/** 整行唱完之后淡出的进度 0..1（旧一行是压暗，不是突然消失）。 */
export const resolveLineRetirement = (options = {}) => {
    const { timeline, time } = options;
    const fadeSeconds = Number.isFinite(options.fadeSeconds) ? options.fadeSeconds : 0.45;
    if (!timeline) return 0;
    const t = Number.isFinite(time) ? time : 0;
    if (t < timeline.end) return 0;
    return Math.min(1, (t - timeline.end) / Math.max(0.05, fadeSeconds));
};
