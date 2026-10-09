$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$distRoot = Join-Path $projectRoot 'dist'
New-Item -ItemType Directory -Path $distRoot -Force | Out-Null
$files = @('module.json', 'scripts', 'styles', 'templates', 'assets', 'README.md', 'LICENSE', 'CHANGELOG.md', 'docs') | ForEach-Object { Join-Path $projectRoot $_ }
$zipPath = Join-Path $distRoot 'ptu-carbon-random-pokemon.zip'
Compress-Archive -LiteralPath $files -DestinationPath $zipPath -Force
Write-Output $zipPath
