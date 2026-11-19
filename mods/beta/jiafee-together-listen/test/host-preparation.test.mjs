import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FoliumPlayerAdapter } from '../foliumPlayerAdapter.mjs';
import { PlaybackSession } from '../playbackSession.mjs';

// Model official 0.7.28 seekMainAudio and the 200ms + 15ms deferred media pause.
function fixture(t, { refusesPause = false } = {}) {
    const song = { source: 'netease', id: 'test', ref: 'test' };
    let state = 'playing', position = 21, advancingSince = Date.now(), pauseTimer;
    let queue = [{ index: 0, song }], queueVersion = 1, muted = false;
    const calls = [];
    const readPosition = () => position + (advancingSince === null ? 0 : (Date.now() - advancingSince) / 1000);
    const host = {
        getState: () => ({ song, state, position: readPosition(), duration: 240 }),
        getQueue: () => ({ items: queue, length: queue.length, currentIndex: queue.length ? 0 : -1, version: String(queueVersion) }),
        replaceQueue: async songs => {
            queue = songs.map((item, index) => ({ index, song: item }));
            return { status: 'replaced', length: queue.length, version: String(++queueVersion) };
        },
        getLoopMode: () => 'all', setLoopMode() {},
        getVolume: () => ({ volume: 0.7, muted }),
        setMuted: value => { muted = value; calls.push(['muted', value]); },
        seek: value => {
            clearTimeout(pauseTimer); position = value; advancingSince = Date.now(); state = 'playing';
            calls.push(['seek', value]); return true;
        },
        pause: () => {
            calls.push(['pause']);
            if (refusesPause) return false;
            state = 'paused';
            if (!pauseTimer) pauseTimer = setTimeout(() => {
                position = readPosition(); advancingSince = null; pauseTimer = null;
            }, 215);
            return true;
        },
        play: () => { clearTimeout(pauseTimer); pauseTimer = null; state = 'playing'; advancingSince = Date.now(); return true; }
    };
    // Clearing a cancelled fade also clears its ownership, just like takePending() in the host.
    const seek = host.seek;
    host.seek = value => { const result = seek(value); pauseTimer = null; return result; };
    const folium = { playback: host, omni: {}, ui: { toast() {} }, log: { warn() {} } };
    t.after(() => clearTimeout(pauseTimer));
    return { folium, host, calls, setPosition: value => { position = value; advancingSince = null; } };
}

test('the second member clears both current songs and local queues once', async t => {
    const sessions = [true, { ok: true }].map(result => {
        const f = fixture(t), read = f.host.getState, errors = [];
        let cleared = false;
        f.host.getState = () => cleared ? { song: null, state: 'stopped', position: 0 } : read();
        f.host.clearCurrent = () => {
            cleared = true;
            f.calls.push(['clearCurrent']);
            return result;
        };
        const session = new PlaybackSession(f.folium, () => assert.fail('no playback command expected'), error => errors.push(error));
        t.after(() => session.dispose());
        return { ...f, session, errors };
    });
    const owner = { senderId: 'owner' }, guest = { senderId: 'guest' };
    const idle = { serverId: 'room', sessionEpoch: 1, version: 2, status: 'idle',
        members: [owner, guest], queue: [], currentIndex: -1, currentTrackId: '', playing: false, position: 0 };

    await sessions[0].session.accept({ state: { ...idle, version: 1, members: [owner] } }, true, owner.senderId);
    assert.deepEqual(sessions[0].calls, []);
    assert.equal(sessions[0].host.getQueue().length, 1);
    for (const [index, f] of sessions.entries()) {
        const { senderId } = idle.members[index];
        await f.session.accept({ action: 'SESSION_RESET', state: idle }, true, senderId);
        await f.session.accept({ state: { ...idle, version: 3 } }, true, senderId);
        assert.deepEqual(f.calls, [['clearCurrent']]);
        assert.deepEqual(f.host.getState(), { song: null, state: 'stopped', position: 0 });
        assert.deepEqual(f.host.getQueue(), { items: [], length: 0, currentIndex: -1, version: '2' });
        assert.equal(f.session.core.machine.state.status, 'idle');
        assert.deepEqual(f.errors, []);
    }
});

