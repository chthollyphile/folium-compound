'use strict';

/**
 * 列出本机已安装的字体族，给设置面板里的字体选择器用。
 * 纯 Node、不引第三方包，只读需要的字节（sfnt 头部 + 表目录 + name 表），
 * 全异步，扫描期间主进程照常响应。扫描结果缓存在 api.storage（mod-data）里，
 * 24 小时或字体目录文件数变动才重扫，免得每次打开设置面板都扫几千个文件。
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const CACHE_KEY = 'fontFamilies';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_FAMILIES = 800;
const NAME_TABLE_CAP = 1024 * 1024;

/** 不是真字体族的名字，选了也只是噪音。 */
const SKIP_PATTERN = /^(\.|@|#)/;

const fontDirs = () => {
  const home = os.homedir();
  if (process.platform === 'win32') {
    return [
      path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts'),
      path.join(process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'), 'Microsoft', 'Windows', 'Fonts'),
    ];
  }
  if (process.platform === 'darwin') {
    return ['/System/Library/Fonts', '/Library/Fonts', path.join(home, 'Library', 'Fonts')];
  }
  return ['/usr/share/fonts', '/usr/local/share/fonts', path.join(home, '.fonts'), path.join(home, '.local', 'share', 'fonts')];
};

const collectFiles = async (dir, out, depth = 0) => {
  if (depth > 6 || out.length > 6000) return;
  let entries;
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(full, out, depth + 1);
    } else if (/\.(ttf|otf|ttc|otc)$/i.test(entry.name)) {
      out.push(full);
    }
  }
};

const readU16 = (buffer, offset) => buffer.readUInt16BE(offset);
const readU32 = (buffer, offset) => buffer.readUInt32BE(offset);

const readAt = async (handle, position, length) => {
  if (length <= 0) return Buffer.alloc(0);
  const buffer = Buffer.alloc(length);
  const { bytesRead } = await handle.read(buffer, 0, length, position);
  return buffer.subarray(0, bytesRead);
};

/** name 表里 nameID 1 是族名、16 是排版族名（更干净，去掉了 Bold/Italic 之类后缀）。 */
const parseNameTable = (buffer) => {
  if (buffer.length < 6) return [];
  const count = readU16(buffer, 2);
  const stringsStart = readU16(buffer, 4);
  const names = new Map();
  for (let index = 0; index < count; index += 1) {
    const record = 6 + index * 12;
    if (record + 12 > buffer.length) break;
    const platformId = readU16(buffer, record);
    const encodingId = readU16(buffer, record + 2);
    const nameId = readU16(buffer, record + 6);
    if (nameId !== 1 && nameId !== 16) continue;
    const length = readU16(buffer, record + 8);
    const offset = stringsStart + readU16(buffer, record + 10);
    if (length === 0 || offset + length > buffer.length) continue;
    let text;
    if (platformId === 3 || platformId === 0) {
      const chars = [];
      for (let i = 0; i + 1 < length; i += 2) chars.push(readU16(buffer, offset + i));
      text = String.fromCharCode(...chars);
    } else if (platformId === 1 && encodingId === 0) {
      text = buffer.toString('latin1', offset, offset + length);
    } else {
      continue;
    }
    text = text.replace(/\u0000/g, '').trim();
    if (!text) continue;
    const weight = (platformId === 3 ? 2 : 0) + (nameId === 16 ? 1 : 0);
    const existing = names.get(text);
    if (!existing || existing < weight) names.set(text, weight);
  }
  return [...names.keys()];
};

