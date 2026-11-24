import { translator } from './labels.mjs';
import { NATIVE_VERSION, callHost } from './support.mjs';

// The mod page shows status and advanced properties; the background page owns the wallpaper library.
export function mountSummary(folium, container, ctx, selectProperties) {
    const t = translator(ctx.locale);
    const root = document.createElement('div');
    root.className = 'we-mod-summary';
    root.style.cssText = 'display:flex;flex-direction:column;gap:12px;font-size:13px;line-height:1.6';
    const title = document.createElement('strong'); title.textContent = 'Wallpaper Engine · '+NATIVE_VERSION;
    const hint = document.createElement('p'); hint.textContent = t('settingsLocation'); hint.style.margin = '0';
    const advanced = document.createElement('p'); advanced.textContent = t('advancedHint'); advanced.style.margin = '0';
    const status = document.createElement('div'); status.setAttribute('role','status'); status.textContent = t('loading');
    root.append(title,hint,status,advanced); container.append(root);
    let disposed = false, snapshot;
    const theme = () => { const colors=ctx.getTheme();root.style.color=colors.primaryColor;hint.style.color=colors.secondaryColor;advanced.style.color=colors.secondaryColor; };
    const render = state => {
        if(disposed) return;
        status.textContent = state.phase === 'streaming' ? t('ready')+' · '+state.width+' × '+state.height+' · '+t('fps')+' '+state.fps+' FPS'
            : state.phase === 'error' ? state.message : state.phase === 'paused' ? t('paused') : state.phase === 'opening' ? t('opening') : t('idle');
    };
    const selection = () => {
        if(disposed || !snapshot) return;
        const settings=ctx.settings.get();
        const id=settings.followWE ? snapshot.selectedId || settings.source : settings.source;
        void selectProperties(id,settings.presetName || '').catch(error=>{if(!disposed)status.textContent=error.message;});
    };
    const offTheme=ctx.onChange(theme),offSettings=ctx.settings.onChange(selection);
    const offStatus=folium.rpc.on('native-status',render);
    const offSelection=folium.rpc.on('we-selection',({id})=>{if(snapshot){snapshot.selectedId=id;selection();}});
    theme();
    void callHost(folium, 'assets').then(value=>{if(disposed)return;snapshot=value;render(value.native);selection();}).catch(error=>{if(!disposed)status.textContent=error.message;});
    return ()=>{disposed=true;offTheme();offSettings();offStatus();offSelection();root.remove();};
}