test('legacy and refused clears reset the queue and ignore the previous song until a new selection', async t => {
    for (const clearCurrent of [undefined, () => false]) {
        const f = fixture(t), sent = [], notices = [];
        f.host.clearCurrent = clearCurrent;
        f.folium.ui.toast = message => notices.push(message);
        const session = new PlaybackSession(f.folium, action => { sent.push(action); }, assert.fail);
        t.after(() => session.dispose());
        const room = { serverId: 'room', sessionEpoch: 1, version: 1, status: 'idle',
            members: [{ senderId: 'a' }, { senderId: 'b' }], queue: [], currentIndex: -1,
            currentTrackId: '', playing: false, position: 0 };
        const song = f.host.getState().song;
        assert.equal(session.isWaitingForFirstTrack(), false);
        await session.accept({ state: room }, true, 'a');
        assert.equal(session.isWaitingForFirstTrack(), true);
        assert.deepEqual(f.calls, [['seek', 0], ['pause']]);
        assert.equal(f.host.getQueue().length, 0);
        assert.equal(session.core.machine.state.position, 0);
        f.host.play();
        await session.state('playing');
        assert.equal(f.host.getState().state, 'paused');
        f.host.play();
        await session.state('playing');
        assert.equal(f.host.getState().state, 'paused');
        assert.deepEqual(notices, ['请选择第一首歌']);
        await session.song(song);
        assert.deepEqual(sent, []);

        session.beforePlay({ song, cancel: () => assert.fail('the first selection should be allowed') });
        assert.equal(session.isWaitingForFirstTrack(), false);
        await session.song(song);
        assert.deepEqual(sent, ['RESYNC', 'NEXT']);
    }
});

test('prepare survives seek-resumes and waits for the actual pause fade to settle', async t => {
    const f = fixture(t), adapter = new FoliumPlayerAdapter(f.folium, () => null);
    t.after(() => adapter.dispose());
    const begin = Date.now();
    assert.equal(await adapter.waitUntilReady('netease:test', () => true), true);
    assert.ok(Date.now() - begin >= 250, 'transport PAUSED alone must not send READY during the fade');
    assert.equal(f.host.getState().state, 'paused');
    const stoppedAt = f.host.getState().position;
    assert.ok(stoppedAt >= 0.2 && stoppedAt <= 0.5);
    await new Promise(resolve => setTimeout(resolve, 75));
    assert.equal(f.host.getState().position, stoppedAt);
    assert.deepEqual(f.calls, [['seek', 0], ['pause']], 'no repeated seeks that restart playback');
});

test('cancelled preparation cannot report ready or issue further playback operations', async t => {
    const f = fixture(t), adapter = new FoliumPlayerAdapter(f.folium, () => null);
    t.after(() => adapter.dispose());
    const pending = adapter.waitUntilReady('netease:test', () => true);
    adapter.cancelPendingWait();
    const count = f.calls.length;
    assert.equal(await pending, false);
    assert.equal(f.calls.length, count);
});

test('late playback after the first pause is brought back to zero before READY', async t => {
    const f = fixture(t), adapter = new FoliumPlayerAdapter(f.folium, () => null);
    t.after(() => adapter.dispose());
    const originalRead = f.host.getState;
    let restarted = false;
    const lateStart = setTimeout(() => {
        restarted = true;
        f.host.seek(0.9);
    }, 420);
    t.after(() => clearTimeout(lateStart));
    const begin = Date.now();
    assert.equal(await adapter.waitUntilReady('netease:test', () => true), true);
    assert.equal(restarted, true, 'the host must be observed after its late start');
    assert.ok(Date.now() - begin >= 700, 'READY needs a sustained quiet window');
    assert.equal(originalRead().state, 'paused');
    assert.ok(originalRead().position <= 0.5);
    assert.equal(f.calls.filter(call => call[0] === 'seek').length, 3,
        'one late host seek plus one bounded recovery seek');
});

test('a host that refuses pause never reports ready', async t => {
    const f = fixture(t, { refusesPause: true }), adapter = new FoliumPlayerAdapter(f.folium, () => null);
    t.after(() => adapter.dispose());
    adapter.preparationTimeoutMs = 900;
    assert.equal(await adapter.waitUntilReady('netease:test', () => true), false);
    assert.equal(f.host.getState().state, 'playing');
});

test('wrong track cannot report ready', async t => {
    const f = fixture(t), adapter = new FoliumPlayerAdapter(f.folium, () => null);
    t.after(() => adapter.dispose());
    assert.equal(await adapter.waitUntilReady('netease:other', () => true), false);
    assert.deepEqual(f.calls, [], 'do not seek an unrelated current song');
});

test('a paused label with a moving media clock cannot report ready', async t => {
    const f = fixture(t, { refusesPause: true });
    const read = f.host.getState;
    f.host.getState = () => ({ ...read(), state: 'paused' });
    const adapter = new FoliumPlayerAdapter(f.folium, () => null);
    t.after(() => adapter.dispose());
    adapter.preparationTimeoutMs = 900;
    assert.equal(await adapter.waitUntilReady('netease:test', () => true), false);
});

