'use strict';

const assert = require('node:assert/strict');
const net = require('node:net');
const { test } = require('node:test');
const { RoomService } = require('../lib/room-service.cjs');
const {
  authorizationCodeForTarget,
  normalizeConnectTarget,
  savedServerForUi,
} = require('../lib/manager.cjs');

const code = '482731';

function upgradeStatus(port, pathname, origin) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    socket.setTimeout(2000, () => socket.destroy(new Error('upgrade timed out')));
    socket.once('connect', () => {
      const headers = [
        `GET ${pathname} HTTP/1.1`,
        `Host: 127.0.0.1:${port}`,
        'Upgrade: websocket',
        'Connection: Upgrade',
        'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==',
        'Sec-WebSocket-Version: 13',
        `Origin: ${origin}`,
        `x-mineradio-authorization: ${code}`,
        '',
        '',
      ];
      socket.write(headers.join('\r\n'));
    });
    socket.once('data', (chunk) => {
      resolve(chunk.toString('ascii').split('\r\n')[0]);
      socket.destroy();
    });
    socket.once('error', reject);
  });
}

test('every peer address requires the room code, even when LAN bypass is requested', () => {
  const service = new RoomService({
    serverId: 'auth-test', name: 'Auth Test', authorizationCode: code,
    allowLanWithoutAuthorization: true,
  });
  for (const address of ['192.168.1.42', '10.0.0.5', '100.64.1.2', '::ffff:192.168.1.42']) {
    assert.equal(service.authorizationStatus(address, ''), 401, address);
    assert.equal(service.authorizationStatus(address, code), 200, address);
  }
});

test('LAN targets and saved addresses require a six-digit room code', () => {
  const target = normalizeConnectTarget('192.168.1.42:17861');
  assert.throws(() => authorizationCodeForTarget(target, ''), /6 位授权码/);
  assert.equal(authorizationCodeForTarget(target, code), code);
  assert.equal(savedServerForUi({ address: target.displayAddress }).requiresAuthorization, true);
});

test('WebSocket upgrade rejects browser Origin on room and test endpoints', async (t) => {
  const service = new RoomService({ serverId: 'origin-test', name: 'Origin Test', authorizationCode: code });
  await service.start();
  t.after(() => service.stop());
  for (const pathname of ['/together', '/test']) {
    assert.equal(await upgradeStatus(service.port, pathname, 'https://attacker.example'), 'HTTP/1.1 403 Forbidden');
  }
});
