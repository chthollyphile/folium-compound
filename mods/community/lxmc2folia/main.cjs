// 落雪歌单转换 · Folium 主进程入口
//
// 只做一件事：把客户端转换好的 Folia 歌单 JSON 写进用户的「下载」文件夹。
// 转换本身在客户端完成，这个入口不联网、不读别的文件。
//
// 安全约定：
//   - 只接受 format === "folia-playlist" 且 version 为数字的 JSON；
//   - 文件名只取 basename，去掉路径分隔符和 Windows 非法字符；
//   - 重名时自动加 (2)、(3)… 不覆盖用户已有文件；
//   - 大小上限 8 MB。

const fs = require('fs');
const path = require('path');

const MAX_CONTENT_BYTES = 8 * 1024 * 1024;
const REPORT_NAME = /^[^\\/:*?"<>|\u0000-\u001f]{1,160}\.json$/i;

const sanitizeFileName = (raw) => {
    const base = path.basename(String(raw || '').trim()).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/^\.+/, '');
    const name = base || 'lxmc-playlist.folia-playlist.json';
    return /\.json$/i.test(name) ? name : name + '.folia-playlist.json';
};

const uniquePath = (dir, fileName) => {
    const target = path.join(dir, fileName);
    if (!fs.existsSync(target)) return target;
    const base = fileName.replace(/\.json$/i, '');
    for (let n = 2; n < 1000; n += 1) {
        const candidate = path.join(dir, base + ' (' + n + ').json');
        if (!fs.existsSync(candidate)) return candidate;
    }
    return path.join(dir, base + ' (' + Date.now() + ').json');
};

module.exports = function activate(api) {
    api.rpc.handle('save-file', (payload) => {
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
        fs.mkdirSync(directory, { recursive: true });

        const fileName = sanitizeFileName(input.fileName);
        const target = uniquePath(directory, fileName);
        fs.writeFileSync(target, content, 'utf8');
        api.log.info('wrote Folia playlist file', { path: target });
        return { path: target };
    });
};
