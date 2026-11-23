// site/assets/app.js
// Market page behavior: search, the category / source / tag filters and the
// sort order (kept in the URL query so a filtered view can be shared), the
// detail dialogs, the zh/en switch, and the copy buttons. The page is complete
// without it; this only hides and reorders cards, opens dialogs modally and
// swaps text. The chosen language is remembered per browser when storage is
// available.

const EN = {
    submit: 'Submit a mod',
    'submit.awesome': 'List on awesome-Folia',
    title: 'Mod market',
    tagline: 'Official and reviewed community mods for Folia; every released one is signed by Folium. Plus works kept elsewhere, listed on awesome-Folia.',
    'install.1': 'Folia 0.8 and later has a built-in market: install, update and uninstall under Settings → Mods',
    'install.2': 'A zip downloaded here can still be dropped onto the mods page',
    search: 'Search name, author, description, category, tag or permission',
    'search.label': 'Search',
    'group.category': 'Category',
    'group.source': 'Source',
    'group.tag': 'Tag',
    tags: 'Tags',
    sort: 'Sort',
    'sort.recommended': 'Recommended',
    'sort.updated': 'Recently updated',
    'sort.name': 'Name',
    'filter.all': 'All',
    'filter.official': 'Official',
    'filter.community': 'Community',
    'filter.beta': 'Beta',
    'badge.official': 'Official',
    'badge.community': 'Community',
    'badge.beta': 'Beta',
    'badge.external': 'External link',
    'beta.note': 'Beta mods passed the security review only; features may be incomplete or not work at all, and they need Folia 0.7.20 or later.',
    'beta.signed': 'Beta',
    'beta.signed.title': 'Signed with the Folium beta key: security-reviewed only, may not work',
    'permissions.none': 'No permissions',
    node: 'Node entry',
    'node.title': 'Contains code that runs in the main process with full Node.js access',
    experimental: 'Experimental APIs',
    embeds: 'Embeds',
    depends: 'Requires',
    details: 'Signature & checksums',
    key: 'Signing key',
    signedAt: 'Signed',
    digest: 'Signed digest',
    zipsha: 'File SHA-256',
    copy: 'Copy',
    copied: 'Copied',
    signed: 'Signed',
    'signed.title': 'Signed by Folium; shows as Verified once installed',
    source: 'Reviewed source',
    more: 'Details',
    close: 'Close',
    visit: 'Open repository',
    'detail.author': 'Author',
    'detail.repository': 'Source repository',
    'detail.feedback': 'Report a problem',
    'detail.readme': 'Readme',
    'detail.readme.open': 'Read the readme',
    'detail.homepage': 'Homepage',
    'detail.hint': 'Please report problems with a mod to its author',
    'detail.info': 'Overview',
    'detail.category': 'Category',
    'detail.tags': 'Tags',
    'detail.kind': 'Kind',
    'detail.version': 'Version',
    'detail.folia': 'Compatible versions',
    'detail.license': 'License',
    'detail.updated': 'Updated',
    'detail.added': 'Listed',
    'detail.permissions': 'Permissions',
    'detail.compat': 'Dependencies & experimental APIs',
    'detail.provenance': 'Provenance',
    'detail.origin': 'Origin',
    'detail.official': 'Folium maintainers',
    'detail.official.origin': 'Written by the Folium maintainers; the source is in this repository',
    'detail.commit': 'Reviewed commit',
    'awesome.unsigned': 'Not signed by Folium',
    'awesome.note': 'This work is not signed by Folium; it is installed from its own repository.',
    'awesome.hint': 'Please report problems to its author',
    download: 'Download',
    empty: 'Nothing matches',
    reset: 'Clear search and filters',
    'footer.note': 'A signature shows Folium reviewed the mod and it has not changed since; an enabled mod still runs with the app’s full privileges, so enable only what you need. Works on awesome-Folia are not signed by Folium; judge them yourself.',
    'footer.api': 'Catalog (JSON)',
};

