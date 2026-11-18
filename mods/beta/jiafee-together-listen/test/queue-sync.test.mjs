import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QueueSync, queueEdits } from '../queue-sync.mjs';

const track = (id) => ({ trackId: `netease:${id}`, provider: 'netease', providerId: id, name: id });
const song = (id) => ({ source: 'netease', id, ref: `ref-${id}` });

function fixture(overrides = {}) {
  const calls = { resolve: [], replace: [], play: [], notices: [] };
  let version = 'v1';
  let kind = 'queue';
  let response = null;
  const playback = {
    getQueue: () => ({ version, kind, length: 0, items: [], currentIndex: -1 }),
    replaceQueue: async (songs, options) => {
      calls.replace.push({ songs, options });
      return response || { status: 'replaced', version: 'v2', length: songs.length, currentIndex: -1 };
    },
    playQueueItem: async (index, ref) => { calls.play.push({ index, ref }); return true; },
  };
  const omni = { resolveSongs: async (keys) => { calls.resolve.push(keys); return keys.map((key) => ({ status: 'found', song: song(key.id) })); } };
  const sync = new QueueSync({ playback, omni, notice: (message) => calls.notices.push(message), log: { warn() {} }, ...overrides });
  return { sync, calls, playback, omni, setVersion: (value) => { version = value; }, setKind: (value) => { kind = value; }, setResponse: (value) => { response = value; } };
}

test('51 songs resolve in 50 + 1 batches, preserving order and duplicates', async () => {
  const f = fixture();
  const queue = Array.from({ length: 50 }, (_, i) => track(String(i)));
  queue.push(track('0'));
  await f.sync.request({ queue, currentIndex: 50, currentTrackId: 'netease:0' }, { play: true });
  assert.deepEqual(f.calls.resolve.map((batch) => batch.length), [50, 1]);
  assert.equal(f.calls.replace[0].songs[50].id, '0');
  assert.deepEqual(f.calls.play, [{ index: 50, ref: 'ref-0' }]);
});

for (const status of ['not-found', 'unsupported']) {
  test(`${status} leaves existing queue alone`, async () => {
    const f = fixture();
    f.omni.resolveSongs = async () => [{ status }];
    await f.sync.request({ queue: [track('1')] });
    assert.equal(f.calls.replace.length, 0);
    assert.match(f.calls.notices[0], new RegExp(status));
  });
}

test('failed resolves retry a finite number of times', async () => {
  const f = fixture();
  f.omni.resolveSongs = async () => { f.calls.resolve.push(1); return [{ status: 'failed', code: 'network' }]; };
  await f.sync.request({ queue: [track('1')] });
  assert.equal(f.calls.resolve.length, 3);
  assert.equal(f.calls.replace.length, 0);
});

test('stale version rechecks authority and reads a new queue version', async () => {
  const f = fixture();
  let attempt = 0;
  f.playback.replaceQueue = async (songs, options) => {
    f.calls.replace.push({ songs, options });
    if (++attempt === 1) { f.setVersion('v2'); return { status: 'refused', reason: 'stale-version' }; }
    return { status: 'replaced', version: 'v3' };
  };
  await f.sync.request({ queue: [track('1')] });
  assert.deepEqual(f.calls.replace.map((call) => call.options.expectedVersion), ['v1', 'v2']);
});

test('stale ref resolves again and retries only finitely', async () => {
  const f = fixture();
  let attempt = 0;
  f.playback.replaceQueue = async (songs, options) => {
    f.calls.replace.push({ songs, options });
    return ++attempt === 1 ? { status: 'refused', reason: 'stale-ref', index: 0 } : { status: 'replaced', version: 'v2' };
  };
  await f.sync.request({ queue: [track('1')] });
  assert.equal(f.calls.resolve.length, 2);
  assert.equal(f.calls.replace.length, 2);
});

test('stale ref refreshes only the page containing the refused song', async () => {
  const f = fixture();
  let attempt = 0;
  f.playback.replaceQueue = async () => ++attempt === 1
    ? { status: 'refused', reason: 'stale-ref', index: 50 }
    : { status: 'replaced', version: 'v2' };
  await f.sync.request({ queue: Array.from({ length: 51 }, (_, i) => track(String(i))) });
  assert.deepEqual(f.calls.resolve.map((batch) => batch.length), [50, 1, 1]);
});

