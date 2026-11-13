const modes = [
    { label: '翻覆', description: '未开放', available: false },
    { label: '靖歇', description: '海报展开或磁贴有焦点时先清掉状态，再次右键才回退上级', available: true },
];

export default function activate(folium) {
    if (folium.env.context !== 'main') return;

    const ui = folium.ui;
    if (typeof ui?.back !== 'function') return;

    const section = folium.registries.settingsSections.register({
        id: 'back',
        label: { 'zh-CN': '右键返回方式', en: 'Right-click back mode' },
        settings: [{
            key: 'mode', type: 'select', label: { 'zh-CN': '右键返回方式', en: 'Right-click back mode' },
            defaultValue: 'jingxie',
            options: [{ value: 'jingxie', label: { 'zh-CN': '靖歇' } }],
        }],
        settingsPanel(container) {
            const style = document.createElement('style');
            style.textContent = `
                .back-shortcut {
                    margin: 0 0 8px; padding: 5px 8px; border-radius: 6px;
                    background: color-mix(in srgb, var(--folium-accent, currentColor) 13%, transparent);
                    color: var(--folium-primary, inherit); font-size: 12px; font-weight: 400;
                }
                .back-shortcut kbd {
                    padding: 1px 4px; border-radius: 4px; font: inherit;
                    background: color-mix(in srgb, currentColor 12%, transparent);
                }
                .back-mode { display: flex; align-items: center; gap: 8px; margin: 4px 0; font-weight: 400; }
                .back-mode button {
                    min-width: 48px; height: 24px; padding: 0 6px; border: 0;
                    border-radius: 6px; font: 400 12px var(--folium-font, sans-serif);
                    color: var(--folium-secondary, inherit);
                    background: color-mix(in srgb, currentColor 9%, transparent);
                    cursor: pointer;
                }
                .back-mode button:enabled:hover { background: color-mix(in srgb, currentColor 16%, transparent); }
                .back-mode button:focus-visible { outline: 2px solid var(--folium-accent, currentColor); outline-offset: 2px; }
                .back-mode button[aria-pressed="true"] {
                    color: var(--folium-primary, inherit);
                    background: color-mix(in srgb, var(--folium-accent, currentColor) 19%, transparent);
                    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--folium-accent, currentColor) 72%, transparent);
                }
                .back-mode button[aria-pressed="true"]::before { content: '✓ '; }
                .back-mode button:disabled { opacity: .45; cursor: default; }
                .back-mode span { font-size: 12px; color: var(--folium-secondary, inherit); }
            `;
            const shortcut = document.createElement('p');
            shortcut.className = 'back-shortcut';
            const shift = document.createElement('kbd');
            shift.textContent = 'Shift';
            const rightClick = document.createElement('kbd');
            rightClick.textContent = '右键';
            shortcut.append(shift, '＋', rightClick, '启动原菜单');
            container.append(style, shortcut);
            for (const { label, description, available } of modes) {
                const row = document.createElement('div');
                row.className = 'back-mode';
                const button = document.createElement('button');
                button.type = 'button';
                button.textContent = label;
                button.disabled = !available;
                button.setAttribute('aria-pressed', String(available));
                const help = document.createElement('span');
                help.textContent = description;
                row.append(button, help);
                container.append(row);
            }
        },
    });

    let handledPress = false;
    const onPointerDown = event => {
        handledPress = false;
        if (event.defaultPrevented || event.button !== 2
            || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;

        // Decide before Folia's click-outside handlers can change the top layer.
        handledPress = ui.back();
        if (!handledPress) return;
        event.preventDefault();
        event.stopImmediatePropagation();
    };
    const onContextMenu = event => {
        const suppressMenu = handledPress && event.button === 2;
        handledPress = false;
        if (!suppressMenu) return;
        event.preventDefault();
        event.stopImmediatePropagation();
    };

    const options = { capture: true };
    window.addEventListener('pointerdown', onPointerDown, options);
    window.addEventListener('contextmenu', onContextMenu, options);
    return () => {
        window.removeEventListener('pointerdown', onPointerDown, options);
        window.removeEventListener('contextmenu', onContextMenu, options);
        section.unregister();
    };
}

