// taskbar-player / controller.js
// The taskbar pill. It only renders the state the main process sends and turns
// clicks into commands; it has no access to Folia itself.

(() => {
    const cover = document.getElementById('cover');
    const title = document.getElementById('title');
    const sub = document.getElementById('sub');
    const toggle = document.getElementById('toggle');
    const toggleIcon = document.getElementById('toggleIcon');
    const like = document.getElementById('like');
    const api = window.taskbarPlayer;

    let lastCover = null;
    let lastPlaying = null;
    let lastLiked = null;

    // The icon depends on the current player state, so it is swapped as a whole.
    const PLAY_ICON = '<path d="M8 5.2c0-.8.9-1.3 1.6-.9l9.4 6.1c.6.4.6 1.3 0 1.7l-9.4 6.1c-.7.4-1.6-.1-1.6-.9V5.2Z"/>';
    const PAUSE_ICON = '<rect x="7" y="5" width="3.6" height="14" rx="1.2"/><rect x="13.4" y="5" width="3.6" height="14" rx="1.2"/>';

    const render = (view) => {
        if (!view) return;
        if (view.title) title.textContent = view.title;
        if (view.artist && !view.lyric) sub.textContent = view.artist;
        else if (view.lyric) sub.textContent = view.lyric;
        else if (view.title) sub.textContent = view.artist;
        else sub.textContent = '';

        const playing = Boolean(view.playing);
        if (playing !== lastPlaying) {
            lastPlaying = playing;
            toggleIcon.innerHTML = playing ? PAUSE_ICON : PLAY_ICON;
            toggle.title = playing ? '暂停' : '播放';
        }

        if (view.cover !== lastCover) {
            lastCover = view.cover;
            if (view.cover) {
                cover.onerror = () => {
                    cover.removeAttribute('src');
                    cover.classList.add('hidden');
                };
                cover.onload = () => cover.classList.remove('hidden');
                cover.classList.remove('hidden');
                cover.src = view.cover;
            } else {
                cover.removeAttribute('src');
                cover.classList.add('hidden');
            }
        }

        const liked = Boolean(view.liked);
        if (liked !== lastLiked) {
            lastLiked = liked;
            like.classList.toggle('liked', liked);
        }
        like.classList.toggle('dim', view.canLike === false);
        sub.style.opacity = view.lyric ? '1' : '0.75';
    };

    // After a screenshot overlay (QQ 截图, Snipping Tool) Windows sometimes
    // swallows mouse-down while still delivering mouse-up. Treat a mouse-up
    // with no recent mouse-down as a click: run the action and ask the main
    // process to rebuild the window so later presses arrive normally.
    let lastPointerDown = 0;
    document.addEventListener('mousedown', () => {
        lastPointerDown = Date.now();
    }, true);
    document.addEventListener('mouseup', (event) => {
        if (Date.now() - lastPointerDown < 600 || !api) return;
        const target = event.target instanceof Element ? event.target : null;
        const button = target && target.closest('button');
        const command = button ? button.id : target && (target.closest('.cover') || target.closest('.meta')) ? 'open' : null;
        if (command) api.sendCommand(command);
        api.pageEvent('stale-click');
    }, true);

    const bind = (element, command) => {
        element.addEventListener('click', (event) => {
            event.stopPropagation();
            if (api) api.sendCommand(command);
        });
    };

    bind(document.getElementById('prev'), 'prev');
    bind(toggle, 'toggle');
    bind(document.getElementById('next'), 'next');
    bind(like, 'like');
    // Cover (and the title block next to it) opens the Folia main window.
    cover.addEventListener('click', () => api && api.sendCommand('open'));
    document.querySelector('.meta').addEventListener('click', () => api && api.sendCommand('open'));
    cover.addEventListener('error', () => cover.classList.add('hidden'));

    // The main process sends a snapshot on every change; the first one arrives
    // as soon as this page finishes loading.
    if (api) api.onState(render);

    // The main process uses this to notice that a screenshot overlay or a
    // fullscreen app covered the controller and its input went stale.
    if (api) {
        api.pageEvent(document.visibilityState);
        document.addEventListener('visibilitychange', () => api.pageEvent(document.visibilityState));
        for (const type of ['mousedown', 'mouseup', 'click']) {
            document.addEventListener(type, () => api.pageEvent('page ' + type), true);
        }
    }
})();
