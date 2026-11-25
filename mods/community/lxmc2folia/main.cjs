// 落雪歌单转换 · Folium 主进程入口
//
// 只做一件事：把客户端转换好的 Folia 歌单 JSON 写进用户的「下载」文件夹。
// 转换本身在客户端完成，这个入口不联网、不读别的文件。
//
// 安全约定：
//   - 只接受 format === "folia-playlist" 且 version 为数字的 JSON；
//   - 文件名只取 basename，去掉路径分隔符和 Windows 非法字符；
//   - 重名时自动加 (2)、(3)… 不覆盖用户已有文件（用 wx 标志原子地创建，避免竞态）；
//   - 大小上限 8 MB。
//
// 按维护者审查建议使用 fs.promises 异步写，不阻塞主进程。

const fs = require('fs');
const path = require('path');

const MAX_CONTENT_BYTES = 8 * 1024 * 1024;
const MAX_SUFFIX_ATTEMPTS = 1000;

const sanitizeFileName = (raw) => {
    const base = path.basename(String(raw || '').trim()).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/^\.+/, '');
    const name = base || 'lxmc-playlist.folia-playlist.json';
    return /\.json$/i.test(name) ? name : name + '.folia-playlist.json';
};

/** 第 0 次用原名，第 n 次用 "(n+1)" 后缀；写失败交给调用方判断是不是重名。 */
const candidatePath = (directory, fileName, attempt) => {
    if (attempt === 0) return path.join(directory, fileName);
    const base = fileName.replace(/\.json$/i, '');
    return path.join(directory, base + ' (' + (attempt + 1) + ').json');
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

        let directory;
        try {
            directory = api.paths.downloads;
        } catch (error) {
            directory = api.paths.documents;
        }
        await fs.promises.mkdir(directory, { recursive: true });

        const fileName = sanitizeFileName(input.fileName);
        for (let attempt = 0; attempt < MAX_SUFFIX_ATTEMPTS; attempt += 1) {
            const target = candidatePath(directory, fileName, attempt);
            try {
                await fs.promises.writeFile(target, content, { encoding: 'utf8', flag: 'wx' });
                api.log.info('wrote Folia playlist file', { path: target });
                return { path: target };
            } catch (error) {
                if (error && error.code === 'EEXIST') continue;
                throw error;
            }
        }
        throw new Error('too-many-duplicate-names');
    });
};
