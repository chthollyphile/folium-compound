'use strict';



const crypto = require('crypto');

const DEFAULT_AVATARS = new Set(['default:signal', 'default:rose', 'default:mono', 'default:mint']);

function sanitizeAvatar(value) {
  const avatar = String(value || 'default:signal');
  if (DEFAULT_AVATARS.has(avatar)) return avatar;
  if (avatar.length <= 2048 && /^https:\/\//i.test(avatar)) { try { const url = new URL(avatar); if (!url.username && !url.password) return url.href; } catch {} }
  if (avatar.length <= 24000 && /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(avatar)) return avatar;
  return 'default:signal';
}

function sanitizeIdentity(value = {}) {
  const platform = ['netease', 'qq'].includes(value.platform) ? value.platform : 'none';
  const uid = typeof value.uid === 'string' || typeof value.uid === 'number' ? String(value.uid).trim() : '';
  return { platform, uid: platform !== 'none' && uid.length <= 128 ? uid : '' };
}

function sanitizeProfile(value = {}) {
  return {
    name: String(value.name || value.displayName || 'Mineradio 听众').trim().slice(0, 48) || 'Mineradio 听众',
    avatar: sanitizeAvatar(value.avatar),
    ...sanitizeIdentity(value),
  };
}

class TogetherConfigStore {
  constructor(persisted, persist = async () => {}) {
    const data = persisted && typeof persisted === 'object' ? persisted : {};
    const profile = sanitizeProfile(data.profile || {});
    this.data = { version: 2, clientId: String(data.clientId || crypto.randomUUID()), displayName: profile.name,
      profile, servers: Array.isArray(data.servers) ? data.servers.slice(0, 100) : [] };
    this.persist = persist;
    this.pending = Promise.resolve();
  }
  save() {
    const snapshot = structuredClone(this.data);
    this.pending = this.pending.then(() => this.persist(snapshot));
    this.pending.catch(() => {}); // Observed here; RPC/close awaits and reports the original failure.
  }

  list() { return JSON.parse(JSON.stringify(this.data.servers)); }

  profile() { return JSON.parse(JSON.stringify(this.data.profile)); }

  updateProfile(value) {
    this.data.profile = sanitizeProfile(value);
    this.data.displayName = this.data.profile.name;
    this.save();
    return this.profile();
  }

  upsert(value) {
    const id = String(value.id || crypto.randomUUID()).slice(0, 96);
    const entry = {
      id, name: String(value.name || '好友服务器').trim().slice(0, 64), address: String(value.address || '').trim().slice(0, 512),
      lastConnectedAt: Number(value.lastConnectedAt) || 0, lastStatus: String(value.lastStatus || 'unknown').slice(0, 24),
    };
    const index = this.data.servers.findIndex((item) => item.id === id);
    if (index >= 0) this.data.servers[index] = entry; else this.data.servers.unshift(entry);
    this.data.servers = this.data.servers.slice(0, 100);
    this.save();
    return entry;
  }

  remove(id) {
    const before = this.data.servers.length;
    this.data.servers = this.data.servers.filter((item) => item.id !== String(id));
    if (this.data.servers.length !== before) this.save();
    return this.data.servers.length !== before;
  }
}

module.exports = { TogetherConfigStore, sanitizeAvatar, sanitizeProfile, sanitizeIdentity };
