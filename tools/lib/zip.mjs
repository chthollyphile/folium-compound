// tools/lib/zip.mjs
// A minimal, deterministic zip writer for mod downloads (no dependencies).
//
// Every entry gets the same fixed timestamp and the caller's order, so the same
// files always produce the same bytes: a download's sha256 only changes when
// the mod does. Names are flagged UTF-8 (general purpose bit 11), which is how
// Folia's installer (fflate) decides to decode them as UTF-8. Entries are
// deflated unless that would not make them smaller. File bytes are stored
// exactly as given, so a signed mod still verifies after extraction.

import zlib from 'node:zlib';

// 1980-01-01 00:00:00, the earliest DOS date: a fixed, meaningless timestamp.
const DOS_TIME = 0;
const DOS_DATE = (0 << 9) | (1 << 5) | 1;
const UTF8_FLAG = 0x0800;

const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
        let c = n;
        for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table[n] = c >>> 0;
    }
    return table;
})();

export const crc32 = (bytes) => {
    let crc = 0xffffffff;
    for (let index = 0; index < bytes.length; index += 1) crc = CRC_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
};

/*
 * Builds a zip archive from `[{ name, data }]` (name: forward-slash path,
 * data: Buffer). Returns a Buffer. No zip64: callers stay far below 4 GB and
 * 65535 entries (mods are capped at 64 MB and 2000 files).
 */
export const createZip = (entries) => {
    const locals = [];
    const centrals = [];
    let offset = 0;

    for (const { name, data } of entries) {
        if (typeof name !== 'string' || name.length === 0 || name.startsWith('/') || name.split('/').includes('..')) {
            throw new Error(`unsafe zip entry name: ${name}`);
        }
        const nameBytes = Buffer.from(name, 'utf8');
        const crc = crc32(data);
        const deflated = zlib.deflateRawSync(data, { level: 9 });
        const useDeflate = deflated.length < data.length;
        const body = useDeflate ? deflated : data;
        const method = useDeflate ? 8 : 0;

        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(UTF8_FLAG, 6);
        local.writeUInt16LE(method, 8);
        local.writeUInt16LE(DOS_TIME, 10);
        local.writeUInt16LE(DOS_DATE, 12);
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(body.length, 18);
        local.writeUInt32LE(data.length, 22);
        local.writeUInt16LE(nameBytes.length, 26);
        local.writeUInt16LE(0, 28);
        locals.push(local, nameBytes, body);

        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(0x0314, 4); // made by: Unix, zip 2.0
        central.writeUInt16LE(20, 6);
        central.writeUInt16LE(UTF8_FLAG, 8);
        central.writeUInt16LE(method, 10);
        central.writeUInt16LE(DOS_TIME, 12);
        central.writeUInt16LE(DOS_DATE, 14);
        central.writeUInt32LE(crc, 16);
        central.writeUInt32LE(body.length, 20);
        central.writeUInt32LE(data.length, 24);
        central.writeUInt16LE(nameBytes.length, 28);
        central.writeUInt16LE(0, 30); // extra
        central.writeUInt16LE(0, 32); // comment
        central.writeUInt16LE(0, 34); // disk
        central.writeUInt16LE(0, 36); // internal attributes
        central.writeUInt32LE((0o100644 << 16) >>> 0, 38); // regular file, rw-r--r--
        central.writeUInt32LE(offset, 42);
        centrals.push(central, nameBytes);

        offset += local.length + nameBytes.length + body.length;
    }

    const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(0, 4);
    end.writeUInt16LE(0, 6);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(centralSize, 12);
    end.writeUInt32LE(offset, 16);
    end.writeUInt16LE(0, 20);
    return Buffer.concat([...locals, ...centrals, end]);
};

/*
 * Reads a zip written by createZip (or any plain store/deflate zip without
 * zip64) back into `[{ name, data }]`. Used by the tests and the build's own
 * round-trip check.
 */
export const readZip = (archive) => {
    const endOffset = archive.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    if (endOffset < 0) throw new Error('not a zip archive');
    const count = archive.readUInt16LE(endOffset + 10);
    let cursor = archive.readUInt32LE(endOffset + 16);
    const entries = [];
    for (let index = 0; index < count; index += 1) {
        if (archive.readUInt32LE(cursor) !== 0x02014b50) throw new Error('bad central directory');
        const method = archive.readUInt16LE(cursor + 10);
        const crc = archive.readUInt32LE(cursor + 16);
        const compressedSize = archive.readUInt32LE(cursor + 20);
        const nameLength = archive.readUInt16LE(cursor + 28);
        const extraLength = archive.readUInt16LE(cursor + 30);
        const commentLength = archive.readUInt16LE(cursor + 32);
        const localOffset = archive.readUInt32LE(cursor + 42);
        const name = archive.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
        const localNameLength = archive.readUInt16LE(localOffset + 26);
        const localExtraLength = archive.readUInt16LE(localOffset + 28);
        const start = localOffset + 30 + localNameLength + localExtraLength;
        const body = archive.subarray(start, start + compressedSize);
        const data = method === 8 ? zlib.inflateRawSync(body) : Buffer.from(body);
        if (crc32(data) !== crc) throw new Error(`crc mismatch: ${name}`);
        entries.push({ name, data });
        cursor += 46 + nameLength + extraLength + commentLength;
    }
    return entries;
};