const PERMISSIONS_EN = {
    'filesystem.data': 'Read and write its own data file',
    'playback.read': 'Read the playback state',
    'playback.control': 'Control playback: play, pause, seek, skip, volume and loop',
    'playback.queue': 'Replace the whole play queue',
    'equalizer.control': 'Adjust the equalizer',
    'visualizer.renderQuality': 'Change the lyric visualizer’s render quality',
    'visualizer.mode': 'Switch the lyric style',
    'visualizer.tuning': 'Adjust the lyric style’s settings',
    'visualizer.beatEffects': 'Set the beat effects',
    'visualizer.background': 'Set the player background',
    'visualizer.animationIntensity': 'Change the animation intensity',
    'theme.write': 'Change the app’s theme colors',
    'render.export': 'Export transparent lyric videos',
    'net.fetch': 'Access the network',
    'net.embed': 'Embed external web pages',
    stageLayers: 'Draw layers on the player page',
    'platform.netease.read': 'Read data with your signed-in NetEase Cloud Music account',
    'platform.netease.write': 'Write data with your signed-in NetEase Cloud Music account (likes, playlists)',
    // Older names, still found in published mods.
    'runtime.playback': 'Read the playback state',
    'ui.stage': 'Draw layers on the player page',
};

const STORAGE_KEY = 'folium-market-lang';

const readStoredLanguage = () => {
    try {
        return localStorage.getItem(STORAGE_KEY);
    } catch {
        return null;
    }
};

const storeLanguage = (language) => {
    try {
        localStorage.setItem(STORAGE_KEY, language);
    } catch {
        // Private mode or blocked storage: the choice just is not remembered.
    }
};

// The Chinese text is what the page was rendered with; capture it once so switching back restores it.
const original = new Map();
const remember = (element, kind, value) => {
    if (!original.has(element)) original.set(element, {});
    const entry = original.get(element);
    if (!(kind in entry)) entry[kind] = value;
    return entry[kind];
};

let language = 'zh';
const languageListeners = [];

const applyLanguage = (next) => {
    language = next;
    const english = next === 'en';
    document.documentElement.lang = english ? 'en' : 'zh-CN';
    document.title = english ? 'Folium mod market' : 'Folium 模组市场';
    document.querySelectorAll('[data-i18n]').forEach((element) => {
        const zh = remember(element, 'text', element.textContent);
        element.textContent = english ? EN[element.dataset.i18n] ?? zh : zh;
    });
    // Labels from the category, tag and kind tables carry their English in data-en.
    document.querySelectorAll('[data-en]').forEach((element) => {
        const zh = remember(element, 'text', element.textContent);
        element.textContent = english ? element.dataset.en || zh : zh;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
        const zh = remember(element, 'placeholder', element.placeholder);
        element.placeholder = english ? EN[element.dataset.i18nPlaceholder] ?? zh : zh;
    });
    document.querySelectorAll('[data-i18n-title]').forEach((element) => {
        const zh = remember(element, 'title', element.title);
        element.title = english ? EN[element.dataset.i18nTitle] ?? zh : zh;
    });
    document.querySelectorAll('[data-i18n-label]').forEach((element) => {
        const zh = remember(element, 'label', element.getAttribute('aria-label') ?? '');
        element.setAttribute('aria-label', english ? EN[element.dataset.i18nLabel] ?? zh : zh);
    });
    document.querySelectorAll('[data-permission-text]').forEach((element) => {
        const zh = remember(element, 'text', element.textContent);
        element.textContent = english ? PERMISSIONS_EN[element.dataset.permissionText] ?? zh : zh;
    });
    const toggle = document.querySelector('[data-lang-toggle]');
    if (toggle) toggle.textContent = english ? '中文' : 'EN';
    languageListeners.forEach((listener) => listener());
};

