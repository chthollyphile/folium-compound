# tools/vendor

`folia-manifest.cjs` is a verbatim copy of `electron/modSystem/manifest.cjs` from the Folia repository, so the
submission check validates `mod.json` with exactly the rules the app uses. Do not edit it here: when Folia changes
the manifest rules, copy the file over again (`diff` against Folia should print nothing).
