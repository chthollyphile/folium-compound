// pythonEnv.cjs — 管理 Python 執行環境：支援系統 Python、自訂路徑、與 uv 自動下載免安裝 Python
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { pipeline } = require('stream/promises');

const VALID_MODES = new Set(['auto', 'system', 'custom', 'managed']);
const MANAGED_PYTHON_VERSION = '3.12';
const UV_VERSION = '0.12.4';

const UV_ASSETS = {
  'win32-x64': {
    archiveName: 'uv-x86_64-pc-windows-msvc.zip',
    exeName: 'uv.exe',
    sha256: '4f3b7d63cd81fca0da5a655d973d20affca89ce6e5f9a29fd0183cc4204a7639'
  },
  'win32-arm64': {
    archiveName: 'uv-aarch64-pc-windows-msvc.zip',
    exeName: 'uv.exe',
    sha256: '3290abffee78c30e3113f5113e26684fd057287e89124a588dcdcdd6ceec0fea'
  },
  'darwin-x64': {
    archiveName: 'uv-x86_64-apple-darwin.tar.gz',
    exeName: 'uv',
    sha256: 'e603f1eb634ca97a2a125539b983891f53235e901511ed10c32c08c86e253ecd'
  },
  'darwin-arm64': {
    archiveName: 'uv-aarch64-apple-darwin.tar.gz',
    exeName: 'uv',
    sha256: '99a913b606194867b43086404412c1afe079547fee72ecfb6af7e7b0dd54b0c6'
  },
  'linux-x64': {
    archiveName: 'uv-x86_64-unknown-linux-gnu.tar.gz',
    exeName: 'uv',
    sha256: 'c8c60f47e6f88d18dbf6f33d7279fb1fbf7ae76631768152cf5578c3d65729b4'
  },
  'linux-arm64': {
    archiveName: 'uv-aarch64-unknown-linux-gnu.tar.gz',
    exeName: 'uv',
    sha256: '49d881b3403187e1f1789720881e77e4251ad4259d86c4844862657d2a35d13f'
  }
};

function stripWrappingQuotes(value) {
  const s = String(value || '').trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1).trim();
  }
  return s;
}

function normalizePythonConfig(raw = {}) {
  const mode = VALID_MODES.has(raw?.pythonMode) ? raw.pythonMode : 'auto';
  const customPythonPath = stripWrappingQuotes(raw?.customPythonPath);
  return { pythonMode: mode, customPythonPath };
}

function getUvAssetInfo(platform = process.platform, arch = process.arch) {
  const osKey = platform === 'win32' ? 'win32' : platform === 'darwin' ? 'darwin' : 'linux';
  const archKey = arch === 'arm64' ? 'arm64' : 'x64';
  const asset = UV_ASSETS[`${osKey}-${archKey}`];
  return {
    version: UV_VERSION,
    archiveName: asset.archiveName,
    exeName: asset.exeName,
    sha256: asset.sha256,
    url: `https://github.com/astral-sh/uv/releases/download/${UV_VERSION}/${asset.archiveName}`
  };
}

function computeFileSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex').toLowerCase()));
  });
}

async function verifyFileSha256(filePath, expectedSha256) {
  const actual = await computeFileSha256(filePath);
  const expected = String(expectedSha256 || '').trim().toLowerCase();
  if (!expected || actual !== expected) {
    throw new Error(`SHA-256 校驗失敗：預期 ${expected}，實際 ${actual}`);
  }
  return actual;
}

function findFileRecursive(dir, targetName) {
  if (!fs.existsSync(dir)) return null;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isFile() && entry.name.toLowerCase() === targetName.toLowerCase()) {
      return full;
    }
    if (entry.isDirectory()) {
      const found = findFileRecursive(full, targetName);
      if (found) return found;
    }
  }
  return null;
}

