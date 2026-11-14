// main.cjs
const fs = require('node:fs');
const path = require('node:path');

module.exports = function activate(api) {
  const logFile = path.join(api.storage.paths.data, 'debug.log');
  api.rpc.handle('log', async (level, message, details) => {
    const line =
      `[${new Date().toISOString()}] [${level}] ${message}` +
      (details ? ` | ${JSON.stringify(details)}` : '');
    try { fs.appendFileSync(logFile, line + '\n'); } catch {}
    return true;
  });
  api.onDispose(() => {});
};