test('prepared GO removes fade drift once; subsequent PLAY does not rewind', async t => {
    const f = fixture(t), sent = [], errors = [];
    const session = new PlaybackSession(f.folium, (...args) => sent.push(args), error => errors.push(error));
    t.after(() => session.dispose());
    const preparing = { serverId: 'test', sessionEpoch: 1, version: 2,
        members: [{ senderId: 'a' }, { senderId: 'b' }],
        queue: [{ trackId: 'netease:test', provider: 'netease', providerId: 'test' }],
        currentIndex: 0, currentTrackId: 'netease:test', playing: false, position: 0,
        transition: { id: 'next-1', phase: 'preparing' } };
    session.core.appliedSessionKey = 'test:1';
    await session.accept({ state: preparing }, true, 'a');
    assert.deepEqual(errors, []);
    assert.equal(sent.filter(item => item[0] === 'READY').length, 1);
    assert.equal(f.host.getState().state, 'paused');
    assert.equal(f.host.getVolume().muted, true, 'remain muted after READY');
    await session.accept({ state: { ...preparing, version: 3 }, action: 'READY' }, true, 'a');
    assert.equal(f.calls.filter(item => item[0] === 'seek').length, 1, 'READY feedback must not restart preparation');
    assert.equal(sent.filter(item => item[0] === 'READY').length, 1);
    assert.equal(f.host.getVolume().muted, true);
    const go = { ...preparing, version: 4, playing: true, lastAction: 'GO',
        transition: { id: 'next-1', phase: 'go' }, serverTimestamp: Date.now() };
    await session.accept({ state: go }, true, 'a');
    assert.equal(f.host.getState().state, 'playing');
    assert.ok(f.host.getState().position < 0.1, 'GO must remove the pause fade offset');
    assert.equal(f.calls.filter(item => item[0] === 'seek').length, 2);
    assert.equal(f.host.getVolume().muted, false);
    assert.deepEqual(f.calls.slice(-2).map(call => call[0]), ['seek', 'muted'], 'restore output only after starting playback');
    f.setPosition(34);
    await session.accept({ state: { ...go, version: 5, lastAction: 'PLAY', position: 34,
        serverTimestamp: Date.now() } }, true, 'a');
    assert.equal(f.calls.filter(item => item[0] === 'seek').length, 2);
    assert.equal(f.host.getState().position, 34);
});

test('an unexpected GO keeps playback muted while waiting for local media preparation', async t => {
    const f = fixture(t), errors = [];
    const session = new PlaybackSession(f.folium, assert.fail, error => errors.push(error));
    t.after(() => session.dispose());
    const go = { serverId: 'test', sessionEpoch: 1, version: 2, members: [{ senderId: 'a' }, { senderId: 'b' }],
        queue: [{ trackId: 'netease:test', provider: 'netease', providerId: 'test' }], currentIndex: 0,
        currentTrackId: 'netease:test', playing: true, position: 0, serverTimestamp: Date.now(),
        transition: { id: 'early-go', phase: 'go' } };
    const acceptance = session.accept({ state: go }, true, 'a');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.host.getVolume().muted, true);
    assert.equal(f.host.getState().state, 'paused');
    await acceptance;
    assert.equal(f.host.getVolume().muted, false);
    assert.equal(f.host.getState().state, 'playing');
    assert.deepEqual(errors, []);
});

test('aborted preparation restores owned mute after pausing and preserves pre-existing mute', async t => {
    const f = fixture(t), adapter = new FoliumPlayerAdapter(f.folium, () => null);
    t.after(() => adapter.dispose());
    adapter.holdPreparationAudio();
    adapter.abortPreparationAudio();
    assert.equal(f.host.getVolume().muted, true);
    assert.equal(f.host.getState().state, 'paused');
    await new Promise(resolve => setTimeout(resolve, 275));
    assert.equal(f.host.getVolume().muted, false);
    f.host.setMuted(true);
    const count = f.calls.length;
    adapter.holdPreparationAudio();
    adapter.releasePreparationAudio();
    assert.equal(f.host.getVolume().muted, true);
    assert.equal(f.calls.length, count);
});

test('a new song that starts before playQueueItem resolves is paused immediately', async t => {
    const target = { source: 'netease', id: 'target', ref: 'target' };
    let song = { source: 'netease', id: 'old', ref: 'old' };
    let state = 'playing', resolvedAt = 0;
    const pauseTimes = [];
    const timers = [];
    const host = {
        getQueue: () => ({ items: [{ index: 0, song: target }] }),
        getState: () => ({ song, state, position: 0 }),
        playQueueItem: () => new Promise(resolve => {
            timers.push(setTimeout(() => { song = target; state = 'playing'; }, 30));
            timers.push(setTimeout(() => { resolvedAt = Date.now(); resolve(true); }, 350));
        }),
        pause: () => { if (song === target) { pauseTimes.push(Date.now()); state = 'paused'; } },
    };
    t.after(() => timers.forEach(clearTimeout));
    const adapter = new FoliumPlayerAdapter({ playback: host, omni: {}, ui: { toast() {} }, log: { warn() {} } }, () => null);
    t.after(() => adapter.dispose());
    assert.equal(await adapter.switchTrack({ currentIndex: 0, currentTrackId: 'netease:target' }), true);
    assert.ok(pauseTimes.some(at => at < resolvedAt - 150), 'pause must occur while Folia is still loading the selection');
});

