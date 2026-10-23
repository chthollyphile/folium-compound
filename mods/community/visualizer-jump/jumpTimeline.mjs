// mods/visualizer-jump/jumpTimeline.mjs
// 时间那一层：「小人什么时候跳」。纯计算，不碰 DOM。
//
// 一行歌词有自己的起止时间。第 k 块**落在**它自己开唱的那一刻——那一秒既是这句话的
// 第一个音，也是小人的落地、冲击环的起点与柱子开始下沉的那一刻；他在那根柱子上一直站到
// 下一次起跳（起跳是从下一个字的开唱往回推一个滞空），于是他脚下的永远是正在唱的那一块。
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
 * 两条腿（起点 → 拐点、拐点 → 终点）在屏幕上可能差着九十度，直接插值会把拐角切掉、
 * 看着像整屏被横甩；分段之后两头必然是纯一点（`phase = 0` 只剩起点、`1` 只剩终点）。
 *
 * `share` 是**拐点占整段路程的几成**（缺省一半）：按它分时间，两条腿的速度是同一个数
 * ——这样才是「绕过拐角」而不是「先在拐角前蹭一段、过去之后再窜出去」。
 * 以前固定一半对一半，而第一腿只有半个块那么长、第二腿要跨到下一行的行首，
 * 同样的时间跑差着好几倍的路，句末于是「镜头先在拐角前蹭一会儿、忽然往下一行蹿出去」。
 *
 * 每条腿内部**匀速**：整段之外镜头的每一段本来就是匀速的，再给每条腿各加一次缓动，
 * 只会让它在拐点那里把速度收到 0（旧版两段各走一次 smoothstep 就是这么糊的）——
 * 绕过拐角需要的是转向，不是刹车。
 */
