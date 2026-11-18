import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PlaybackSession } from '../playbackSession.mjs';
import { getLocalUserProfile } from '../accountSync.mjs';
import { FoliaTogetherBridge } from '../client.mjs';
import { createRequire } from 'node:module';
const { AuthoritativeRoom } = createRequire(import.meta.url)('../lib/authoritative-room.cjs');

// The previous bridge assertions are preserved in the pre-rebuild backup.
// These tests exercise the replacement at the protocol/host behavior boundary.
function fixture() {
    let state = { song: { source: 'netease', id: 'old', ref: 'old' }, position: 34, state: 'playing', duration: 100 };
    let items = [{ index: 0, song: state.song }], version = 1;
    const calls = [];
    const host = {
        getState: () => ({ ...state }),
        getQueue: () => ({ items, length: items.length, version: String(version), kind: 'queue', currentIndex: 0 }),
        pause: () => { calls.push('pause'); state.state = 'paused'; },
        play: () => { calls.push('play'); state.state = 'playing'; },
        // Official Folia seekMainAudio resumes a paused deck and cancels a pending pause.
        seek: position => { calls.push(['seek', position]); state.position = position; state.state = 'playing'; },
        getLoopMode: () => 'all', setLoopMode() {},
        replaceQueue: async songs => {
            items = songs.map((song, index) => ({ index, song })); version++;
            return { status: 'replaced', version: String(version), length: items.length };
        },
        playQueueItem: async index => { state.song = items[index].song; state.state = 'playing'; return true; }
    };
    const errors = [];
    const folium = { playback: host, omni: { resolveSongs: async keys => keys.map(key => ({ status: 'found', song: { ...key, ref: key.id } })) },
        log: { warn() {} }, ui: { toast() {} } };
    const sent = [];
    const session = new PlaybackSession(folium, (...args) => { sent.push(args); }, error => errors.push(error));
    return { session, folium, calls, sent, errors, select: song => { state.song = song; state.state = 'playing'; items = [{ index: 0, song }]; version++; } };
}
const room = (extra = {}) => ({ serverId: 'test', sessionEpoch: 2, version: 1, members: [{ senderId: 'a' }, { senderId: 'b' }],
    queue: [], currentIndex: -1, currentTrackId: '', playing: false, position: 0, mode: 'loop', lastAction: 'SESSION_RESET', ...extra });

test('solo room never takes control; pairing clears queue and pauses once', async t => {
    const f = fixture(); t.after(() => f.session.dispose());
    await f.session.accept({ state: room({ members: [{ senderId: 'a' }] }) }, true, 'a');
    assert.equal(f.calls.length, 0);
    await f.session.accept({ state: room() }, true, 'a');
    assert.equal(f.folium.playback.getState().state, 'paused');
    assert.equal(f.folium.playback.getQueue().length, 0);
    const count = f.calls.length;
    await f.session.accept({ state: room(), metadataOnly: true }, true, 'a');
    assert.equal(f.calls.length, count);
});
test('empty paired queue events do not resurrect the old song', async t => {
    const f = fixture(); t.after(() => f.session.dispose());
    await f.session.accept({ state: room() }, true, 'a');
    await f.session.queueChanged({ version: 'external', byThisMod: false });
    assert.equal(f.sent.length, 0);
});
test('explicit selection seeds one paused song then NEXT playing, once', async t => {
    const f = fixture(); t.after(() => f.session.dispose());
    await f.session.accept({ state: room() }, true, 'a');
    const song = { source: 'netease', id: 'new', ref: 'new' };
    f.select(song);
    await Promise.all([f.session.song(song), f.session.song(song)]);
    assert.deepEqual(f.sent.map(item => item[0]), ['RESYNC', 'NEXT']);
    assert.equal(f.sent[0][1].snapshot.position, 0);
    assert.equal(f.sent[0][1].snapshot.playing, false);
    assert.equal(f.sent[1][1].playing, true);
    assert.equal(f.folium.playback.getState().state, 'paused');
});
test('two replacement sessions reach GO only after both prepare; stale authority cannot rewind', async t => {
    const a = fixture(), b = fixture(); t.after(() => { a.session.dispose(); b.session.dispose(); });
    const authority = new AuthoritativeRoom({ serverId: 'test', name: 'Test' });
    authority.setMembers([{ senderId: 'a' }, { senderId: 'b' }]);
    authority.resetForNewPair();
    await Promise.all([a.session.accept({ state: authority.snapshot() }, true, 'a'), b.session.accept({ state: authority.snapshot() }, true, 'b')]);
    const track = { trackId: 'netease:new', provider: 'netease', providerId: 'new', name: 'New' };
    const apply = (type, payload, senderId, operationId) => authority.apply({ type, payload, senderId, operationId, stateVersion: authority.state.version });
    apply('RESYNC', { snapshot: { queue: [track], currentIndex: 0, playing: false, position: 0 } }, 'a', 'seed');
    apply('NEXT', { targetTrackId: track.trackId, playing: true }, 'a', 'next');
    const preparing = authority.snapshot();
    await a.session.accept({ state: preparing, operationId: 'next' }, true, 'a');
    assert.equal(a.sent[0][0], 'READY');
    assert.equal(a.folium.playback.getState().position, 0);
    apply('READY', a.sent[0][1], 'a', 'ready-a');
    assert.equal(authority.state.playing, false);
    await b.session.accept({ state: preparing, operationId: 'next' }, true, 'b');
    apply('READY', b.sent[0][1], 'b', 'ready-b');
    assert.equal(authority.state.playing, true);
    const go = authority.snapshot();
    await Promise.all([a.session.accept({ state: go, operationId: 'ready-b' }, true, 'a'), b.session.accept({ state: go, operationId: 'ready-b' }, true, 'b')]);
    assert.equal(a.folium.playback.getState().state, 'playing');
    assert.equal(b.folium.playback.getState().state, 'playing');
    await a.session.accept({ state: preparing }, true, 'a');
    assert.equal(a.session.room.version, go.version);
    assert.equal(a.folium.playback.getState().state, 'playing');
    assert.deepEqual(a.errors, []); assert.deepEqual(b.errors, []);
});
test('disconnect cancels correction timer and pending intent', async t => {
    const f = fixture(); t.after(() => f.session.dispose());
    await f.session.accept({ state: room() }, true, 'a');
    assert.ok(f.session.timer);
    f.session.disconnect(true);
    assert.equal(f.session.timer, null);
    assert.equal(f.session.core.connected, false);
});

