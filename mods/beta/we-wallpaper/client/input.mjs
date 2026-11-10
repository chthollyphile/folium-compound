import { callHost } from './support.mjs';

// Folium supplies native controls; only Folia's own popups supplement its layout snapshot.
export function mountDesktopInput(folium, ctx, navigation) {
    let disposed = false;
    let frame = 0;
    let signature = '';
    let openingWindow = false;
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
                popupResize.observe(element);
            }
            for(const element of observedPopups) if(!popups.includes(element)) popupResize.unobserve(element);
            observedPopups = popups;
            if(active) rects.push({ left:Math.max(0,innerWidth-240), top:Math.max(0,innerHeight-200), width:Math.min(240,innerWidth), height:Math.min(200,innerHeight) });
            const key = JSON.stringify(rects);
            if(key === signature) return;
            signature = key;
            void callHost('desktop-input-regions',rects).catch(error => { if(!disposed) folium.log.error('[WE desktop input] ' + error.message); });
        });
    };
    let observedPopups = [];
    const popupResize = new ResizeObserver(report);
    const popupObserver = new MutationObserver(changes => {
        if(changes.some(change => change.type === 'attributes'
            ? change.target.matches?.(popupSelector)
            : [...change.addedNodes,...change.removedNodes].some(node => node instanceof Element && (node.matches(popupSelector) || node.querySelector(popupSelector))))) report();
    });
    popupObserver.observe(document.body,{ childList:true, subtree:true, attributes:true, attributeFilter:['hidden','inert','aria-hidden'] });
    const offLayout = ctx.onChange(report);
    const offNavigation = navigation.subscribe(report);
    window.addEventListener('resize',report);
    report();
    return () => {
        disposed = true;
        cancelAnimationFrame(frame);
        offLayout(); offNavigation();
        popupResize.disconnect(); popupObserver.disconnect();
        window.removeEventListener('resize',report);
        void callHost('desktop-input-regions',[]).catch(() => {});
    };
}
