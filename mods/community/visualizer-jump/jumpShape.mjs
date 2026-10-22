// mods/visualizer-jump/jumpShape.mjs
// 一块柱子有多大、它的字排多长。纯计算，不碰 DOM。
//
// 规矩只有一条：**字顺着自己贴在哪个面排，那个方向就跟着字走，别的方向一概不动**。
//   - 顶面 / 正面：一排字沿路铺，块长 a 随字宽，横向 b 与柱高守旋钮 / 常数；
//   - 侧面：一排字横着写在端头那面墙上，墙宽随字宽，块长 a 只留柱身那点厚度。
//
// 上一版把这条规矩读成了「块长跟着字长」，于是侧面那档的「墙宽」与「块长」被绑在一起：
// 字长的块又长又厚，字短的块又短又薄，屏幕上是一排越念越大（或越小）的方块——
// 字盒的预算跟着变，字号也跟着变。这里把**墙宽**（放字的那个方向）与**柱身**分开：
// 侧面那档墙宽随字宽，块长只留柱身厚度，柱子于是每根一样长，只有端头那面墙在横向伸缩。

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/** 一块最短 / 最长几个格（字宽算出来之后再夹一下，免得一个标点撑出一条长廊）。 */
export const MAX_UNIT_CELLS = 4.4;
export const MIN_UNIT_CELLS = 0.8;

/** 柱身（与柱高垂直的那两条边）的边长（格）：顶面 / 正面那一档的块长与块厚都由它起步。 */
export const FACE_SPAN_CELLS = 1.35;

/**
 * 块长的下限与上限（格）：太短的词别成一根棍，太长的词别把一条路撑出画面。
 *
 * 上限要留够「字盒 = 字宽 ÷ `FACE_FILL_ALONG`」那一档：`FACE_FILL_ALONG` 一调小（字更大），
 * 块就跟着变长，上限卡住的话字盒会被夹小——长词的字于是比短词的字小一档。
 */
export const MIN_BLOCK_LEN_CELLS = 0.6;
export const MAX_BLOCK_LEN_CELLS = 12;

/** 端头墙宽（侧面那档放字的方向）的下限与上限（格）：字少的柱子还有一点厚度，字多也别宽成一堵墙。 */
export const MIN_WALL_CELLS = 0.8;
export const MAX_WALL_CELLS = 6;

/**
 * 柱顶面占一格宽（`cell` 像素）的几成：这一面在屏幕上得装得下一块字。
 *
 * 顶面横向（世界里的对角线）在屏幕上正好是一格宽，沿路一条边只有 1/√2 格宽——
 * 于是「沿路 78%、横向 78%」装出来的字盒，横向是沿路的 1.4 倍，字盒比面还宽。
 * 同一个数（`TEXT_FILL`）装进长短两条边必定溢出其中一条，这是上一版「字号一大就出框」的根因。
 * 现在面按「字盒的横竖各占几成」来定大小：横向 76%、沿路 40%，字盒铺匀了，面就是字盒的 1.1 倍。
 */
export const TEXT_FILL = 0.78;

/**
 * 顶面 / 正面上，字盒沿路那一条占面长的几成、横向那一条占面宽的几成。
 *
 * 这两个数就是「字号有多大」：字盒高 = `TEXT_FILL / FACE_FILL_ALONG`（沿路那一边的预算）
 * 与 `TEXT_FILL × 柱顶横向` 取小的那个，而柱顶横向 = 柱高 ÷ `FACE_FILL_ACROSS`。
 * 于是默认字号由 `FACE_FILL_ALONG` 与「柱子高度」旋钮一起定：字要更大就调柱高，
 * 面跟着一起长（字盒与面同比例，永远不会顶出框）。
 */
export const FACE_FILL_ALONG = 0.4;
export const FACE_FILL_ACROSS = 0.76;

