#!/usr/bin/env node
// tools/site/build.mjs
// Builds the mod market site into dist/ (the deployed static assets):
//   dist/index.html                 the market page, rendered at build time
//   dist/catalog.json               machine-readable catalog (download URLs, sizes, hashes)
//   dist/downloads/<id>-<version>.zip
//   dist/previews/<id>-<version>.<ext>   each mod's introduction image (mod.json `preview`)
//   dist/readmes/<id>-<version>.md       each mod's README.md, as it is (Folia renders it in its mods view)
//   dist/assets/*                   copied from site/assets
//   dist/_headers                   response headers (CSP etc.), copied from site/_headers
//
// Only a fully verified repository is published: any unsigned or invalid mod
// stops the build (the previous deployment stays live; should-build.mjs
// normally skips such commits before this runs).
// Each zip is extracted again and its signature re-verified before it is
// written, so every download on the site installs as a verified mod.

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SIGNATURE_FILE, collectSignedFiles, readModIdentity, verifyMod } from '../lib/signing.mjs';
import { REPO_ROOT, readRevokedDigests, readTrustedKeys } from '../lib/repo.mjs';
import { buildIndex, readCommunityRegistry, readOfficialMeta } from '../lib/index.mjs';
import { CATEGORIES, autoTagsOf, categoryOf } from '../lib/categories.mjs';
import { checkAwesome, httpsUrlOf, readAwesome } from '../lib/awesome.mjs';
import { createZip, readZip } from '../lib/zip.mjs';
import { checkPreview } from '../lib/image.mjs';
import { renderMarketPage } from './render.mjs';
import { SITE_REPOSITORY } from './config.mjs';

const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

// An owner as the catalog lists it: the GitHub account and its page.
const ownerEntry = (login) => ({ login, url: `https://github.com/${encodeURIComponent(login)}` });

// The README a mod ships, if any (any case of README.md at the top of the mod directory).
const readmeOf = (modDir) => fs.readdirSync(modDir).find((name) => /^readme\.md$/i.test(name)) ?? null;

/*
 * The zip for one mod: a single top-level `<id>/` folder (what Folia's
 * installer expects) holding the signed files plus the signature, bytes
 * untouched. OS clutter never ships.
 */
export const zipMod = (modDir, modId) => {
    const files = collectSignedFiles(modDir).map((file) => ({ name: `${modId}/${file.relative}`, data: fs.readFileSync(file.absolute) }));
    files.push({ name: `${modId}/${SIGNATURE_FILE}`, data: fs.readFileSync(path.join(modDir, SIGNATURE_FILE)) });
    return createZip(files);
};

/* Extracts a mod zip to a temporary directory and verifies it there (the result's status is 'verified' or 'beta' when good). */
const verifyZip = (archive, modId, keys, revokedDigests) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'folium-zip-check-'));
    try {
        for (const { name, data } of readZip(archive)) {
            const target = path.join(dir, ...name.split('/'));
            if (!target.startsWith(dir + path.sep)) throw new Error(`unsafe path in zip: ${name}`);
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, data);
        }
        return verifyMod(path.join(dir, modId), keys, { revokedDigests });
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
};

/*
 * Builds the site from the repository at `root` into `outDir`. Returns the
 * catalog. Throws when the repository does not fully verify.
 */
