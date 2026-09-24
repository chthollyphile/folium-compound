// test/image.test.mjs
// Introduction images: the header reader recognizes PNG, JPEG and WebP (and
// nothing else), and checkPreview enforces the market's rules.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { checkPreview, readImageInfo } from '../tools/lib/image.mjs';
import { makePng } from './fixtures.mjs';

// Minimal headers: only what readImageInfo reads.
const jpegHeader = (width, height) => Buffer.from([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
    0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
]);
const webpVp8x = (width, height) => {
    const bytes = Buffer.alloc(30);
    bytes.write('RIFF', 0, 'ascii');
    bytes.write('WEBP', 8, 'ascii');
    bytes.write('VP8X', 12, 'ascii');
    bytes.writeUIntLE(width - 1, 24, 3);
    bytes.writeUIntLE(height - 1, 27, 3);
    return bytes;
};

test('reads the format and size from PNG, JPEG and WebP headers', () => {
    assert.deepEqual(readImageInfo(makePng(1280, 720)), { format: 'png', width: 1280, height: 720 });
    assert.deepEqual(readImageInfo(jpegHeader(1920, 1080)), { format: 'jpeg', width: 1920, height: 1080 });
    assert.deepEqual(readImageInfo(webpVp8x(1280, 720)), { format: 'webp', width: 1280, height: 720 });
    assert.equal(readImageInfo(Buffer.from('GIF89a......')), null);
    assert.equal(readImageInfo(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')), null);
});

test('checkPreview enforces presence, real format, size and shape', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'folium-preview-'));
    const write = (name, bytes) => fs.writeFileSync(path.join(dir, name), bytes);
    write('good.png', makePng(1280, 720));
    write('fake.jpg', makePng(1280, 720));
    write('square.png', makePng(800, 800));
    write('small.png', makePng(480, 270));
    write('huge.png', Buffer.concat([makePng(1280, 720), Buffer.alloc(1024 * 1024)]));

    assert.deepEqual(checkPreview(dir, { preview: 'good.png' }), { errors: [], info: { file: 'good.png', format: 'png', width: 1280, height: 720, bytes: fs.statSync(path.join(dir, 'good.png')).size } });
    assert.match(checkPreview(dir, {}).errors[0], /缺少 `preview`/);
    assert.match(checkPreview(dir, { preview: 'missing.png' }).errors[0], /不存在/);
    assert.match(checkPreview(dir, { preview: '../good.png' }).errors[0], /不存在/);
    assert.match(checkPreview(dir, { preview: 'fake.jpg' }).errors.join(), /与扩展名不符/);
    assert.match(checkPreview(dir, { preview: 'square.png' }).errors.join(), /16:9/);
    assert.match(checkPreview(dir, { preview: 'small.png' }).errors.join(), /太小/);
    assert.match(checkPreview(dir, { preview: 'huge.png' }).errors.join(), /过大/);
});
