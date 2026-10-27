// mods/daily-30/index.cjs
// The main entry: owns the on-disk archive and answers the client's rpc calls. Nothing is scheduled here;
// the client records on its own timer, so the same data is written whether or not the home tab is open.

'use strict';

const path = require('node:path');
const { createArchive } = require('./archive.cjs');

module.exports = function activate(api) {
    const root = path.join(api.storage.paths.data, 'archive');
    const archive = createArchive(root, api.log);
    archive.init();

    api.rpc.handle('archive.list', () => archive.listDays());
    api.rpc.handle('archive.get', (platform, date) => archive.getDay(platform, date));
    api.rpc.handle('archive.save', (day) => archive.saveDay(day));
    api.rpc.handle('archive.delete', (platform, date) => archive.deleteDay(platform, date));
    api.rpc.handle('archive.search', (query, options) => archive.search(query, options));
    api.rpc.handle('archive.export', () => archive.exportAll(api.paths.downloads));

    api.log.info('[daily-30] main entry ready', { root });
    return () => {};
};