function downloadFile(url, destPath, redirectCount = 0) {
  if (redirectCount > 5) {
    return Promise.reject(new Error('下載 uv 時重新導向次數過多'));
  }
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'folia-mic-lyric-sync' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          const nextUrl = new URL(res.headers.location, url).toString();
          downloadFile(nextUrl, destPath, redirectCount + 1).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode} (${url})`));
          return;
        }
        const out = fs.createWriteStream(destPath);
        pipeline(res, out).then(resolve, reject);
      })
      .on('error', reject);
  });
}

function readJsonSafe(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJsonSafe(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function removeDirSafe(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  try {
    fs.rmSync(dirPath, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 });
  } catch {
    const backup = `${dirPath}.old.${Date.now()}`;
    fs.renameSync(dirPath, backup);
    try {
      fs.rmSync(backup, { recursive: true, force: true, maxRetries: 2, retryDelay: 100 });
    } catch {}
  }
}

function createPythonEnvManager({ dataDir, reqFile, pushLog, runCommand, downloadFn = downloadFile, platform = process.platform, arch = process.arch }) {
  const configFile = path.join(dataDir, 'python_config.json');
  const metaFile = path.join(dataDir, 'python_env_meta.json');
  const stateFile = path.join(dataDir, 'pip_state.json');
  const consentFile = path.join(dataDir, 'install_consent.json');
  const venvDir = path.join(dataDir, 'venv');
  const uvDir = path.join(dataDir, 'uv');
  const managedPythonDir = path.join(dataDir, 'python-managed');

  const venvPython = platform === 'win32'
    ? path.join(venvDir, 'Scripts', 'python.exe')
    : path.join(venvDir, 'bin', 'python');

  let cachedConfig = normalizePythonConfig(readJsonSafe(configFile, {}));

  function getConfig() {
    return { ...cachedConfig };
  }

  function setConfig(raw) {
    cachedConfig = normalizePythonConfig(raw);
    writeJsonSafe(configFile, cachedConfig);
    return getConfig();
  }

  function hasInstallConsent() {
    const data = readJsonSafe(consentFile, null);
    return Boolean(data && data.consented === true);
  }

  function setInstallConsent(granted) {
    const consented = Boolean(granted);
    writeJsonSafe(consentFile, {
      consented,
      updatedAt: Date.now()
    });
    return consented;
  }

  async function arePackagesReady() {
    if (!fs.existsSync(venvPython)) return false;
    try {
      await runCommand(venvPython, ['-c', 'import shazamio, sounddevice, numpy']);
      return true;
    } catch {
      return false;
    }
  }

  async function getEnvStatus() {
    const consented = hasInstallConsent();
    const venvExists = fs.existsSync(venvPython);
    const pkgsReady = await arePackagesReady();
    const ready = venvExists && pkgsReady;
    return {
      consented,
      venvExists,
      pkgsReady,
      ready,
      needsConsent: !consented && !ready,
      dataDir,
      venvDir,
      uvDir,
      managedPythonDir,
      uvVersion: UV_VERSION,
      managedPythonVersion: MANAGED_PYTHON_VERSION,
      pythonMode: cachedConfig.pythonMode,
      packages: ['shazamio', 'sounddevice', 'numpy']
    };
  }

  async function findSystemPython() {
    const candidates = platform === 'win32'
      ? [['python', []], ['py', ['-3']], ['python3', []]]
      : [['python3', []], ['python', []]];
    for (const [cmd, baseArgs] of candidates) {
      try {
        await runCommand(cmd, [...baseArgs, '--version']);
        return [cmd, baseArgs];
      } catch {}
    }
    return null;
  }

  async function validateCustomPython(customPath) {
    if (!customPath) {
      throw new Error('已選擇自訂 Python 路徑，但尚未填寫執行檔路徑');
    }
    if (!fs.existsSync(customPath)) {
      throw new Error(`找不到自訂 Python 路徑：${customPath}`);
    }
    try {
      await runCommand(customPath, ['--version']);
      return [customPath, []];
    } catch (err) {
      throw new Error(`自訂 Python 無法執行 (${customPath})：${err.message}`);
    }
  }

  async function ensureUvBinary() {
    const info = getUvAssetInfo(platform, arch);
    const existing = findFileRecursive(uvDir, info.exeName);
    if (existing) return existing;

    fs.mkdirSync(uvDir, { recursive: true });
    const archivePath = path.join(uvDir, info.archiveName);
    pushLog('INFO', `正在下載免安裝 Python 管理工具 uv v${info.version} (${info.archiveName})...`);
    try {
      await downloadFn(info.url, archivePath);
      pushLog('INFO', '正在校驗工具壓縮檔 SHA-256...');
      await verifyFileSha256(archivePath, info.sha256);

      pushLog('INFO', 'SHA-256 校驗通過，正在解壓縮管理工具...');
      await runCommand('tar', ['-xf', archivePath, '-C', uvDir]);
    } finally {
      try { fs.unlinkSync(archivePath); } catch {}
    }

    const binPath = findFileRecursive(uvDir, info.exeName);
    if (!binPath) {
      throw new Error(`解壓縮後找不到 ${info.exeName}`);
    }
    if (platform !== 'win32') {
      try { fs.chmodSync(binPath, 0o755); } catch {}
    }
    return binPath;
  }

  function getUvEnv() {
    return {
      UV_PYTHON_INSTALL_DIR: managedPythonDir,
      UV_PYTHON_PREFERENCE: 'only-managed'
    };
  }

  async function createVenvWithSystemOrCustom(cmd, baseArgs) {
    await runCommand(cmd, [...baseArgs, '-m', 'venv', venvDir], (line) => pushLog('INFO', line));
  }

  async function createVenvWithUv(uvBin) {
    pushLog('INFO', `正在透過 uv 下載並建立免安裝 Python ${MANAGED_PYTHON_VERSION} 隔離環境...`);
    await runCommand(
      uvBin,
      ['venv', venvDir, '--python', MANAGED_PYTHON_VERSION],
      (line) => pushLog('INFO', line),
      getUvEnv()
    );
  }

  async function installPackages(runtimeKind) {
    if (runtimeKind === 'managed') {
      const uvBin = await ensureUvBinary();
      await runCommand(
        uvBin,
        ['pip', 'install', '--python', venvPython, '--require-hashes', '-r', reqFile],
        (line) => pushLog('INFO', line),
        getUvEnv()
      );
      return;
    }
    await runCommand(
      venvPython,
      ['-m', 'pip', 'install', '--disable-pip-version-check', '--require-hashes', '-r', reqFile],
      (line) => pushLog('INFO', line)
    );
  }

  function isConfigMatchingMeta(cfg, meta) {
    if (!meta || meta.pythonMode !== cfg.pythonMode) return false;
    if (cfg.pythonMode === 'custom' && meta.customPythonPath !== cfg.customPythonPath) return false;
    return true;
  }

  function assertInstallConsent() {
    if (!hasInstallConsent()) {
      throw new Error('INSTALL_CONSENT_REQUIRED: 尚未取得使用者安裝同意，請先確認下載內容與儲存路徑');
    }
  }

  async function ensureEnvironment(forceReinstall = false) {
    const cfg = getConfig();
    let prevMeta = readJsonSafe(metaFile, null);
    let pkgsReadyPrecheck = null;

    if (!prevMeta && fs.existsSync(venvPython) && !forceReinstall) {
      pkgsReadyPrecheck = await arePackagesReady();
      if (pkgsReadyPrecheck) {
        prevMeta = {
          pythonMode: cfg.pythonMode,
          customPythonPath: cfg.customPythonPath,
          runtimeKind: 'existing'
        };
        writeJsonSafe(metaFile, prevMeta);
      }
    }

    const configChanged = !isConfigMatchingMeta(cfg, prevMeta);

    if (configChanged && fs.existsSync(venvDir)) {
      assertInstallConsent();
      pushLog('INFO', `Python 環境設定已變更 (${cfg.pythonMode})，正在重建隔離環境...`);
      removeDirSafe(venvDir);
      try { fs.unlinkSync(stateFile); } catch {}
    }

    let runtimeKind = prevMeta?.runtimeKind || null;

    if (!fs.existsSync(venvPython)) {
      assertInstallConsent();
      if (cfg.pythonMode === 'custom') {
        pushLog('INFO', `正在使用自訂 Python 建立隔離環境：${cfg.customPythonPath}`);
        const [cmd, args] = await validateCustomPython(cfg.customPythonPath);
        await createVenvWithSystemOrCustom(cmd, args);
        runtimeKind = 'custom';
      } else if (cfg.pythonMode === 'system') {
        pushLog('INFO', '正在搜尋系統 Python 並建立隔離環境 (venv)...');
        const found = await findSystemPython();
        if (!found) {
          throw new Error('找不到系統 Python，請安裝 Python 3.10+ 並勾選 Add Python to PATH，或切換為「自動下載」模式');
        }
        await createVenvWithSystemOrCustom(found[0], found[1]);
        runtimeKind = 'system';
      } else if (cfg.pythonMode === 'managed') {
        const uvBin = await ensureUvBinary();
        await createVenvWithUv(uvBin);
        runtimeKind = 'managed';
      } else {
        pushLog('INFO', '正在偵測系統 Python...');
        const found = await findSystemPython();
        if (found) {
          pushLog('INFO', '已偵測到系統 Python，正在建立隔離環境 (venv)...');
          await createVenvWithSystemOrCustom(found[0], found[1]);
          runtimeKind = 'system';
        } else {
          pushLog('INFO', '未偵測到系統 Python，將自動下載免安裝 Python...');
          const uvBin = await ensureUvBinary();
          await createVenvWithUv(uvBin);
          runtimeKind = 'managed';
        }
      }

      writeJsonSafe(metaFile, {
        pythonMode: cfg.pythonMode,
        customPythonPath: cfg.customPythonPath,
        runtimeKind
      });
      pushLog('INFO', '隔離環境建立完成');
    }

    const pkgsReady = pkgsReadyPrecheck === true ? true : await arePackagesReady();
    const needInstall = forceReinstall || !pkgsReady;

    if (needInstall) {
      assertInstallConsent();
      pushLog('INFO', pkgsReady ? '正在重新驗證並安裝鎖定版本 Python 套件...' : '正在安裝鎖定版本與 SHA-256 校驗的 Python 套件 (shazamio / sounddevice / numpy)...');
      await installPackages(runtimeKind);
      writeJsonSafe(stateFile, { lastVerifiedAt: Date.now() });
      pushLog('INFO', 'Python 套件準備完成！');
    }

    return venvPython;
  }

  return {
    getConfig,
    setConfig,
    hasInstallConsent,
    setInstallConsent,
    getEnvStatus,
    ensureEnvironment,
    findSystemPython,
    validateCustomPython
  };
}

module.exports = {
  MANAGED_PYTHON_VERSION,
  UV_VERSION,
  normalizePythonConfig,
  getUvAssetInfo,
  computeFileSha256,
  verifyFileSha256,
  createPythonEnvManager
};