/**
 * 侧面那一档柱高相对旋钮值的倍数（下限兜住「拧到最小也得装得下一格字」）与绝对上限：
 * 这一档的柱子高一点更好读，但也不该高成一根杆。
 */
export const SIDE_PILLAR_FLOOR_CELLS = 0.35;
export const SIDE_PILLAR_MAX_SCALE = 1.30;

/** 侧面那一档柱高相对旋钮值的倍数不超过它：柱身太高的柱子不像跳一跳的方料。 */
export const SIDE_PILLAR_CAP_CELLS = 2.6;

/**
 * 一块字排出来有多长（格）：Σ 每个字的字身系数，只夹在最短 / 最长两个端点上。
 *
 * 不再按 `TEXT_FILL` 把留白除回去：字盒的长宽比按**字本身**给（见 resolveTextRatio），
 * 面的长宽由它反推（`resolveFaceShape`），字号又由面反推（`jumpProject.placeText`）——
 * 留白按比例给，字盒与面于是同比例缩放，永远不会在一条边上顶出去。
 */
export const resolveReachCells = (span) => clamp(
    Math.max(0, Number(span) || 0),
    MIN_UNIT_CELLS,
    MAX_UNIT_CELLS,
);

/**
 * 这一行的柱高（格）：旋钮给的那个数，侧面那一档往上放宽一点。
 *
 * 侧面的柱子就是**端头墙的高**：墙矮，字只能小。所以在这一档把旋钮值放大一档
 * （`SIDE_PILLAR_MAX_SCALE`），矮柱子也能写字。放宽只跟旋钮走，与这一行有多长、
 * 屏幕上哪一块正在唱都无关——一屏里的字号仍是同一个。
 */
export const resolvePillarHeight = (face, heightCells = 1) => {
    const height = Math.max(0.2, Number(heightCells) || 0.2);
    if (face !== 'side') return height;
    return Math.min(
        SIDE_PILLAR_CAP_CELLS,
        Math.max(SIDE_PILLAR_FLOOR_CELLS, height * SIDE_PILLAR_MAX_SCALE),
    );
};

/**
 * 字盒的长宽比（宽 ÷ 高）：一块字的字宽 ÷ 一个字的字高。
 *
 * 长宽比原来写成「字宽 ÷ 字号倍数」，倍数不是 1 的时候两边就被同时缩放——
 * 那正是「字多的时候字体会缩小、字还是会超出柱子」：字盒变扁，宽那头把字推出墙外。
 * 字盒只该由字本身的长宽比给，字号由「面有多大」给（见 FACE_FILL_ALONG）。
 *
 * 拉丁字母比汉字矮一些（0.72 个字高），所以「how」这类块的字会比汉字小一档，
 * 而英文一行几乎全是拉丁字母，一屏里的字号仍然是同一个。
 */
export const resolveTextRatio = (span, glyph = 1) => {
    const width = Math.max(MIN_UNIT_CELLS, Number(span) || MIN_UNIT_CELLS);
    const height = clamp(Number(glyph) || 1, 0.4, 1.4);
    return width / height;
};

/**
 * 这块字自己的长宽比（宽 ÷ 高）——贴面排版的唯一依据。
 *
 * `placeText` 用它决定字盒的形状：面再长、窗再宽，字盒也只有这一种比例，
 * 于是「字心对准面心」是一个可以算出来的点，不用猜每一档面自己的方向。
 */
export const resolveTextAspect = (span, glyph = 1) => resolveTextRatio(span, glyph);

/**
 * 顶面 / 正面那一档：一块柱子的形状。
 *
 * 按字盒的长宽比反推面的长宽，于是面永远装得下字盒：块再长，面也跟着长，
 * 字盒始终铺满它的同一个成数、落在同一个面心上。
 *
 * - `len`：沿路那条边（块长），按字宽 × `FACE_FILL_ALONG` 反推；
 * - `faceDepth`：横向那条边（柱顶的 b），按柱高 × `FACE_FILL_ACROSS` 反推；
 * - `depth`：柱身厚度，只留柱顶那点厚度，块再长也不把柱身垫胖。
 */
