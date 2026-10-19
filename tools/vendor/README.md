# tools/vendor

`folia-manifest.cjs` is a verbatim copy of `electron/modSystem/manifest.cjs` from the Folia repository, so the
submission check validates `mod.json` with exactly the rules the app uses. It requires `foliumShared.json` (the
permission and experimental ids) and `deprecated.cjs` (Folium 1.5 names read as their 1.6 ones), which are verbatim
copies of the files of the same name in `electron/modSystem/`. Do not edit them here: when Folia changes the manifest
rules, copy all three over again from the latest Folia release (`diff` against Folia should print nothing).

Current copy: Folia v0.7.21 (Folium 1.6).
