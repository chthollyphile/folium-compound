// client.mjs
// Lyrics list: a button next to the progress bar opens a scrollable list of the
// whole song's lyrics on the player page. The current line is highlighted and
// kept in view (unless the user is scrolling), and clicking a line seeks there.
//
// Uses: registries.controlButtons (the button), registries.stageLayers (the
// panel, needs ui.stage), folium.playback.seekToLyricTime (needs
// playback.control), folium.ui.icon and folium.theme.

// Shared by the button and the panel: whether the list is open.
const createVisibility = () => {
  let open = false;
  const listeners = new Set();
  return {
    get: () => open,
    set: (next) => {
      open = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};

const PANEL_CSS = `
.panel {
  position: absolute; top: 72px; right: 24px; bottom: 128px;
  width: min(380px, 42vw);
  display: flex; flex-direction: column;
  border-radius: 18px; overflow: hidden;
  background: color-mix(in srgb, var(--panel-bg) 78%, transparent);
  backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px);
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.35);
  border: 1px solid color-mix(in srgb, var(--panel-fg) 12%, transparent);
  color: var(--panel-fg);
  pointer-events: auto;
  transition: opacity 180ms ease, transform 180ms ease;
}
.panel[hidden] { display: flex; opacity: 0; transform: translateX(16px); pointer-events: none; }
.head { display: flex; align-items: baseline; justify-content: space-between; padding: 16px 18px 10px; }
.title { font-size: 15px; font-weight: 650; }
.count { font-size: 12px; opacity: 0.55; }
.list { flex: 1; overflow-y: auto; padding: 4px 8px 16px; scroll-behavior: smooth; overscroll-behavior: contain; }
.list::-webkit-scrollbar { width: 6px; }
.list::-webkit-scrollbar-thumb { background: color-mix(in srgb, var(--panel-fg) 22%, transparent); border-radius: 3px; }
.line {
  display: block; width: 100%; text-align: left; border: 0; cursor: pointer;
  padding: 8px 10px; border-radius: 10px; background: none; color: inherit; font: inherit;
  opacity: 0.55; transition: opacity 160ms ease, background 160ms ease;
}
.line:hover { opacity: 0.9; background: color-mix(in srgb, var(--panel-fg) 8%, transparent); }
.line.active { opacity: 1; background: color-mix(in srgb, var(--panel-accent) 22%, transparent); }
.text { display: block; font-size: 15px; line-height: 1.45; }
.sub { display: block; margin-top: 2px; font-size: 12px; line-height: 1.4; opacity: 0.7; }
.time { float: right; margin-left: 10px; font-size: 11px; opacity: 0.45; font-variant-numeric: tabular-nums; }
.empty { padding: 32px 18px; text-align: center; font-size: 13px; opacity: 0.6; }
`;

const formatTime = (seconds) => {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
};

// A user scroll pauses auto-follow for this long, so reading ahead is not yanked back.
const FOLLOW_PAUSE_MS = 3000;

export default function activate(folium) {
  const visibility = createVisibility();

  folium.registries.controlButtons.register({
    id: 'toggle',
    slot: 'progress.trailing',
    order: 520,
    mount(container, ctx) {
      const button = document.createElement('button');
      button.type = 'button';
      button.title = '歌词列表 / Lyrics list';
      button.setAttribute('aria-label', '歌词列表');
      button.style.cssText = 'display:grid;place-items:center;width:28px;height:28px;padding:0;border:0;border-radius:8px;background:none;cursor:pointer;';
      button.textContent = '≡';
      folium.ui.icon('list-music', { size: 16 }).then((icon) => {
        if (icon) button.replaceChildren(icon);
      }).catch(() => {});
      const paint = () => {
        const { text, fill } = ctx.getColors();
        button.style.color = visibility.get() ? fill : text;
      };
      const onClick = () => visibility.set(!visibility.get());
      button.addEventListener('click', onClick);
      container.appendChild(button);
      paint();
      const offColors = ctx.subscribe(paint);
      const offVisibility = visibility.subscribe(paint);
      return () => {
        offColors();
        offVisibility();
        button.removeEventListener('click', onClick);
        button.remove();
      };
    },
  });

  folium.registries.stageLayers.register({
    id: 'panel',
    slot: 'player.stage.front',
    mount(container, ctx) {
      const style = document.createElement('style');
      style.textContent = PANEL_CSS;
      const panel = document.createElement('section');
      panel.className = 'panel';
      panel.hidden = !visibility.get();
      panel.innerHTML = '<header class="head"><span class="title">歌词</span><span class="count"></span></header><div class="list" role="list"></div>';
      container.append(style, panel);
      const list = panel.querySelector('.list');
      panel.querySelector('.count').textContent = ctx.lines.length > 0 ? `${ctx.lines.length} 行` : '';

      // The lyrics are fixed for one mount (the host remounts on a new song).
      const rows = ctx.lines.map((line, index) => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'line';
        row.setAttribute('role', 'listitem');
        const time = document.createElement('span');
        time.className = 'time';
        time.textContent = formatTime(line.startTime);
        const text = document.createElement('span');
        text.className = 'text';
        text.textContent = line.fullText;
        row.append(time, text);
        const sub = line.translation || line.romanization;
        if (sub) {
          const subtitle = document.createElement('span');
          subtitle.className = 'sub';
          subtitle.textContent = sub;
          row.append(subtitle);
        }
        row.addEventListener('click', () => {
          try {
            folium.playback.seekToLyricTime(line.startTime);
          } catch (error) {
            folium.log.warn(`seek to line ${index} failed`, error);
          }
        });
        list.appendChild(row);
        return row;
      });
      if (rows.length === 0) {
        list.innerHTML = '<div class="empty">这首歌没有歌词</div>';
      }

      let pausedUntil = 0;
      const onWheel = () => { pausedUntil = Date.now() + FOLLOW_PAUSE_MS; };
      list.addEventListener('wheel', onWheel, { passive: true });
      list.addEventListener('touchmove', onWheel, { passive: true });

      let activeIndex = -2;
      const paintTheme = () => {
        const theme = ctx.getTheme();
        panel.style.setProperty('--panel-bg', theme.backgroundColor);
        panel.style.setProperty('--panel-fg', theme.primaryColor);
        panel.style.setProperty('--panel-accent', theme.accentColor);
        panel.style.fontFamily = folium.theme.resolveFontStack(theme);
      };
      const sync = () => {
        panel.hidden = !visibility.get();
        paintTheme();
        const index = ctx.getLineIndex();
        if (index === activeIndex) return;
        rows[activeIndex]?.classList.remove('active');
        rows[index]?.classList.add('active');
        activeIndex = index;
        if (rows[index] && visibility.get() && Date.now() > pausedUntil) {
          rows[index].scrollIntoView({ block: 'center' });
        }
      };
      sync();
      const offContext = ctx.subscribe(sync);
      const offVisibility = visibility.subscribe(() => {
        activeIndex = -2; // re-center on open
        sync();
      });
      return () => {
        offContext();
        offVisibility();
        list.removeEventListener('wheel', onWheel);
        list.removeEventListener('touchmove', onWheel);
        style.remove();
        panel.remove();
      };
    },
  });
}
