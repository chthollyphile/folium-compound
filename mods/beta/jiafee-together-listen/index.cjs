'use strict';

// Folium main entry: owns sockets, the optional local room and client RPC handlers.
const { TogetherListenManager } = require('./lib/manager.cjs');

module.exports = async function activate(api) {
    if (Number(api.host?.folium?.minor) < 7 || typeof api.rpc.send !== 'function') throw new Error('Folium 1.7 required');
    const persisted = await api.storage.get('config');
    const manager = new TogetherListenManager({
        persisted,
        persist: (value) => api.storage.set('config', value),
        log: api.log,
    });

    const onEvent = event => api.rpc.send('event', event);
    manager.on('event', onEvent);
    api.rpc.handle('status', () => manager.status());
    api.rpc.handle('connect', (address, options) => manager.connect(address, options || {}));
    api.rpc.handle('createRoom', (options) => manager.createRoom(options || {}));
    api.rpc.handle('leave', (options) => manager.leave(options || {}));
    api.rpc.handle('discover', () => manager.discover());
    api.rpc.handle('probe', (address) => manager.probe(address));
    api.rpc.handle('diagnose', (address, options) => manager.diagnose(address, options || {}));
    api.rpc.handle('sendOperation', (action, payload, source, operationId) => (
        manager.request(action, payload || {}, source || 'local', operationId || '')
    ));
    api.rpc.handle('getProfile', () => manager.getProfile());
    api.rpc.handle('saveProfile', (profile) => manager.saveProfile(profile || {}));
    api.rpc.handle('listSaved', () => manager.listSaved());
    api.rpc.handle('saveServer', (server) => manager.saveServer(server || {}));
    api.rpc.handle('deleteServer', (id) => manager.deleteServer(id));

    api.log.info(`Jiafee Together Listen ${api.manifest.version} loaded with native TCP transport (push events)`);
    return async () => {
        manager.removeListener('event', onEvent);
        await manager.close();
    };
};
