// site/assets/app.js
// Market page behavior: search and origin filter, the detail dialogs, the
// zh/en switch, and the copy buttons. The page is complete without it; this
// only hides cards, opens dialogs modally and swaps text. The chosen language is remembered per browser when storage
// is available.

const EN = {
    submit: 'Submit a mod',
    title: 'Mod market',
    tagline: 'Official and reviewed community mods for Folia. Every mod is signed by Folium and shows as Verified once installed.',
    'install.1': 'Turn on the mod system in Folia under Settings → System → Mods',
    'install.2': 'Download a mod’s zip and drop it onto the mods panel',
    'install.3': 'When enabling, check the signature and permissions in the confirmation window',
    search: 'Search name, id, author or description',
    'filter.all': 'All',
    'filter.official': 'Official',
    'filter.community': 'Community',
    'badge.official': 'Official',
    'badge.community': 'Community',
    'permissions.none': 'No permissions',
    node: 'Node entry',
    'node.title': 'Contains code that runs in the main process with full Node.js access',
    experimental: 'Experimental',
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
    source: 'Source',
    more: 'Details',
    close: 'Close',
    'detail.permissions': 'Permissions',
    'detail.compat': 'Compatibility',
    'detail.folia': 'Folia version',
    'detail.provenance': 'Provenance',
    'detail.origin': 'Origin',
    'detail.official': 'Written by the Folium maintainers',
    'detail.owners': 'Maintainers',
    'detail.commit': 'Reviewed commit',
    download: 'Download',
    empty: 'No mods match',
    'footer.note': 'A signature shows Folium reviewed the mod and it has not changed since; an enabled mod still runs with the app’s full privileges, so enable only what you need.',
    'footer.api': 'Catalog (JSON)',
};

const PERMISSIONS_EN = {
    'filesystem.data': 'Read and write its own data file',
    'runtime.playback': 'Read the playback state',
    'render.export': 'Export transparent lyric videos',
    'playback.control': 'Control playback: play, pause, seek, skip',
    'net.fetch': 'Access the network',
    'net.embed': 'Embed external web pages',
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

const applyLanguage = (next) => {
    language = next;
    const english = next === 'en';
    document.documentElement.lang = english ? 'en' : 'zh-CN';
    document.title = english ? 'Folium mod market' : 'Folium 模组市场';
    document.querySelectorAll('[data-i18n]').forEach((element) => {
        const zh = remember(element, 'text', element.textContent);
        element.textContent = english ? EN[element.dataset.i18n] ?? zh : zh;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
        const zh = remember(element, 'placeholder', element.placeholder);
        element.placeholder = english ? EN[element.dataset.i18nPlaceholder] ?? zh : zh;
    });
    document.querySelectorAll('[data-i18n-title]').forEach((element) => {
        const zh = remember(element, 'title', element.title);
        element.title = english ? EN[element.dataset.i18nTitle] ?? zh : zh;
    });
    document.querySelectorAll('[data-permission]').forEach((element) => {
        const zh = remember(element, 'title', element.title);
        element.title = english ? PERMISSIONS_EN[element.dataset.permission] ?? zh : zh;
    });
    document.querySelectorAll('[data-permission-text]').forEach((element) => {
        const zh = remember(element, 'text', element.textContent);
        element.textContent = english ? PERMISSIONS_EN[element.dataset.permissionText] ?? zh : zh;
    });
    const toggle = document.querySelector('[data-lang-toggle]');
    if (toggle) toggle.textContent = english ? '中文' : 'EN';
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

const setupFilters = () => {
    const input = document.querySelector('[data-search-input]');
    const buttons = [...document.querySelectorAll('[data-filter]')];
    const cards = [...document.querySelectorAll('.card')];
    const empty = document.querySelector('[data-empty]');
    let origin = 'all';

    const update = () => {
        const terms = (input?.value ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean);
        let shown = 0;
        cards.forEach((card) => {
            const matches = (origin === 'all' || card.dataset.origin === origin)
                && terms.every((term) => card.dataset.search.includes(term));
            card.hidden = !matches;
            if (matches) shown += 1;
        });
        if (empty) empty.hidden = shown > 0;
    };

    input?.addEventListener('input', update);
    buttons.forEach((button) => button.addEventListener('click', () => {
        origin = button.dataset.filter;
        buttons.forEach((other) => other.classList.toggle('is-active', other === button));
        update();
    }));
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
 * Detail dialogs. Each is `<dialog id="mod-<id>">`; links to `#mod-<id>` open
 * it modally and push the fragment, so the back button closes it and the URL
 * can be shared. Closing (button, Esc, backdrop) drops the fragment again.
 */
const setupDetails = () => {
    const dialogFor = (hash) => {
        const element = hash.startsWith('#mod-') ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
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
        const link = event.target.closest('a[href^="#mod-"]');
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