test('not-queueable and unknown refusal do not replace or play', async () => {
  const f = fixture();
  f.setResponse({ status: 'refused', reason: 'not-queueable', index: 0 });
  await f.sync.request({ queue: [track('1')], currentIndex: 0 }, { play: true });
  assert.equal(f.calls.play.length, 0);
  assert.match(f.calls.notices[0], /不可加入/);
  f.setResponse({ status: 'refused', reason: 'new-future-reason' });
  await f.sync.request({ queue: [track('2')] });
  for (let i = 0; i < 3; i++) await f.sync.queueChanged({ version: `v${i + 2}`, byThisMod: false });
  assert.ok(f.calls.replace.length <= 4);
  assert.match(f.calls.notices.at(-1), /停止重试/);
});

test('dispose aborts a pending resolve and prevents a later replace', async () => {
  const f = fixture();
  let resolvePending;
  let aborted = false;
  f.omni.resolveSongs = (_, { signal }) => new Promise((resolve) => {
    resolvePending = resolve;
    signal.addEventListener('abort', () => { aborted = true; resolve([]); });
  });
  const pending = f.sync.request({ queue: [track('1')] });
  f.sync.dispose();
  resolvePending([{ status: 'found', song: song('1') }]);
  await pending;
  assert.equal(aborted, true);
  assert.equal(f.calls.replace.length, 0);
});

test('transition waits for queueChanged, stage waits for queue kind to change', async () => {
  const f = fixture();
  f.setResponse({ status: 'refused', reason: 'transition' });
  await f.sync.request({ queue: [track('1')] });
  assert.equal(f.calls.replace.length, 1);
  f.setResponse({ status: 'replaced', version: 'v2' });
  await f.sync.queueChanged({ version: 'v1', byThisMod: false });
  assert.equal(f.calls.replace.length, 2);
  f.setKind('stage');
  await f.sync.request({ queue: [track('2')] });
  assert.equal(f.calls.replace.length, 2);
  f.setKind('queue');
  await f.sync.queueChanged({ version: 'v2', byThisMod: false });
  assert.equal(f.calls.replace.length, 3);
});

test('rate limit respects retry delay and dispose clears it', async () => {
  const f = fixture();
  f.setResponse({ status: 'refused', reason: 'rate-limited', retryAfterMs: 20 });
  await f.sync.request({ queue: [track('1')] });
  await f.sync.request({ queue: [track('2')] });
  await new Promise((resolve) => setTimeout(resolve, 35));
  assert.equal(f.calls.replace.at(-1).songs[0].id, '2');
  const before = f.calls.replace.length;
  f.sync.dispose();
  await new Promise((resolve) => setTimeout(resolve, 35));
  assert.equal(f.calls.replace.length, before);
});

test('own queue event is ignored; undo and index-only event are distinguished', async () => {
  const f = fixture();
  assert.equal(await f.sync.queueChanged({ version: 'v2', byThisMod: true }), false);
  assert.equal(await f.sync.queueChanged({ version: 'v1', byThisMod: false }), true);
  assert.equal(await f.sync.queueChanged({ version: 'v1', byThisMod: false }), false);
  f.setVersion('v2');
  assert.equal(await f.sync.queueChanged({ version: 'v2', byThisMod: false }), true);
});

test('empty queue is valid and never starts playback', async () => {
  const f = fixture();
  await f.sync.request({ queue: [], currentIndex: -1 }, { play: true });
  assert.deepEqual(f.calls.replace[0].songs, []);
  assert.equal(f.calls.play.length, 0);
});

test('duplicate-aware queue edits use indexes for removal', () => {
  const edits = queueEdits([track('1'), track('1'), track('2')], [track('1'), track('2'), track('2')]);
  assert.deepEqual(edits.map((edit) => edit.type), ['QUEUE_REMOVE', 'QUEUE_ADD']);
  assert.equal(edits[0].payload.index, 1);
  assert.equal(edits[0].payload.trackId, undefined);
});