test('resume during authority work is retained and never corrected back to paused position', async t => {
    const f = fixture(); t.after(() => f.session.dispose());
    await f.session.accept({ state: room() }, true, 'a');
    const paused = room({ version: 2, lastAction: 'PAUSE', currentTrackId: 'netease:old', currentIndex: 0,
        queue: [{ trackId: 'netease:old', provider: 'netease', providerId: 'old' }], position: 34 });
    await f.session.accept({ state: paused }, true, 'a');
    f.folium.playback.seek(34);
    f.folium.playback.play();
    let finish;
    f.session.core.executing = true;
    f.session.core.execution = new Promise(resolve => { finish = () => { f.session.core.executing = false; resolve(); }; });
    const intent = f.session.state('playing');
    finish();
    await intent;
    assert.equal(f.sent.filter(item => item[0] === 'PLAY').length, 1);
    assert.equal(f.sent.find(item => item[0] === 'PLAY')[1].position, 34);
    const seeks = f.calls.filter(item => Array.isArray(item) && item[0] === 'seek').length;
    f.session.core.correctProgress({ ...paused, position: 0 });
    assert.equal(f.calls.filter(item => Array.isArray(item) && item[0] === 'seek').length, seeks);
    assert.equal(f.folium.playback.getState().position, 34);
    const play = f.sent.find(item => item[0] === 'PLAY');
    await f.session.accept({ state: { ...paused, version: 3, lastAction: 'PLAY', playing: true,
        serverTimestamp: Date.now() }, operationId: play[3], acceptedSenderId: 'a' }, true, 'a');
    assert.equal(f.session.core.pendingPredictions.size, 0);
    assert.equal(f.folium.playback.getState().position, 34);
    assert.equal(f.calls.filter(item => Array.isArray(item) && item[0] === 'seek').length, seeks);
});

test('a queued resume is cancelled by a later pause or disconnection', async t => {
    const f = fixture(); t.after(() => f.session.dispose());
    await f.session.accept({ state: room() }, true, 'a');
    const paused = room({ version: 2, lastAction: 'PAUSE', currentTrackId: 'netease:old', currentIndex: 0,
        queue: [{ trackId: 'netease:old', provider: 'netease', providerId: 'old' }], position: 34 });
    await f.session.accept({ state: paused }, true, 'a');
    let finish;
    f.session.core.execution = new Promise(resolve => { finish = resolve; });
    f.folium.playback.play();
    const play = f.session.state('playing');
    f.folium.playback.pause();
    await f.session.state('paused');
    finish(); await play;
    assert.equal(f.sent.length, 0);
    f.session.core.execution = new Promise(resolve => { finish = resolve; });
    f.folium.playback.play();
    const disconnectedPlay = f.session.state('playing');
    f.session.disconnect(true);
    finish(); await disconnectedPlay;
    assert.equal(f.sent.length, 0);
});

test('progress correction cannot seek a locally resumed player against paused authority', async t => {
    const f = fixture(); t.after(() => f.session.dispose());
    f.session.core.setConnection(true, 'a');
    f.session.core.machine.transition({ status: 'playing', trackId: 'netease:old', version: 1 });
    f.session.core.correctProgress(room({ currentTrackId: 'netease:old', position: 0, playing: false }));
    assert.equal(f.folium.playback.getState().position, 34);
    assert.equal(f.calls.length, 0);
});
test('account priority, logout fallback, avatar safety and no installation key disclosure', () => {
    const accounts = {
        netease: { status: 'signed-in', user: { nickname: 'N', avatarUrl: 'https://example.com/n.jpg' }, accountKey: 'private' },
        qq: { status: 'signed-in', user: { nickname: 'Q', avatarUrl: 'javascript:bad' } }
    };
    const api = { account: { getState: id => accounts[id] } };
    assert.deepEqual(getLocalUserProfile(api), { name: 'N', avatar: 'https://example.com/n.jpg' });
    accounts.netease.status = 'signed-out';
    assert.deepEqual(getLocalUserProfile(api), { name: 'Q', avatar: 'default:signal' });
    accounts.qq.status = 'signed-out';
    assert.equal(getLocalUserProfile(api).name, '未登录用户');
});
test('profile refresh publishes changed account presentation without a second login', async () => {
    const calls = [];
    const f = fixture();
    f.folium.account = { getState: id => id === 'netease' ? { status: 'signed-in', user: { nickname: 'New', avatarUrl: 'https://example.com/a' } } : null };
    f.folium.rpc = { call: async (...args) => { calls.push(args); return args[1]; } };
    const bridge = new FoliaTogetherBridge(f.folium);
    bridge.status.connectionState = 'connected';
    await bridge.refreshProfile(); await bridge.refreshProfile();
    assert.equal(calls.filter(item => item[0] === 'saveProfile').length, 1);
    assert.equal(calls.filter(item => item[0] === 'sendOperation').length, 1);
    bridge.dispose(); f.session.dispose();
});
