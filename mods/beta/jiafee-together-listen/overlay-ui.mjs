import { authoritativePosition } from './playback-core.mjs?v=1.4.5';
import { OVERLAY_STYLE, PANEL_ENTRY_STYLE } from './styles.mjs?v=1.4.5';

const node = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

const button = (className, text, action) => {
  const element = node('button', className, text);
  element.type = 'button';
  if (action) element.addEventListener('click', action);
  return element;
};

const themeAccent = (theme) => typeof theme?.accentColor === 'string' && theme.accentColor.trim()
  ? theme.accentColor.trim()
  : '#00f5d4';

const colorChannels = (color) => {
  const value = String(color || '').trim();
  const shortHex = /^#([\da-f])([\da-f])([\da-f])$/i.exec(value);
  if (shortHex) return shortHex.slice(1).map((part) => Number.parseInt(`${part}${part}`, 16));
  const hex = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})/i.exec(value);
  if (hex) return hex.slice(1).map((part) => Number.parseInt(part, 16));
  const rgb = /^rgba?\(\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)/i.exec(value);
  return rgb ? rgb.slice(1).map((part) => Math.max(0, Math.min(255, Math.round(Number(part))))) : [0, 245, 212];
};

const applyTheme = (root, ctx) => {
  const theme = ctx.getTheme?.() || {};
  const accent = themeAccent(theme);
  const channels = colorChannels(accent);
  const luminance = (channels[0] * 299 + channels[1] * 587 + channels[2] * 114) / 255000;
  root.dataset.daylight = String(!!theme.isDaylight);
  root.style.setProperty('--tl-accent', accent);
  root.style.setProperty('--home-accent-rgb', channels.join(','));
  root.style.setProperty('--tl-on-accent', luminance > .58 ? '#17171a' : '#ffffff');
};

const initials = (name) => Array.from(String(name || '听')).slice(0, 1).join('').toUpperCase();
const avatarClass = (avatar) => /^default:(?:signal|rose|mono|mint)$/.test(avatar || '') ? avatar.replace(':', '-') : '';

function renderAvatar(element, avatar, name) {
  element.replaceChildren();
  element.classList.remove('default-signal', 'default-rose', 'default-mono', 'default-mint');
  const preset = avatarClass(avatar || 'default:signal');
  if (preset) element.classList.add(preset);
  if (/^(?:https:\/\/|data:image\/(?:png|jpeg|webp);base64,)/i.test(avatar || '')) {
    const image = document.createElement('img');
    image.src = avatar;
    image.alt = '';
    element.append(image);
  } else {
    element.append(node('span', '', initials(name)));
  }
}

function compressAvatar(file) {
  const supported = file && (/^image\/(?:png|jpeg|webp)$/i.test(file.type || '') || /\.(?:png|jpe?g|webp)$/i.test(file.name || ''));
  if (!supported) return Promise.reject(new Error('请选择 PNG、JPG 或 WebP 图片'));
  if (file.size > 10 * 1024 * 1024) return Promise.reject(new Error('头像原图不能超过 10 MB'));
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      try {
        let data = '';
        for (const size of [96, 80, 64]) {
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const context = canvas.getContext('2d');
          const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
          const width = image.naturalWidth * scale;
          const height = image.naturalHeight * scale;
          context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
          for (const quality of [.78, .64, .5, .38, .28]) {
            data = canvas.toDataURL('image/webp', quality);
            if (data.length <= 22000) break;
          }
          if (data.length <= 22000) break;
        }
        URL.revokeObjectURL(url);
        if (!data || data.length > 24000) reject(new Error('头像压缩后仍然过大'));
        else resolve(data);
      } catch (error) {
        URL.revokeObjectURL(url);
        reject(error);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('头像图片无法读取'));
    };
    image.src = url;
  });
}