export const buildSite = ({ root = REPO_ROOT, outDir = path.join(root, 'dist'), commit = process.env.WORKERS_CI_COMMIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? null } = {}) => {
    const { mods: indexed, errors } = buildIndex(root);
    if (errors.length > 0) throw new Error(`repository does not verify, not publishing:\n${errors.join('\n')}`);
    const keys = readTrustedKeys(root);
    const revokedDigests = readRevokedDigests(root);
    const keyLabels = Object.fromEntries(keys.map((key) => [key.keyId, key.label ?? key.keyId]));

    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(path.join(outDir, 'downloads'), { recursive: true });
    fs.mkdirSync(path.join(outDir, 'previews'), { recursive: true });
    fs.mkdirSync(path.join(outDir, 'readmes'), { recursive: true });
    const community = readCommunityRegistry(root);
    const officialMeta = readOfficialMeta(root);
    const awesome = readAwesome(root);
    const awesomeErrors = checkAwesome(awesome, { modIds: indexed.map((entry) => entry.id) });
    if (awesomeErrors.length > 0) throw new Error(`awesome.json does not check, not publishing:\n${awesomeErrors.join('\n')}`);

    const mods = indexed.map((entry) => {
        const modDir = path.join(root, entry.path);
        const { manifest } = readModIdentity(modDir);
        const archive = zipMod(modDir, entry.id);
        const check = verifyZip(archive, entry.id, keys, revokedDigests);
        if (check.status !== (entry.channel === 'beta' ? 'beta' : 'verified') || check.digest !== entry.digest) {
            throw new Error(`${entry.path}: the zip does not verify after extraction (${check.reason ?? check.status})`);
        }
        const fileName = `${entry.id}-${entry.version}.zip`;
        fs.writeFileSync(path.join(outDir, 'downloads', fileName), archive);

        // Every published mod has a valid introduction image (tests enforce it on main too).
        const preview = checkPreview(modDir, manifest);
        if (preview.errors.length > 0) throw new Error(`${entry.path}: ${preview.errors.join('; ')}`);
        const previewName = `${entry.id}-${entry.version}${path.extname(preview.info.file).toLowerCase()}`;
        fs.copyFileSync(path.join(modDir, ...preview.info.file.split('/')), path.join(outDir, 'previews', previewName));
        const readme = readmeOf(modDir);
        const readmeName = readme ? `${entry.id}-${entry.version}.md` : null;
        if (readme) fs.copyFileSync(path.join(modDir, readme), path.join(outDir, 'readmes', readmeName));
        const registered = entry.origin === 'official' ? officialMeta.mods[entry.id] : community.mods[entry.id];
        const repository = httpsUrlOf(manifest.repository) ?? httpsUrlOf(entry.source) ?? null;
        return {
            ...entry,
            owners: (entry.owners ?? []).map(ownerEntry),
            kind: Array.isArray(manifest.sources) && manifest.sources.length > 0 ? 'source' : 'standard',
            category: categoryOf(registered?.category),
            tags: autoTagsOf(manifest),
            addedAt: registered?.addedAt ?? entry.signedAt.slice(0, 10),
            updatedAt: registered?.updatedAt ?? entry.signedAt.slice(0, 10),
            repository,
            bugs: httpsUrlOf(manifest.bugs),
            license: typeof manifest.license === 'string' ? manifest.license : null,
            readme: readmeName ? `/readmes/${readmeName}` : null,
            keyLabel: keyLabels[entry.keyId] ?? entry.keyId,
            permissions: Array.isArray(manifest.permissions) ? manifest.permissions : [],
            experimental: Array.isArray(manifest.experimental) ? manifest.experimental : [],
            embedOrigins: Array.isArray(manifest.embedOrigins) ? manifest.embedOrigins : [],
            depends: Array.isArray(manifest.depends) ? manifest.depends : [],
            folia: manifest.folia ?? null,
            hasMain: typeof manifest.main === 'string',
            hasClient: typeof manifest.client === 'string',
            download: { url: `/downloads/${fileName}`, fileName, size: archive.length, sha256: sha256(archive) },
            preview: { url: `/previews/${previewName}`, width: preview.info.width, height: preview.info.height },
        };
    });

    // Official, then community, then beta, each by name; stable for identical input.
    const originOrder = (origin) => ['official', 'community', 'beta'].indexOf(origin);
    mods.sort((left, right) => originOrder(left.origin) - originOrder(right.origin)
        || left.name.localeCompare(right.name, 'en') || left.id.localeCompare(right.id, 'en'));

    /*
     * Version 2: entries carry `channel`, and beta-channel mods (security-reviewed only) are listed too.
     * Version 3 only adds: `categories`, `awesome` (works listed as links, see tools/lib/awesome.mjs), and per
     * mod `kind`, `category`, `tags`, `addedAt`, `updatedAt`, `repository`, `bugs`, `license`, `readme`, and
     * `owners` as `{ login, url }`. A reader of version 2 still finds every field it knew.
     */
    const awesomeEntries = awesome.entries
        .map((entry) => ({ ...entry, category: entry.category ?? null, owners: entry.owners.map(ownerEntry), tags: entry.tags ?? [] }))
        .sort((left, right) => left.name.localeCompare(right.name, 'en') || left.id.localeCompare(right.id, 'en'));
    const catalog = { format: 'folium-market-catalog', version: 3, repository: SITE_REPOSITORY, commit, categories: CATEGORIES, mods, awesome: awesomeEntries };
    fs.writeFileSync(path.join(outDir, 'catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`);
    fs.writeFileSync(path.join(outDir, 'index.html'), renderMarketPage(catalog));
    fs.cpSync(path.join(root, 'site', 'assets'), path.join(outDir, 'assets'), { recursive: true });
    fs.copyFileSync(path.join(root, 'site', '_headers'), path.join(outDir, '_headers'));
    return catalog;
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        const catalog = buildSite();
        console.log(`built dist/ with ${catalog.mods.length} mods`);
        catalog.mods.forEach((mod) => console.log(`  ${mod.download.fileName} ${mod.download.size} bytes sha256:${mod.download.sha256}`));
    } catch (error) {
        console.error(error.message);
        process.exit(1);
    }
}
