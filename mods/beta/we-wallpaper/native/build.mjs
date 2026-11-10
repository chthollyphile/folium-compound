import { spawn } from 'node:child_process';
import { mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

// Build both shipped Windows binaries from the pinned Cargo lockfiles.
const root = path.dirname(fileURLToPath(import.meta.url));
const target = process.env.FOLIA_WE_BUILD_DIR || path.join(os.tmpdir(), 'folia-we-native-build');
const remapFlags = [
    [os.homedir(), '/folia/home'],
    [path.resolve(root, '../../..'), '/folia/source'],
].flatMap(([source, destination]) => [...new Set([source, source.replace(/\\/g, '/')])]
    .map(prefix => '--remap-path-prefix=' + prefix + '=' + destination));
// Cargo's encoded RUSTFLAGS preserve paths containing spaces.
const rustFlags = process.env.CARGO_ENCODED_RUSTFLAGS
    ? process.env.CARGO_ENCODED_RUSTFLAGS.split('\x1f')
    : (process.env.RUSTFLAGS || '').split(/\s+/).filter(Boolean);
const env = { ...process.env, CARGO_ENCODED_RUSTFLAGS: [...rustFlags, ...remapFlags].join('\x1f') };
for (const [source, directory, output, destination] of [
    ['Cargo.toml', target, 'folia_we_capture.dll', 'we-capture-v2.win32-x64.node'],
    ['desktop-helper/Cargo.toml', target + '-desktop', 'folia-wallpaper-helper.exe', 'folia-wallpaper-helper.exe'],
]) {
    const code = await new Promise((resolve, reject) => {
        const child = spawn('cargo', ['build', '--locked', '--release', '--manifest-path', path.join(root, source), '--target-dir', directory], { stdio: 'inherit', windowsHide: true, env });
        child.on('error', reject);
        child.on('close', resolve);
    });
    if (code !== 0) process.exit(code || 1);
    await mkdir(path.join(root, '../bin'), { recursive: true });
    await copyFile(path.join(directory, 'release', output), path.join(root, '../bin', destination));
}
