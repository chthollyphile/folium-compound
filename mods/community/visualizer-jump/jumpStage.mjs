// mods/visualizer-jump/jumpStage.mjs
// 跳一跳的舞台：一层「画布」（换行时整体平移）+ 里面三种节点——柱子、落地特效、小人。
//
// 柱子是三块 SVG 多边形：顶面（菱形）、正面（沿路的长条面）、侧面（端头那面）。
// 三个面的顶点都由 jumpProject 从同一套投影算出来，所以它们的棱天然对齐、
// 顶面比例也不会被「柱子高度」带歪（旧版是写死的单位方块，改高度会把顶面一起拉变形）。
// 为什么用 SVG 而不是 `div` 拼 `clip-path`：`div` 一改 `clip-path` 就会把斜边切掉，
// 屏幕上于是出现「柱子坏掉」（只剩半块、柱身歪、字压在棱上）。
//
// 每个 SVG 的 `viewBox` 就是它自己外接框的像素尺寸（1 单位 = 1 像素），所以画面不会被
// 二次缩放——面的形状是什么样，画出来就是什么样。
//
// 这一层只建节点、写样式，不做几何判断：面的顶点、位置与时刻都由上层算好传进来。

const SVG_NS = 'http://www.w3.org/2000/svg';

const createPillarNode = () => {
    const node = document.createElement('div');
    node.style.cssText = [
        'position:absolute', 'left:0', 'top:0', 'width:0', 'height:0',
        'pointer-events:none', 'will-change:transform',
    ].join(';');

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'position:absolute;overflow:visible;pointer-events:none;';

    const front = document.createElementNS(SVG_NS, 'polygon');
    const side = document.createElementNS(SVG_NS, 'polygon');
    const top = document.createElementNS(SVG_NS, 'polygon');
    [front, side, top].forEach((face) => face.setAttribute('stroke-linejoin', 'round'));
    // 侧面在后、正面压过它、顶面最后：三者只在棱上相接，顺序只影响描边压线。
    svg.append(side, front, top);

    const label = document.createElement('div');
    label.style.cssText = [
        'position:absolute', 'left:0', 'top:0', 'pointer-events:none',
        /*
         * 字盒就是一块字本身：不折行、行高 1、居中。
         * 不能再让 flex / padding 参与排版——贴面矩阵假设「盒子 = 字」，
         * 一旦盒子比字大或比字小，字就不在面心（`placeText` 量出来的中心对不上）。
         *
         * `text-align:center` 兜住「盒子比字宽」的那一档：字宽按字身系数估（拉丁字母 0.58 格、
         * 实际笔画只有半个字宽），盒子于是比这一行字宽出一截。靠左铺就会把字推到柱子的一头，
         * 居中之后字心才真的落在面心（CJK 那块本来就铺满，居中看不出差别）。
         */
        'white-space:pre', 'line-height:1', 'text-align:center', 'margin:0', 'padding:0', 'border:0',
        'overflow:visible', 'transform-origin:0 0', 'will-change:transform',
    ].join(';');

    node.append(svg, label);
    return { node, svg, front, side, top, label };
};

const clamp01 = (value) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const px = (value) => `${value.toFixed(2)}px`;

/**
 * 挤压时横向补多少：竖直压掉（或拉出）的那一份乘这个系数再补到横向上。
 *
 * 不是「体积守恒」的 1:1（`2 − squash`）：原版的棋子被压矮时只是略胖一点，
 * 1:1 补回来会把它压成一张饼。0.5 是「看得出来、不过头」。
 */
const SQUASH_WIDTH_GAIN = 0.5;