export const resolvePathWeights = (phase, share = 0.5) => {
    const t = clamp01(phase);
    const corner = Math.max(0, Math.min(1, Number.isFinite(share) ? share : 0.5));
    if (t <= corner) {
        const local = corner > 0 ? t / corner : 0;
        return { first: 1 - local, mid: local, second: 0 };
    }
    const local = corner < 1 ? (t - corner) / (1 - corner) : 1;
    return { first: 0, mid: 1 - local, second: local };
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
    // 镜头的到站时刻要按「他在每一根上站多久」算（详见下面 hops 之后的那一处）。
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
    /*
     * 每一次起跳：窗口是「上一块落地 → 这一块开唱」，而**落地就落在这一块开唱的那一秒**。
     *
     * 以前是反过来的：他在这一块**自己**开唱的那一刻起跳、滞空结束就落了地——于是
     *   1. 落地落在两个词中间的任意一处，跟歌的拍子没有关系（冲击环、柱子那一沉
     *      都是不与任何一个字同时发生的，画面因而「不听歌」）；
     *   2. 他是踩着**上一个词**站在这一块上的：这一块的词一开口他就跳走了，
     *      嘴里唱的和脚下站的差着一整格。
     * 现在反过来钉：这一块开唱的那一秒，正好是他落在它顶上的那一秒——环、尘、柱子的
     * 下沉都与那句话的第一个音同时发生，他也就整段站在正在唱的那句话上。
     *
     * 起跳顺着落点往回推一个滞空（比例由 `flyShares` 给）：滞空是几秒就是几秒，
     * 与这句唱得快还是慢无关（见 MIN_FLY_SHARE / MAX_FLY_SHARE）。
     */
    const hops = [];
    for (let index = 0; index < Math.max(0, total - 1); index += 1) {
        const hopStart = landings[index];
        const hopEnd = landings[index + 1];
        const fly = (hopEnd - hopStart) * (flyShares[index] ?? MAX_FLY_SHARE);
        hops.push({
            index,
            from: index,
            to: index + 1,
            // 窗口的头：上一块的落地。这一跳之前他站在上一块上把它的词唱完。
            start: hopStart,
            // 起跳：往回一个滞空。出发之前他一直站在上一块上，跟着那块自己的词。
            liftTime: hopEnd - fly,
            // 落地：这一块自己的开唱那一刻。
            landTime: hopEnd,
            end: hopEnd,
        });
    }
    /*
     * 他从每一根柱子上迈步的时刻：出了这一跳，最后一根就是跨行那一跳的起步点
     * （由 `lastRelease` 给；缺省按这一行唱完算）。它同时也是「他站在这一根上多久」的止点。
     */
    const leaveTimes = landings.map((landing, index) => (
        index < hops.length ? hops[index].liftTime : lastRelease
    ));
    /*
     * 镜头自己的到站时刻：他在第 k 根上站到 `leaveTimes[k]`，镜头按**这段停留的中点**到站。
     *
     * 小人只在腾空那一截前进、站着的时候纹丝不动；镜头要是照他的曲线走，就成了
     * 「走一截、停一截」——节奏一快，画面就在「动—停—动」地抖。所以镜头走**匀速**：
     * 每一段的窗口覆盖「站着那一截 + 这一跳」，段与段首尾相接，行内于是全程在走。
     *
     * 到站取停留的中点：镜头比他晚半截到站（他落地时镜头还在走）、也比他早半截离站，
     * 两头各摊半截，镜头落在他身前 / 身后都不超过半截，不会一头偏到底。
     * 站着多久每一根都不一样（见 leaveTimes），所以这个中点也按根算。
     *
     * 第 0 根不必推：他从上一行跨过来就落在它上面，镜头顺着上一行的末段直接接手，
     * 画面一刻不停；顺推的话行的开口处会平白呆站半截。
     */
    const cameraTimes = landings.map((landing, index) => (
        index === 0 ? landing : landing + Math.max(0, leaveTimes[index] - landing) / 2
    ));
    /*
     * 镜头到站**末块**的那一刻：末段的窗口就按它起步（见返回的 `cameraTail`）。
     * 到站之后镜头立刻开始往下一行首块走，不留「已经到站、这一行却还没唱完」的空档。
     */
    const cameraStop = cameraTimes.length > 0 ? cameraTimes[cameraTimes.length - 1] : start;
    if (tailRelease) cameraTimes.push(tailEnd);
    // 时刻排得挤到一起时兜一下：段与段之间至少留一点宽度，`resolveCameraPath` 才不会除零。
    for (let index = 1; index < cameraTimes.length; index += 1) {
        if (cameraTimes[index] <= cameraTimes[index - 1]) cameraTimes[index] = cameraTimes[index - 1] + 1e-3;
    }
    /*
     * 末段（镜头从末块走到下一行首块）自己有一个窗口：`cameraStop` → `tailEnd`。
     *
     * 它**不能**借用小人那一开窗（`tailSpan`，从末块落点起算）：小人在末块上一直站到
     * 唱完那一刻才起跳，镜头的到站却在他那段停留的中点——比他早。共用窗口的下场是
     * 「镜头已经站到末块上、低头却发现这一行还没唱完」：那一截里调用方既不能用行内那几段
     * （首尾两端夹在同一块上，画面停住），又还不到接管的时候；等接管了，相位早就走了
     * 小半程——画面于是「停一会儿，忽然往下一行蹿一下」。
     *
     * 按镜头自己的到站时刻起步，这三段就首尾相接了：行内最后一段在这儿交班，末段从同一个
     * 点出发，终点仍是下一行开口那一刻。
     */
    // 没有下一行时（整首的最后一句）就没有末段可接：镜头停在末块上，别留下一个指向虚处的窗口。
    const cameraTail = tailRelease && Number.isFinite(options.nextStart) && tailEnd > cameraStop
        ? { begin: cameraStop, end: tailEnd }
        : null;
    /*
     * 每根柱子自己的两个时刻（柱子被踩下去 / 弹回来，见 jumpCourse.resolvePillarSpring）：
     *   - `pressTime`：小人**落**在它上面的那一刻 —— 就是这一块自己开唱的那一刻
     *     （第 0 根是这一行开口：他从上一行跨过来就落在它上面）；
     *   - `releaseTime`：他**跳走**的那一刻 —— 这一跳的起跳（`leaveTimes`），
     *     最后一根是跨行那一跳的起步点，由 `lastRelease` 给；缺省按这一行唱完算。
     *
     * 于是柱子被踩沉下去的那一秒正好是这句话的第一个音：听觉与画面落在同一处。
     */
    const pillars = landings.map((landing, index) => ({
        index,
        riseTime: index === 0 ? start : landing - minGap,
        pressTime: index === 0 ? start : (hops[index - 1]?.landTime ?? start),
        releaseTime: leaveTimes[index],
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
         * 末段**镜头**自己的窗口（`cameraStop → tailEnd`）：与小人那一开窗不同起点，
         * 见上面 `cameraTail` 那一处说明。调用方画末段一律按它取相位。
         */
        cameraTail,
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
        // 起跳是窗口里的第二个时刻：之前他站在上一块上，跟着那块自己的词一起唱。
        const lift = Number.isFinite(hop.liftTime) ? hop.liftTime : hop.start;
        if (t < lift) return { index: hop.from, from: hop.from, to: hop.from, progress: 1, airborne: false };
        if (t < hop.landTime) {
            return {
                index: hop.to,
                from: hop.from,
                to: hop.to,
                progress: (t - lift) / Math.max(1e-6, hop.landTime - lift),
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
