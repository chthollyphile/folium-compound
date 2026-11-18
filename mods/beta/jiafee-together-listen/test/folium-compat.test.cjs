'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const activate = require('../index.cjs');

function fakeApi(minor) {
    const handlers = new Map();
    const sent = [];
    const rpc = {
        handle(name, handler) {
            handlers.set(name, handler);
        },
    };
    if (minor >= 7) rpc.send = (name, payload) => sent.push({ name, payload });
    return {
        api: {
            host: { folium: { major: 1, minor }, folia: '0.7.21' },
            manifest: { version: '1.1.1' },
            storage: { get: async () => null, set: async () => {} },
            log: { info() {}, warn() {}, error() {} },
            rpc,
        },
        handlers,
        sent,
    };
}

test('Folium 1.6 is rejected before any handlers or resources are registered', async () => {
    const fake = fakeApi(6);
    await assert.rejects(activate(fake.api), /Folium 1.7 required/);
    assert.equal(fake.handlers.size, 0);
});

test('Folium 1.7 keeps the main-to-client push path', async () => {
    const fake = fakeApi(7);
    const dispose = await activate(fake.api);
    await fake.handlers.get('leave')({ stopHost: true });
    assert.equal(fake.sent.length, 1);
    assert.equal(fake.sent[0].name, 'event');
    assert.equal(fake.sent[0].payload.kind, 'status');
    await dispose();
});
