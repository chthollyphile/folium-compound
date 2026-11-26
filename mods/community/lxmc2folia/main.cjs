// 洛雪歌单转换 · Folium 主进程入口
//
// 只做一件事：把客户端转换好的 Folia 歌单 JSON 写进用户的「下载」文件夹。
// 不联网、不读别的文件。
//
// 安全约定：
//   - 歌单文件只接受 format === "folia-playlist" 且 version 为数字的 JSON；
//   - 文件名只取 basename，去掉路径分隔符和 Windows 非法字符；
//   - 重名时自动加 (2)、(3)… 不覆盖用户已有文件（用 wx 标志原子地创建，避免竞态）；
//   - 大小上限 8 MB（备份文件单独放宽到 64 MB）。

const fs = require('fs');
const path = require('path');

const MAX_CONTENT_BYTES = 8 * 1024 * 1024;
const MAX_SUFFIX_ATTEMPTS = 1000;

const sanitizeFileName = (raw) => {
    const base = path.basename(String(raw || '').trim()).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/^\.+/, '');
    return base || 'lxmc-playlist.folia-playlist.json';
};

/** 第 0 次用原名，第 n 次用 "(n+1)" 后缀；写失败交给调用方判断是不是重名。 */
const candidatePath = (directory, fileName, attempt) => {
    if (attempt === 0) return path.join(directory, fileName);
    const base = fileName.replace(/\.json$/i, '');
    return path.join(directory, base + ' (' + (attempt + 1) + ').json');
};

const downloadsDirectory = (api) => {
    try {
        return api.paths.downloads;
    } catch (error) {
        return api.paths.documents;
    }
};

/** 原子地写一个不重名的文件；返回最终路径。 */
const writeUnique = async (directory, fileName, content) => {
    await fs.promises.mkdir(directory, { recursive: true });
    for (let attempt = 0; attempt < MAX_SUFFIX_ATTEMPTS; attempt += 1) {
        const target = candidatePath(directory, fileName, attempt);
        try {
            await fs.promises.writeFile(target, content, { encoding: 'utf8', flag: 'wx' });
            return target;
        } catch (error) {
            if (error && error.code === 'EEXIST') continue;
            throw error;
        }
    }
    throw new Error('too-many-duplicate-names');
};

module.exports = function activate(api) {
    api.rpc.handle('save-file', async (payload) => {
        const input = payload && typeof payload === 'object' ? payload : {};
        const content = typeof input.content === 'string' ? input.content : '';
        if (!content) throw new Error('empty-content');
        if (Buffer.byteLength(content, 'utf8') > MAX_CONTENT_BYTES) throw new Error('too-large');

        let parsed;
        try {
            parsed = JSON.parse(content);
        } catch (error) {
            throw new Error('invalid-json');
        }
        if (!parsed || typeof parsed !== 'object' || parsed.format !== 'folia-playlist' || typeof parsed.version !== 'number') {
            throw new Error('not-folia-playlist');
        }

        const fileName = (() => {
            const base = sanitizeFileName(input.fileName);
            return /\.json$/i.test(base) ? base : base + '.folia-playlist.json';
        })();
        const target = await writeUnique(downloadsDirectory(api), fileName, content);
        api.log.info('wrote Folia playlist file', { path: target });
        return { path: target };
    });


};