const familiesOfFile = async (file) => {
  let handle;
  try {
    handle = await fs.promises.open(file, 'r');
  } catch {
    return [];
  }
  try {
    const header = await readAt(handle, 0, 12);
    if (header.length < 12) return [];
    const magic = header.toString('latin1', 0, 4);
    const sfntOffsets = [];
    if (magic === 'ttcf') {
      const numFonts = Math.min(readU32(header, 8), 32);
      const table = await readAt(handle, 12, numFonts * 4);
      for (let index = 0; index < Math.floor(table.length / 4); index += 1) {
        sfntOffsets.push(readU32(table, index * 4));
      }
    } else if (magic === '\u0000\u0001\u0000\u0000' || magic === 'OTTO' || magic === 'true' || magic === 'typ1') {
      sfntOffsets.push(0);
    } else {
      return [];
    }

    const families = [];
    for (const sfntOffset of sfntOffsets) {
      const directoryHeader = await readAt(handle, sfntOffset, 12);
      if (directoryHeader.length < 12) continue;
      const numTables = readU16(directoryHeader, 4);
      const directory = await readAt(handle, sfntOffset + 12, numTables * 16);
      for (let index = 0; index < numTables; index += 1) {
        const record = index * 16;
        if (record + 16 > directory.length) break;
        if (directory.toString('latin1', record, record + 4) !== 'name') continue;
        const tableOffset = readU32(directory, record + 8);
        const tableLength = Math.min(readU32(directory, record + 12), NAME_TABLE_CAP);
        const table = await readAt(handle, tableOffset, tableLength);
        families.push(...parseNameTable(table));
      }
    }
    return families;
  } catch {
    return [];
  } finally {
    await handle.close().catch(() => {});
  }
};

const scan = async () => {
  const files = [];
  for (const dir of fontDirs()) await collectFiles(dir, files);

  const families = new Set();
  // 有限并发解析：逐个 await 太慢（首次加载明显卡），多开几个并行读文件/解析 name 表。
  const CONCURRENCY = 8;
  let cursor = 0;
  const worker = async () => {
    while (families.size <= MAX_FAMILIES) {
      const i = cursor;
      cursor += 1;
      if (i >= files.length) return;
      const list = await familiesOfFile(files[i]);
      for (const family of list) {
        if (SKIP_PATTERN.test(family)) continue;
        if (family.length > 60) continue;
        families.add(family);
      }
    }
  };
  const workers = [];
  const n = Math.min(CONCURRENCY, files.length);
  for (let k = 0; k < n; k += 1) workers.push(worker());
  await Promise.all(workers);

  // 同一族的 Light / SemiBold / Italic 变体很多没有排版族名，会以独立族名进来；
  // 基本名字也在的情况下把它们去掉。
  const familySet = [...families].filter((name) => {
    const match = /^(.+?)\s+(Thin|Light|Regular|Book|Medium|SemiBold|DemiBold|Bold|ExtraBold|Black|Heavy|Italic|Oblique|Condensed|Narrow)$/i.exec(name);
    return !(match && families.has(match[1]));
  });
  return familySet.sort((left, right) => left.localeCompare(right, 'zh-Hans-CN'));
};

/**
 * 返回本机字体族列表。优先用 api.storage 里 24 小时内的缓存（带文件指纹），
 * 没缓存或指纹变了就重扫并写回。扫描失败返回空数组（面板里退化成只有内置项）。
 */
const listFontFamilies = async (api, log) => {
  // 先读缓存：7 天内的缓存直接返回，连目录都不用遍历（菜单打开即秒开）。
  let cached = null;
  try {
    cached = await api.storage.get(CACHE_KEY);
  } catch {
    cached = null;
  }
  if (
    cached && Array.isArray(cached.families)
    && Date.now() - Number(cached.at) < CACHE_TTL_MS
    && cached.families.length > 0
  ) {
    return cached.families;
  }

  // 缓存过期：只做轻量的目录清点（不解析字体文件）算出文件数指纹；
  // 文件数没变就续期缓存直接返回，避免昂贵的逐字体解析。
  let fingerprint = '';
  try {
    const files = [];
    for (const dir of fontDirs()) await collectFiles(dir, files);
    fingerprint = `${files.length}`;
  } catch {
    fingerprint = '';
  }
  if (
    cached && Array.isArray(cached.families) && cached.families.length > 0
    && fingerprint !== '' && cached.fingerprint === fingerprint
  ) {
    try {
      await api.storage.set(CACHE_KEY, { at: Date.now(), families: cached.families, fingerprint });
    } catch { /* 续期失败不影响返回 */ }
    return cached.families;
  }

  const families = await scan();
  try {
    await api.storage.set(CACHE_KEY, { at: Date.now(), families, fingerprint });
  } catch (error) {
    log && log.warn ? log.warn('[desktop-lyric] 字体列表写缓存失败', error) : null;
  }
  return families;
};

module.exports = { listFontFamilies };
