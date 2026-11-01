// Runs only inside the opaque-origin worker; scripts receive no Folium or Electron objects.
export function lxWorker() {
    const emit = globalThis.postMessage.bind(globalThis);
    const callbacks = new Map();
    let sequence = 0;
    let handler;
    let initialized = false;
    const EVENT_NAMES = Object.freeze({ request: 'request', inited: 'inited', updateAlert: 'updateAlert' });
    const errorText = error => String(error?.message ?? error).slice(0, 1000);
    globalThis.onmessage = async ({ data }) => {
        try {
            if (data.kind === 'start') {
                globalThis.lx = Object.freeze({
                    env: 'desktop', version: '2.0.0', EVENT_NAMES,
                    currentScriptInfo: Object.freeze(data.info), utils: Object.freeze({}),
                    on(event, callback) {
                        if (event !== EVENT_NAMES.request || typeof callback !== 'function') throw new Error('LX: unsupported listener');
                        handler = callback;
                    },
                    send(event, payload) {
                        if (event === EVENT_NAMES.inited && !initialized) {
                            if (!handler) throw new Error('LX: request handler is missing');
                            initialized = true;
                            emit({ kind: 'initialized', payload });
                        }
                        // Updates never execute or open URLs automatically.
                        return Promise.resolve();
                    },
                    request(url, options, callback) {
                        if (typeof callback !== 'function') throw new Error('LX: callback required');
                        const id = ++sequence;
                        callbacks.set(id, callback);
                        emit({ kind: 'http', id, url, options });
                        return () => {
                            const pending = callbacks.get(id);
                            callbacks.delete(id);
                            pending?.(new Error('LX: request aborted'));
                        };
                    },
                });
                // This evaluation is in a dedicated worker in a sandboxed, opaque-origin iframe.
                new Function(data.info.rawScript)();
            } else if (data.kind === 'httpResult') {
                const callback = callbacks.get(data.id);
                callbacks.delete(data.id);
                callback?.(data.error ? new Error(data.error) : null, data.response, data.response?.body);
            } else if (data.kind === 'call') {
                if (!initialized || !handler) throw new Error('LX: source is not initialized');
                const result = await handler(data.payload);
                emit({ kind: 'result', id: data.id, result });
            }
        } catch (error) {
            emit({ kind: data.kind === 'call' ? 'result' : 'failure', id: data.id, error: errorText(error) });
        }
    };
    globalThis.addEventListener('unhandledrejection', event => {
        emit({ kind: 'failure', error: errorText(event.reason) });
        event.preventDefault();
    });
}

// This relay has no script code in its document realm; even a busy-looping script is terminable.
export function sandboxRelay() {
    addEventListener('message', function connect(event) {
        if (event.source !== parent || event.data?.kind !== 'connect' || !event.ports[0]) return;
        removeEventListener('message', connect);
        const port = event.ports[0];
        const url = URL.createObjectURL(new Blob([event.data.worker], { type: 'text/javascript' }));
        const worker = new Worker(url);
        URL.revokeObjectURL(url);
        worker.onmessage = ({ data }) => port.postMessage(data);
        worker.onerror = () => port.postMessage({ kind: 'failure', error: 'LX: worker failed' });
        port.onmessage = ({ data }) => {
            if (data.kind === 'stop') { worker.terminate(); port.close(); }
            else worker.postMessage(data);
        };
        port.postMessage({ kind: 'ready' });
    });
}

