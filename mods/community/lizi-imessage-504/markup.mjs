// mods/lizi-imessage-504/markup.mjs
// The stage 504 DOM, unchanged from the LIZI single-file form except that ids
// became `data-l` hooks: a visualizer mounts into a host-owned container, not a
// document of its own, so ids would be global and could collide with the app.
// stage.mjs sets this as the inner HTML of `.lizi504-root`.

export const STAGE_HTML = `
<div class="bg"></div>
<div class="glow" data-l="glow"></div>
<canvas class="grain" data-l="grain"></canvas>

<div class="stage">
  <div class="anchor" data-l="anchor">
    <div class="halo"></div>
    <div class="tilt" data-l="tilt">
    <div class="par" data-l="par">
    <div class="float">
    <div class="box">
      <div class="layers" data-l="layers"></div>
      <div class="phone">

      <div class="screen" data-l="screen">

        <!-- 灵动岛 -->
        <div class="island" data-l="island">
          <div class="island__art"><b data-l="islCh">♪</b><img data-l="islImg" alt=""></div>
          <div class="island__meta">
            <div class="island__n" data-l="islN">—</div>
            <div class="island__a" data-l="islA">—</div>
          </div>
          <div class="island__wave" data-l="islWave"></div>
        </div>

        <!-- 状态栏 -->
        <div class="sbar">
          <div class="sbar__t" data-l="clock">9:41</div>
          <div class="sbar__i">
            <svg width="17" height="11" viewBox="0 0 17 11" fill="#000"><rect x="0" y="7.5" width="3" height="3.5" rx="1"/><rect x="4.5" y="5.2" width="3" height="5.8" rx="1"/><rect x="9" y="2.6" width="3" height="8.4" rx="1"/><rect x="13.5" y="0" width="3" height="11" rx="1"/></svg>
            <svg width="16" height="11" viewBox="0 0 16 11" fill="none"><path d="M8 10.2 5.7 7.7a3.3 3.3 0 0 1 4.6 0L8 10.2Z" fill="#000"/><path d="M3.6 5.4a6.4 6.4 0 0 1 8.8 0" stroke="#000" stroke-width="1.5" stroke-linecap="round"/><path d="M1.2 2.6a9.9 9.9 0 0 1 13.6 0" stroke="#000" stroke-width="1.5" stroke-linecap="round"/></svg>
            <svg width="25" height="12" viewBox="0 0 25 12" fill="none"><rect x=".5" y=".5" width="21" height="11" rx="3.2" stroke="#000" stroke-opacity=".32"/><rect x="2" y="2" width="16.5" height="8" rx="2" fill="#000"/><path d="M23 4.2v3.6a2 2 0 0 0 0-3.6Z" fill="#000" fill-opacity=".38"/></svg>
          </div>
        </div>

        <!-- 导航 -->
        <div class="nav">
          <div class="nav__b">
            <svg width="12" height="21" viewBox="0 0 12 21" fill="none"><path d="M10.4 1.6 2 10.5l8.4 8.9" stroke="#0b84ff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
          <div class="nav__n" data-l="navN">—</div>
        </div>

        <!-- 会话头 -->
        <div class="hd">
          <div class="hd__av"><b data-l="avCh">♪</b><img data-l="avImg" alt=""></div>
          <div class="hd__n" data-l="hdN">—</div>
          <div class="hd__s">正在播放</div>
        </div>

        <!-- 对话 -->
        <div class="chat" data-l="chat">
          <div class="stamp" data-l="stamp">今天</div>
          <div class="thread" data-l="thread">
            <div class="typing l" data-l="typing"><i></i><i></i><i></i></div>
          </div>
          <div class="empty" data-l="empty">
            <div class="empty__i">
              <svg width="15" height="11" viewBox="0 0 15 11" fill="#d6d6dc"><path d="M1.2 1h12.6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H4.8L2 11V9H1.2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1Z"/></svg>
            </div>
            <div class="empty__t">还没有歌词</div>
          </div>
        </div>

        <!-- 语音消息 -->
        <div class="rec">
          <div class="rec__b">
            <span class="rec__i"></span>
            <div class="rec__w" data-l="recWave"></div>
            <span class="rec__t" data-l="recT">0:00</span>
          </div>
        </div>

        <!-- 输入条 -->
        <div class="bar">
          <div class="bar__p">+</div>
          <div class="bar__in">iMessage</div>
          <div class="bar__m">
            <svg width="14" height="18" viewBox="0 0 14 18" fill="none"><rect x="4.6" y="1" width="4.8" height="9.4" rx="2.4" stroke="#8a8a90" stroke-width="1.5"/><path d="M1.6 8.2a5.4 5.4 0 0 0 10.8 0" stroke="#8a8a90" stroke-width="1.5" stroke-linecap="round"/><path d="M7 13.9V16.6" stroke="#8a8a90" stroke-width="1.5" stroke-linecap="round"/></svg>
          </div>
        </div>

        <div class="home"><i></i></div>
        <div class="glass"></div>
      </div>
    </div>
      </div>
    </div>
    </div>
    </div>
  </div>
</div>

<div class="meta" data-l="meta">
  <div class="meta__k"><span class="meta__dot"></span>NOW PLAYING</div>
  <div class="meta__n" data-l="mN">—</div>
  <div class="meta__a" data-l="mA">—</div>
  <div class="meta__p"><i data-l="mBar"></i></div>
  <div class="meta__t"><b data-l="mCur">0:00</b><span>/</span><span data-l="mDur">0:00</span></div>
</div>
`;
