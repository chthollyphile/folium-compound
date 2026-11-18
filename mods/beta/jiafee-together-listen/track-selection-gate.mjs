const SELECTION_INTERVAL_MS = 2500;
const GO_SETTLE_MS = 2000;

export class TrackSelectionGate {
    constructor(now = Date.now) {
        this.now = now;
        this.reset();
    }
    reset() {
        this.paired = false;
        this.cooldownUntil = 0;
        this.transitionId = '';
        this.transitionPhase = '';
        this.internalRef = '';
    }
    setPaired(paired) {
        if (!paired) this.reset();
        else this.paired = true;
    }
    observe(room) {
        if (!this.paired) return;
        const transition = room?.transition;
        const id = String(transition?.id || '');
        const phase = String(transition?.phase || '');
        if (id && phase === 'go' && (id !== this.transitionId || this.transitionPhase !== 'go'))
            this.cooldownUntil = Math.max(this.cooldownUntil, this.now() + GO_SETTLE_MS);
        this.transitionId = id;
        this.transitionPhase = phase;
    }
    permit(ref) {
        const value = String(ref || '');
        this.internalRef = value;
        return () => { if (this.internalRef === value) this.internalRef = ''; };
    }
    allow(song, pendingTrack = false) {
        if (!this.paired) return true;
        if (this.internalRef && song?.ref === this.internalRef) {
            this.internalRef = '';
            return true;
        }
        if (pendingTrack || (this.transitionPhase && this.transitionPhase !== 'go')
            || this.now() < this.cooldownUntil) return false;
        this.cooldownUntil = this.now() + SELECTION_INTERVAL_MS;
        return true;
    }
}