export const resolveFaceShape = (span, glyph = 1, heightCells = 1) => {
    const height = Math.max(0.2, Number(heightCells) || 0.2);
    const aspect = resolveTextAspect(span, glyph);
    const len = clamp(
        Math.max(MIN_UNIT_CELLS, aspect) / FACE_FILL_ALONG,
        MIN_BLOCK_LEN_CELLS,
        MAX_BLOCK_LEN_CELLS,
    );
    const faceDepth = clamp(
        height / FACE_FILL_ACROSS,
        Math.min(FACE_SPAN_CELLS, MIN_WALL_CELLS),
        MAX_WALL_CELLS,
    );
    return {
        len,
        // 柱身与柱顶同宽：三条棱在屏幕上对齐，不会多出悬空的斜边。
        depth: faceDepth,
        faceDepth,
        height,
        reading: 'along',
    };
};

/**
 * 侧面那一档：字横着写在端头那面墙（宽 × 高）上。
 *
 * 墙宽跟着字宽；柱高整屏一个数。块长（也就是这面墙的宽）按顶面那一档同一把尺子给：
 * `字宽 ÷ FACE_FILL_ALONG` —— 字盒是它固定的几成，字号于是与顶面 / 正面一致。
 * 上一版只留一截固定厚度（`STEM_MIN_CELLS`），字被夹在一条窄墙上，比另外几档小一半。
 */
export const resolveSideShape = (span, glyph = 1, heightCells = 1) => {
    const aspect = resolveTextAspect(span, glyph);
    const height = Math.max(0.2, Number(heightCells) || 0.2);
    const wall = clamp(Math.max(MIN_WALL_CELLS, aspect), MIN_WALL_CELLS, MAX_WALL_CELLS);
    const stem = clamp(wall / FACE_FILL_ALONG, MIN_BLOCK_LEN_CELLS, MAX_BLOCK_LEN_CELLS);
    const len = stem;
    return {
        len,
        depth: len,
        // 端头那面墙是盒子里的中间一段：墙窄时顶面比柱身宽，宽出来的截只有柱顶那一条。
        faceDepth: wall,
        height,
        reading: 'across',
    };
};

/**
 * 「上方」那一档：字浮在柱顶之上，不贴面。
 *
 * 同样按字盒的长宽比反推柱顶：字盒要铺满柱顶的这个成数，于是「柱子跟着字长」，
 * 字盒永远落在柱顶的投影里，字心落在柱顶中心。
 */
export const resolveAboveShape = (span, glyph = 1, heightCells = 1) => {
    const height = Math.max(0.2, Number(heightCells) || 0.2);
    const aspect = resolveTextAspect(span, glyph);
    const len = clamp(
        Math.max(MIN_UNIT_CELLS, aspect) / FACE_FILL_ALONG,
        MIN_BLOCK_LEN_CELLS,
        MAX_BLOCK_LEN_CELLS,
    );
    const faceDepth = clamp(height / FACE_FILL_ACROSS, MIN_WALL_CELLS, MAX_WALL_CELLS);
    return {
        len,
        depth: faceDepth,
        faceDepth,
        height,
        reading: 'along',
    };
};

/**
 * 一块柱子长什么样：`len` 沿路的块长、`depth` 柱身厚度、`faceDepth` 柱顶横向的边长、
 * `height` 柱高。每档面只让一个方向跟着字走（见上面三段）。
 */
export const resolveBlockShape = (face, span, heightCells = 1, glyph = 1) => {
    if (face === 'side') {
        return resolveSideShape(span, glyph, resolvePillarHeight(face, heightCells));
    }
    if (face === 'above') return resolveAboveShape(span, glyph, heightCells);
    return resolveFaceShape(span, glyph, heightCells);
};


