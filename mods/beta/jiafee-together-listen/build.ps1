$ErrorActionPreference = 'Stop'
$manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'mod.json') -Raw | ConvertFrom-Json
$output = Join-Path $PSScriptRoot 'dist'
New-Item -ItemType Directory -Path $output -Force | Out-Null
$packageItems = @(
  'mod.json', 'index.cjs', 'client.mjs', 'overlay-ui.mjs', 'styles.mjs',
  'accountSync.mjs', 'playback-core.mjs', 'playbackSession.mjs',
  'foliumPlayerAdapter.mjs', 'queue-sync.mjs', 'vendorPlaybackCore.mjs', 'track-selection-gate.mjs',
  'lib', 'vendor', 'preview.jpg', 'LICENSE', 'README.md'
)
$files = $packageItems | ForEach-Object { Join-Path $PSScriptRoot $_ }
foreach ($file in $files) {
  if (-not (Test-Path -LiteralPath $file)) { throw "Missing package item: $file" }
}
$archive = Join-Path $output "jiafee-together-listen-$($manifest.version).zip"
Compress-Archive -LiteralPath $files -DestinationPath $archive -Force
Get-FileHash -LiteralPath $archive -Algorithm SHA256
