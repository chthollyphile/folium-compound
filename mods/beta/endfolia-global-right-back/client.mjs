// One right-click uses the same route, layer actions, and history as Folia's existing Back controls.
const PALETTE = '[data-testid="command-palette-panel"]';
const SHEET = '[data-folia-sheet="true"]';
const DIALOG = '[role="dialog"][aria-modal="true"]:not([inert])';
const BLOCKING_WINDOW = '[data-folia-keyboard-window="true"]';
const FOCUSED_POPOVER = '.st-pop:not([inert]), [role="menu"]:not([inert]), [role="listbox"]:not([inert])';

function isPlainRightClick(event) {
    return event.button === 2 && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey;
}

// An Escape handled by one layer must not reach another window listener under it.
class BackEscape extends KeyboardEvent {
    preventDefault() {
        super.preventDefault();
        this.stopImmediatePropagation();
    }
}

function offerEscape(fallback = document.body) {
    const focused = document.activeElement;
    const target = focused && fallback.contains(focused) ? focused : fallback;
    return !target.dispatchEvent(new BackEscape('keydown', {
        key: 'Escape', code: 'Escape', bubbles: true, cancelable: true, composed: true,
    }));
}

function clickIconButton(container, selector) {
    const button = container?.querySelector(selector)?.closest('button');
    if (!button || button.disabled || button.closest('[inert]')) return false;
    button.click();
    return true;
}

function hasAppBackEntry(state) {
    return Boolean(state?.appHistorySession) && Number.isInteger(state.appHistoryIndex) && state.appHistoryIndex > 0;
}

function tryBack() {
    const popover = document.activeElement?.closest(FOCUSED_POPOVER);
    if (popover && offerEscape(popover)) return true;

    const sheet = document.querySelector(SHEET);
    if (sheet) {
        // Sheet owns Escape, including busy states and nested pickers. Never navigate underneath it.
        offerEscape();
        return true;
    }

    const palette = document.querySelector(PALETTE);
    if (palette) {
        // The search workspace also listens on window, so invoke the palette's own Close control.
        if (!clickIconButton(palette, 'button[title][aria-label] + button[aria-label] > svg.lucide-x[width="16"]')) {
            offerEscape(palette);
        }
        return true;
    }

    const dialog = [...document.querySelectorAll(DIALOG)].at(-1);
    if (dialog) {
        if (!dialog.matches('.st-window')
            || !clickIconButton(dialog, 'header button[aria-label] > svg.lucide-chevron-left, header button[aria-label] > svg.lucide-x')) {
            offerEscape(dialog);
        }
        return true;
    }

    if (document.querySelector(BLOCKING_WINDOW)) {
        offerEscape();
        return true;
    }
    if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => {});
        return true;
    }

    const state = window.history.state;
    if (state?.view === 'home' && state.collection && hasAppBackEntry(state)) {
        // Collection Escape may only clear keyboard focus. Use the host's one-entry Back path.
        window.history.back();
        return true;
    }
    if (state?.view === 'lattice') {
        const back = document.querySelector('button.lattice-back');
        if (back && !back.disabled) {
            back.click();
            return true;
        }
    }
    if (offerEscape()) return true;
    if (hasAppBackEntry(state)) {
        window.history.back();
        return true;
    }
    return false;
}

export default function activate(folium) {
    if (folium.env.context !== 'main') return;
    let handledPress = null;
    const onPointerDown = event => {
        handledPress = isPlainRightClick(event) ? tryBack() : null;
        if (!handledPress) return;
        // Do not let the backdrop or a popover process the same right button press a second time.
        event.preventDefault();
        event.stopImmediatePropagation();
    };
    const onContextMenu = event => {
        if (!isPlainRightClick(event)) return;
        const handled = handledPress ?? tryBack();
        handledPress = null;
        if (!handled) return;
        event.preventDefault();
        event.stopImmediatePropagation();
    };
    const options = { capture: true };
    window.addEventListener('pointerdown', onPointerDown, options);
    window.addEventListener('contextmenu', onContextMenu, options);
    return () => {
        window.removeEventListener('pointerdown', onPointerDown, options);
        window.removeEventListener('contextmenu', onContextMenu, options);
    };
}
