'use strict';

// Protocol and native-TCP integration coverage for the standalone mod.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { once } = require('node:events');
const { RoomService } = require('../lib/room-service.cjs');
const { TogetherListenManager, MAX_RECONNECT_ATTEMPTS } = require('../lib/manager.cjs');
const { TYPES, sanitizeTrack, validateEnvelope } = require('../lib/protocol.cjs');

const silentLog = { info() {}, warn() {}, error() {} };

const nextEvent = (emitter, kind, predicate = () => true, timeoutMs = 3000) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
        emitter.removeListener('event', listener);
        reject(new Error(`timed out waiting for ${kind}`));
    }, timeoutMs);
    const listener = (event) => {
        if (event.kind !== kind || !predicate(event)) return;
        clearTimeout(timer);
        emitter.removeListener('event', listener);
        resolve(event);
    };
    emitter.on('event', listener);
});

const manager = (name) => new TogetherListenManager({
    persisted: { profile: { name, avatar: 'default:signal' }, servers: [] },
    persist: async () => {},
    log: silentLog,
});

test('track and envelope validation keep the 2.3.0 wire shape', () => {
    assert.deepEqual(sanitizeTrack({ source: 'netease', id: 123, title: 'Song', artist: 'Artist' }), {
        trackId: 'netease:123', provider: 'netease', providerId: '123', name: 'Song', artist: 'Artist',
        album: '', duration: 0, cover: '', id: '123', mid: '', spotifyId: '', hash: '',
    });
    const checked = validateEnvelope({
        id: 'message-123456', operationId: 'operation-123456', senderId: 'client-a', timestamp: Date.now(),
        version: 0, action: TYPES.PLAY, source: 'local', payload: { position: 4 },
    });
    assert.equal(checked.ok, true);
    assert.equal(checked.value.type, TYPES.PLAY);
    assert.equal(validateEnvelope({ action: TYPES.PLAY, senderId: 'client-a' }).error, 'MISSING_OPERATION_ID');
    assert.equal(MAX_RECONNECT_ATTEMPTS, 3);
});

test('two native TCP clients authorize, synchronize authority and exchange chat', async (t) => {
    const service = new RoomService({
        serverId: 'test-server', name: 'Test Room', authorizationCode: '482731', port: 0,
    });
    await service.start();
    const first = manager('First');
    const second = manager('Second');
    t.after(async () => {
        await Promise.allSettled([first.close(), second.close()]);
        await service.stop();
    });
    const address = `127.0.0.1:${service.port}`;

    await assert.rejects(manager('Wrong').connect(address, { authorizationCode: '000000' }), /授权码错误/);
    await first.connect(address, { authorizationCode: '482731' });
    const pairedFirst = nextEvent(first, 'room-state', (event) => event.state.members.length === 2);
    const pairedSecond = nextEvent(second, 'room-state', (event) => event.state.members.length === 2);
    await second.connect(address, { authorizationCode: '482731' });
    await Promise.all([pairedFirst, pairedSecond]);
    assert.equal(first.status().room.members.length, 2);
    assert.equal(second.status().room.members.length, 2);

    const seeded = nextEvent(second, 'room-state', (event) => event.state.currentTrackId === 'netease:100');
    first.request(TYPES.RESYNC, {
        snapshot: {
            queue: [
                { trackId: 'netease:100', provider: 'netease', providerId: '100', name: 'One', artist: 'A' },
                { trackId: 'qq:200', provider: 'qq', providerId: '200', name: 'Two', artist: 'B' },
            ],
            currentIndex: 0,
            position: 12,
            playing: false,
            mode: 'loop',
        },
    });
    assert.equal((await seeded).state.queue.length, 2);

    const played = nextEvent(second, 'room-state', (event) => event.state.playing === true);
    first.request(TYPES.PLAY, { trackId: 'netease:100', position: 12 });
    assert.equal((await played).state.status, 'playing');

    const message = nextEvent(second, 'message', (event) => event.text === 'hello');
    first.request(TYPES.MESSAGE_SEND, { text: 'hello', time: Date.now() });
    assert.equal((await message).userId, first.clientId);

    const before = service.room.state.version;
    const operationId = 'duplicate-operation-123';
    first.request(TYPES.SEEK, { trackId: 'netease:100', position: 30 }, 'local', operationId);
    await once(first, 'event');
    first.request(TYPES.SEEK, { trackId: 'netease:100', position: 30 }, 'local', operationId);
    await new Promise((resolve) => setTimeout(resolve, 80));
    assert.equal(service.room.state.version, before + 1);
});

