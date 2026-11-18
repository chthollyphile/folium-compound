import { PlaybackController } from './vendorPlaybackCore.mjs?v=1.4.5';
import { FoliumPlayerAdapter } from './foliumPlayerAdapter.mjs?v=1.4.5';
import { canonicalSongKey, serializeTrack, protocolMode } from './playback-core.mjs?v=1.4.5';
import { queueEdits } from './queue-sync.mjs?v=1.4.5';
import { TrackSelectionGate } from './track-selection-gate.mjs?v=1.4.5';

// Latest Mineradio authority controller, with Folium events converted to local intents here only.
export class PlaybackSession {
    constructor(folium, send, report, notify = () => {}) {
        this.folium = folium;
        this.room = null;
        this.pendingTrack = '';
        this.localExecution = Promise.resolve();
        this.stateIntentVersion = 0;
        this.stateIntentCount = 0;
        this.gate = new TrackSelectionGate();
        this.notify = notify;
        this.lyricsHeld = false;
        this.selectionGuard = null;
        this.adapter = new FoliumPlayerAdapter(folium, () => this.room, ref => this.gate.permit(ref));
        this.core = new PlaybackController({ adapter: this.adapter, send, onError: report,
            hasPendingLocalIntent: () => this.stateIntentCount > 0 || !!this.pendingTrack,
            onState: () => { this.releaseLyricsIfReady(); this.notify(); } });
        this.send = send;
        this.timer = null;
    }
    accept(event, connected, clientId) {
        if (this.room && event.state?.serverId === this.room.serverId
            && event.state?.sessionEpoch === this.room.sessionEpoch
            && event.state.version < this.room.version) return Promise.resolve();
        this.room = event.state;
        const members = this.room?.members || [];
        const paired = connected && new Set(members.map(member => member.senderId)).size === 2;
        this.gate.setPaired(paired);
        this.gate.observe(this.room);
        this.core.setConnection(paired, clientId);
        if (paired && !this.timer) this.timer = setInterval(() => this.core.correctProgress(this.room), 1000);
        if (!paired) { clearInterval(this.timer); this.timer = null; return Promise.resolve(); }
        if (this.pendingTrack && this.room.currentTrackId === this.pendingTrack && this.room.transition) this.pendingTrack = '';
        if (this.room.transition?.phase === 'go'
            && this.selectionGuard?.trackId === this.room.currentTrackId) this.stopSelectionGuard();
        if (this.pendingTrack) return Promise.resolve();
        return this.core.acceptAuthority(event);
    }
    song(song) {
        this.localExecution = this.localExecution.then(async () => {
            const track = serializeTrack(song);
            if (!this.core.connected || !track || this.pendingTrack === track.trackId) return;
            if (!this.room.currentTrackId && !this.folium.playback.getQueue({ offset: 0, limit: 1 }).length) return;
            if (canonicalSongKey(this.folium.playback.getState().song) !== track.trackId || this.room?.currentTrackId === track.trackId) return;
            this.pendingTrack = track.trackId;
            this.notify();
            const clientId = this.core.clientId;
            this.core.setConnection(false);
            this.core.setConnection(true, clientId);
            this.adapter.pauseAtStart();
            try {
                if (!this.room.currentTrackId) {
                    await this.core.request('RESYNC', { snapshot: { queue: [track], currentIndex: 0,
                        position: 0, playing: false, mode: protocolMode(this.folium.playback.getLoopMode()) } });
                } else if (!this.room.queue.some(item => item.trackId === track.trackId)) {
                    await this.core.request('QUEUE_ADD', { track, index: this.room.queue.length });
                }
                await this.core.dispatchLocal('NEXT', { targetTrackId: track.trackId, playing: true });
            } catch (error) { this.pendingTrack = ''; this.notify(); throw error; }
        });
        const result = this.localExecution;
        this.localExecution = result.catch(() => {});
        return result;
    }
    canPublish() {
        return this.core.connected && !this.core.executing && !this.pendingTrack
            && this.adapter.readState().trackId === this.room?.currentTrackId
            && this.room?.currentTrackId && !['preparing', 'awaiting-end'].includes(this.room.transition?.phase);
    }
    isSwitching() {
        if (!this.core.connected) return false;
        const transition = this.room?.transition;
        if (this.selectionGuard || this.pendingTrack || (transition && transition.phase !== 'go')) return true;
        return !!(transition && transition.phase === 'go'
            && (this.core.machine.state.trackId !== this.room.currentTrackId
                || this.core.machine.state.status !== (this.room.playing ? 'playing' : 'paused')));
    }
    transformLyrics(event) {
        if (!this.isSwitching()) return;
        const trackId = canonicalSongKey(event.song);
        if (!trackId || (trackId !== this.room?.currentTrackId && trackId !== this.pendingTrack
            && trackId !== this.selectionGuard?.trackId)) return;
        event.lines = [];
        this.lyricsHeld = true;
    }
    releaseLyricsIfReady() {
        if (!this.lyricsHeld || !this.core.connected || this.isSwitching()) return;
        this.refreshHeldLyrics();
    }
    refreshHeldLyrics() {
        if (!this.lyricsHeld) return;
        this.lyricsHeld = false;
        try { this.folium.lyrics?.refresh(); }
        catch (error) { this.folium.log.warn('[Together] lyric refresh failed', error); }
    }
    beforePlay(event) {
        if (this.gate.allow(event.song, this.isSwitching())) {
            const trackId = canonicalSongKey(event.song);
            if (this.core.connected && trackId && trackId !== this.room?.currentTrackId)
                this.startSelectionGuard(trackId);
            return;
        }
        event.cancel();
        const now = Date.now();
        if (!this.lastLockNoticeAt || now - this.lastLockNoticeAt > 1800) {
            this.lastLockNoticeAt = now;
            this.folium.ui.toast('正在切歌，请稍后再选歌曲', { type: 'info' });
        }
    }
    startSelectionGuard(trackId) {
        this.stopSelectionGuard();
        const guard = { trackId, interval: null, timeout: null };
        guard.interval = setInterval(() => {
            if (!this.core.connected) { this.stopSelectionGuard(); return; }
            try {
                const actual = this.adapter.readState();
                if (actual.trackId === trackId && actual.playing) this.adapter.pause();
            } catch (error) {
                this.stopSelectionGuard();
                this.folium.log.warn('[Together] selection pause guard failed', error);
            }
        }, 40);
        guard.timeout = setTimeout(() => this.stopSelectionGuard(), 15000);
        this.selectionGuard = guard;
        this.notify();
    }
    stopSelectionGuard() {
        if (!this.selectionGuard) return;
        clearInterval(this.selectionGuard.interval);
        clearTimeout(this.selectionGuard.timeout);
        this.selectionGuard = null;
        this.releaseLyricsIfReady();
        this.notify();
    }
    async state(value) {
        const intent = ++this.stateIntentVersion;
        const epoch = this.core.connectionEpoch;
        const actual = this.folium.playback.getState();
        if (!this.core.connected || this.pendingTrack || !this.room?.currentTrackId
            || ['preparing', 'awaiting-end'].includes(this.room.transition?.phase)
            || value !== actual.state || canonicalSongKey(actual.song) !== this.room.currentTrackId) return;
        if ((value === 'playing') === this.room.playing || value === 'stopped') return;
        // Folium notifications can arrive while an unrelated authority task is awaiting the host.
        // Keep the intent, then recheck it; never drop it solely because the controller is busy.
        this.stateIntentCount++;
        try {
            await this.core.whenIdle();
            const current = this.folium.playback.getState();
            if (intent !== this.stateIntentVersion || epoch !== this.core.connectionEpoch
                || !this.canPublish() || current.state !== value
                || canonicalSongKey(current.song) !== canonicalSongKey(actual.song)
                || (value === 'playing') === this.room.playing) return;
            return await this.core.dispatchLocal(value === 'playing' ? 'PLAY' : 'PAUSE',
                { trackId: this.room.currentTrackId, position: current.position });
        } finally { this.stateIntentCount--; }
    }
    seek(position) {
        if (!this.canPublish()) return;
        const own = this.adapter.lastSeek;
        if (own && own.until > Date.now() && Math.abs(own.position - position) < 0.2) { this.adapter.lastSeek = null; return; }
        if (this.adapter.readState().trackId !== this.room.currentTrackId) return;
        return this.core.dispatchLocal('SEEK', { trackId: this.room.currentTrackId, position });
    }
    async queueChanged(event) {
        const changed = await this.adapter.queue.queueChanged(event);
        if (!this.canPublish() || !changed) return;
        const local = this.folium.playback.getQueue({ offset: 0, limit: 200 }).items.map(item => serializeTrack(item.song)).filter(Boolean);
        for (const edit of queueEdits(this.room.queue, local)) await this.core.request(edit.type, edit.payload);
    }
    disconnect(final = false) {
        this.stateIntentVersion++;
        this.stopSelectionGuard();
        this.gate.setPaired(false);
        this.core.setConnection(false);
        this.refreshHeldLyrics();
        this.adapter.cancelPendingWait();
        this.pendingTrack = '';
        clearInterval(this.timer); this.timer = null;
        if (final) { this.core.resetSessionIdentity(); this.room = null; }
    }
    dispose() { this.disconnect(true); this.adapter.dispose(); }
}
