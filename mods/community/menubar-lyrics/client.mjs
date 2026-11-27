// client.mjs — the renderer half of the mod.
//
// Playback control happens here, through the public `folium.playback.*` API.
// The Node half cannot call into the renderer, so it hands a command over by
// resolving a pending `folium.rpc.call()`: one call is always in flight, so a
// click in the tray menu reaches the player immediately. Nothing here touches
// host internals or global objects.
//
// The command names must match the `dispatchCommand()` calls in index.cjs.

export default function activate(folium) {
    let stopped = false;

    // One log line so a support question can be answered without probing:
    // Folia 0.8.0 has `host.folia`, older hosts leave it empty.
    try {
        const host = folium.host || {};
        const app = String(host.folia || '未知');
        const minor = (host.folium && host.folium.minor) || 0;
        folium.log.info(`菜单栏歌词就绪（Folia ${app} / 模组 API 1.${minor}）`);
    } catch (error) { /* logging must never break activation */ }

    const actions = {
        toggle: () => folium.playback.toggle(),
        next: () => folium.playback.next(),
        previous: () => folium.playback.previous(),
        like: () => folium.playback.toggleLike(),
    };

    const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

    // `folium.rpc.call` resolves with the handler's return value; tolerate a
    // host that hands back its `{ ok, result }` envelope instead.
    const unwrap = (reply) => {
        if (reply && typeof reply === 'object' && typeof reply.ok === 'boolean') {
            return reply.ok ? reply.result : null;
        }
        return reply;
    };

    const loop = async () => {
        while (!stopped) {
            let reply = null;
            try {
                reply = await folium.rpc.call('menubar-lyrics.command');
            } catch (error) {
                if (stopped) return;
                await sleep(1000);
                continue;
            }
            const payload = unwrap(reply);
            const command = payload && typeof payload === 'object' ? payload.command : null;
            if (!command) {
                if (stopped) return;
                await sleep(200);
                continue;
            }
            const action = actions[command];
            if (!action) continue;
            try {
                await action();
            } catch (error) {
                // Nothing is playing, the provider is offline, … — the menu
                // stays usable, the command simply has no effect.
            }
        }
    };

    void loop();

    folium.onDispose(() => {
        stopped = true;
    });
}