test('target lyrics are held during READY and refreshed only after local GO', () => {
    let refreshes = 0;
    const folium = { playback: {}, omni: {}, lyrics: { refresh() { refreshes++; } },
        ui: { toast() {} }, log: { warn() {} } };
    const session = new PlaybackSession(folium, async () => {}, () => {});
    session.core.setConnection(true, 'local');
    session.room = { currentTrackId: 'netease:target', playing: false,
        transition: { id: 't1', phase: 'preparing' } };
    const event = { song: { source: 'netease', id: 'target' }, lines: [{ fullText: 'new lyric' }] };
    session.transformLyrics(event);
    assert.deepEqual(event.lines, []);
    assert.equal(refreshes, 0);
    session.room = { ...session.room, playing: true, transition: { id: 't1', phase: 'go' } };
    session.core.machine.transition({ trackId: 'netease:target', status: 'playing', version: 1 });
    assert.equal(refreshes, 1);
    session.dispose();
});

test('the initiating peer pauses a newly selected song before room authority arrives', async t => {
    const target = { source: 'netease', id: 'target', ref: 'target' };
    let current = { source: 'netease', id: 'old', ref: 'old' };
    let state = 'playing', pauseCount = 0;
    const host = {
        getState: () => ({ song: current, state, position: 0 }),
        pause: () => { if (current === target) { pauseCount++; state = 'paused'; } },
    };
    let refreshes = 0;
    const folium = { playback: host, omni: {}, lyrics: { refresh() { refreshes++; } },
        ui: { toast() {} }, log: { warn() {} } };
    const session = new PlaybackSession(folium, async () => {}, () => {});
    t.after(() => session.dispose());
    session.core.setConnection(true, 'local');
    session.gate.setPaired(true);
    session.room = { currentTrackId: 'netease:old', transition: null };
    const event = { song: target, cancelled: false, cancel() { this.cancelled = true; } };
    session.beforePlay(event);
    assert.equal(event.cancelled, false);
    assert.equal(session.isSwitching(), true);
    const lyrics = { song: target, lines: [{ fullText: 'new lyric' }] };
    session.transformLyrics(lyrics);
    assert.deepEqual(lyrics.lines, [], 'local lyrics stay hidden before room authority arrives');
    session.core.setConnection(false);
    session.core.setConnection(true, 'local');
    assert.equal(refreshes, 0, 'local prediction reset must not reveal lyrics before GO');
    current = target;
    await new Promise(resolve => setTimeout(resolve, 110));
    assert.ok(pauseCount > 0, 'local selection must be paused before the room transition starts');
    session.room = { currentTrackId: 'netease:target', playing: true,
        transition: { id: 't1', phase: 'go' } };
    session.stopSelectionGuard();
    state = 'playing';
    await new Promise(resolve => setTimeout(resolve, 70));
    assert.equal(state, 'playing', 'the guard must release before GO starts playback');
});

test('an old GO snapshot cannot release the new selection pause guard', async t => {
    const oldSong = { source: 'netease', id: 'old', ref: 'old' };
    const folium = { playback: { getState: () => ({ song: oldSong, state: 'playing', position: 0 }),
        pause() {} }, omni: {}, ui: { toast() {} }, log: { warn() {} } };
    const session = new PlaybackSession(folium, async () => {}, () => {});
    t.after(() => session.dispose());
    session.core.setConnection(true, 'a');
    session.gate.setPaired(true);
    session.room = { serverId: 'room', sessionEpoch: 1, version: 1,
        currentTrackId: 'netease:old', playing: true, transition: { id: 'old-go', phase: 'go' } };
    session.core.machine.transition({ trackId: 'netease:old', status: 'playing', version: 1 });
    session.beforePlay({ song: { source: 'netease', id: 'new', ref: 'new' }, cancel() {} });
    session.pendingTrack = 'netease:new';
    await session.accept({ state: { ...session.room, version: 2,
        members: [{ senderId: 'a' }, { senderId: 'b' }] } }, true, 'a');
    assert.equal(session.selectionGuard?.trackId, 'netease:new');
});
