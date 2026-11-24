// Follow the visible native corner stack, including wall locators and its finite CSS transitions.
const ROOT_SELECTOR = '[data-testid="grid-list-search-button"],.lattice-tools,[data-testid="panel-toggle"]';
const ROOT_PRIORITY = ['[data-testid="grid-list-search-button"]', '.lattice-tools', '[data-testid="panel-toggle"]'];
const visible = element => {
    if (element.closest('[inert],[hidden],[aria-hidden="true"],[data-picture]')) return false;
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    for (let node = element; node && node !== document.body; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    }
    return true;
};

export function observeNavigationAnchor(onChange) {
    let current = null, root = null, anchor = null, observed = [], frame = 0, trackUntil = 0, disposed = false;
    const schedule = (animate = false) => {
        if (disposed) return;
        if (animate) trackUntil = performance.now() + 340;
        if (!frame) frame = requestAnimationFrame(measure);
    };
    const attributes = new MutationObserver(() => schedule());
    const resize = new ResizeObserver(() => schedule());
    const children = new MutationObserver(() => schedule());
    const hover = () => schedule(true);
    const transition = event => {
        if (observed.includes(event.target)) schedule(true);
    };
    function measure() {
        frame = 0;
        if (disposed) return;
        const candidates = [...document.querySelectorAll(ROOT_SELECTOR)];
        let nextRoot = null;
        for (const selector of ROOT_PRIORITY) {
            nextRoot = candidates.filter(element => element.matches(selector)).find(visible);
            if (nextRoot) break;
        }
        const nextAnchor = nextRoot?.querySelector(':scope > [data-grid-locate]')
            || nextRoot?.querySelector(':scope > div[class~="w-12"] > button') || null;
        const nodes = new Set(nextAnchor ? [nextAnchor, nextAnchor.parentElement] : []);
        for (const candidate of candidates) for (let node = candidate; node && node !== document.body; node = node.parentElement) nodes.add(node);
        const nextObserved = [...nodes];
        if (nextObserved.length !== observed.length || nextObserved.some((node,index) => node !== observed[index])) {
            attributes.disconnect();
            observed = nextObserved;
            for (const node of observed) attributes.observe(node, { attributes:true, attributeFilter:['class','style','hidden','inert','aria-hidden'] });
        }
        if (root !== nextRoot || anchor !== nextAnchor) {
            root?.removeEventListener('pointerenter', hover);
            root?.removeEventListener('pointerleave', hover);
            root?.removeEventListener('transitionrun', transition, true);
            resize.disconnect(); children.disconnect();
            root = nextRoot; anchor = nextAnchor;
            if (root) resize.observe(root);
            if (anchor) resize.observe(anchor);
            if (root) {
                children.observe(root, { childList:true, subtree:true });
                root.addEventListener('pointerenter', hover);
                root.addEventListener('pointerleave', hover);
                root.addEventListener('transitionrun', transition, true);
            }
        }
        let next = null;
        if (anchor) {
            const rect = anchor.getBoundingClientRect();
            const size = anchor.offsetWidth;
            const anchorTop = rect.top + (rect.height - anchor.offsetHeight) / 2;
            const style = getComputedStyle(anchor);
            next = {
                left:rect.left + rect.width / 2 - size / 2, top:anchorTop - size - 12,
                width:size, height:size, revealPadding:12,
                background:style.backgroundColor, color:style.color, shadow:style.boxShadow,
                blocked:Boolean(root.querySelector('[role="menu"],.lattice-tools-panel')),
            };
        }
        if (JSON.stringify(current) !== JSON.stringify(next)) { current = next; onChange(); }
        if (performance.now() < trackUntil) schedule();
    }
    const discovery = new MutationObserver(changes => {
        if (changes.some(change => [...change.addedNodes,...change.removedNodes].some(node => node instanceof Element
            && (node.matches(ROOT_SELECTOR) || node.querySelector(ROOT_SELECTOR))))) schedule();
    });
    discovery.observe(document.body, { childList:true, subtree:true });
    window.addEventListener('resize', hover);
    schedule();
    return {
        get: () => current,
        refresh: () => schedule(),
        dispose() {
            disposed = true; cancelAnimationFrame(frame);
            attributes.disconnect(); resize.disconnect(); children.disconnect(); discovery.disconnect();
            root?.removeEventListener('pointerenter', hover); root?.removeEventListener('pointerleave', hover);
            root?.removeEventListener('transitionrun', transition, true);
            window.removeEventListener('resize', hover);
        },
    };
}
