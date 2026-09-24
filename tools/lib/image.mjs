// tools/lib/image.mjs
// Mod introduction images (`preview` in mod.json): reading their real format
// and size from the file header, and the rules every mod in this repository
// must meet. The market page shows the image at the top of the mod's card in a
// 16:9 frame, so the rules ask for roughly that shape.

import fs from 'node:fs';
import path from 'node:path';

export const PREVIEW_RULES = {
    maxBytes: 1024 * 1024,
    minWidth: 640,
    minHeight: 360,
    // Around 16:9 (1.78); the card crops to 16:9, so this keeps the crop small.
    minAspect: 1.5,
    maxAspect: 2.0,
};

const EXTENSION_FORMATS = { '.png': 'png', '.jpg': 'jpeg', '.jpeg': 'jpeg', '.webp': 'webp' };

/*
 * `{ format, width, height }` from a PNG, JPEG or WebP header, or null when the
 * bytes are none of those. Only the header is read; nothing is decoded.
 */
export const readImageInfo = (bytes) => {
    if (bytes.length >= 24 && bytes.readUInt32BE(0) === 0x89504e47 && bytes.readUInt32BE(4) === 0x0d0a1a0a && bytes.toString('ascii', 12, 16) === 'IHDR') {
        return { format: 'png', width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
    }
    if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
        let offset = 2;
        while (offset + 9 < bytes.length) {
            if (bytes[offset] !== 0xff) return null;
            const marker = bytes[offset + 1];
            if (marker === 0xff) {
                offset += 1;
                continue;
            }
            const length = bytes.readUInt16BE(offset + 2);
            // SOF0-SOF15 carry the frame size; C4 (DHT), C8 (JPG) and CC (DAC) are not frames.
            if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
                return { format: 'jpeg', width: bytes.readUInt16BE(offset + 7), height: bytes.readUInt16BE(offset + 5) };
            }
            offset += 2 + length;
        }
        return null;
    }
    if (bytes.length >= 30 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') {
        const chunk = bytes.toString('ascii', 12, 16);
        if (chunk === 'VP8X') {
            return { format: 'webp', width: 1 + bytes.readUIntLE(24, 3), height: 1 + bytes.readUIntLE(27, 3) };
        }
        if (chunk === 'VP8 ') {
            return { format: 'webp', width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
        }
        if (chunk === 'VP8L' && bytes[20] === 0x2f) {
            const bits = bytes.readUInt32LE(21);
            return { format: 'webp', width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
        }
    }
    return null;
};

/*
 * Checks a mod's introduction image. Returns `{ errors, info }` where info is
 * `{ file, format, width, height, bytes }` for a readable image.
 */
export const checkPreview = (modDir, manifest) => {
    const errors = [];
    const file = manifest?.preview;
    if (typeof file !== 'string' || file.length === 0) {
        return { errors: ['mod.json 缺少 `preview`：每个模组都需要一张介绍图片（推荐 1280×720 的 PNG / JPG / WebP）'], info: null };
    }
    const absolute = path.join(modDir, ...file.split('/'));
    if (!absolute.startsWith(modDir + path.sep) || !fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
        return { errors: [`介绍图片 \`${file}\` 不存在`], info: null };
    }
    const bytes = fs.readFileSync(absolute);
    const info = readImageInfo(bytes);
    const expected = EXTENSION_FORMATS[path.extname(file).toLowerCase()];
    if (!info) return { errors: [`介绍图片 \`${file}\` 不是有效的 PNG / JPG / WebP`], info: null };
    if (info.format !== expected) errors.push(`介绍图片 \`${file}\` 的实际格式是 ${info.format}，与扩展名不符`);
    if (bytes.length > PREVIEW_RULES.maxBytes) errors.push(`介绍图片过大：${bytes.length} 字节（上限 ${PREVIEW_RULES.maxBytes}）`);
    if (info.width < PREVIEW_RULES.minWidth || info.height < PREVIEW_RULES.minHeight) {
        errors.push(`介绍图片太小：${info.width}×${info.height}（至少 ${PREVIEW_RULES.minWidth}×${PREVIEW_RULES.minHeight}，推荐 1280×720）`);
    }
    const aspect = info.width / info.height;
    if (aspect < PREVIEW_RULES.minAspect || aspect > PREVIEW_RULES.maxAspect) {
        errors.push(`介绍图片比例是 ${info.width}×${info.height}，请接近 16:9（推荐 1280×720）`);
    }
    return { errors, info: { file, ...info, bytes: bytes.length } };
};