test('paired room stays empty until explicit first song and both READY before GO', async (t) => {
    const service = new RoomService({
        serverId: 'first-song-test', name: 'First Song', authorizationCode: '482731', port: 0,
    });
    await service.start();
    const first = manager('First');
    const second = manager('Second');
    t.after(async () => {
        await Promise.allSettled([first.close(), second.close()]);
        await service.stop();
    });
    const address = `127.0.0.1:${service.port}`;
    await first.connect(address, { authorizationCode: '482731' });
    const paired = nextEvent(first, 'room-state', (event) => event.action === 'SESSION_RESET');
    await second.connect(address, { authorizationCode: '482731' });
    const reset = (await paired).state;
    assert.deepEqual(reset.queue, []);
    assert.equal(reset.playing, false);

    const track = { trackId: 'netease:100', provider: 'netease', providerId: '100', name: 'One' };
    const seeded = nextEvent(first, 'room-state', (event) => event.action === 'RESYNC');
    first.request(TYPES.RESYNC, { snapshot: { queue: [track], currentIndex: 0, position: 0, playing: false, mode: 'loop' } });
    assert.equal((await seeded).state.playing, false);
    const preparing = nextEvent(first, 'room-state', (event) => event.action === 'NEXT');
    first.request(TYPES.NEXT, { targetTrackId: track.trackId, playing: true });
    const transition = (await preparing).state.transition;
    assert.equal(transition.phase, 'preparing');
    assert.equal(service.room.state.playing, false);
    const oneReady = nextEvent(first, 'room-state', (event) => event.action === 'READY');
    first.request(TYPES.READY, { phase: 'loaded', transitionId: transition.id, targetTrackId: track.trackId }, 'system');
    assert.equal((await oneReady).state.playing, false);
    const go = nextEvent(second, 'room-state', (event) => event.go === true);
    second.request(TYPES.READY, { phase: 'loaded', transitionId: transition.id, targetTrackId: track.trackId }, 'system');
    const started = (await go).state;
    assert.equal(started.playing, true);
    assert.equal(started.position, 0);
});

test('saved server data never contains an authorization code', async () => {
    let stored;
    const subject = new TogetherListenManager({
        persisted: {},
        persist: async (value) => { stored = value; },
        log: silentLog,
    });
    await subject.saveServer({ name: 'Relay', address: 'relay.example.com:17861', authorizationCode: '482731' });
    assert.equal(JSON.stringify(stored).includes('482731'), false);
    assert.equal(subject.listSaved()[0].address, 'relay.example.com:17861');
    await subject.close();
});

test('latest WebSocket transport admits two peers and preserves account avatar URLs', async t => {
    const service = new RoomService({ serverId: 'ws-test', name: 'WS', authorizationCode: '482731', port: 0 });
    await service.start();
    const first = manager('First'), second = manager('Second');
    t.after(async () => { await Promise.allSettled([first.close(), second.close()]); await service.stop(); });
    await first.saveProfile({ name: 'First', avatar: 'https://example.com/avatar.jpg' });
    await first.connect(`ws://127.0.0.1:${service.port}/together`, { authorizationCode: '482731' });
    const paired = nextEvent(first, 'room-state', event => event.state.members.length === 2);
    await second.connect(`ws://127.0.0.1:${service.port}/together`, { authorizationCode: '482731' });
    assert.equal((await paired).state.members.find(member => member.name === 'First').avatar, 'https://example.com/avatar.jpg');
});

test('Folium persistence failures are returned to profile callers', async () => {
    const subject = new TogetherListenManager({ persisted: {}, persist: async () => { throw new Error('storage-full'); }, log: silentLog });
    await assert.rejects(subject.saveProfile({ name: 'New' }), /storage-full/);
    await assert.rejects(subject.close(), /storage-full/);
});