export const createJumpStage = (container) => {
    const root = document.createElement('div');
    /*
     * `contain`：这一层是自成一套的子树（里面的节点全是 absolute，撑不动外面），
     * 加了它，每次写了一堆样式之后失效就只在这层内部结算，不往宿主的布局树上冒泡。
     * 只写 layout / paint / style，**不写 `size`**——宽高由 `inset:0` 给出，
     * 带上 `size` 的话 `clientWidth` 会永远量到 0。
     */
    root.style.cssText = 'position:absolute;inset:0;overflow:hidden;pointer-events:none;contain:layout paint style;';

    /*
     * `canvas` 就是「镜头里那一块」。换行时只动它一个 `translateY`，
     * 屏幕上的内容是**整体滑下去**的，而不是两行各自淡入淡出。
     */
    const canvas = document.createElement('div');
    canvas.style.cssText = [
        'position:absolute', 'left:0', 'top:0', 'width:100%', 'height:100%',
        'pointer-events:none', 'will-change:transform',
    ].join(';');
    const trail = document.createElement('div');
    trail.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;';
    const scene = document.createElement('div');
    scene.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;';
    /*
     * 落地特效是 `scene` 里的一层：夹在柱子与小人**之间**——
     * 环铺在柱顶上（要盖住柱子，不然被柱顶的填充吃掉），又不该压在小人身上。
     * 它跟着 `arrange` 每次重排时挂回去，所以永远在柱子之后、小人之前。
     */
    const impact = document.createElement('div');
    impact.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;';
    // 轨迹层夹在画布最底下：拱线不该压在柱子正面。
    canvas.append(trail, scene);
    root.append(canvas);
    container.append(root);

    const pillars = [];
    /** 现在画不画柱顶那块字（宿主的 `getDisplay().showText`）；见 `setTextVisible`。 */
    let textVisible = true;
    let runner = null;
    // 上一次真正重排过的顺序（见 arrange）：没变就一个节点都不动。
    let arrangeKey = null;
    // 轨迹层那几十个点 / 椭圆也像柱子一样池化复用（见 drawTrail）。
    const trailDots = [];
    const trailRings = [];

    /** 取（必要时新建）第 `index` 根柱子的壳。池子只增不减，多出来的藏起来。 */
    const acquirePillar = (index) => {
        const slot = Math.max(0, Math.round(index));
        while (pillars.length <= slot) {
            const entry = createPillarNode();
            entry.slot = pillars.length;
            // 池子里新取的柱子也要跟上「现在画不画字」：关掉字之后才登场的柱子不能带着字出场。
            entry.label.style.visibility = textVisible ? '' : 'hidden';
            scene.append(entry.node);
            pillars.push(entry);
        }
        return pillars[slot];
    };

    /**
     * 只留下这批柱子，按给定顺序重排：后 append 的盖住先 append 的。
     * 顺序即绘制顺序（画家算法），不用 z-index——它会被 `contain` / `isolate` 切断。
     */
    const arrange = (entries) => {
        const ordered = Array.isArray(entries) ? entries.filter(Boolean) : [];
        /*
         * 顺序（也就是队列里的柱子是哪几个）在绝大多数帧里是不变的：
         * 只有换行的那一两帧才会真的变。变了再动 DOM——`append` 是子节点重排，
         * 顺带把兄弟链上的样式一起作废，每帧做一遍太贵。
         */
        const key = ordered.map((entry) => entry.slot).join(' ');
        if (key === arrangeKey) return ordered;
        arrangeKey = key;
        const visible = new Set(ordered);
        pillars.forEach((entry) => {
            const hidden = !visible.has(entry);
            if (entry.hidden === hidden) return;
            entry.hidden = hidden;
            entry.node.style.display = hidden ? 'none' : '';
        });
        ordered.forEach((entry) => scene.append(entry.node));
        // 落地特效压在柱子上面、小人下面：每次重排之后把它挂回这儿。
        scene.append(impact);
        // 小人永远压在最上面：每次重排之后把它挂回最后（影子在它下面一档）。
        if (runner) scene.append(runner.shadow, runner.node);
        return ordered;
    };

    /**
     * 镜头：整块画布在画面里的平移量（正数 = 内容往右/往下走）。
     * 行内的每一次跳、行与行之间的每一次换手，都只落在这个平移上——
     * 柱子自己的位置从来不动，于是「小人每跳一次，镜头走一格」。
     */
    const moveCanvas = (offsetX, offsetY) => {
        canvas.style.transform = `translate3d(${px(offsetX)}, ${px(offsetY)}, 0)`;
    };

    /**
     * 写一根柱子。
     *
     * `base` 是盒底中心在屏幕上的位置；`box` 是 jumpProject.boxFaces 算好的三个面
     * （坐标以盒底中心为原点，像素）。`label.transform` 是贴面的矩阵（或「上方」那一档的
     * 平移），由 jumpProject.placeText 算好——这一层不再自己摆字。
     *
     * `faceAlpha` 是柱面与棱线自己的浓淡（「线框强度」× 行的主次），`opacity` 只管这一行
     * 登场时整块的淡入——两者分开是因为字不能跟着柱面一起被压暗（见 `label.opacity`）。
     */
    const paintPillar = (entry, options) => {
        const { base, box, colors, opacity, faceAlpha, label } = options;
        const bbox = box.bbox;
        const state = entry.state ?? (entry.state = {});

        /*
         * 几何（三个面的顶点、外接框）是上层缓存出来的**同一个对象**：身份没变就什么都不用写。
         * 一屏里柱子纹丝不动的那些帧（也就是大多数帧）于是连一次 `setAttribute` 都没有。
         */
        if (state.box !== box) {
            state.box = box;

            // viewBox 与像素尺寸 1:1：面算出来是什么形状，画出来就是什么形状。
            entry.svg.setAttribute(
                'viewBox',
                `${bbox.x.toFixed(2)} ${bbox.y.toFixed(2)} ${bbox.width.toFixed(2)} ${bbox.height.toFixed(2)}`,
            );
            entry.svg.style.left = px(bbox.x);
            entry.svg.style.top = px(bbox.y);
            entry.svg.style.width = px(bbox.width);
            entry.svg.style.height = px(bbox.height);

            const writePoints = (node, points) => {
                node.setAttribute('points', points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' '));
            };
            writePoints(entry.side, box.faces.side);
            writePoints(entry.front, box.faces.front);
            writePoints(entry.top, box.faces.top);
        }

        /*
         * 「长相」与几何是两回事：同一副几何在换角色（正在写 / 上下两行）或换主题时
         * 颜色全变，反过来几何换了长相也可能一模一样。所以长相自己拼一个短键比一次，
         * 省下每帧二十来次样式写入与一次 Text 节点的重建——`textContent` 哪怕写得一样，
         * 也会换掉整个 Text 节点，把这一块字重新排一遍。
         */
        const look = [
            colors.top, colors.front, colors.side, colors.edge, faceAlpha,
            label?.text ?? '', label?.width, label?.height, label?.fontSize, label?.transform,
            label?.color, label?.fontFamily, label?.fontWeight, label?.opacity,
        ].join('|');
        if (state.look !== look) {
            state.look = look;
            /*
             * 浓淡走 `fill-opacity` / `stroke-opacity`，不再整根柱子共用一个 `opacity`：
             * 那样字会被柱面那份浓度一起乘掉（`label` 是 `node` 的子节点）。
             * 五种面各自的 base alpha（棱线 0.42、正面 0.17、侧面 0.08…）留在颜色里，
             * 这里只叠「线框强度 × 行的主次」这一份。
             */
            const faceMix = String(clamp01(faceAlpha ?? 1));
            const paintFace = (node, fill) => {
                node.setAttribute('fill', fill);
                node.setAttribute('fill-opacity', faceMix);
                node.setAttribute('stroke', colors.edge);
                node.setAttribute('stroke-opacity', faceMix);
                node.setAttribute('stroke-width', '1.2');
            };
            paintFace(entry.side, colors.side);
            paintFace(entry.front, colors.front);
            paintFace(entry.top, colors.top);

            entry.label.textContent = label?.text ?? '';
            // 本地盒子：`width × height` 像素，再被 `transform` 错切到面上。
            entry.label.style.width = px(label.width);
            entry.label.style.height = px(label.height);
            entry.label.style.fontSize = px(label.fontSize);
            entry.label.style.color = label.color;
            entry.label.style.fontFamily = label.fontFamily;
            entry.label.style.fontWeight = String(label.fontWeight);
            entry.label.style.transform = label.transform;
            // 字的亮度自己一份：只跟行的主次走，不吃柱面的浓淡（它再乘上节点的登场淡入）。
            entry.label.style.opacity = String(clamp01(label?.opacity ?? 1));
        }

        // 下面两样是逐帧真的会变的：柱子在沉 / 在升，以及这一行登场的淡入。
        const alpha = clamp01(opacity).toFixed(3);
        if (state.alpha !== alpha) {
            state.alpha = alpha;
            entry.node.style.opacity = alpha;
        }
        entry.node.style.transform = `translate3d(${px(base.x)}, ${px(base.y)}, 0)`;
    };

    /**
     * 小人：照跳一跳原版那一枚「棋子」——一颗头 + 一个胶囊身子，**没有手脚**。
     * 原版里他就是这么一个棋子：蓄力时压矮、腾空时拉长，靠挤压本身表达动作。
     *
     * 尺寸一律写在 `em` 里（`fontSize` 就是他的像素高），于是整只人跟着「小人尺寸」旋钮
     * 一起放大缩小、比例不变；盒子是 `0.62em × 1em`，`transform-origin: 50% 100%`
     * 就是脚下那一点——挤压只从脚往上压，人不会陷进柱子里。
     *
     * 影子是**另一个节点**：它留在柱顶，不跟着人飞，所以不能挂在人身上被一起挤压；
     * 它画在小人之前，压不到人身上。
     */
    const createRunner = () => {
        const shadow = document.createElement('div');
        shadow.style.cssText = [
            'position:absolute', 'left:0', 'top:0', 'display:none',
            'border-radius:50%', 'pointer-events:none', 'will-change:transform',
            // 软边：柱顶是一块斜面，硬边椭圆看着像贴上去的一块斑。
            'background:radial-gradient(50% 50% at 50% 50%, rgba(6,10,22,0.62), rgba(6,10,22,0) 70%)',
        ].join(';');

        const node = document.createElement('div');
        node.style.cssText = [
            'position:absolute', 'left:0', 'top:0', 'width:0.62em', 'height:1em',
            'transform-origin:50% 100%', 'pointer-events:none', 'display:none', 'will-change:transform',
        ].join(';');

        const part = (extra) => {
            const el = document.createElement('div');
            el.style.cssText = `position:absolute;${extra}`;
            return el;
        };
        /*
         * 高光固定打在左上：头与身子才有体积，不至于是一块纯色剪影。
         * 身子底下再压暗一档（`linear-gradient` 那层）：棋子才像立在柱顶上，而不是浮着。
         */
        const gloss = [
            'background-color:currentColor',
            'background-image:radial-gradient(circle at 32% 24%, rgba(255,255,255,0.5), rgba(255,255,255,0) 62%)',
        ].join(';');
        const skin = [
            'background-color:currentColor',
            'background-image:'
                + 'radial-gradient(circle at 32% 22%, rgba(255,255,255,0.5), rgba(255,255,255,0) 62%),'
                + 'linear-gradient(rgba(6,10,22,0) 52%, rgba(6,10,22,0.2))',
        ].join(';');
        const head = part(`left:0.14em;top:0;width:0.34em;height:0.34em;border-radius:50%;${gloss}`);
        /*
         * 身子是一枚胶囊：上头半圆（圆角 = 半个宽）、底下略收一点圆角，坐在柱顶上。
         * 头压在它上面一档，两者交叠 0.02em——不留脖子缝隙。
         */
        const body = part([
            'left:0.05em', 'top:0.32em', 'width:0.52em', 'height:0.68em',
            'border-radius:0.26em 0.26em 0.14em 0.14em', skin,
        ].join(';'));
        node.append(body, head);
        scene.append(shadow, node);
        return { node, shadow };
    };

    /**
     * 画小人。
     *
     * `feet` 是此刻脚下那一点的屏幕坐标（含腾空那一下），`ground` 是同一时刻落在线路上的
     * 那一点（不含腾空）——人踩 `feet`、影子留在 `ground`。`squash` 是竖直方向的缩放
     * （1 原样、<1 压矮、>1 拉长，见 jumpCourse），横向按它补回来；
     * `groundSquash` 是柱顶在屏幕上的扁度（影子的椭圆照它压）。
     */
    const paintRunner = (options) => {
        if (!runner) runner = createRunner();
        const state = runner.state ?? (runner.state = {});
        if (!options) {
            if (state.shown !== false) {
                state.shown = false;
                runner.node.style.display = 'none';
                runner.shadow.style.display = 'none';
            }
            return;
        }
        const { feet, ground, height, color, squash, groundSquash } = options;
        const size = Math.max(6, height);
        // 离地多高（0…1，站着是 0）：只用来缩影子。
        const air = clamp01((ground.y - feet.y) / Math.max(1, size * 0.55));

        if (state.shown !== true) {
            state.shown = true;
            runner.node.style.display = '';
            runner.shadow.style.display = '';
        }
        /*
         * 个子、配色、影子的大小都只跟旋钮 / 主题 / 屏幕有关：
         * 它们不随时间变，所以只在那一串签名变了的时候才写（站住不动的那些帧于是零写入）。
         */
        const look = `${size.toFixed(2)}|${groundSquash}|${color}`;
        if (state.look !== look) {
            state.look = look;
            runner.node.style.fontSize = `${size.toFixed(2)}px`;
            runner.node.style.color = color;
            // 影子留在柱顶：比身子宽一圈，站着时它才不会整个人被盖住。收缩走 `scale`（而不改宽高）。
            const rx = size * 0.42;
            const ry = rx * Math.max(0.16, Number(groundSquash) || 0.5) * 0.8;
            runner.shadow.style.width = px(rx * 2);
            runner.shadow.style.height = px(ry * 2);
        }
        // 压矮就略胖、拉长就略瘦：横向只补 `SQUASH_WIDTH_GAIN` 那一份，不按体积 1:1 补。
        const wide = 1 + (1 - squash) * SQUASH_WIDTH_GAIN;
        const bodyTransform = [
            `translate3d(${px(feet.x)}, ${px(feet.y)}, 0)`,
            'translate(-50%, -100%)',
            `scale(${wide.toFixed(3)}, ${squash.toFixed(3)})`,
        ].join(' ');
        if (state.bodyTransform !== bodyTransform) {
            state.bodyTransform = bodyTransform;
            runner.node.style.transform = bodyTransform;
        }
        // 影子不跟着人飞：它留在落点上，飞得越高越小越淡。
        const shadowOpacity = (0.38 * (1 - 0.5 * air)).toFixed(3);
        if (state.shadowOpacity !== shadowOpacity) {
            state.shadowOpacity = shadowOpacity;
            runner.shadow.style.opacity = shadowOpacity;
        }
        const shrink = (1 - 0.35 * air).toFixed(3);
        const shadowTransform = [
            `translate3d(${px(ground.x)}, ${px(ground.y)}, 0)`,
            'translate(-50%, -50%)',
            `scale(${shrink}, ${shrink})`,
        ].join(' ');
        if (state.shadowTransform !== shadowTransform) {
            state.shadowTransform = shadowTransform;
            runner.shadow.style.transform = shadowTransform;
        }
        // 影子先、人后（人压在自己的影子上）：这一对的前后顺序只在 arrange 里校正，
        // 每帧重新 append 等于每一帧都重排一次子节点。
    };

    /**
     * 跳跃轨迹：已经跳过的拱线 + 落点的小坑。
     *
     * 拱线用一串小圆点画，不用「旋转的细长条」：细长条一旦角度算错就会连成一片，
     * 看起来像地面被划花了。圆点只吃位置，画不歪。
     *
     * 这一层的节点是**池化复用**的（见 takeTrailSlot）：内容在同一行里几乎不动，
     * 每帧推倒重来纯属浪费。
     */

    /*
     * 轨迹层的节点只建一次，以后按序号取用，多余的藏起来。
     *
     * 以前每帧 `createElement` + `replaceChildren`：一条已跳过的拱线是八个点、一个落点椭圆，
     * 一行最多四跳 = 四十来个节点每帧建了又扔，每个还要重新解析一遍 `cssText`。
     * 而这些点在**同一行里是静态的**——坐标来自柱子的绝对位置与固定的跳跃高度，
     * 镜头那一层位移由父节点的 transform 承担——多数帧这层的内容压根没变。
     */
    const takeTrailSlot = (pool, index, kind) => {
        let slot = pool[index];
        if (!slot) {
            const node = document.createElement('div');
            node.style.cssText = kind === 'ring'
                ? 'position:absolute;left:0;top:0;display:none;box-sizing:border-box;border-radius:50%;border-style:solid;'
                : 'position:absolute;left:0;top:0;display:none;border-radius:50%;';
            trail.append(node);
            slot = { node, shown: false, styles: Object.create(null) };
            pool[index] = slot;
        }
        return slot;
    };

    /** 写一样式前先比一次：值没变就不要去碰 CSSOM（这一层可能有几十个节点在复用）。 */
    const writeTrailStyle = (slot, prop, value) => {
        if (slot.styles[prop] === value) return;
        slot.styles[prop] = value;
        slot.node.style[prop] = value;
    };

    const showTrailSlot = (slot) => {
        if (slot.shown) return;
        slot.shown = true;
        slot.node.style.display = '';
    };

    const hideTrailSlot = (slot) => {
        if (!slot.shown) return;
        slot.shown = false;
        slot.node.style.display = 'none';
    };

    const drawTrail = (segments) => {
        let dots = 0;
        let rings = 0;
        (segments ?? []).forEach((segment) => {
            const color = segment.color ?? '#8fc7ff';
            if (segment.kind === 'ellipse') {
                const slot = takeTrailSlot(trailRings, rings, 'ring');
                rings += 1;
                showTrailSlot(slot);
                writeTrailStyle(slot, 'width', px(segment.rx * 2));
                writeTrailStyle(slot, 'height', px(segment.ry * 2));
                writeTrailStyle(slot, 'borderWidth', '1px');
                writeTrailStyle(slot, 'borderColor', color);
                writeTrailStyle(slot, 'opacity', String(clamp01(segment.opacity)));
                writeTrailStyle(
                    slot,
                    'transform',
                    `translate3d(${px(segment.x - segment.rx)}, ${px(segment.y - segment.ry)}, 0)`,
                );
                return;
            }
            const points = segment.points ?? [];
            points.forEach((point, index) => {
                if (index === 0) return;
                const dotSize = 2.4;
                const slot = takeTrailSlot(trailDots, dots, 'dot');
                dots += 1;
                showTrailSlot(slot);
                writeTrailStyle(slot, 'width', `${dotSize}px`);
                writeTrailStyle(slot, 'height', `${dotSize}px`);
                writeTrailStyle(slot, 'background', color);
                // 越靠近落点越实，远处的拱看起来是慢慢淡出去的。
                writeTrailStyle(
                    slot,
                    'opacity',
                    String(clamp01(segment.opacity * (0.3 + 0.7 * (index / Math.max(1, points.length - 1))))),
                );
                writeTrailStyle(
                    slot,
                    'transform',
                    `translate3d(${px(point.x - dotSize / 2)}, ${px(point.y - dotSize / 2)}, 0)`,
                );
            });
        });
        // 这一帧用不到的存货只是藏起来：留着下一帧继续用，不删也不重建。
        for (let index = dots; index < trailDots.length; index += 1) hideTrailSlot(trailDots[index]);
        for (let index = rings; index < trailRings.length; index += 1) hideTrailSlot(trailRings[index]);
    };

    /**
     * 落地那一瞬：每个落点上一圈铺开的环 + 几粒飞散的尘。
     *
     * 环与尘都画成圆 / 椭圆：柱顶是一块斜面，纵向照 `squash` 压扁才像摊在顶面上。
     * 这一层每帧整批换掉（`replaceChildren`）——特效只在落地后那零点几秒里有内容，
     * 平时是空的，留着节点不动反而会在拖动进度时留下上一帧的环。
     */
    const drawImpact = (stamps) => {
        const nodes = [];
        (stamps ?? []).forEach((stamp) => {
            const color = stamp.color ?? '#8fc7ff';
            const alpha = clamp01(stamp.opacity);
            if (alpha <= 0.004) return;
            const rx = Math.max(1, Number(stamp.radius) || 1);
            const ry = Math.max(1, rx * (Number(stamp.squash) || 0.5));
            const ring = document.createElement('div');
            ring.style.cssText = [
                'position:absolute', 'left:0', 'top:0', 'box-sizing:border-box',
                `width:${px(rx * 2)}`, `height:${px(ry * 2)}`,
                `border:1.6px solid ${color}`, 'border-radius:50%',
                `opacity:${(alpha * 0.85).toFixed(3)}`,
                `transform:translate3d(${px(stamp.x - rx)}, ${px(stamp.y - ry)}, 0)`,
            ].join(';');
            nodes.push(ring);
            (stamp.dust ?? []).forEach((dot) => {
                const size = Math.max(1.4, Number(stamp.dotSize) || 2.2);
                const dotAlpha = clamp01(alpha * clamp01(dot.opacity));
                if (dotAlpha <= 0.004) return;
                const grain = document.createElement('div');
                grain.style.cssText = [
                    'position:absolute', 'left:0', 'top:0', 'border-radius:50%',
                    `width:${px(size)}`, `height:${px(size)}`, `background:${color}`,
                    `opacity:${dotAlpha.toFixed(3)}`,
                    `transform:translate3d(${px(dot.x - size / 2)}, ${px(dot.y - size / 2)}, 0)`,
                ].join(';');
                nodes.push(grain);
            });
        });
        /*
         * 这一层绝大多数帧是空的（只在落地后那零点几秒里有内容）：
         * 空对空就什么都不做——`replaceChildren` 每帧都要抛一次子节点变化的通知。
         */
        if (nodes.length === 0 && impact.childElementCount === 0) return;
        impact.replaceChildren(...nodes);
    };

    /*
     * 宿主说「现在不该画歌词」（`getDisplay().showText` 为 false，比如设置窗口盖住播放页）
     * 时只藏字：柱子、小人、轨迹照旧画，和内置模式一致。
     *
     * 藏的是字盒的 `visibility`，不是把字换成空串——柱子的块长由这块字推出来（jumpShape /
     * jumpProject），换了字整条路的排版就跟着变，来回切一次画面要跳一次。
     * 它只跟 display 变，不跟时间变，所以值没动就一个节点都不写。
     */
    const setTextVisible = (visible) => {
        const next = visible !== false;
        if (next === textVisible) return;
        textVisible = next;
        pillars.forEach((entry) => {
            entry.label.style.visibility = next ? '' : 'hidden';
        });
    };

    return {
        root,
        acquirePillar,
        arrange,
        moveCanvas,
        paintPillar,
        paintRunner,
        drawTrail,
        drawImpact,
        setTextVisible,
        dispose: () => {
            root.remove();
            pillars.length = 0;
            trailDots.length = 0;
            trailRings.length = 0;
            arrangeKey = null;
            runner = null;
        },
    };
};
