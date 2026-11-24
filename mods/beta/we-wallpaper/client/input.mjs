import { callHost } from './support.mjs';

// Folium supplies native controls; only Folia's own popups supplement its layout snapshot.
export function mountDesktopInput(folium, ctx, navigation) {
    let disposed = false;
    let frame = 0;
    let signature = '';
    let openingWindow = false;
    let watching = false;
    let popupDirty = true;
    let lastLayout;
    let lastDisplay = '';
    const popupSelector = '[role="dialog"],[role="menu"],[role="listbox"],[data-folia-keyboard-window="true"],[data-testid="capsule-quick-actions"]';
    const visible = element => {
        if(element.closest('[inert],[hidden],[aria-hidden="true"]')) return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== 'hidden';
    };
    const report = () => {
        if(disposed || frame) return;
        frame = requestAnimationFrame(() => {
            frame = 0;
            if(disposed) return;
            const display = ctx.getDisplay();
            const layout = ctx.getLayout();
            const active = navigation.desktop && display.visualizerOpacity > 0;
            const displayKey = [active, display.isPlayerChromeHidden, innerWidth, innerHeight, JSON.stringify(navigation.hitRegion)].join(':');
            if (lastLayout === layout && lastDisplay === displayKey && !popupDirty) return;
            lastLayout = layout; lastDisplay = displayKey; popupDirty = false;
            const popups = active ? [...document.querySelectorAll(popupSelector)].filter(visible) : [];
            const keyboardPopup = popups.some(element => element.matches('[data-folia-keyboard-window="true"]'));
            if(keyboardPopup && !openingWindow) {
                openingWindow = true;
                void navigation.leave(false).catch(error => folium.log.error(error.message)).finally(() => { openingWindow = false; });
            }
            const rects = active && layout ? layout.obstacles.filter(obstacle => !display.isPlayerChromeHidden || obstacle.kind === 'reveal-area').map(obstacle => ({ ...obstacle.rect })) : [];
            for(const element of popups) {
                const rect = element.getBoundingClientRect();
                rects.push({ left:rect.left, top:rect.top, width:rect.width, height:rect.height });
                if (!observedPopups.includes(element)) popupResize.observe(element);
            }
            for(const element of observedPopups) if(!popups.includes(element)) popupResize.unobserve(element);
            if (popups.length !== observedPopups.length || popups.some(element => !observedPopups.includes(element))) {
                popupStyle.disconnect();
                for (const element of popups) popupStyle.observe(element, { attributes:true, attributeFilter:['style','class'] });
            }
            observedPopups = popups;
            if (active && navigation.hitRegion) {
                const rect = navigation.hitRegion;
                rects.push({ left:Math.max(0,rect.left - rect.revealPadding), top:Math.max(0,rect.top - rect.revealPadding), width:rect.width + rect.revealPadding * 2, height:rect.height + rect.revealPadding * 2 });
            }
            const key = JSON.stringify(rects);
            if(key === signature) return;
            signature = key;
            void callHost(folium, 'desktop-input-regions',rects).catch(error => { if(!disposed) folium.log.error('[WE desktop input] ' + error.message); });
        });
    };
    let observedPopups = [];
    const popupChanged = () => { popupDirty = true; report(); };
    const popupResize = new ResizeObserver(popupChanged);
    const popupStyle = new MutationObserver(popupChanged);
    const popupObserver = new MutationObserver(changes => {
        if(changes.some(change => change.type === 'attributes'
            ? change.target.matches?.(popupSelector)
            : [...change.addedNodes,...change.removedNodes].some(node => node instanceof Element && (node.matches(popupSelector) || node.querySelector(popupSelector))))) popupChanged();
    });
    const navigationChanged = () => {
        if (watching !== navigation.desktop) {
            watching = navigation.desktop;
            if (watching) popupObserver.observe(document.body,{ childList:true, subtree:true, attributes:true, attributeFilter:['hidden','inert','aria-hidden'] });
            else { popupObserver.disconnect(); popupResize.disconnect(); popupStyle.disconnect(); observedPopups = []; }
            popupDirty = true;
        }
        report();
    };
    const offLayout = ctx.onChange(report);
    const offNavigation = navigation.subscribe(navigationChanged);
    const offButton = navigation.onLayout(report);
    window.addEventListener('resize',report);
    navigationChanged();
    return () => {
        disposed = true;
        cancelAnimationFrame(frame);
        offLayout(); offNavigation(); offButton();
        popupResize.disconnect(); popupObserver.disconnect(); popupStyle.disconnect();
        window.removeEventListener('resize',report);
        void callHost(folium, 'desktop-input-regions',[]).catch(() => {});
    };
}
