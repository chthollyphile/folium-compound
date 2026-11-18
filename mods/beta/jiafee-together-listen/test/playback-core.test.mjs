// Tests the public-API song matching policy and authoritative clock math.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  authoritativePosition,
  canonicalSongKey,
  findMatchingQueueItem,
  serializeTrack,
  tracksMatch,
} from '../playback-core.mjs';

test('song identity uses source plus id instead of session ref', () => {
  const left = { source: 'netease', id: '123', ref: 'session-a', title: 'A', artist: 'B' };
  const right = { source: 'netease', id: '123', ref: 'session-b', title: 'Changed', artist: 'Other' };
  assert.equal(canonicalSongKey(left), 'netease:123');
  assert.equal(canonicalSongKey(right), 'netease:123');
  assert.equal(tracksMatch(serializeTrack(left), right), true);
});

test('title and artist are the fallback only when ids are unavailable', () => {
  const remote = { trackId: 'meta:song', name: 'Song', artist: 'Artist' };
  const queue = {
    items: [
      { index: 0, song: { source: null, id: null, ref: 'one', title: 'Other', artist: 'Artist' } },
      { index: 1, song: { source: null, id: null, ref: 'two', title: 'Song', artist: 'Artist' } },
    ],
  };
  assert.equal(findMatchingQueueItem(queue, remote).index, 1);
});

test('authority position includes server clock offset only while playing', () => {
  assert.equal(authoritativePosition({ playing: false, position: 8, serverTimestamp: 1000 }, 5000), 8);
  assert.equal(authoritativePosition({ playing: true, position: 8, serverTimestamp: 2000, clockOffsetMs: 200 }, 5000), 11.2);
});
