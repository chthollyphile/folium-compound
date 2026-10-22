// mods/visualizer-jump/jumpSettings.mjs
// 跳一跳的旋钮。宿主按这份 schema 渲染表单、校验、持久化，并随视觉配置一起导入导出；
// 模组只走 `ctx.getSettings()` 读值（默认值宿主已并入），所以这里不需要自己存取。
//
// key / 范围 / 默认值只有这一份，client.mjs 的 readKnobs 必须与它一致——
// 两边各写一遍就会漂移成「面板显示一个数、画面用的是另一个数」。

/** 分组：先决定镜头怎么摆，再决定路怎么铺，然后决定字贴在哪，最后是小人与外观。 */
const GROUPS = {
    camera: { 'zh-CN': '镜头', en: 'Camera' },
    course: { 'zh-CN': '跳台', en: 'Pillars' },
    text: { 'zh-CN': '文字', en: 'Text' },
    motion: { 'zh-CN': '小人', en: 'Runner' },
    look: { 'zh-CN': '外观', en: 'Looks' },
};

const number = (key, group, label, description, min, max, step, defaultValue) => ({
    key,
    type: 'number',
    group,
    label,
    description,
    min,
    max,
    step,
    defaultValue,
});

const select = (key, group, label, description, options, defaultValue) => ({
    key,
    type: 'select',
    group,
    label,
    description,
    options,
    defaultValue,
});

