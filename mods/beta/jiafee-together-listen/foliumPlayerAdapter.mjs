import { canonicalSongKey, foliumLoopMode } from './playback-core.mjs?v=1.4.6';
import { QueueSync } from './queue-sync.mjs?v=1.4.6';

// All host access is through the stable Folium playback and Omni services.
// Official 0.7.28 pauses media after a fixed 200ms fade + 15ms timer grace.
// A paused snapshot is not media-ready: also wait for its position to settle.
const PAUSE_SETTLE_MS = 700;
const PAUSE_OUTPUT_SETTLE_MS = 250;
const START_FADE_TOLERANCE_SECONDS = 0.5;
const PREPARATION_TIMEOUT_MS = 8000;
const MAX_PREPARATION_REBASES = 2;

export class FoliumPlayerAdapter {
    constructor(folium, currentRoom, permitSelection = () => () => {}, isSelecting = () => false) {
        this.host = folium.playback;
        this.currentRoom = currentRoom;
        this.permitSelection = permitSelection;
        this.isSelecting = isSelecting;
        this.log = folium.log;
        this.generation = 0;
        this.preparationTimeoutMs = PREPARATION_TIMEOUT_MS;
        this.lastSeek = null;
        this.ownsPreparationMute = false;
        this.preparationMuteRelease = null;
        this.queue = new QueueSync({ playback: this.host, omni: folium.omni,
            notice: message => folium.ui.toast(message, { type: 'error' }), log: folium.log,
            isCurrent: room => this.currentRoom()?.sessionEpoch === room.sessionEpoch
                && this.currentRoom()?.serverId === room.serverId });
    }
    readState() {
        const state = this.host.getState();
        return { trackId: canonicalSongKey(state.song), position: state.position,
            playing: state.state === 'playing', status: state.state };
    }
    pause() { this.host.pause(); }
    play() { this.host.play(); }
    holdPreparationAudio() {
        clearTimeout(this.preparationMuteRelease);
        this.preparationMuteRelease = null;
        if (this.ownsPreparationMute || typeof this.host.getVolume !== 'function'
            || typeof this.host.setMuted !== 'function' || this.host.getVolume().muted) return;
        this.host.setMuted(true);
        this.ownsPreparationMute = true;
    }
    releasePreparationAudio(waitForPause = false, force = false) {
        if (!this.ownsPreparationMute || (!force && this.isSelecting())) return;
        clearTimeout(this.preparationMuteRelease);
        if (waitForPause) {
            this.preparationMuteRelease = setTimeout(() => {
                try { this.releasePreparationAudio(false, force); }
                catch (error) { this.log.warn('[Together] mute restoration failed', error); }
            }, PAUSE_OUTPUT_SETTLE_MS);
            return;
        }
        this.preparationMuteRelease = null;
        this.ownsPreparationMute = false;
        this.host.setMuted(false);
    }
    abortPreparationAudio() {
        if (!this.ownsPreparationMute) return;
        try { if (this.readState().playing) this.pause(); }
        finally { this.releasePreparationAudio(true, true); }
    }
    seek(position) {
        this.lastSeek = { position, until: Date.now() + 1000 };
        this.host.seek(position);
    }
    pauseAtStart() {
        // seekMainAudio resumes playback and cancels pending pause. Pause MUST be last.
        this.seek(0);
        this.pause();
    }
    setMode(mode) {
        const wanted = foliumLoopMode(mode);
        if (mode !== 'shuffle' && this.host.getLoopMode() !== wanted) this.host.setLoopMode(wanted);
    }
    cancelPendingWait() { this.generation++; this.queue.cancel(); }
    async resetSessionPlayback(room) {
        this.lastSeek = null;
        let cleared = false;
        if (typeof this.host.clearCurrent === 'function') {
            const result = await this.host.clearCurrent();
            cleared = result === true || result?.ok === true;
        }
        if (!cleared) {
            const current = this.readState();
            if (current.trackId) this.pauseAtStart();
            else if (current.playing) this.pause();
        }
        await this.replace({ ...room, queue: [] });
    }
    async replace(room) {
        const generation = this.generation;
        if (await this.queue.request(room)) return;
        for (let attempt = 0; attempt < 200 && this.queue.pending; attempt++) {
            if (generation !== this.generation) throw new Error('FOLIUM_OPERATION_CANCELLED');
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        const actual = this.host.getQueue({ offset: 0, limit: 200 }).items.map(item => canonicalSongKey(item.song));
        if (generation !== this.generation || actual.join('\n') !== room.queue.map(item => item.trackId).join('\n'))
            throw new Error('FOLIUM_QUEUE_SYNC_REFUSED');
    }
    async syncQueue(room) {
        const local = this.host.getQueue({ offset: 0, limit: 200 });
        if (local.items.map(item => canonicalSongKey(item.song)).join('\n') === room.queue.map(item => item.trackId).join('\n')) return;
        await this.replace(room);
    }
    async switchTrack(room) {
        const generation = this.generation;
        const item = this.host.getQueue({ offset: 0, limit: 200 }).items[room.currentIndex];
        if (!item || canonicalSongKey(item.song) !== room.currentTrackId) return false;
        const release = this.permitSelection(item.song.ref);
        let guardError = null;
        // playQueueItem can start audio well before its promise resolves.
        const guard = setInterval(() => {
            if (generation !== this.generation) return;
            try {
                const state = this.readState();
                if (state.trackId === room.currentTrackId && state.playing) this.pause();
            } catch (error) { guardError = error; }
        }, 40);
        let accepted;
        try { accepted = await this.host.playQueueItem(item.index, item.song.ref); }
        finally { clearInterval(guard); release(); }
        if (guardError) throw guardError;
        if (generation !== this.generation) return false;
        this.pause();
        return accepted && this.readState().trackId === room.currentTrackId;
    }
    async waitUntilReady(trackId, isCurrent) {
        const generation = this.generation;
        if (!isCurrent() || this.readState().trackId !== trackId) return false;
        this.pauseAtStart();
        let startedAt = Date.now(), rebases = 0;
        const deadline = startedAt + this.preparationTimeoutMs;
        let stableSince = null, stablePosition = null;
        // Folium exposes a playback snapshot, not media canplay readiness. Never claim otherwise.
        while (Date.now() < deadline) {
            if (generation !== this.generation || !isCurrent()) return false;
            const state = this.readState();
            const now = Date.now();
            if (state.trackId !== trackId) return false;
            if (state.playing) this.pause();
            const nearStart = state.trackId === trackId && state.status === 'paused'
                && Number.isFinite(state.position) && state.position >= 0
                && state.position <= START_FADE_TOLERANCE_SECONDS;
            if (nearStart && now - startedAt >= PAUSE_SETTLE_MS) {
                if (stablePosition === null || Math.abs(state.position - stablePosition) > 0.01) {
                    stableSince = now;
                    stablePosition = state.position;
                } else if (now - stableSince >= 150) return true;
            } else { stableSince = null; stablePosition = null; }
            if (!nearStart && now - startedAt >= PAUSE_SETTLE_MS && rebases < MAX_PREPARATION_REBASES) {
                // A late media start can undo the first pause or start past zero. Rebase only
                // after observing that state, with a strict limit to avoid a seek loop.
                if (generation !== this.generation || !isCurrent()) return false;
                this.pauseAtStart();
                startedAt = Date.now();
                rebases++;
                stableSince = null;
                stablePosition = null;
            }
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        return false;
    }
    dispose() { this.cancelPendingWait(); this.queue.dispose(); }
}