const setupLanguage = () => {
    const stored = readStoredLanguage();
    const preferred = stored ?? (navigator.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en');
    if (preferred === 'en') applyLanguage('en');
    document.querySelector('[data-lang-toggle]')?.addEventListener('click', () => {
        const next = language === 'en' ? 'zh' : 'en';
        applyLanguage(next);
        storeLanguage(next);
    });
};

/*
 * Search, filters and sort. Every card (released, beta and awesome-Folia) sits in one waterfall; the
 * state lives in the URL query (?q=&c=&src=&tag=&sort=), replaced as it changes and read on load. A
 * search matches when every word is found in the card's data-search.
 */
const setupFilters = () => {
    const grid = document.querySelector('[data-grid]');
    if (!grid) return;
    const input = document.querySelector('[data-search-input]');
    const sortSelect = document.querySelector('[data-sort]');
    const empty = document.querySelector('[data-empty]');
    const count = document.querySelector('[data-count]');
    const groups = {
        c: [...document.querySelectorAll('[data-category]')].filter((element) => element.tagName === 'BUTTON'),
        src: [...document.querySelectorAll('button[data-source]')],
        tag: [...document.querySelectorAll('button[data-tag]')],
    };
    const valueOf = (key, button) => (key === 'c' ? button.dataset.category : key === 'src' ? button.dataset.source : button.dataset.tag);
    const cards = [...grid.querySelectorAll('.card')];
    // The English permission texts are searchable too (the markup carries the Chinese ones).
    const searchText = new Map(cards.map((card) => {
        const english = (card.dataset.permissions ?? '').split(' ').filter(Boolean).map((id) => PERMISSIONS_EN[id] ?? '').join(' ');
        return [card, `${card.dataset.search ?? ''} ${english}`.toLowerCase()];
    }));
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
    const SORTS = {
        '': (left, right) => Number(left.dataset.order) - Number(right.dataset.order),
        updated: (left, right) => (right.dataset.updated ?? '').localeCompare(left.dataset.updated ?? '') || SORTS[''](left, right),
        name: (left, right) => collator.compare(left.dataset.name ?? '', right.dataset.name ?? '') || SORTS[''](left, right),
    };

    const state = { q: '', c: '', src: '', tag: '', sort: '' };
    let sortedBy = null;

    const known = (key, value) => (key === 'sort' ? Object.hasOwn(SORTS, value) : key === 'q' || groups[key].some((button) => valueOf(key, button) === value));
    const readUrl = () => {
        const params = new URLSearchParams(location.search);
        for (const key of Object.keys(state)) {
            const value = params.get(key) ?? '';
            state[key] = known(key, value) ? value : '';
        }
    };
    const writeUrl = () => {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(state)) if (value) params.set(key, key === 'q' ? value.trim() : value);
        const query = params.toString();
        const next = `${location.pathname}${query ? `?${query}` : ''}${location.hash}`;
        if (next !== `${location.pathname}${location.search}${location.hash}`) history.replaceState(history.state, '', next);
    };

    const renderCount = (shown) => {
        if (!count) return;
        const total = cards.length;
        count.textContent = language === 'en'
            ? (shown === total ? `${total} items` : `Showing ${shown} of ${total}`)
            : (shown === total ? `共 ${total} 项` : `显示 ${shown} / ${total} 项`);
    };

    let lastShown = cards.length;
    const update = () => {
        const terms = state.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
        let shown = 0;
        cards.forEach((card) => {
            const matches = (!state.c || card.dataset.category === state.c)
                && (!state.src || card.dataset.origin === state.src)
                && (!state.tag || (card.dataset.tags ?? '').split(' ').includes(state.tag))
                && terms.every((term) => searchText.get(card).includes(term));
            card.hidden = !matches;
            if (matches) shown += 1;
        });
        if (sortedBy !== state.sort) {
            grid.append(...[...cards].sort(SORTS[state.sort]));
            sortedBy = state.sort;
        }
        for (const [key, buttons] of Object.entries(groups)) {
            buttons.forEach((button) => {
                const active = valueOf(key, button) === state[key];
                button.classList.toggle('is-active', active);
                button.setAttribute('aria-pressed', String(active));
            });
        }
        if (empty) empty.hidden = shown > 0;
        lastShown = shown;
        renderCount(shown);
        writeUrl();
    };

    readUrl();
    if (input) input.value = state.q;
    if (sortSelect) sortSelect.value = state.sort;

    input?.addEventListener('input', () => {
        state.q = input.value;
        update();
    });
    sortSelect?.addEventListener('change', () => {
        state.sort = known('sort', sortSelect.value) ? sortSelect.value : '';
        update();
    });
    for (const [key, buttons] of Object.entries(groups)) {
        buttons.forEach((button) => button.addEventListener('click', () => {
            const value = valueOf(key, button);
            // A tag is a toggle; category and source pick one (their "all" is the empty value).
            state[key] = key === 'tag' && state.tag === value ? '' : value;
            update();
        }));
    }
    document.querySelector('[data-reset]')?.addEventListener('click', () => {
        Object.assign(state, { q: '', c: '', src: '', tag: '' });
        if (input) input.value = '';
        update();
        input?.focus();
    });
    // "/" jumps to the search box, as on most code hosts.
    document.addEventListener('keydown', (event) => {
        if (event.key !== '/' || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
        const target = event.target;
        if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
        if (document.querySelector('dialog.detail[open]')) return;
        event.preventDefault();
        input?.focus();
    });
    languageListeners.push(() => renderCount(lastShown));
    update();
    // On phones the chip rows scroll sideways: bring a chip chosen by the link into view.
    for (const [key, buttons] of Object.entries(groups)) {
        const active = buttons.find((button) => state[key] && valueOf(key, button) === state[key]);
        const row = active?.parentElement;
        if (row && row.scrollWidth > row.clientWidth) {
            const offset = active.getBoundingClientRect().left - row.getBoundingClientRect().left;
            row.scrollLeft += offset - (row.clientWidth - active.offsetWidth) / 2;
        }
    }
};

const setupCopy = () => {
    document.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-copy]');
        if (!button) return;
        const label = button.querySelector('[data-i18n]');
        try {
            await navigator.clipboard.writeText(button.dataset.copy);
            if (label) {
                label.textContent = language === 'en' ? EN.copied : '已复制';
                setTimeout(() => { label.textContent = language === 'en' ? EN.copy : '复制'; }, 1400);
            }
        } catch {
            // Clipboard unavailable (insecure context or denied): the hash stays selectable.
        }
    });
};