export const JUMP_SETTINGS_SCHEMA = [
    number(
        'pitch', GROUPS.camera,
        { 'zh-CN': '俯角', en: 'Camera pitch' },
        { 'zh-CN': '镜头往下看多少度。角度越大，地面铺得越开——台阶更陡、两行离得更远，柱身与小人也越矮；角度越小越接近平视，路挤在一起、柱子显得更高。默认 34°。', en: 'How far the camera looks down, in degrees. Higher spreads the ground out (steeper steps, wider gaps between lines) and shortens pillars and the runner; lower flattens it toward eye level with taller pillars. Default 34.' },
        18, 60, 1, 34,
    ),
    number(
        'spacing', GROUPS.course,
        { 'zh-CN': '柱子间隙', en: 'Pillar gap' },
        { 'zh-CN': '两块之间留多宽的空当（格）。块按字宽定长度，间隙只决定跳多远；行首行尾各留半个间隙，下一行从上一行的拐点外面起步，拐角处两块就不会叠在一起。默认 1.2。', en: 'Empty gap between two blocks, in cells. Blocks size themselves from their text, so the gap only sets how far a hop is; half a gap is kept at both ends of a row, and the next row starts just outside the previous row’s corner, so the two blocks at a corner never overlap. Default 1.2.' },
        0.1, 2, 0.05, 1.2,
    ),
    number(
        'pillarHeight', GROUPS.course,
        { 'zh-CN': '柱子高度', en: 'Pillar height' },
        { 'zh-CN': '柱顶离地多高（格）。高柱子让跳台像悬浮的方块，矮柱子更像地基。**字多大也由它定**：柱顶那块面跟着柱高一起长，字盒是面的固定几成，于是调高柱子 = 调大字号（字与面同比例，永远不会顶出框）。柱高是整屏一个数，不跟着字长变；文字贴在侧面时，柱高就是端头那面墙的高，柱子会在这个值上再长一档，字才装得下——字多的块只把那面墙撑宽，不会把柱子顶得更高。默认 1.9。', en: 'How tall pillars stand, in cells. Tall ones read as floating blocks, short ones as footings. **It also sets the type size**: the top face grows with the height and the type box is a fixed share of that face, so a taller pillar means bigger words (box and face scale together, so words never spill). The height is one number per screen and never follows the words; with the text on the side face this is the end wall’s height, raised one notch so the words fit — a longer word only widens that wall, it never makes a taller pillar. Default 1.9.' },
        0.2, 3, 0.05, 1.9,
    ),
    number(
        'pillarSpring', GROUPS.course,
        { 'zh-CN': '柱子弹性', en: 'Pillar bounce' },
        { 'zh-CN': '柱子受力后的那一下：小人**落地**把它踩沉下去（默认沉 0.45 格），**起跳**时它弹回来、冲过头一点，再做几下越来越小的振动（约 1 秒内停住）。默认 1；0 = 柱子纹丝不动（老样子），2 = 夸张的一沉一弹。小人踩在柱顶上，所以他跟着柱子一起沉、一起弹。', en: 'How much the pillars react to the runner: on **landing** the block is pressed down (0.45 cells by default), on **take-off** it springs back, overshoots a little, then jitters in ever smaller swings until it settles (within about a second). Default 1; 0 keeps the pillars perfectly still, 2 is an exaggerated dip and spring. The runner stands on the top face, so he sinks and springs with it.' },
        0, 2, 0.05, 1,
    ),
    select(
        'textFace', GROUPS.text,
        { 'zh-CN': '文字所在面', en: 'Text face' },
        { 'zh-CN': '字贴在方块的哪一个面上：顶面（躺在柱顶，随投影斜切）、正面（沿路那一长条面）、侧面（端头那面，字立着读）或悬浮在柱子上方（不随面变形，最好读）。柱子跟着字长：那一面按这块字的长宽比反推大小，所以字永远装得下、永远正正落在面心（四档面同一套算法）。顶面 / 正面那档块沿路变长、柱顶跟着变宽；侧面那档端头那面墙变宽；悬浮那档柱顶跟着长宽。', en: 'Which face the words sit on: the top face (lying flat, sheared by the projection), the front face (the long face along the road), the side face (the end cap, where the words read upright) or floating above the block (upright, easiest to read). Blocks grow with their words: the face is derived from the type box’s aspect, so the words always fit and always land dead centre on that face — the same rule for all four faces. Top and front blocks lengthen along the road and widen the top face; the side face widens the end wall; the floating face grows the top face with it.' },
        [
            { value: 'top', label: { 'zh-CN': '顶面', en: 'Top' } },
            { value: 'front', label: { 'zh-CN': '正面（沿路那面）', en: 'Front (along the road)' } },
            { value: 'side', label: { 'zh-CN': '侧面（端头）', en: 'Side (end cap)' } },
            { value: 'above', label: { 'zh-CN': '上方（悬浮）', en: 'Above (floating)' } },
        ],
        'top',
    ),
    number(
        'chunkChars', GROUPS.course,
        { 'zh-CN': '每块字数', en: 'Chars per block' },
        { 'zh-CN': '一根柱子最多写几个字（**只对中文有用**）：2 是一两个字的碎步（默认），3 / 4 是一块扛三四个字，柱子更长、跳得更少；1 想让每个字跳一次，但长句里会被「一行最多几块」的上限夹回 2（10 个字的句子至少 2 字一块）。英文只在空格处断，一个单词整根柱子扛下来，这个旋钮对英文不起作用。', en: 'How many characters one pillar may hold (**Chinese only**): 2 gives blocks of one or two (default), 3 / 4 put three or four on a pillar for longer blocks and fewer hops; 1 wants one hop per character, but on long lines the "blocks per row" ceiling pushes it back to 2 (a 10-character line is at least two characters per block). English only breaks at spaces and keeps a whole word on one pillar, so this has no effect there.' },
        1, 4, 1, 2,
    ),
    number(
        'preferPair', GROUPS.course,
        { 'zh-CN': '长词切细', en: 'Split long words' },
        { 'zh-CN': '1 = 超过「每块字数」的中文词再切小（推荐），0 = 一个词一块，长句会变得笨重。英文单词无论开不开都不拆。', en: '1 splits Chinese words longer than "chars per block" (recommended); 0 keeps a whole word on one pillar and makes long lines heavy. English words are never split either way.' },
        0, 1, 1, 1,
    ),
    number(
        'flySeconds', GROUPS.motion,
        { 'zh-CN': '滞空时间', en: 'Air time' },
        { 'zh-CN': '一次跳跃在空里待几**秒**（不是比例）。唱得快时这一跳几乎占满整个拍子，唱得慢时跳完就站着等下一句——快歌慢歌里「跳这一下」本身一样快。', en: 'How many **seconds** one hop stays in the air (not a share). On fast lyrics the hop fills almost the whole beat; on slow ones it lands and waits — the hop itself keeps the same speed either way.' },
        0.1, 1.2, 0.05, 0.45,
    ),
    number(
        'runnerScale', GROUPS.motion,
        { 'zh-CN': '小人尺寸', en: 'Runner size' },
        { 'zh-CN': '小人有多高（倍，相对他自己的基准身高）。跳一跳里人是主角：默认 1.2，比一根柱子还高一头；拧到最小就只剩一个小棋子。头顶的地方是算进画面预算的，拧大只会让整屏的柱子让出一点空间，人不会顶出画面。', en: 'How tall the runner stands, as a multiple of his base height. In hopscotch the runner is the star: 1.2 by default, a head taller than a pillar; turn it down and he shrinks to a small piece. The room above his head is part of the frame budget, so raising this only gives the pillars a little less room — he never pokes out of the frame.' },
        0.2, 2, 0.05, 1.2,
    ),
    number(
        'arc', GROUPS.motion,
        { 'zh-CN': '跳跃高度', en: 'Hop arc' },
        { 'zh-CN': '跳跃高度（格）：腾空那一段抬多高。默认 1.2，约半根柱子——看得清是跳过去的，又不会像飞。0 是贴地滑过去。', en: 'How high the runner leaps, in cells: how far the arc lifts him. Default 1.2, about half a pillar — clearly a hop, not a flight. 0 slides along the ground.' },
        0, 2.4, 0.05, 1.2,
    ),
    number(
        'wireframe', GROUPS.look,
        { 'zh-CN': '线框强度', en: 'Wireframe' },
        { 'zh-CN': '柱子上的格线与棱线有多明显。线框越强，方块越像全息投影。', en: 'How visible the grid and edges on pillars are. Stronger lines read as a hologram.' },
        0, 1, 0.05, 0.55,
    ),
    number(
        'trail', GROUPS.look,
        { 'zh-CN': '跳跃轨迹', en: 'Hop trail' },
        { 'zh-CN': '跳过的地方留多清楚的虚线；落地那一瞬在柱顶铺开的冲击环与飞尘也跟着它一起浓淡。0 只留灰疙瘩。', en: 'How visible the trail of past hops is; the impact ring and dust that burst on the pillar top at each landing follow it too. 0 leaves only fading dots.' },
        0, 1, 0.05, 0.5,
    ),
];

/** 缺省值的一份快照：主机没给值（或给了非法值）时按它回落。 */
export const JUMP_DEFAULT_KNOBS = Object.freeze(
    Object.fromEntries(JUMP_SETTINGS_SCHEMA.map((param) => [param.key, param.defaultValue])),
);