function memberStatusText(member) {
  const labels = {
    idle: '在线', loading: '正在加载', ready: '已准备', playing: '正在播放', paused: '已暂停',
    seeking: '正在定位', switching: '正在切歌', buffering: '正在缓冲', waiting: '等待对方', error: '播放异常',
  };
  const latency = Number(member?.latencyMs) || 0;
  return `${labels[member?.status] || '在线'}${latency > 0 ? ` · ${Math.round(latency)}ms` : ''}`;
}

export function mountTogetherOverlay(folium, bridge, container, ctx, controller) {
  const style = node('style', '', OVERLAY_STYLE);
  const root = node('div', 'together-overlay-root');
  root.innerHTML = `
    <div class="together-control" data-role="control">
      <div class="together-switch-notice" data-role="switch-notice" role="status" aria-live="polite" hidden><i aria-hidden="true"></i>正在切歌</div>
      <div class="together-modal-mask" data-role="menu" aria-hidden="true">
        <section class="together-panel" data-role="panel" role="dialog" aria-modal="false" aria-labelledby="together-panel-title">
          <header class="together-panel-head"><div><h2 id="together-panel-title">一起听</h2><p>双人联机大厅</p></div><button class="together-icon-btn" data-action="close-menu" type="button" title="关闭" aria-label="关闭">×</button></header>
          <div class="together-message" data-role="message" aria-live="polite"></div>
          <div class="together-lobby-view" data-view="lobby">
            <section class="together-section together-profile-section">
              <div class="together-section-head"><div><h3>我的联机资料</h3><p>自动同步 Folia 账号 · 网易云优先，其次 QQ</p></div><button class="together-secondary-btn" data-action="profile-save" type="button">保存</button></div>
              <div class="together-profile-editor"><button class="together-profile-avatar default-signal" data-role="profile-avatar" type="button" title="上传头像" aria-label="上传头像"></button><label><span>显示名称</span><input data-role="profile-name" maxlength="48" placeholder="Folia 听众"></label><div class="together-avatar-presets" role="group" aria-label="默认头像"><button type="button" data-avatar-preset="default:signal" title="信号"></button><button type="button" data-avatar-preset="default:rose" title="玫瑰"></button><button type="button" data-avatar-preset="default:mono" title="黑白"></button><button type="button" data-avatar-preset="default:mint" title="薄荷"></button><button data-action="avatar-upload" type="button">上传图片</button></div></div>
            </section>
            <section class="together-section together-create-section">
              <div class="together-section-head"><div><h3>创建一起听世界</h3><p>在本机开启一个双人同步服务器</p></div></div>
              <div class="together-form-row"><label><span>服务器名称</span><input data-role="create-name" maxlength="64" value="我的 Folia"></label><label><span>TCP 监听端口</span><input data-role="create-port" inputmode="numeric" value="17861"></label><button class="together-primary-btn" data-action="create" type="button">创建</button></div>
            </section>
            <section class="together-section together-discover-section">
              <div class="together-section-head"><div><h3>局域网服务器</h3><p>UDP 17862 只负责发现</p></div><button class="together-secondary-btn" data-action="discover" type="button">刷新</button></div>
              <div class="together-list" data-role="lan-list"><div class="together-empty">点击刷新查找附近服务器</div></div>
            </section>
            <section class="together-section together-connect-section">
              <div class="together-section-head"><div><h3>直接连接</h3><p>公网、DDNS 或私有组网地址</p></div></div>
              <div class="together-connect-grid"><label><span>TCP 地址（IP:端口 / 域名:端口）</span><input data-role="address" placeholder="192.168.1.20:17861"></label><label><span>6 位授权码</span><input data-role="auth" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="所有连接均需填写"></label></div>
              <div class="together-action-row"><button class="together-primary-btn" data-action="connect" type="button">加入服务器</button><button class="together-secondary-btn" data-action="save-address" type="button">保存地址</button></div>
            </section>
            <section class="together-section together-saved-section">
              <div class="together-section-head"><div><h3>已保存服务器</h3><p>只保存地址，不保存授权码</p></div></div>
              <div class="together-list" data-role="saved-list"><div class="together-empty">尚未保存服务器</div></div>
            </section>
          </div>
          <div class="together-room-view" data-view="room" hidden>
            <section class="together-room-summary"><div><h3 data-role="room-name">一起听服务器</h3><p data-role="room-state">0/2 · idle</p></div><div class="together-room-meta"><span class="together-network-quality" data-role="quality" data-quality="measuring"><i></i><span data-role="quality-text">检测线路</span></span><div class="together-members" data-role="members-label">等待成员</div></div></section>
            <section class="together-host-info" data-role="host" hidden><div class="together-host-details"><span>TCP 一起听服务器已开启 · 加入均需授权码</span><code data-role="host-address"></code><small>FRP 必须使用 type=tcp</small></div><div class="together-host-code"><span>授权码</span><strong data-role="host-code">------</strong></div><div class="together-host-actions"><button class="together-secondary-btn" data-action="copy-address" type="button">复制地址</button><button class="together-secondary-btn" data-action="copy-code" type="button">复制授权码</button></div></section>
            <section class="together-now-playing"><div class="together-now-copy"><span>当前同步状态</span><h3 data-role="track-title">等待播放第一首歌</h3><p data-role="track-artist">请使用 Folia 原生播放器开始播放</p></div><div class="together-room-progress"><i data-role="progress"></i></div></section>
            <div class="together-room-footer"><span>断线后将自动重连并获取最新状态</span><button class="together-danger-btn" data-action="leave" type="button">断开连接</button></div>
          </div>
        </section>
      </div>
    <section class="together-presence-space" data-role="presence" hidden aria-label="一起听成员空间">
      <div class="together-presence-pair">
        <article class="together-presence-member" data-presence-slot="0"><button class="together-presence-avatar together-presence-avatar-editable default-signal" data-role="presence-avatar" type="button" title="更换我的头像" aria-label="更换我的头像"></button><strong data-role="presence-name">等待成员</strong><small data-role="presence-status">连接中</small><p class="together-expression" data-role="presence-expression" hidden></p></article>
        <div class="together-presence-link" aria-hidden="true"><i></i><span>♪</span></div>
        <article class="together-presence-member" data-presence-slot="1"><div class="together-presence-avatar default-mono" data-role="presence-avatar"></div><strong data-role="presence-name">等待好友</strong><small data-role="presence-status">未连接</small><p class="together-expression" data-role="presence-expression" hidden></p></article>
      </div>
      <div class="together-expression-controls" data-role="chat"><button class="together-expression-toggle" data-action="chat-toggle" type="button" aria-expanded="true" title="收起聊天输入" aria-label="收起聊天输入"><span data-icon="chat-toggle"></span></button><form class="together-expression-form" data-role="chat-form"><input data-role="chat-input" maxlength="50" autocomplete="off" placeholder="分享此刻感受…" aria-label="发送一句感受"><button type="submit" title="发送" aria-label="发送"><span data-icon="send">发送</span></button></form></div>
    </section>
    </div>
    <input data-role="avatar-file" type="file" accept="image/png,image/jpeg,image/webp" hidden>`;
  container.append(style, root);

  const paintTheme = () => applyTheme(root, ctx);
  const unsubscribeView = bridge.subscribe(() => {
    root.dataset.subdued = String(['home', 'search', 'library', 'lattice'].includes(bridge.view));
  });
  const unsubscribeTheme = ctx.onChange?.(paintTheme) || (() => {});
  paintTheme();

  const control = root.querySelector('[data-role=control]');
  const menu = root.querySelector('[data-role=menu]');
  const q = (selector) => root.querySelector(selector) || controller.panelHost?.querySelector(selector) || null;
  const qa = (selector) => [
    ...root.querySelectorAll(selector),
    ...(controller.panelHost?.querySelectorAll(selector) || []),
  ];
  let selectedAvatar = '';
  let rooms = [];
  let busy = false;
  let menuOpen = false;
  let chatExpanded = true;
  let lastMessageKey = '';
  let messageAudioContext = null;
  let displayedTrack = null;
  let displayedPosition = 0;
  let displayedSession = '';

  const setMenuOpen = (open) => {
    if (menu.classList.contains('is-native-panel')) return;
    menuOpen = !!open;
    control.classList.toggle('open', menuOpen);
    menu.setAttribute('aria-hidden', String(!menuOpen));
  };
  const attachPanel = (host) => {
    if (!host?.isConnected) return;
    menuOpen = false;
    control.classList.remove('open');
    menu.classList.add('is-native-panel');
    menu.setAttribute('aria-hidden', 'false');
    controller.panelHost = host;
    host.append(menu);
  };
  const detachPanel = (host) => {
    if (controller.panelHost !== host) return;
    menu.classList.remove('is-native-panel');
    menu.setAttribute('aria-hidden', 'true');
    control.prepend(menu);
    controller.panelHost = null;
  };
  controller.attachPanel = attachPanel;
  controller.detachPanel = detachPanel;
  controller.open = () => {
    if (!controller.nativePanel) setMenuOpen(true);
    else controller.pending = true;
  };
  if (controller.panelHost) attachPanel(controller.panelHost);
  if (controller.pending) {
    controller.pending = false;
    if (!controller.nativePanel) setMenuOpen(true);
  }

  const showMessage = (message = '', kind = '') => {
    q('[data-role=message]').textContent = message;
    q('[data-role=message]').dataset.kind = kind;
  };

  const run = async (action) => {
    if (busy) return;
    busy = true;
    q('[data-role=panel]').classList.add('is-busy');
    qa('[data-role=panel] button').forEach((item) => { item.disabled = true; });
    try {
      await action();
      showMessage();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : String(error), 'error');
    } finally {
      busy = false;
      q('[data-role=panel]').classList.remove('is-busy');
      qa('[data-role=panel] button').forEach((item) => { item.disabled = false; });
      render();
    }
  };

  const makeServerRow = (item, onConnect, deletable = false) => {
    const row = button(deletable ? 'together-saved-row' : 'together-server-row');
    const copy = node('span');
    copy.append(node('strong', '', item.name || '一起听服务器'), node('small', '', `${item.address}${item.latencyMs != null ? ` · ${item.latencyMs}ms` : ''}`));
    row.append(copy, node('em', '', item.members != null ? `${item.members}/2` : (item.lastStatus || '')));
    row.addEventListener('click', onConnect);
    if (!deletable) return row;
    const wrap = node('div', 'together-saved-wrap');
    const remove = button('together-remove-btn', '×', (event) => {
      event.stopPropagation();
      run(async () => {
        await bridge.call('deleteServer', item.id);
        bridge.status.savedServers = await bridge.call('listSaved');
      });
    });
    remove.title = '删除';
    remove.setAttribute('aria-label', `删除 ${item.name || item.address}`);
    wrap.append(row, remove);
    return wrap;
  };

  const renderMember = (slot, member, fallback, switching = false) => {
    const target = q(`[data-presence-slot="${slot}"]`);
    target.dataset.memberState = switching && member ? 'switching' : member?.status || (slot ? 'offline' : 'connecting');
    renderAvatar(target.querySelector('[data-role=presence-avatar]'), member?.avatar || (slot ? 'default:mono' : 'default:signal'), member?.name || fallback);
    target.querySelector('[data-role=presence-name]').textContent = member?.name || fallback;
    target.querySelector('[data-role=presence-status]').textContent = member
      ? memberStatusText(switching ? { ...member, status: 'switching' } : member)
      : (slot ? '未连接' : '连接中');
    const expression = target.querySelector('[data-role=presence-expression]');
    const active = member?.expression && Number(member.expression.expiresAt) > Date.now();
    expression.hidden = !active;
    const key = active ? `${member.senderId}:${member.expression.time}:${member.expression.text}` : '';
    if (active && expression.dataset.expressionKey !== key) {
      expression.textContent = member.expression.text;
      expression.dataset.expressionKey = key;
      expression.classList.toggle('is-peer-expression', member.senderId !== bridge.status.clientId);
      expression.style.setProperty('--together-expression-duration', `${Math.max(1200, Number(member.expression.expiresAt) - Date.now())}ms`);
    } else if (!active) {
      expression.textContent = '';
      expression.dataset.expressionKey = '';
      expression.classList.remove('is-peer-expression');
      expression.style.removeProperty('--together-expression-duration');
    }
  };

  const playMessageTone = () => {
    try {
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor) return;
      if (!messageAudioContext) messageAudioContext = new AudioContextCtor();
      const now = messageAudioContext.currentTime;
      const oscillator = messageAudioContext.createOscillator();
      const gain = messageAudioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(560, now);
      oscillator.frequency.exponentialRampToValueAtTime(430, now + .16);
      gain.gain.setValueAtTime(.0001, now);
      gain.gain.exponentialRampToValueAtTime(.035, now + .018);
      gain.gain.exponentialRampToValueAtTime(.0001, now + .18);
      oscillator.connect(gain);
      gain.connect(messageAudioContext.destination);
      oscillator.start(now);
      oscillator.stop(now + .2);
    } catch (_) { }
  };

  const render = () => {
    const status = bridge.status || {};
    const connected = status.connectionState === 'connected';
    const room = bridge.room || status.room || {};
    const switching = connected && bridge.session.isSwitching();
    q('[data-role=switch-notice]').hidden = !switching;
    q('[data-view=lobby]').hidden = connected || status.connectionState === 'reconnecting';
    q('[data-view=room]').hidden = !connected && status.connectionState !== 'reconnecting';

    const profile = status.profile || { name: 'Folia 听众', avatar: 'default:signal' };
    const profileName = q('[data-role=profile-name]');
    // The native panel moves this input into a different ShadowRoot from the stage overlay.
    profileName.value = profile.name || '';
    selectedAvatar = profile.avatar || 'default:signal';
    renderAvatar(q('[data-role=profile-avatar]'), selectedAvatar, profile.name);
    qa('[data-avatar-preset]').forEach((item) => item.classList.toggle('is-selected', item.dataset.avatarPreset === selectedAvatar));

    const saved = status.savedServers || [];
    q('[data-role=saved-list]').replaceChildren(...(saved.length ? saved.map((item) => makeServerRow(item, () => run(async () => {
      q('[data-role=address]').value = item.address;
      if (item.requiresAuthorization && !q('[data-role=auth]').value) throw new Error('请输入该服务器的 6 位授权码');
      bridge.status = await bridge.call('connect', item.address, { authorizationCode: q('[data-role=auth]').value, savedServerId: item.id });
    }), true)) : [node('div', 'together-empty', '尚未保存服务器')]));
    q('[data-role=lan-list]').replaceChildren(...(rooms.length ? rooms.map((item) => makeServerRow(item, () => run(async () => {
      bridge.status = await bridge.call('connect', item.address, { authorizationCode: q('[data-role=auth]').value });
    }))) : [node('div', 'together-empty', '未发现局域网服务器')]));

    const presence = q('[data-role=presence]');
    const presenceVisible = !!((connected || ['reconnecting', 'disconnected'].includes(status.connectionState)) && room.members?.length);
    presence.hidden = !presenceVisible;
    presence.classList.toggle('is-visible', presenceVisible);
    presence.dataset.connectionState = status.connectionState || 'idle';
    presence.dataset.playbackState = room.transition && room.transition.phase !== 'go' ? 'waiting' : (room.playing ? 'playing' : 'paused');
    if (!connected && status.connectionState !== 'reconnecting') return;

    q('[data-role=room-name]').textContent = room.name || '一起听服务器';
    q('[data-role=room-state]').textContent = `${room.members?.length || 0}/2 · ${room.status || 'idle'}`;
    q('[data-role=quality-text]').textContent = `${status.transport?.label || '连接线路'}${status.latencyMs ? ` · ${Math.round(status.latencyMs)}ms` : ''} · ${status.transport?.qualityLabel || '检测中'}`;
    q('[data-role=quality]').dataset.quality = status.transport?.quality || 'measuring';
    q('[data-role=members-label]').textContent = (room.members || []).map((member) => member.name).join(' · ') || '等待成员';
    const host = status.hosting && status.host ? status.host : null;
    q('[data-role=host]').hidden = !host;
    if (host) {
      q('[data-role=host-address]').textContent = host.connectionAddresses?.[0] || host.localAddress || '';
      q('[data-role=host-code]').textContent = host.authorizationCode || '------';
    }
    const sessionKey = `${room.serverId || ''}:${room.sessionEpoch || ''}`;
    if (displayedSession !== sessionKey) {
      displayedSession = sessionKey;
      displayedTrack = null;
      displayedPosition = 0;
    }
    // Keep the panel on the last committed track until the GO operation has applied locally.
    if (!switching) {
      displayedTrack = room.queue && room.currentIndex >= 0 ? room.queue[room.currentIndex] : null;
      displayedPosition = authoritativePosition(room);
    }
    q('[data-role=track-title]').textContent = displayedTrack?.name || '等待播放第一首歌';
    q('[data-role=track-artist]').textContent = displayedTrack?.artist || '请使用 Folia 原生播放器开始播放';
    q('[data-role=progress]').style.width = `${displayedTrack?.duration ? Math.min(100, displayedPosition / displayedTrack.duration * 100) : 0}%`;
    const members = [...(room.members || [])].sort((a, b) => a.senderId === status.clientId ? -1 : b.senderId === status.clientId ? 1 : 0);
    renderMember(0, members[0], '等待成员', switching);
    renderMember(1, members[1], '等待好友', switching);

    const message = bridge.lastMessage;
    const messageKey = message ? `${message.operationId}:${message.userId}:${message.time}` : '';
    if (messageKey && messageKey !== lastMessageKey) {
      lastMessageKey = messageKey;
      if (message.userId && message.userId !== status.clientId) playMessageTone();
    }
  };

  q('[data-action=close-menu]').addEventListener('click', () => setMenuOpen(false));
  const address = q('[data-role=address]');
  const auth = q('[data-role=auth]');
  auth.addEventListener('input', () => { auth.value = auth.value.replace(/\D/g, '').slice(0, 6); });
  q('[data-action=connect]').addEventListener('click', () => run(async () => {
    bridge.status = await bridge.call('connect', address.value.trim(), { authorizationCode: auth.value.trim() });
  }));
  q('[data-action=create]').addEventListener('click', () => run(async () => {
    bridge.status = await bridge.call('createRoom', { name: q('[data-role=create-name]').value.trim(), port: q('[data-role=create-port]').value.trim() });
  }));
  q('[data-action=leave]').addEventListener('click', () => run(async () => {
    bridge.status = await bridge.call('leave', { stopHost: !!bridge.status.hosting });
  }));
  q('[data-action=discover]').addEventListener('click', () => run(async () => { rooms = await bridge.call('discover'); }));
  q('[data-action=save-address]').addEventListener('click', () => run(async () => {
    const value = address.value.trim();
    await bridge.call('saveServer', { name: value, address: value });
    bridge.status.savedServers = await bridge.call('listSaved');
  }));
  q('[data-role=profile-name]').readOnly = true;
  q('[data-role=profile-name]').title = '自动同步 Folia 已登录账号';
  q('[data-action=profile-save]').hidden = true;
  q('[data-role=profile-avatar]').disabled = true;
  q('[data-role=profile-avatar]').title = '自动同步账号头像';
  qa('[data-avatar-preset], [data-action=avatar-upload]').forEach(item => { item.hidden = true; });
  q('[data-presence-slot="0"] [data-role=presence-avatar]').disabled = true;
  q('[data-action=copy-address]').addEventListener('click', () => run(async () => {
    await navigator.clipboard.writeText(q('[data-role=host-address]').textContent);
    showMessage('地址已复制', 'ok');
  }));
  q('[data-action=copy-code]').addEventListener('click', () => run(async () => {
    await navigator.clipboard.writeText(q('[data-role=host-code]').textContent);
    showMessage('授权码已复制', 'ok');
  }));
  q('[data-role=chat-form]').addEventListener('submit', (event) => {
    event.preventDefault();
    const input = q('[data-role=chat-input]');
    const text = Array.from(input.value.trim()).slice(0, 50).join('');
    if (!text) return;
    run(async () => {
      await bridge.send('MESSAGE_SEND', { text, time: Date.now() });
      input.value = '';
    });
  });
  q('[data-action=chat-toggle]').addEventListener('click', (event) => {
    chatExpanded = !chatExpanded;
    q('[data-role=chat]').classList.toggle('is-collapsed', !chatExpanded);
    event.currentTarget.setAttribute('aria-expanded', String(chatExpanded));
    event.currentTarget.setAttribute('aria-label', chatExpanded ? '收起聊天输入' : '展开聊天输入');
    event.currentTarget.setAttribute('title', chatExpanded ? '收起聊天输入' : '展开聊天输入');
    if (chatExpanded) q('[data-role=chat-input]').focus();
  });

  Promise.all([
    ['send', q('[data-icon=send]'), 13],
    ['chevron-up', q('[data-icon=chat-toggle]'), 14],
  ].map(async ([name, target, size]) => {
    const icon = await folium.ui.icon(name, { size, strokeWidth: 1.8 });
    if (icon && target.isConnected) target.replaceChildren(icon);
  })).catch(() => {});

  const onWindowPointerDown = (event) => {
    if (!menuOpen || event.composedPath().includes(q('[data-role=control]'))) return;
    setMenuOpen(false);
  };
  const onWindowKeyDown = (event) => {
    if (event.key === 'Escape' && menuOpen) setMenuOpen(false);
  };
  window.addEventListener('pointerdown', onWindowPointerDown);
  window.addEventListener('keydown', onWindowKeyDown);
  const unsubscribe = bridge.subscribe(render);
  ctx.every(1000, () => {
    bridge.correctProgress();
    render();
  });
  render();

  return () => {
    if (controller.panelHost) detachPanel(controller.panelHost);
    controller.open = () => { controller.pending = true; };
    controller.attachPanel = (host) => { controller.panelHost = host; };
    controller.detachPanel = (host) => { if (controller.panelHost === host) controller.panelHost = null; };
    window.removeEventListener('pointerdown', onWindowPointerDown);
    window.removeEventListener('keydown', onWindowKeyDown);
    if (messageAudioContext) messageAudioContext.close().catch(() => {});
    unsubscribeTheme();
    unsubscribeView();
    unsubscribe();
    root.remove();
    style.remove();
  };
}

export function mountTogetherPanelEntry(folium, bridge, container, ctx, controller) {
  const style = node('style', '', `${OVERLAY_STYLE}\n${PANEL_ENTRY_STYLE}`);
  const root = node('section', 'together-overlay-root together-native-root');
  container.append(style, root);

  const paintTheme = () => applyTheme(root, ctx);
  const unsubscribeTheme = ctx.onChange?.(paintTheme) || (() => {});
  paintTheme();
  controller.attachPanel(root);
  controller.pending = false;
  return () => {
    controller.detachPanel(root);
    unsubscribeTheme();
    root.remove();
    style.remove();
  };
}
