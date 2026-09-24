// test/fixtures.mjs
// Shared test data: a real (decodable) PNG of any size, for mod introduction images.

import zlib from 'node:zlib';
import { crc32 } from '../tools/lib/zip.mjs';

const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
};

/** A solid dark grey RGB PNG of the given size. */
export const makePng = (width = 1280, height = 720) => {
    const header = Buffer.alloc(13);
    header.writeUInt32BE(width, 0);
    header.writeUInt32BE(height, 4);
    header[8] = 8; // bit depth
    header[9] = 2; // RGB
    const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, 0x22)]);
    const pixels = zlib.deflateSync(Buffer.concat(Array.from({ length: height }, () => row)));
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', header),
        chunk('IDAT', pixels),
        chunk('IEND', Buffer.alloc(0)),
    ]);
};
