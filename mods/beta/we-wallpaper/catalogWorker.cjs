'use strict';

const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { parentPort } = require('node:worker_threads');
const { record, normalize, buildLibrary, buildState, hostLibrary } = require('./catalogIndex.cjs');

// Keep the library in this worker across configuration reloads.
const execute = promisify(execFile);
const PROJECT_LIMIT = 2 * 1024 * 1024;
const CONFIG_LIMIT = 32 * 1024 * 1024;
const PROJECT_CONCURRENCY = 8;

function containedPath(root, value) {
    if (typeof value !== 'string' || !value || /^[\\/]/.test(value) || /^[a-z]:(?![\\/])/i.test(value)) return null;
    const parts = value.replace(/^[a-z]:/i, '').split(/[\\/]/);
    if (parts.some(part => /[<>:"|?*\x00-\x1f]/.test(part)
        || /^(con(?:in\$|out\$)?|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(part)
        || (part !== '.' && part !== '..' && /[ .]$/.test(part)))) return null;
    const file = path.resolve(root, value);
    const relative = path.relative(root, file);
    return relative && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative) ? file : null;
}

// Inspect links without following them, before opening any project-controlled path.
async function safePath(root, value, directory = false) {
    const file = containedPath(root, value);
    if (!file) return null;
    const parts = path.relative(root, file).split(path.sep);
    let current = root;
    try {
        for (let index = 0; index < parts.length; index++) {
            current = path.join(current, parts[index]);
            const stat = await fsp.lstat(current);
            if (stat.isSymbolicLink()) return null;
            if (index < parts.length - 1 || directory) {
                if (!stat.isDirectory()) return null;
            } else if (!stat.isFile()) return null;
        }
        return file;
    } catch (error) {
        if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null;
        throw error;
    }
}

async function text(file, limit) {
    const tooLarge = () => Object.assign(new Error('WE JSON 文件超过 ' + limit / 1024 / 1024 + ' MB：' + file), { code: 'WE_JSON_TOO_LARGE' });
    const stat = await fsp.stat(file);
    if (stat.size > limit) throw tooLarge();
    const chunks = [];
    let length = 0;
    for await (const chunk of fs.createReadStream(file, { end: limit })) {
        length += chunk.length;
        if (length > limit) throw tooLarge();
        chunks.push(chunk);
    }
    return Buffer.concat(chunks, length).toString('utf8');
}

async function json(file, limit) {
    try { return JSON.parse(await text(file, limit)); }
    catch (error) {
        if (error.code === 'ENOENT' || error instanceof SyntaxError) return null;
        throw error;
    }
}

async function directories(root, relative) {
    const dir = await safePath(root, relative, true);
    if (!dir) return [];
    return (await fsp.readdir(dir, { withFileTypes: true }))
        .filter(entry => entry.isDirectory() && !entry.isSymbolicLink()).map(entry => path.join(dir, entry.name));
}

async function installed() {
    const roots = new Set(['C:/Program Files (x86)/Steam', 'C:/Program Files/Steam']);
    const addRoot = (target, value) => {
        if (typeof value === 'string' && /^[a-z]:[\\/]/i.test(value)) target.add(path.normalize(value));
    };
    for (const [key, value] of [['HKCU\\Software\\Valve\\Steam', 'SteamPath'], ['HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam', 'InstallPath']]) {
        try {
            const { stdout } = await execute('reg', ['query', key, '/v', value], { encoding: 'utf8', windowsHide: true });
            const match = stdout.match(/REG_SZ\s+(.+?)\s*$/m);
            if (match) addRoot(roots, match[1].trim());
        } catch { /* Steam may be registered for the current user only. */ }
    }
    const libraries = new Set(roots);
    for (const root of roots) {
        const file = await safePath(root, 'steamapps/libraryfolders.vdf');
        if (!file) continue;
        const vdf = await text(file, PROJECT_LIMIT);
        for (const match of vdf.matchAll(/"path"\s+"([^"]+)"/g)) addRoot(libraries, match[1].replace(/\\\\/g, '\\'));
    }
    for (const root of libraries) {
        const weDir = path.join(root, 'steamapps/common/wallpaper_engine');
        if (await safePath(weDir, 'config.json')) return { weDir, libraries: [...libraries] };
    }
    throw new Error('没有找到 Wallpaper Engine 的安装目录');
}

async function projectEntry({ dir, kind }) {
    const projectPath = await safePath(dir, 'project.json');
    if (!projectPath) return null;
    let project;
    try { project = await json(projectPath, PROJECT_LIMIT); }
    catch (error) {
        if (error.code === 'WE_JSON_TOO_LARGE') return null;
        throw error;
    }
    if (!project || typeof project.file !== 'string' || !project.file) return null;
    // The previous OBS wrapper points back into Folia and is not a WE source.
    if (path.basename(dir) === 'folia-obs' && project.file === 'we-entry.html') return null;
    const entryPath = await safePath(dir, project.file);
    if (!entryPath) return null;
    const previewPath = project.preview ? await safePath(dir, project.preview) : null;
    const definitions = Object.fromEntries(Object.entries(record(project.general?.properties))
        .filter(([, value]) => value && typeof value === 'object' && !Array.isArray(value)));
    return {
        id: crypto.createHash('sha1').update(normalize(dir)).digest('hex').slice(0, 12),
        dir, kind, projectPath, entryPath, previewPath,
        entryFile: normalize(path.relative(dir, entryPath)), workshopId: '',
        project: { file: project.file, general: { properties: definitions } },
        title: String(project.title || path.basename(dir)), type: project.type || 'scene',
    };
}

async function scan(info) {
    const locations = [
        { root: info.weDir, relative: 'projects/myprojects', kind: 'local' },
        ...info.libraries.map(root => ({ root, relative: 'steamapps/workshop/content/431960', kind: 'workshop' })),
    ];
    const seen = new Set();
    const projects = [];
    for (const location of locations) {
        for (const dir of await directories(location.root, location.relative)) {
            const key = normalize(dir);
            if (seen.has(key)) continue;
            seen.add(key);
            projects.push({ dir, kind: location.kind });
        }
    }
    const entries = new Array(projects.length);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(PROJECT_CONCURRENCY, projects.length) }, async () => {
        while (next < projects.length) {
            const index = next++;
            entries[index] = await projectEntry(projects[index]);
        }
    }));
    return entries.filter(Boolean).sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'));
}

async function readUser(weDir) {
    const file = await safePath(weDir, 'config.json');
    const config = file ? await json(file, CONFIG_LIMIT) : null;
    const username = os.userInfo().username.toLowerCase();
    const name = Object.keys(record(config)).find(key => key.toLowerCase() === username);
    if (!name) throw new Error('WE 配置中没有当前 Windows 用户的数据');
    return record(config[name]);
}

let library = null;

async function run(request) {
    if (request.action === 'refresh') {
        const info = await installed();
        const user = await readUser(info.weDir);
        const nextLibrary = buildLibrary(await scan(info), info.weDir);
        const state = buildState(nextLibrary, user, request.selectedId);
        library = nextLibrary;
        return { library: hostLibrary(library), ...state };
    }
    if (request.action === 'reload') {
        const user = await readUser(library.weDir);
        return buildState(library, user, request.selectedId);
    }
    throw new Error('未知的 WE 壁纸索引操作');
}

parentPort.on('message', request => {
    void run(request).then(
        result => parentPort.postMessage({ ok: true, result }),
        error => parentPort.postMessage({ ok: false, error: { message: error.message, code: error.code } }),
    );
});
