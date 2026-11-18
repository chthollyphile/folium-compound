import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const modRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(modRoot, 'mod.json'), 'utf8'));
const client = fs.readFileSync(path.join(modRoot, 'client.mjs'), 'utf8');
const overlay = fs.readFileSync(path.join(modRoot, 'overlay-ui.mjs'), 'utf8');
const escapedVersion = manifest.version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test('renderer dependency cache keys match the manifest version', () => {
  assert.match(client, new RegExp(`playbackSession\\.mjs\\?v=${escapedVersion}`));
  assert.match(client, new RegExp(`overlay-ui\\.mjs\\?v=${escapedVersion}`));
  assert.match(client, new RegExp(`accountSync\\.mjs\\?v=${escapedVersion}`));
  assert.match(overlay, new RegExp(`playback-core\\.mjs\\?v=${escapedVersion}`));
  assert.match(overlay, new RegExp(`styles\\.mjs\\?v=${escapedVersion}`));
});

test('the versioned overlay module provides the player-panel entry', async () => {
  const module = await import(new URL(`../overlay-ui.mjs?v=${manifest.version}`, import.meta.url));
  assert.equal(typeof module.mountTogetherPanelEntry, 'function');
});
