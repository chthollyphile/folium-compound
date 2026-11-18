import { PlaybackSession } from './playbackSession.mjs?v=1.4.5';
import { getLocalUserProfile } from './accountSync.mjs?v=1.4.5';
import { mountTogetherOverlay, mountTogetherPanelEntry } from './overlay-ui.mjs?v=1.4.5';

// UI/RPC composition; playback state belongs to PlaybackSession.
export class FoliaTogetherBridge {
    constructor(folium) {
        this.folium = folium;
        this.status = { connectionState: 'idle', savedServers: [], room: null };
        this.room = null;
        this.view = 'home';
        this.listeners = new Set();
        this.disposers = [];
        this.lastMessage = null;
        this.disposed = false;
        this.profileExecution = Promise.resolve();
        this.session = new PlaybackSession(folium, (...args) => this.send(...args), error => this.report(error), () => this.notify());
    }
    get connected() { return this.status.connectionState === 'connected'; }
    subscribe(listener) { this.listeners.add(listener); listener(); return () => this.listeners.delete(listener); }
    notify() { if (!this.disposed) this.listeners.forEach(listener => listener()); }
    report(error) {
        this.folium.log.warn('[Together] action failed', error);
        this.folium.ui.toast(error instanceof Error ? error.message : String(error), { type: 'error' });
    }
    async start() {
        if (Number(this.folium.host?.folium?.minor) < 7) throw new Error('需要稳定 Folium 1.7 或更新版本');
        const on = (name, fn) => this.disposers.push(this.folium.events.on(name, value => {
            Promise.resolve().then(() => fn(value)).catch(error => this.report(error));
        }));
        this.disposers.push(this.folium.rpc.on('event', event => this.handleMainEvent(event)));
        on('app.viewChanged', ({ view }) => { this.view = view; this.notify(); });
        on('account.changed', () => this.refreshProfile());
        on('playback.songChanged', ({ song }) => this.session.song(song));
        on('playback.stateChanged', ({ state }) => this.session.state(state));
        on('playback.seeked', ({ position }) => this.session.seek(position));
        on('playback.queueChanged', event => this.session.queueChanged(event));
        // The hook must decide synchronously; notification events above may be deferred.
        this.disposers.push(this.folium.events.on('playback.beforePlay', event => this.session.beforePlay(event)));
        this.disposers.push(this.folium.events.on('lyrics.transform', event => this.session.transformLyrics(event)));
        on('playback.loopModeChanged', ({ mode }) => {
            if (this.session.canPublish() && (mode === 'one' ? 'single' : 'loop') !== this.room.mode)
                return this.session.core.request('SET_MODE', { mode: mode === 'one' ? 'single' : 'loop' });
        });
        on('playback.failed', () => {
            if (this.connected) return this.send('PRESENCE', { status: 'error' }, 'system');
        });
        this.status = await this.folium.rpc.call('status');
        this.room = this.status.room || null;
        await this.refreshProfile();
        if (this.room) await this.session.accept({ state: this.room }, this.connected, this.status.clientId);
    }
    refreshProfile() {
        this.profileExecution = this.profileExecution.catch(() => {}).then(async () => {
            if (this.disposed) return;
            const profile = getLocalUserProfile(this.folium);
            if (profile.name === this.status.profile?.name && profile.avatar === this.status.profile?.avatar) return;
            const saved = await this.folium.rpc.call('saveProfile', profile);
            if (this.disposed) return;
            this.status.profile = saved;
            if (this.connected) await this.send('PRESENCE', saved, 'system');
            this.notify();
        });
        return this.profileExecution;
    }
    async call(name, ...args) {
        if (name === 'connect' || name === 'createRoom') await this.refreshProfile();
        const result = await this.folium.rpc.call(name, ...args);
        if (result?.connectionState) this.handleMainEvent({ kind: 'status', status: result });
        return result;
    }
    send(action, payload = {}, source = 'local', operationId = '') {
        return this.folium.rpc.call('sendOperation', action, payload, source, operationId);
    }
    handleMainEvent(event) {
        if (this.disposed || !event) return;
        if (event.kind === 'status') {
            this.status = event.status;
            this.room = this.status.room || null;
            if (!this.connected) this.session.disconnect(this.status.connectionState === 'idle');
        } else if (event.kind === 'room-state') {
            this.room = event.state;
            this.status = { ...this.status, room: this.room };
            this.session.accept(event, this.connected, this.status.clientId).catch(error => this.report(error));
        } else if (event.kind === 'message') this.lastMessage = event;
        else if (event.kind === 'error') {
            this.session.pendingTrack = '';
            this.session.core.rejectPrediction(event.operationId);
            this.report(new Error('联机错误：' + event.code));
        }
        this.notify();
    }
    // Existing view contract; the session owns the synchronization timer.
    correctProgress() {}
    dispose() {
        this.disposed = true;
        this.session.dispose();
        this.disposers.splice(0).reverse().forEach(dispose => dispose());
        this.listeners.clear();
        this.folium.rpc.call('leave', { stopHost: true }).catch(error => this.folium.log.warn('[Together] leave failed', error));
    }
}

export default async function activate(folium) {
  if (folium.env.context !== 'main') return undefined;
  const bridge = new FoliaTogetherBridge(folium);
  try { await bridge.start(); } catch (error) { bridge.dispose(); throw error; }
  const hasPlayerPanelEntry = typeof folium.registries.playerPanelTabs?.register === 'function';
  const controller = {
    nativePanel: hasPlayerPanelEntry,
    panelHost: null,
    pending: false,
    open: () => { controller.pending = true; },
    attachPanel: (host) => { controller.panelHost = host; },
    detachPanel: (host) => { if (controller.panelHost === host) controller.panelHost = null; },
  };
  folium.registries.stageLayers.register({
    id: 'together-listen-overlay',
    slot: 'app.overlay',
    order: 720,
    interactive: false,
    mount: (container, ctx) => mountTogetherOverlay(folium, bridge, container, ctx, controller),
  });
  if (hasPlayerPanelEntry) {
    folium.registries.playerPanelTabs.register({
      id: 'together-listen',
      label: { 'zh-CN': '一起听', en: 'Together' },
      order: 900,
      mount: (container, ctx) => mountTogetherPanelEntry(folium, bridge, container, ctx, controller),
    });
  } else {
    folium.log.warn('Together Listen player panel entry is unavailable on this Folium build; use the command palette entry instead');
  }
  folium.registries.commands.register({
    id: 'open-together-listen',
    label: { 'zh-CN': '打开 Jiafee 一起听', en: 'Open Jiafee Listen Together' },
    description: { 'zh-CN': '打开双人联机房间', en: 'Open the two-person listening room' },
    icon: 'radio',
    keywords: ['together', 'room', '一起听', '联机'],
    run: () => {
      if (!hasPlayerPanelEntry) {
        controller.open();
        return;
      }
      folium.ui.navigate('player');
      folium.ui.openPlayerPanel('together-listen');
    },
  });
  return () => bridge.dispose();
}
