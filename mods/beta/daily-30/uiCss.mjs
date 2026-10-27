// mods/daily-30/uiCss.mjs
// The home tab's styles. The host gives every entry a ShadowRoot and the --folium-* theme variables,
// so this sheet never reaches or depends on the host's own CSS.

export const CSS = `
:host { color: inherit; }
* { box-sizing: border-box; }
.d30 { --line: color-mix(in srgb, currentColor 16%, transparent); --soft: color-mix(in srgb, currentColor 6%, transparent);
  --softer: color-mix(in srgb, currentColor 3%, transparent); --accent: var(--folium-primary, #5b9dff);
  display: flex; flex-direction: column; gap: 18px; height: 100%; min-height: 0; padding: 24px 28px;
  font: 14px/1.5 var(--folium-font, system-ui, sans-serif); color: inherit; }
button, input { font: inherit; color: inherit; }
button { cursor: pointer; }
button:focus-visible, input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.d30-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.d30-head h1 { margin: 0; font-size: 22px; line-height: 1.25; letter-spacing: .01em; }
.d30-head p { margin: 4px 0 0; opacity: .66; }
.d30-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.d30-btn { border: 1px solid var(--line); background: var(--soft); border-radius: 999px; padding: 7px 14px;
  transition: background .15s ease, border-color .15s ease; white-space: nowrap; }
.d30-btn:hover { background: color-mix(in srgb, currentColor 11%, transparent); }
.d30-btn.primary { border-color: transparent; background: var(--accent); color: var(--folium-bg, #111); }
.d30-btn.primary:hover { background: color-mix(in srgb, var(--accent) 84%, #000); }
.d30-btn:disabled { opacity: .5; cursor: default; }
.d30-status { display: flex; align-items: center; gap: 10px 18px; flex-wrap: wrap; font-size: 12.5px; opacity: .78; }
.d30-status b { font-weight: 600; }
.d30-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); display: inline-block; margin-right: 6px; }
.d30-grid { flex: 1; min-height: 0; display: grid; grid-template-columns: 304px minmax(0, 1fr); gap: 18px; }
.d30-side, .d30-main { min-height: 0; border: 1px solid var(--line); border-radius: 20px; background: var(--softer); }
.d30-side { display: flex; flex-direction: column; padding: 14px; gap: 12px; }
.d30-sidetitle { margin: 0 2px; font-size: 12px; font-weight: 500; letter-spacing: .04em; opacity: .55; }
.d30-main { display: flex; flex-direction: column; overflow: hidden; container-type: inline-size; }
.d30-search { width: 100%; border: 1px solid var(--line); border-radius: 12px; padding: 9px 12px; background: transparent; }
.d30-dates { flex: 1; min-height: 0; overflow: auto; display: flex; flex-direction: column; gap: 4px; padding-right: 4px; }
.d30-date { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 8px; width: 100%;
  text-align: left; border: 1px solid transparent; border-radius: 12px; padding: 8px 10px; background: transparent; }
.d30-date:hover { background: var(--soft); }
.d30-date[aria-current="true"] { border-color: color-mix(in srgb, var(--accent) 55%, transparent); background: color-mix(in srgb, var(--accent) 12%, transparent); }
.d30-date .day { font-variant-numeric: tabular-nums; }
.d30-date .meta { display: block; font-size: 11.5px; opacity: .6; }
.d30-badge { font-size: 11px; border-radius: 999px; padding: 1px 7px; background: var(--soft); opacity: .8; white-space: nowrap; }
.d30-badge.accent { background: color-mix(in srgb, var(--accent) 22%, transparent); color: var(--accent); opacity: 1; }
.d30-dayhead { display: flex; align-items: center; gap: 12px; padding: 16px 18px; border-bottom: 1px solid var(--line); flex-wrap: wrap; }
.d30-dayhead h2 { margin: 0; font-size: 17px; font-variant-numeric: tabular-nums; }
.d30-dayhead .grow { flex: 1; }
.d30-songs { flex: 1; min-height: 0; overflow: auto; padding: 4px 8px 10px; }
.d30-row { display: grid; grid-template-columns: 26px 36px minmax(0, 1fr) minmax(0, .9fr) 48px 52px;
  align-items: center; gap: 10px; padding: 7px 10px; border-radius: 10px; }
.d30-row.head { position: sticky; top: 0; z-index: 1; background: color-mix(in srgb, var(--folium-bg, #111) 92%, transparent);
  backdrop-filter: blur(8px); font-size: 11.5px; opacity: .55; }
.d30-row:not(.head):hover { background: var(--soft); }
.d30-index { grid-column: 1; font-size: 12px; opacity: .45; font-variant-numeric: tabular-nums; text-align: right; }
.d30-cover { grid-column: 2; width: 36px; height: 36px; border-radius: 8px; object-fit: cover; background: var(--soft); display: block; }
.d30-cover.hidden { visibility: hidden; }
.d30-title { grid-column: 3; display: flex; flex-direction: column; min-width: 0; }
.d30-title .name, .d30-album { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.d30-title .name { font-weight: 500; }
.d30-title .artist { font-size: 12px; opacity: .58; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.d30-album { grid-column: 4; font-size: 12px; opacity: .58; }
.d30-time { grid-column: 5; font-size: 12px; opacity: .5; font-variant-numeric: tabular-nums; text-align: right; }
.d30-play { grid-column: 6; border: 1px solid var(--line); border-radius: 999px; background: transparent; padding: 3px 9px; font-size: 12px; }
.d30-row.head .d30-cover { background: transparent; }
.d30-row.head .d30-play { border: 0; padding: 0; }
.d30-play:hover { background: var(--accent); border-color: transparent; color: var(--folium-bg, #111); }
.d30-empty { margin: auto; max-width: 420px; text-align: center; padding: 32px; }
.d30-empty h2 { margin: 0 0 8px; font-size: 17px; }
.d30-empty p { margin: 0; opacity: .62; }
.d30-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 12px; opacity: .65; flex-wrap: wrap; }
.d30-hidden { display: none !important; }
.d30-searchrow { padding: 12px 18px 4px; border-bottom: 1px solid var(--line); font-size: 12px; opacity: .6; }
.d30-section-note { padding: 2px 4px 4px; font-size: 12px; opacity: .6; }
.d30-error { color: #ff8a80; }
.d30-dates::-webkit-scrollbar, .d30-songs::-webkit-scrollbar { width: 8px; }
.d30-dates::-webkit-scrollbar-thumb, .d30-songs::-webkit-scrollbar-thumb { background: var(--line); border-radius: 8px; }
@media (max-width: 760px) {
  .d30 { padding: 18px; }
  .d30-grid { grid-template-columns: 1fr; grid-template-rows: minmax(180px, 34%) minmax(0, 1fr); }
}
@container (max-width: 560px) {
  .d30-row { grid-template-columns: 26px 36px minmax(0, 1fr) 48px 52px; }
  .d30-row .d30-album { display: none; }
  .d30-time { grid-column: 4; }
  .d30-play { grid-column: 5; }
}
@container (max-width: 440px) {
  .d30-row { grid-template-columns: 20px minmax(0, 1fr) 44px 48px; }
  .d30-row .d30-cover { display: none; }
  .d30-title { grid-column: 2; }
  .d30-time { grid-column: 3; }
  .d30-play { grid-column: 4; }
}
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
`;
