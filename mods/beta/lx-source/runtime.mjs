import { httpUrl, requestOptions, scriptInfo, sourcesOf } from './protocol.mjs';
import { lxWorker, sandboxRelay } from './worker.mjs';

// Owns the sandbox, bounded script calls and the only network bridge available to an LX source.
export function createRuntime(folium, rawScript, { timeoutMs = 35000, initTimeoutMs = timeoutMs } = {}) {
    const info = scriptInfo(rawScript);
    const frame = document.createElement('iframe');
    frame.hidden = true;
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.srcdoc = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; worker-src blob:; connect-src 'none'"><script>(${sandboxRelay.toString()})()<\/script>`;
    const { port1, port2 } = new MessageChannel();
    const pending = new Map();
    let sequence = 0;
    let stopped = false;
    let activeHttp = 0;
    let requestTimes = [];
    let resolveReady;
    let rejectReady;
    const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
    const initTimer = setTimeout(() => dispose(new Error('LX: initialization timed out')), initTimeoutMs);

    function dispose(error = new Error('LX: source stopped')) {
        if (stopped) return;
        stopped = true;
        clearTimeout(initTimer);
        rejectReady(error);
        for (const item of pending.values()) { clearTimeout(item.timer); item.reject(error); }
        pending.clear();
        port1.postMessage({ kind: 'stop' });
        port1.close();
        frame.remove();
    }

    async function http(data) {
        const now = Date.now();
        requestTimes = requestTimes.filter(time => now - time < 60000);
        if (activeHttp >= 8 || requestTimes.length >= 120) throw new Error('LX: request rate limit');
        requestTimes.push(now);
        activeHttp += 1;
        try {
            const response = await folium.net.fetch(httpUrl(data.url), requestOptions(data.options));
            let body = response.text();
            try { body = JSON.parse(body); } catch { /* LX also returns plain text. */ }
            return { statusCode: response.status, statusMessage: response.statusText, headers: response.headers, body };
        } finally { activeHttp -= 1; }
    }

    port1.onmessage = async ({ data }) => {
        if (stopped || !data || typeof data !== 'object') return;
        if (data.kind === 'ready') port1.postMessage({ kind: 'start', info });
        else if (data.kind === 'initialized') {
            try { const sources = sourcesOf(data.payload); clearTimeout(initTimer); resolveReady(sources); }
            catch (error) { dispose(error); }
        } else if (data.kind === 'failure') dispose(new Error(String(data.error)));
        else if (data.kind === 'result') {
            const item = pending.get(data.id);
            if (!item) return;
            pending.delete(data.id);
            clearTimeout(item.timer);
            if (data.error) item.reject(new Error(String(data.error)));
            else item.resolve(data.result);
        } else if (data.kind === 'http') {
            let response;
            let error;
            try { response = await http(data); } catch (caught) { error = String(caught?.message ?? caught); }
            if (!stopped) port1.postMessage({ kind: 'httpResult', id: data.id, response, error });
        }
    };
    frame.onload = () => {
        if (!stopped) frame.contentWindow.postMessage({ kind: 'connect', worker: `(${lxWorker.toString()})()` }, '*', [port2]);
    };
    document.body.append(frame);
    return {
        info, ready, dispose, get active() { return !stopped; },
        call(payload) {
            if (stopped) return Promise.reject(new Error('LX: source stopped; import or enable it again'));
            if (pending.size >= 16) return Promise.reject(new Error('LX: too many pending calls'));
            return new Promise((resolve, reject) => {
                const id = ++sequence;
                const timer = setTimeout(() => dispose(new Error('LX: request timed out; source stopped')), timeoutMs);
                pending.set(id, { resolve, reject, timer });
                port1.postMessage({ kind: 'call', id, payload });
            });
        },
    };
}

