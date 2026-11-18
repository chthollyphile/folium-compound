'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const { test } = require('node:test');
const { once } = require('node:events');
const { TogetherListenManager } = require('../lib/manager.cjs');
const { TYPES } = require('../lib/protocol.cjs');

const silentLog = { info() {}, warn() {}, error() {} };
const patcherRoot = process.env.JIAFEE_FX_PATCHER_ROOT
    ? path.resolve(process.env.JIAFEE_FX_PATCHER_ROOT)
    : path.resolve(__dirname, '../../Jiafee-FX-Patcher');
const relayEntry = path.join(patcherRoot, 'together-relay-server', 'server.js');
const relayNodeModules = path.join(patcherRoot, 'together-relay-server', 'node_modules');

function freePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const port = server.address().port;
            server.close((error) => error ? reject(error) : resolve(port));
        });
    });
}

function nextEvent(manager, kind, predicate = () => true, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            manager.removeListener('event', listener);
            reject(new Error(`timed out waiting for ${kind}`));
        }, timeoutMs);
        const listener = (event) => {
            if (event.kind !== kind || !predicate(event)) return;
            clearTimeout(timeout);
            manager.removeListener('event', listener);
            resolve(event);
        };
        manager.on('event', listener);
    });
}

function waitForLine(stream, fragment, timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
        let output = '';
        const timeout = setTimeout(() => reject(new Error(`relay did not print ${fragment}: ${output}`)), timeoutMs);
        stream.on('data', (chunk) => {
            output += chunk.toString('utf8');
            if (!output.includes(fragment)) return;
            clearTimeout(timeout);
            resolve(output);
        });
    });
}

test('the unchanged original relay accepts two Folium TCP clients', { skip: !fs.existsSync(relayEntry) }, async (t) => {
    const port = await freePort();
    const relay = spawn(process.execPath, [relayEntry], {
        cwd: path.dirname(relayEntry),
        env: {
            ...process.env,
            NODE_PATH: relayNodeModules,
            PORT: String(port),
            HOST: '127.0.0.1',
            ROOM_NAME: 'Original Relay Smoke',
            AUTHORIZATION_CODE: '246810',
            ALLOW_LAN_WITHOUT_AUTH: 'false',
            SERVER_ID: 'original-relay-smoke',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    t.after(async () => {
        if (relay.exitCode == null) {
            relay.kill('SIGTERM');
            await once(relay, 'exit').catch(() => {});
        }
    });
    await Promise.race([
        waitForLine(relay.stdout, `listening on 127.0.0.1:${port}/tcp`),
        once(relay, 'exit').then(([code]) => { throw new Error(`relay exited early with ${code}`); }),
    ]);

    const first = new TogetherListenManager({
        persisted: { profile: { name: 'Folia A', avatar: 'default:signal' } }, persist: async () => {}, log: silentLog,
    });
    const second = new TogetherListenManager({
        persisted: { profile: { name: 'Folia B', avatar: 'default:rose' } }, persist: async () => {}, log: silentLog,
    });
    t.after(async () => { await Promise.all([first.close(), second.close()]); });

    await first.connect(`127.0.0.1:${port}`, { authorizationCode: '246810' });
    const paired = nextEvent(first, 'room-state', (event) => event.state.members.length === 2);
    await second.connect(`127.0.0.1:${port}`, { authorizationCode: '246810' });
    assert.equal((await paired).state.name, 'Original Relay Smoke');

    const received = nextEvent(first, 'message', (event) => event.text === 'relay-compatible');
    second.request(TYPES.MESSAGE_SEND, { text: 'relay-compatible', time: Date.now() });
    assert.equal((await received).text, 'relay-compatible');
});
