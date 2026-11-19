export const OVERLAY_STYLE = `
:host { color-scheme: dark light; }
* { box-sizing: border-box; letter-spacing: 0; }
button, input { font: inherit; }
button { cursor: pointer; }
[hidden] { display: none !important; }
.together-overlay-root {
  --home-accent-rgb: 0,245,212;
  --tl-accent: #00f5d4;
  --tl-on-accent: #17171a;
  --tl-window: rgba(26,26,29,.96);
  --tl-card: #232327;
  --tl-menu: #2b2b30;
  --tl-label: #f4f4f5;
  --tl-secondary: rgba(244,244,245,.62);
  --tl-tertiary: rgba(244,244,245,.42);
  --tl-line: rgba(244,244,245,.08);
  --tl-line-strong: rgba(244,244,245,.16);
  --tl-fill: rgba(244,244,245,.07);
  --tl-fill-strong: rgba(244,244,245,.12);
  --tl-danger: #ef6f6f;
  --tl-stage-label: rgba(255,255,255,.88);
  --tl-stage-secondary: rgba(255,255,255,.48);
  --tl-stage-shadow: 0 1px 8px rgba(0,0,0,.72);
  --tl-avatar-ink: rgba(255,255,255,.92);
  --tl-avatar-line: rgba(255,255,255,.16);
  --tl-avatar-highlight: rgba(255,255,255,.12);
  --tl-avatar-signal: rgba(55,79,84,.88);
  --tl-avatar-rose: rgba(119,63,77,.9);
  --tl-avatar-mono: rgba(60,64,70,.92);
  --tl-avatar-mint: rgba(54,100,82,.9);
  --panel-button-bg: var(--tl-fill);
  position: fixed; inset: 0; z-index: 1; pointer-events: none;
  color: var(--tl-label);
  color-scheme: dark;
  font-family: -apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei UI",sans-serif;
}
.together-overlay-root[data-daylight=true] {
  --tl-window: rgba(243,243,244,.97);
  --tl-card: #fff;
  --tl-menu: #fff;
  --tl-label: #18181b;
  --tl-secondary: rgba(24,24,27,.62);
  --tl-tertiary: rgba(24,24,27,.42);
  --tl-line: rgba(24,24,27,.08);
  --tl-line-strong: rgba(24,24,27,.16);
  --tl-fill: rgba(24,24,27,.07);
  --tl-fill-strong: rgba(24,24,27,.12);
  --tl-danger: #d04444;
  --tl-stage-label: rgba(24,24,27,.88);
  --tl-stage-secondary: rgba(24,24,27,.52);
  --tl-stage-shadow: 0 1px 7px rgba(255,255,255,.78),0 0 12px rgba(255,255,255,.32);
  --tl-avatar-ink: rgba(32,32,36,.9);
  --tl-avatar-line: rgba(24,24,27,.14);
  --tl-avatar-highlight: rgba(255,255,255,.74);
  --tl-avatar-signal: rgba(219,230,232,.94);
  --tl-avatar-rose: rgba(235,218,224,.96);
  --tl-avatar-mono: rgba(226,226,230,.97);
  --tl-avatar-mint: rgba(218,233,226,.96);
  color-scheme: light;
}
.together-control {
  position: fixed; z-index: 40; inset: 0;
  pointer-events: none;
}
.together-switch-notice {
  position:fixed; z-index:43; top:8px; left:50%; transform:translateX(-50%);
  display:flex; align-items:center; gap:7px; min-height:28px; padding:5px 12px;
  border:1px solid var(--tl-line-strong); border-radius:7px;
  background:var(--tl-window); color:var(--tl-label); box-shadow:0 6px 24px rgba(0,0,0,.22);
  backdrop-filter:blur(24px); -webkit-backdrop-filter:blur(24px);
  font-size:11px; font-weight:650; white-space:nowrap; pointer-events:none;
}
.together-switch-notice i { width:6px; height:6px; border-radius:50%; background:var(--tl-accent); animation:together-pulse 1.2s ease-in-out infinite; }
.together-modal-mask {
  position: fixed; z-index: 39; right: 20px; bottom: 76px;
  width: min(360px,calc(100vw - 24px)); max-height: min(640px,calc(100vh - 100px));
  opacity:0; visibility:hidden; pointer-events:none; transform:translateY(8px) scale(.99);
  transform-origin:bottom right; transition:opacity .2s ease,transform .26s cubic-bezier(.16,1,.3,1),visibility .2s;
}
.together-control.open .together-modal-mask { opacity:1; visibility:visible; pointer-events:auto; transform:none; }
.together-panel {
  --tl-surface:var(--tl-card); --tl-surface-hover:var(--tl-fill-strong);
  --tl-border:var(--tl-line-strong); --tl-border-soft:var(--tl-line);
  width:100%; max-height:min(640px,calc(100vh - 100px)); overflow:auto; padding:10px;
  color:var(--tl-label); border:1px solid var(--tl-line-strong); border-radius:14px;
  background:var(--tl-window); box-shadow:0 18px 48px rgba(0,0,0,.3),inset 0 1px 0 var(--tl-line);
  backdrop-filter:blur(24px) saturate(1.16); -webkit-backdrop-filter:blur(24px) saturate(1.16);
  scrollbar-width:none;
}
.together-panel::-webkit-scrollbar { display:none; width:0; height:0; }
.together-panel h2,.together-panel h3,.together-panel p { margin:0; }
.together-panel-head { display:flex; align-items:center; justify-content:space-between; min-height:28px; padding:0 2px 4px; }
.together-panel-head h2 { color:var(--tl-label); font-size:11.5px; font-weight:800; }
.together-panel-head p,.together-section-head p,.together-room-summary p { margin-top:2px; color:var(--tl-tertiary); font-size:9px; line-height:1.4; }
.together-icon-btn { width:26px; height:26px; padding:0; display:grid; place-items:center; color:var(--tl-secondary); border:1px solid var(--tl-border); border-radius:9px; background:var(--tl-fill); font-size:16px; }
.together-message { min-height:0; padding:0 2px; color:var(--tl-secondary); font-size:10px; }
.together-message:not(:empty) { min-height:28px; margin-bottom:7px; padding:6px 7px; border:1px solid var(--tl-border-soft); border-radius:8px; background:var(--tl-fill); }
.together-message[data-kind=error] { color:var(--tl-danger); }.together-message[data-kind=ok] { color:var(--tl-accent); }
.together-lobby-view { display:flex; flex-direction:column; align-items:stretch; gap:8px; }
.together-section { min-width:0; padding:9px; border:1px solid var(--tl-line); border-radius:10px; background:var(--tl-card); box-shadow:inset 0 1px 0 var(--tl-line); }
.together-section-head { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; margin-bottom:9px; }
.together-section-head h3,.together-room-summary h3 { color:var(--tl-label); font-size:11.5px; font-weight:800; }
.together-profile-summary { display:grid; grid-template-columns:40px minmax(0,1fr); align-items:center; gap:8px; }
.together-profile-copy { min-width:0; }
.together-profile-copy strong { display:block; overflow-wrap:anywhere; color:var(--tl-label); font-size:12px; line-height:1.4; }
.together-profile-copy p { margin-top:3px; color:var(--tl-secondary); font-size:10px; line-height:1.4; }
.together-profile-avatar,.together-presence-avatar {
  width:40px; height:40px; padding:0; display:grid; place-items:center; overflow:hidden;
  border:1px solid var(--tl-avatar-line); border-radius:50%; color:var(--tl-avatar-ink);
  background:var(--tl-avatar-signal); box-shadow:0 7px 20px rgba(0,0,0,.18),inset 0 1px 0 var(--tl-avatar-highlight); font-size:13px; font-weight:650;
}
.together-profile-avatar.default-signal,.together-presence-avatar.default-signal { background:var(--tl-avatar-signal); }
.together-profile-avatar.default-rose,.together-presence-avatar.default-rose { background:var(--tl-avatar-rose); }
.together-profile-avatar.default-mono,.together-presence-avatar.default-mono { background:var(--tl-avatar-mono); }
.together-profile-avatar.default-mint,.together-presence-avatar.default-mint { background:var(--tl-avatar-mint); }
.together-profile-avatar img,.together-presence-avatar img { width:100%; height:100%; object-fit:cover; border-radius:50%; }
.together-form-row { display:grid; grid-template-columns:minmax(0,1fr) 92px; gap:7px; align-items:end; }
.together-form-row label:first-child { grid-column:1/-1; }
.together-connect-grid { display:grid; grid-template-columns:1fr; gap:7px; }
.together-panel label { display:grid; gap:4px; min-width:0; color:var(--tl-tertiary); font-size:9px; }
.together-panel input { width:100%; min-width:0; height:34px; padding:0 9px; color:var(--tl-label); border:1px solid var(--tl-border); border-radius:8px; outline:none; background:var(--tl-fill); }
.together-panel input::placeholder { color:var(--tl-tertiary); }
.together-panel input:focus { border-color:rgba(var(--home-accent-rgb),.58); box-shadow:0 0 0 3px rgba(var(--home-accent-rgb),.09); }
.together-primary-btn,.together-secondary-btn,.together-danger-btn { min-height:32px; padding:0 10px; color:var(--tl-label); border:1px solid var(--tl-border); border-radius:8px; background:var(--tl-fill); font-size:10.5px; font-weight:600; }
.together-primary-btn { color:var(--tl-on-accent); border-color:var(--tl-accent); background:var(--tl-accent); }
.together-danger-btn { color:var(--tl-danger); border-color:rgba(255,99,112,.24); background:rgba(255,69,82,.08); }
.together-panel button { transition:transform .15s,border-color .15s,background .15s,opacity .15s; }
.together-panel button:hover:not(:disabled) { border-color:rgba(var(--home-accent-rgb),.3); background:var(--tl-fill-strong); }
.together-panel button:active:not(:disabled) { transform:scale(.97); }
.together-panel button:focus-visible { outline:2px solid rgba(var(--home-accent-rgb),.58); outline-offset:2px; }
.together-panel button:disabled { opacity:.5; cursor:progress; }
.together-action-row { display:grid; grid-template-columns:1fr 1fr; gap:7px; margin-top:8px; }
.together-list { display:grid; gap:5px; max-height:154px; overflow:auto; }
.together-empty { min-height:40px; display:grid; place-items:center; padding:8px; color:var(--tl-tertiary); border:1px dashed var(--tl-border-soft); border-radius:8px; font-size:9.5px; }
.together-server-row,.together-saved-row { width:100%; min-height:44px; height:auto; display:flex; align-items:center; gap:8px; padding:6px 8px; color:inherit; border:1px solid var(--tl-border-soft); border-radius:8px; background:var(--tl-fill); text-align:left; }
.together-server-row>span,.together-saved-row>span { min-width:0; flex:1; display:grid; gap:2px; }
.together-server-row strong,.together-saved-row strong,.together-server-row small,.together-saved-row small { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.together-server-row strong,.together-saved-row strong { color:var(--tl-label); font-size:10.5px; }.together-server-row small,.together-saved-row small { color:var(--tl-tertiary); font-size:8.5px; }
.together-server-row em,.together-saved-row em { color:rgb(var(--home-accent-rgb)); font-size:9px; font-style:normal; }
.together-saved-wrap { display:grid; grid-template-columns:minmax(0,1fr) 28px; gap:5px; }.together-remove-btn { width:28px; height:28px; align-self:center; padding:0; border:0; border-radius:50%; background:transparent; color:var(--tl-secondary); }
.together-room-view:not([hidden]) { display:flex; flex-direction:column; gap:8px; animation:together-panel-view-in .3s cubic-bezier(.16,1,.3,1) both; }
.together-room-summary,.together-host-info,.together-now-playing,.together-room-footer { padding:10px; border:1px solid var(--tl-border); border-radius:10px; background:var(--tl-surface); }
.together-room-summary { display:flex; align-items:flex-start; justify-content:space-between; gap:8px; }.together-room-meta { display:grid; justify-items:end; gap:5px; }
.together-network-quality { display:inline-flex; align-items:center; gap:6px; color:var(--tl-secondary); font-size:9px; }.together-network-quality i { width:5px; height:5px; border-radius:50%; background:var(--tl-tertiary); }
.together-network-quality[data-quality=excellent] i,.together-network-quality[data-quality=good] i { background:rgb(var(--home-accent-rgb)); box-shadow:0 0 8px rgba(var(--home-accent-rgb),.34); }.together-network-quality[data-quality=high] i { background:#e2b66f; }.together-network-quality[data-quality=poor] i { background:#df7a74; }
.together-members { max-width:165px; overflow:hidden; color:var(--tl-secondary); font-size:9px; text-overflow:ellipsis; white-space:nowrap; }
.together-host-info { display:grid; grid-template-columns:1fr; gap:8px; border-color:rgba(var(--home-accent-rgb),.18); background:rgba(var(--home-accent-rgb),.055); }.together-host-details { min-width:0; display:grid; gap:3px; }.together-host-info span,.together-host-info small { color:var(--tl-tertiary); font-size:8.5px; }.together-host-info code { overflow:hidden; color:var(--tl-secondary); font-size:9px; text-overflow:ellipsis; white-space:nowrap; }
.together-host-code { padding:8px 0; border-top:1px solid var(--tl-line); }.together-host-code strong { display:block; margin-top:2px; color:var(--tl-label); font-size:17px; letter-spacing:.13em; }.together-host-actions { display:grid; grid-template-columns:1fr 1fr; gap:7px; }
.together-now-playing { text-align:left; }.together-now-copy span { color:rgb(var(--home-accent-rgb)); font-size:8.5px; font-weight:650; }.together-now-copy h3 { margin-top:5px; font-size:14px; }.together-now-copy p { margin-top:3px; color:var(--tl-secondary); font-size:9.5px; }
.together-room-progress { height:3px; margin:12px auto 2px; overflow:hidden; border-radius:99px; background:var(--tl-line); }.together-room-progress i { display:block; width:0; height:100%; background:var(--tl-accent); transition:width .3s linear; }
.together-room-footer { display:flex; align-items:center; justify-content:space-between; gap:8px; }.together-room-footer span { color:var(--tl-tertiary); font-size:9px; }

.together-presence-space {
  position:fixed; z-index:42; top:42px; left:50%; width:264px; padding:4px 0 0;
  opacity:0; transform:translate(-50%,-7px) scale(.98); pointer-events:none;
  transition:opacity .22s,transform .24s cubic-bezier(.16,1,.3,1);
}
.together-presence-space.is-visible { opacity:1; transform:translateX(-50%); pointer-events:none; animation:together-presence-enter .34s cubic-bezier(.16,1,.3,1) both; }
.together-presence-avatar, .together-presence-member strong, .together-presence-member small, .together-presence-link { opacity:1; transition:opacity .3s ease; pointer-events:none; }
.together-overlay-root[data-subdued=true] .together-presence-avatar,
.together-overlay-root[data-subdued=true] .together-presence-member strong,
.together-overlay-root[data-subdued=true] .together-presence-member small,
.together-overlay-root[data-subdued=true] .together-presence-link { opacity:.24; }
.together-expression-controls { pointer-events:none; }
.together-presence-space.is-visible .together-expression-controls:not(.is-collapsed) input,
.together-presence-space.is-visible .together-expression-controls:not(.is-collapsed) button,
.together-presence-space.is-visible .together-expression-toggle { pointer-events:auto; -webkit-app-region:no-drag; }
.together-panel { -webkit-app-region:no-drag; }
.together-expression-form input { appearance:none; -webkit-appearance:none; background-color:transparent !important; background-image:none !important; box-shadow:none !important; text-shadow:none !important; border-radius:0; }
.together-expression-form input::placeholder { text-shadow:none !important; }
.together-presence-member strong, .together-presence-member small { text-shadow:none; background:transparent; }
.together-expression { opacity:1; background:#101820 !important; color:#fff !important; }
.together-presence-pair { display:grid; grid-template-columns:92px 48px 92px; justify-content:center; align-items:start; }
.together-presence-member { position:relative; min-width:0; display:grid; grid-template-rows:52px auto auto; align-content:start; justify-items:center; gap:3px; text-align:center; }
.together-presence-avatar { width:52px; height:52px; font-size:14px; }
.together-presence-avatar-editable { cursor:pointer; transition:border-color .18s,transform .18s,box-shadow .18s; }
.together-presence-avatar-editable:hover { border-color:var(--tl-line-strong); transform:scale(1.04); }
.together-presence-avatar-editable:focus-visible { outline:2px solid rgba(var(--home-accent-rgb),.55); outline-offset:2px; }
.together-presence-member strong { width:100%; margin-top:2px; overflow:hidden; color:var(--tl-stage-label); font-size:12px; line-height:1.3; font-weight:650; letter-spacing:0; text-shadow:var(--tl-stage-shadow); text-overflow:ellipsis; white-space:nowrap; }
.together-presence-member small { min-height:14px; display:inline-flex; align-items:center; justify-content:center; gap:4px; color:var(--tl-stage-secondary); font-size:9.5px; line-height:1.3; letter-spacing:0; font-variant-numeric:tabular-nums; text-shadow:var(--tl-stage-shadow); white-space:nowrap; }
.together-presence-member small::before { content:""; width:4px; height:4px; flex:0 0 4px; border-radius:50%; background:var(--tl-stage-secondary); box-shadow:0 0 6px var(--tl-line); }
.together-presence-member[data-member-state=playing] small::before,.together-presence-member[data-member-state=ready] small::before { background:rgb(var(--home-accent-rgb)); box-shadow:0 0 7px rgba(var(--home-accent-rgb),.5); }
.together-presence-member[data-member-state=error] small::before { background:#ff8c96; }
.together-presence-link { position:relative; height:56px; display:grid; place-items:center; }.together-presence-link::before { content:""; position:absolute; top:26px; left:-5px; right:-5px; height:1px; background:linear-gradient(90deg,transparent,rgba(var(--home-accent-rgb),.38),transparent); box-shadow:0 0 8px rgba(var(--home-accent-rgb),.22); }
.together-presence-link i { position:absolute; z-index:1; top:23px; left:-5px; width:7px; height:7px; border-radius:50%; background:rgb(var(--home-accent-rgb)); box-shadow:0 0 9px rgba(var(--home-accent-rgb),.55); animation:together-signal-flow 3.8s ease-in-out infinite alternate; }.together-presence-link span { position:relative; z-index:2; display:grid; place-items:center; color:rgba(var(--home-accent-rgb),.9); font-size:12px; text-shadow:0 0 10px rgba(var(--home-accent-rgb),.58),0 2px 8px rgba(0,0,0,.7); }
.together-presence-space[data-playback-state=paused] .together-presence-link i,.together-presence-space[data-playback-state=waiting] .together-presence-link i { animation-duration:5s; opacity:.55; }.together-presence-space[data-connection-state=reconnecting] .together-presence-link i { animation:none; opacity:.25; }
.together-expression { position:absolute; top:100%; left:50%; translate:-50% 5px; width:max-content; max-width:104px; margin:0; padding:2px 4px; border:0; border-radius:6px; background:rgba(5,9,12,.82); color:rgba(255,255,255,.94); box-shadow:inset 0 0 0 1px rgba(255,255,255,.1),0 4px 12px rgba(0,0,0,.34); text-shadow:0 1px 5px rgba(0,0,0,.88); backdrop-filter:blur(7px); font-size:9.5px; line-height:1.4; overflow-wrap:anywhere; animation:together-expression-in .24s cubic-bezier(.16,1,.3,1); }
.together-expression::before { content:"“"; margin-right:2px; color:rgba(var(--home-accent-rgb),.8); }.together-expression::after { content:"”"; margin-left:2px; color:rgba(var(--home-accent-rgb),.8); }.together-expression.is-peer-expression { animation:together-expression-peer var(--together-expression-duration,8s) linear both; }
.together-expression-controls { width:230px; min-height:30px; margin:6px auto 0; display:flex; align-items:center; justify-content:center; gap:4px; transition:opacity .2s,transform .24s; }
.together-expression-toggle { width:22px; height:26px; flex:0 0 22px; display:grid; place-items:center; padding:0; border:0; border-radius:6px; background:transparent; color:var(--tl-stage-secondary); box-shadow:none; backdrop-filter:none; transition:color .18s,background .18s,transform .24s; }.together-expression-toggle:hover,.together-expression-toggle:focus-visible { color:var(--tl-stage-label); background:rgba(var(--home-accent-rgb),.1); outline:none; }.together-expression-toggle span,.together-expression-toggle svg { width:13px; height:13px; display:grid; place-items:center; }
.together-expression-form { box-sizing:border-box; width:204px; height:30px; margin:0; padding:0; display:flex; align-items:center; gap:5px; overflow:hidden; border:0; border-bottom:1px solid var(--tl-line-strong); border-radius:0; background:transparent; box-shadow:none; backdrop-filter:none; transition:width .28s cubic-bezier(.22,.72,.2,1),opacity .2s,margin .28s,border-color .2s; }.together-expression-form:focus-within { border-bottom-color:rgba(var(--home-accent-rgb),.52); box-shadow:none; }
.together-expression-form input { min-width:0; flex:1; height:28px; padding:0 3px; border:0; outline:none; background:transparent; color:var(--tl-stage-label); text-shadow:var(--tl-stage-shadow); font-size:10px; letter-spacing:0; }.together-expression-form input::placeholder { color:var(--tl-stage-secondary); text-shadow:var(--tl-stage-shadow); }
.together-expression-form button { width:26px; height:26px; display:grid; place-items:center; padding:0; border:0; border-radius:50%; background:transparent; color:rgba(var(--home-accent-rgb),.9); }.together-expression-form button:hover,.together-expression-form button:focus-visible { color:var(--tl-stage-label); background:rgba(var(--home-accent-rgb),.1); outline:none; }.together-expression-form button span,.together-expression-form button svg { width:13px; height:13px; display:grid; place-items:center; font-size:0; }
.together-expression-controls.is-collapsed { transform:translateY(-1px); }
.together-expression-controls.is-collapsed .together-expression-toggle { transform:rotate(180deg); }
.together-expression-controls.is-collapsed .together-expression-form { width:0; opacity:0; overflow:hidden; pointer-events:none; margin-left:-4px; border-bottom-width:0; }
@keyframes together-pulse { 50% { opacity:.35; } }
@keyframes together-presence-enter { from { opacity:0; transform:translate(-50%,-6px) scale(.98); } to { opacity:1; transform:translateX(-50%); } }
@keyframes together-signal-flow { from { left:-5px; } to { left:calc(100% - 2px); } }
@keyframes together-expression-in { from { opacity:0; transform:translateY(4px) scale(.97); } }
@keyframes together-expression-peer { 0% { opacity:0; transform:scale(.9); } 8% { opacity:1; transform:scale(1.3); } 42% { opacity:1; transform:scale(1.3); } 92% { opacity:1; transform:scale(.86); } 100% { opacity:0; transform:scale(.72); } }
@keyframes together-panel-view-in { from { opacity:0; transform:translateY(7px) scale(.985); } to { opacity:1; transform:none; } }
@media (max-width:620px) { .together-modal-mask { right:8px; bottom:72px; width:calc(100vw - 16px); max-height:calc(100vh - 80px); }.together-panel { max-height:calc(100vh - 80px); }.together-presence-space { top:76px; }.together-room-summary,.together-room-footer { flex-direction:column; }.together-room-meta { justify-items:start; } }
@media (prefers-reduced-motion:reduce) { .together-modal-mask,.together-room-view,.together-presence-space,.together-presence-link i,.together-expression,.together-expression-controls,.together-expression-toggle,.together-expression-form { animation:none !important; transition:none !important; } }
`;

export const PANEL_ENTRY_STYLE = `
.together-native-root {
  position:relative; inset:auto; z-index:auto; width:100%; min-height:0;
  pointer-events:auto; color:var(--tl-label); background:transparent;
}
.together-native-root .together-modal-mask,
.together-native-root .together-modal-mask.is-native-panel {
  position:relative; z-index:auto; right:auto; bottom:auto; width:100%; max-height:none;
  opacity:1; visibility:visible; pointer-events:auto; transform:none;
}
.together-native-root .together-panel {
  width:100%; max-height:calc(100vh - 148px); padding:10px 10px 14px;
  border:0; border-radius:0; background:transparent; box-shadow:none;
  backdrop-filter:none; -webkit-backdrop-filter:none;
}
.together-native-root .together-panel-head { padding-top:1px; }
.together-native-root .together-panel-head .together-icon-btn { display:none; }
`;
