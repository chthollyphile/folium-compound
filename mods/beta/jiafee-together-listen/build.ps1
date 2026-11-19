$ErrorActionPreference = 'Stop'
$manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'mod.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$output = Join-Path $PSScriptRoot 'dist'
New-Item -ItemType Directory -Path $output -Force | Out-Null
$packageItems = @(
  'mod.json', 'index.cjs', 'client.mjs', 'overlay-ui.mjs', 'styles.mjs',
  'accountSync.mjs', 'playback-core.mjs', 'playbackSession.mjs',
  'foliumPlayerAdapter.mjs', 'queue-sync.mjs', 'vendorPlaybackCore.mjs', 'track-selection-gate.mjs',
  'lib', 'vendor', 'preview.jpg', 'LICENSE', 'README.md'
)
$root = $PSScriptRoot.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
$files = foreach ($item in $packageItems) {
  $source = Get-Item -LiteralPath (Join-Path $root $item)
  if ($source.PSIsContainer) { Get-ChildItem -LiteralPath $source.FullName -File -Recurse }
  else { $source }
}
$archive = Join-Path $output "jiafee-together-listen-$($manifest.version).zip"
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
$temporaryArchive = Join-Path $output ([guid]::NewGuid().ToString() + '.tmp')
try {
  $zip = [IO.Compression.ZipFile]::Open($temporaryArchive, [IO.Compression.ZipArchiveMode]::Create)
  try {
    foreach ($file in $files) {
      $entryName = $file.FullName.Substring($root.Length).Replace('\', '/')
      [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file.FullName, $entryName) | Out-Null
    }
  } finally { $zip.Dispose() }
  Move-Item -LiteralPath $temporaryArchive -Destination $archive -Force
} finally {
  if (Test-Path -LiteralPath $temporaryArchive) { Remove-Item -LiteralPath $temporaryArchive }
}
$stream = [IO.File]::OpenRead($archive)
try {
  $hasher = [Security.Cryptography.SHA256]::Create()
  try { $hash = [BitConverter]::ToString($hasher.ComputeHash($stream)).Replace('-', '') }
  finally { $hasher.Dispose() }
} finally { $stream.Dispose() }
[pscustomobject]@{ Algorithm = 'SHA256'; Hash = $hash; Path = $archive }
