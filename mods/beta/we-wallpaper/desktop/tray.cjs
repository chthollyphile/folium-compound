'use strict';

const path = require('path');
const { Menu, nativeImage, Tray } = require('electron');

// The WorkerW surface receives no desktop input; this tray opens the song picker.
function createDesktopTray(openPicker, language) {
    const locale = language.toLowerCase();
    const choose = /^zh-(tw|hk|hant)/.test(locale) ? '選歌 / 返回 Folia 視窗'
        : locale.startsWith('zh') ? '选歌 / 返回 Folia 窗口'
            : locale.startsWith('in') || locale.startsWith('id') ? 'Pilih lagu / Buka Folia'
                : locale.startsWith('vi') ? 'Chọn bài hát / Mở Folia'
                    : 'Choose a song / Open Folia';
    const image = nativeImage.createFromPath(path.join(__dirname, '../preview.png')).resize({ width: 32, height: 32 });
    const tray = new Tray(image);
    tray.setToolTip('Folia · Wallpaper Engine · ' + choose);
    tray.setContextMenu(Menu.buildFromTemplate([{ label: choose, click: openPicker }]));
    tray.on('click', openPicker);
    return tray;
}

module.exports = { createDesktopTray };
