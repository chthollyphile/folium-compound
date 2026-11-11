// mods/lizi-imessage-504/styles.mjs
// Stage 504's stylesheet, scoped under `.lizi504-root`. A visualizer mounts
// into a normal host container (not a ShadowRoot), so every selector is
// prefixed and every keyframe is renamed; nothing here can leak into Folia.
// `fixed` became `absolute` because the stage now lives inside its container,
// and the two viewport media queries became classes that fit() toggles from the
// container's own size.

export const STAGE_CSS = `
.lizi504-root {
  all: initial;
  position: absolute;
  inset: 0;
  display: block;
  box-sizing: border-box;
  overflow: hidden;
  background: transparent;
  --ac: 150, 165, 255;
  --k: 1;
  --bw: 272px;
  container-type: size;
  font-family: "SF Pro Text", -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  -webkit-user-select: none;
  user-select: none;
  cursor: default;
  pointer-events: none;
}

.lizi504-root *,
.lizi504-root *::before,
.lizi504-root *::after {
  box-sizing: border-box;
  -webkit-font-smoothing: antialiased;
}

.lizi504-root.free {
  pointer-events: auto;
  touch-action: none;
  cursor: grab;
}

.lizi504-root.dragging {
  cursor: grabbing;
}

.lizi504-root.no-text .chat,
.lizi504-root.no-text .rec {
  visibility: hidden;
}

.lizi504-root.no-bg .bg {
  display: none;
}

.lizi504-root.static,
.lizi504-root.static * {
  transition: none !important;
  animation: none !important;
}

/* ================= 背景：黑 ================= */
.lizi504-root .bg {
  position: absolute;
  inset: 0;
  background: radial-gradient(118% 88% at 66% 40%, #141418 0%, #0b0b0e 42%, #050507 72%, #000 100%);
}

.lizi504-root .glow {
  position: absolute;
  inset: -25%;
  pointer-events: none;
  background: radial-gradient(circle at 64% 44%, rgba(var(--ac), .20), rgba(var(--ac), .07) 30%, rgba(var(--ac), 0) 56%);
  transition: background 1.6s ease;
}

.lizi504-root .grain {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  opacity: .4;
  mix-blend-mode: overlay;
}

/* ================= 舞台 ================= */
.lizi504-root .stage {
  position: absolute;
  inset: 0;
}

.lizi504-root .anchor {
  position: absolute;
  left: 63%;
  top: 50%;
  transform: translate(-50%, -50%);
  perspective: 1250px;
  perspective-origin: 48% 44%;
}

/* 摄影机：机械臂。每次换句由 JS 重设 transform（时长/曲线逐镜不同） */
.lizi504-root .tilt {
  position: relative;
  transform-style: preserve-3d;
  will-change: transform;
  transform: rotateX(11deg) rotateY(23deg) rotateZ(-1.3deg);
}

/* 视差：鼠标带着转一点点，挂在摄影机里侧，不参与运镜 */
.lizi504-root .par {
  transform-style: preserve-3d;
  transition: transform .5s cubic-bezier(.22, .75, .28, 1);
}

.lizi504-root .float {
  transform-style: preserve-3d;
  animation: lizi504-float 12s ease-in-out infinite alternate;
}

@keyframes lizi504-float {
  from { transform: translateY(-7px); }
  to { transform: translateY(8px); }
}

.lizi504-root .box {
  position: relative;
  transform-style: preserve-3d;
  transform: scale(calc(var(--k, 1) * 0.5));
}

/* 机身厚度：40 层实心片沿 z 轴挤出（约 44px），转起来是一条金属侧壁 */
.lizi504-root .layers {
  position: absolute;
  inset: 0;
  transform-style: preserve-3d;
  pointer-events: none;
}

.lizi504-root .layers i {
  position: absolute;
  inset: 0;
  border-radius: 112px;
  background: #2a2a30;
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
}

/* 机身周围的一圈冷光，把手机从黑里托起来 */
.lizi504-root .halo {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 760px;
  height: 1060px;
  pointer-events: none;
  transform: translate(-50%, -50%) scale(var(--k, 1));
  background: radial-gradient(46% 44% at 50% 50%, rgba(150, 165, 255, .11), rgba(120, 130, 190, .05) 42%, rgba(0, 0, 0, 0) 70%);
}

.lizi504-root .phone {
  position: relative;
  width: 390px;
  height: 844px;
  border-radius: 56px;
  transform-origin: 50% 50%;
  zoom: 2;
  background: linear-gradient(146deg, #3d3d45 0%, #17171b 15%, #4e4e58 29%, #0d0d11 47%, #36363e 63%, #101014 81%, #2e2e35 100%);
  box-shadow:
    0 0 0 .8px rgba(255, 255, 255, .20) inset,
    0 1.5px 2px rgba(255, 255, 255, .26) inset,
    0 -2px 5px rgba(0, 0, 0, .92) inset,
    0 0 60px -6px rgba(150, 165, 255, .10),
    0 40px 90px -30px rgba(0, 0, 0, .95);
}

/* ================= 屏幕 ================= */
.lizi504-root .screen {
  position: absolute;
  inset: 6px;
  border-radius: 50px;
  overflow: hidden;
  background: #fff;
  isolation: isolate;
  display: flex;
  flex-direction: column;
}

/* --- 灵动岛 --- */
.lizi504-root .island {
  position: absolute;
  top: 11px;
  left: 50%;
  z-index: 60;
  transform: translateX(-50%);
  width: 124px;
  height: 36px;
  border-radius: 19px;
  background: #060608;
  display: flex;
  align-items: center;
  padding: 0 10px;
  gap: 10px;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(0, 0, 0, .3);
  transition: width .58s cubic-bezier(.22, 1.2, .36, 1),
    height .58s cubic-bezier(.22, 1.2, .36, 1),
    border-radius .45s ease, padding .45s ease, gap .45s ease;
}

.lizi504-root .island.open {
  width: 212px;
  height: 60px;
  border-radius: 22px;
  padding: 0 13px;
  gap: 10px;
}

.lizi504-root .island__art {
  width: 16px;
  height: 16px;
  border-radius: 5px;
  flex: none;
  overflow: hidden;
  position: relative;
  background: linear-gradient(140deg, rgba(var(--ac), .85), rgba(var(--ac), 1));
  display: grid;
  place-items: center;
  transition: width .45s cubic-bezier(.22, 1.2, .36, 1), height .45s cubic-bezier(.22, 1.2, .36, 1), border-radius .45s;
}

.lizi504-root .island__art b {
  font-size: 9px;
  font-weight: 600;
  color: rgba(255, 255, 255, .95);
  line-height: 1;
  transition: font-size .4s ease;
}

.lizi504-root .island.open .island__art {
  width: 38px;
  height: 38px;
  border-radius: 10px;
}

.lizi504-root .island.open .island__art b {
  font-size: 16px;
}

.lizi504-root .island__art img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: none;
  position: absolute;
  inset: 0;
}

.lizi504-root .island__meta {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1px;
  opacity: 0;
  transform: translateX(-5px);
  transition: opacity .28s ease, transform .38s ease;
}

.lizi504-root .island.open .island__meta {
  opacity: 1;
  transform: none;
  transition-delay: .13s;
}

.lizi504-root .island__n {
  font-size: 12.5px;
  font-weight: 600;
  color: #fff;
  letter-spacing: -.1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lizi504-root .island__a {
  font-size: 10.5px;
  color: rgba(255, 255, 255, .5);
  letter-spacing: .1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lizi504-root .island__wave {
  flex: none;
  display: flex;
  align-items: center;
  gap: 2px;
  height: 11px;
  transition: height .45s ease;
}

.lizi504-root .island.open .island__wave {
  height: 17px;
  gap: 2.5px;
}

.lizi504-root .island__wave i {
  width: 2.5px;
  height: 100%;
  border-radius: 2px;
  background: rgba(255, 255, 255, .88);
  transform: scaleY(.24);
  transform-origin: center;
  transition: transform .12s linear;
}

/* --- 状态栏 --- */
.lizi504-root .sbar {
  height: 54px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 30px;
  position: relative;
  z-index: 10;
}

.lizi504-root .sbar__t {
  font-size: 15px;
  font-weight: 600;
  color: #000;
  letter-spacing: -.2px;
  font-variant-numeric: tabular-nums;
}

.lizi504-root .sbar__i {
  display: flex;
  align-items: center;
  gap: 5px;
  transition: opacity .4s ease;
}

.lizi504-root .screen.island-open .sbar__i {
  opacity: .16;
}

.lizi504-root .sbar__i svg {
  display: block;
}

/* --- 导航条 --- */
.lizi504-root .nav {
  height: 42px;
  flex: none;
  display: flex;
  align-items: center;
  padding: 0 8px 0 6px;
  gap: 2px;
  position: relative;
  z-index: 10;
}

.lizi504-root .nav__b {
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  flex: none;
}

.lizi504-root .nav__n {
  font-size: 13px;
  font-weight: 600;
  color: #000;
  letter-spacing: -.1px;
  max-width: 200px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: .88;
}

/* --- 会话头 --- */
.lizi504-root .hd {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 2px 0 15px;
}

.lizi504-root .hd__av {
  width: 70px;
  height: 70px;
  border-radius: 50%;
  overflow: hidden;
  position: relative;
  background: linear-gradient(142deg, rgba(var(--ac), .55), rgba(var(--ac), .92));
  display: grid;
  place-items: center;
  box-shadow: 0 5px 16px -8px rgba(30, 34, 54, .5), 0 0 0 .5px rgba(0, 0, 0, .05) inset;
}

.lizi504-root .hd__av::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: linear-gradient(160deg, rgba(255, 255, 255, .30), rgba(255, 255, 255, 0) 46%);
}

.lizi504-root .hd__av img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: none;
  z-index: 1;
}

.lizi504-root .hd__av b {
  font-size: 27px;
  font-weight: 500;
  color: rgba(255, 255, 255, .94);
  position: relative;
  z-index: 1;
}

.lizi504-root .hd__n {
  font-size: 15.5px;
  font-weight: 600;
  color: #000;
  letter-spacing: -.2px;
  max-width: 82%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lizi504-root .hd__s {
  font-size: 11px;
  color: #9c9ca4;
  letter-spacing: .35px;
}

/* --- 对话 --- */
.lizi504-root .chat {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  background: radial-gradient(130% 85% at 48% 26%, #ffffff 0%, #fdfdfe 52%, #f7f7fa 84%, #f2f2f6 100%);
}

.lizi504-root .chat::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 54px;
  z-index: 6;
  pointer-events: none;
  background: linear-gradient(#fff 22%, rgba(255, 255, 255, 0));
}

.lizi504-root .thread {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 0;
  transition: transform .56s cubic-bezier(.24, .86, .3, 1);
}

.lizi504-root .stamp {
  position: absolute;
  left: 0;
  right: 0;
  top: 10px;
  z-index: 5;
  text-align: center;
  font-size: 10.5px;
  font-weight: 500;
  color: #b6b6be;
  letter-spacing: .5px;
  pointer-events: none;
  transition: opacity .4s ease;
}

.lizi504-root .bub {
  position: absolute;
  max-width: var(--bw, 272px);
  padding: 8px 14px;
  border-radius: 19px;
  font-size: 16px;
  line-height: 22px;
  letter-spacing: 0;
  word-break: break-word;
  z-index: 1;
  transition: opacity .55s ease, transform .55s cubic-bezier(.2, .9, .3, 1),
    box-shadow .5s ease;
}

.lizi504-root .bub.cur {
  box-shadow: 0 3px 14px -6px rgba(40, 44, 70, .30);
}

.lizi504-root .bub span {
  opacity: .34;
  transition: opacity .32s ease;
}

.lizi504-root .bub span.on {
  opacity: 1;
}

.lizi504-root .bub.r {
  right: 12px;
  background: #0b84ff;
  color: #fff;
  border-bottom-right-radius: 0;
}

.lizi504-root .bub.l {
  left: 12px;
  background: #e9e9eb;
  color: #000;
  border-bottom-left-radius: 0;
}

/* 气泡尾巴：向内压 2px 与本体重叠，消除接缝 */
.lizi504-root .bub::after {
  content: '';
  position: absolute;
  bottom: 0;
  width: 9px;
  height: 16px;
  background-repeat: no-repeat;
  background-size: 9px 16px;
  pointer-events: none;
}

.lizi504-root .bub.r::after {
  right: -5px;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='9' height='16'><path d='M3 0 C3.3 7.4 5.2 12 9 16 L3 16 Z' fill='%230b84ff'/></svg>");
}

.lizi504-root .bub.l::after {
  left: -5px;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='9' height='16'><path d='M6 0 C5.7 7.4 3.8 12 0 16 L6 16 Z' fill='%23e9e9eb'/></svg>");
}

/* 正在输入… */
.lizi504-root .typing {
  position: absolute;
  height: 33px;
  padding: 0 15px;
  border-radius: 19px;
  display: flex;
  align-items: center;
  gap: 4.5px;
  z-index: 2;
  pointer-events: none;
  opacity: 0;
  transform: scale(.9) translateY(6px);
  transform-origin: 0 100%;
  transition: opacity .3s ease, transform .36s cubic-bezier(.2, 1.2, .4, 1);
}

.lizi504-root .typing.on {
  opacity: 1;
  transform: none;
}

.lizi504-root .typing.l {
  left: 12px;
  background: #e9e9eb;
  transform-origin: 0 100%;
}

.lizi504-root .typing.r {
  right: 12px;
  background: #0b84ff;
  transform-origin: 100% 100%;
}

.lizi504-root .typing i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: block;
  animation: lizi504-dot 1.15s ease-in-out infinite;
}

.lizi504-root .typing.l i {
  background: #9c9ca3;
}

.lizi504-root .typing.r i {
  background: rgba(255, 255, 255, .94);
}

.lizi504-root .typing i:nth-child(2) {
  animation-delay: .16s;
}

.lizi504-root .typing i:nth-child(3) {
  animation-delay: .32s;
}

@keyframes lizi504-dot {
  0%, 62%, 100% { transform: translateY(0); opacity: .4; }
  32% { transform: translateY(-3.4px); opacity: 1; }
}

/* --- 语音消息气泡 --- */
.lizi504-root .rec {
  flex: none;
  display: flex;
  padding: 2px 12px 10px;
  justify-content: flex-start;
}

.lizi504-root .rec__b {
  display: flex;
  align-items: center;
  gap: 9px;
  height: 38px;
  padding: 0 15px;
  border-radius: 19px;
  background: #e9e9eb;
  border-bottom-left-radius: 3px;
  position: relative;
  max-width: 78%;
}

.lizi504-root .rec__b::after {
  content: '';
  position: absolute;
  left: -4px;
  bottom: 0;
  width: 8px;
  height: 16px;
  background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='8' height='16'><path d='M6 0 C5.7 7.2 3.8 11.8 0 15.8 L0 16 L6 16 Z' fill='%23e9e9eb'/></svg>") no-repeat;
  background-size: 8px 16px;
  pointer-events: none;
}

.lizi504-root .rec__i {
  width: 0;
  height: 0;
  border-left: 9px solid #8e8e93;
  border-top: 6px solid transparent;
  border-bottom: 6px solid transparent;
  flex: none;
  margin-left: 1px;
}

.lizi504-root .rec__w {
  position: relative;
  flex: 0 1 auto;
  height: 18px;
  min-width: 100px;
}

.lizi504-root .rec__w i {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #b0b0b7;
  border-radius: 1px;
  transform: scaleY(.18);
  transform-origin: center;
  transition: transform .13s linear, background .3s ease;
}

.lizi504-root .rec__w i.ps {
  background: #0b84ff;
}

.lizi504-root .rec__t {
  font-size: 12px;
  color: #8e8e93;
  font-variant-numeric: tabular-nums;
  flex: none;
  letter-spacing: .2px;
}

/* --- 输入条 --- */
.lizi504-root .bar {
  flex: none;
  height: 54px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px 6px;
}

.lizi504-root .bar__p {
  width: 31px;
  height: 31px;
  border-radius: 50%;
  background: #f1f1f4;
  flex: none;
  display: grid;
  place-items: center;
  color: #8a8a90;
  font-size: 20px;
  font-weight: 300;
  line-height: 1;
  padding-bottom: 2px;
}

.lizi504-root .bar__in {
  flex: 1 1 auto;
  height: 35px;
  border-radius: 18px;
  border: 1px solid #e4e4e8;
  display: flex;
  align-items: center;
  padding: 0 13px;
  color: #c5c5cb;
  font-size: 15px;
  letter-spacing: -.1px;
}

.lizi504-root .bar__m {
  width: 31px;
  height: 31px;
  border-radius: 50%;
  background: #f1f1f4;
  flex: none;
  display: grid;
  place-items: center;
}

.lizi504-root .home {
  flex: none;
  height: 24px;
  display: grid;
  place-items: center;
}

.lizi504-root .home i {
  width: 134px;
  height: 5px;
  border-radius: 3px;
  background: #0a0a0d;
  display: block;
  opacity: .9;
}

.lizi504-root .glass {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  z-index: 80;
  background:
    linear-gradient(116deg, rgba(255, 255, 255, .62) 0%, rgba(255, 255, 255, 0) 20%,
      rgba(255, 255, 255, 0) 62%, rgba(60, 64, 92, .055) 82%, rgba(60, 64, 92, .11) 100%);
}

/* 空歌词 */
.lizi504-root .empty {
  position: absolute;
  left: 0;
  right: 0;
  top: 34%;
  text-align: center;
  opacity: 0;
  transition: opacity .7s ease;
  pointer-events: none;
  z-index: 4;
}

.lizi504-root .empty.on {
  opacity: 1;
}

.lizi504-root .empty__i {
  width: 36px;
  height: 36px;
  margin: 0 auto 13px;
  border-radius: 50%;
  border: 1.4px solid #e4e4e9;
  display: grid;
  place-items: center;
}

.lizi504-root .empty__t {
  font-size: 13px;
  color: #b8b8c0;
  letter-spacing: .4px;
}

/* ================= 左侧曲目信息 ================= */
.lizi504-root .meta {
  position: absolute;
  left: 7vw;
  left: 7cqw;
  top: 50%;
  transform: translateY(-50%);
  color: #8a8a96;
  pointer-events: none;
  opacity: 0;
  transition: opacity 1s ease;
}

.lizi504-root .meta.on {
  opacity: 1;
}

.lizi504-root .meta__k {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 2.2px;
  color: #5a5a66;
  margin-bottom: 16px;
}

.lizi504-root .meta__dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: rgb(var(--ac));
  flex: none;
  box-shadow: 0 0 8px 1px rgba(var(--ac), .7);
}

.lizi504-root .meta__n {
  font-size: clamp(19px, 1.35vw, 23px);
  font-size: clamp(19px, 1.35cqw, 23px);
  font-weight: 600;
  color: #ededf2;
  letter-spacing: -.4px;
  line-height: 1.32;
  max-width: min(30vw, 330px);
  max-width: min(30cqw, 330px);
  margin-bottom: 9px;
}

.lizi504-root .meta__a {
  font-size: 12.5px;
  color: #84848f;
  letter-spacing: .35px;
  max-width: min(30vw, 330px);
  max-width: min(30cqw, 330px);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lizi504-root .meta__p {
  width: min(19vw, 240px);
  width: min(19cqw, 240px);
  height: 1.5px;
  background: rgba(255, 255, 255, .10);
  margin-top: 22px;
  position: relative;
  overflow: hidden;
  border-radius: 1px;
}

.lizi504-root .meta__p i {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  width: 100%;
  background: #cfcfda;
  border-radius: 1px;
  transform: scaleX(0);
  transform-origin: left center;
  transition: transform .28s linear;
}

.lizi504-root .meta__t {
  margin-top: 10px;
  font-size: 10px;
  letter-spacing: 1px;
  color: #5e5e6a;
  font-variant-numeric: tabular-nums;
  display: flex;
  gap: 9px;
}

.lizi504-root .meta__t b {
  font-weight: 500;
  color: #9a9aa6;
}

/* ================= 适配 ================= */
.lizi504-root.narrow .meta {
  left: 5vw;
  left: 5cqw;
}

.lizi504-root.narrow .meta__n {
  font-size: 17px;
}

.lizi504-root.portrait .anchor {
  left: 50%;
  top: 50%;
  perspective: none;
}

.lizi504-root.portrait .halo {
  display: none;
}

.lizi504-root.portrait .tilt {
  transform: none;
  transition: none;
}

.lizi504-root.portrait .float {
  animation: none;
}

.lizi504-root.portrait .box {
  transform: scale(var(--k, 1));
}

.lizi504-root.portrait .layers {
  display: none;
}

.lizi504-root.portrait .phone {
  border-radius: 44px;
  box-shadow: none;
}

.lizi504-root.portrait .screen {
  inset: 5px;
  border-radius: 40px;
}

.lizi504-root.portrait .meta {
  display: none;
}

.lizi504-root.portrait .glass {
  display: none;
}

@media (prefers-reduced-motion: reduce) {
  .lizi504-root .phone {
    animation: none;
  }
  .lizi504-root .rec__w i {
    transition: none;
  }
  .lizi504-root .typing i {
    animation: none;
    opacity: .6;
  }
  .lizi504-root .island {
    transition: none;
  }
  .lizi504-root .island.open .island__meta {
    transition: none;
  }
}
`;