/*
 * Detail dialogs. Each is `<dialog id="mod-<id>">` or `<dialog id="awesome-<id>">`; links to the
 * fragment open it modally and push it, so the back button closes it and the URL can be shared.
 * Closing (button, Esc, backdrop) drops the fragment again; the filter query stays.
 */
const DETAIL_HASH = /^#(mod|awesome)-/;
const setupDetails = () => {
    const dialogFor = (hash) => {
        const element = DETAIL_HASH.test(hash ?? '') ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
        return element instanceof HTMLDialogElement ? element : null;
    };
    const openDialogs = () => [...document.querySelectorAll('dialog.detail[open]')];
    // Whether the current fragment was pushed by a click here (then closing goes back one entry).
    let pushed = false;

    const show = (dialog) => {
        openDialogs().forEach((other) => other !== dialog && other.close());
        if (!dialog.open) dialog.showModal();
    };
    const sync = () => {
        const dialog = dialogFor(location.hash);
        if (dialog) show(dialog);
        else openDialogs().forEach((open) => open.close());
    };

    document.addEventListener('click', (event) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const link = event.target.closest('a[href^="#mod-"], a[href^="#awesome-"]');
        const dialog = link && dialogFor(link.getAttribute('href'));
        if (dialog) {
            event.preventDefault();
            if (location.hash !== link.getAttribute('href')) {
                history.pushState(null, '', link.getAttribute('href'));
                pushed = true;
            }
            show(dialog);
            return;
        }
        const close = event.target.closest('[data-close]');
        if (close) {
            event.preventDefault();
            close.closest('dialog')?.close();
            return;
        }
        // The dialog itself is only hit outside .detail-body, i.e. on the backdrop.
        if (event.target instanceof HTMLDialogElement && event.target.classList.contains('detail')) event.target.close();
    });

    document.querySelectorAll('dialog.detail').forEach((dialog) => dialog.addEventListener('close', () => {
        if (location.hash !== `#${dialog.id}`) return;
        if (pushed) {
            pushed = false;
            history.back();
        } else {
            history.replaceState(null, '', location.pathname + location.search);
        }
    }));
    window.addEventListener('popstate', () => {
        pushed = false;
        sync();
    });
    sync();
};

// Tells app.css the dialogs are driven from here (it shows them through :target otherwise).
document.documentElement.classList.add('js');
setupLanguage();
setupFilters();
setupDetails();
setupCopy();
