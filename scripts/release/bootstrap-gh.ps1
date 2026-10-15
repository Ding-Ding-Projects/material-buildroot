Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$version = '2.96.0'
$expected = 'c2d6acc935cd2f00e2144d7e036d5cd82e6b6bd5594e8c75aa75ef2a4ed6aac3'
$directory = Join-Path $env:RUNNER_TEMP 'material-release-gh'
[IO.Directory]::CreateDirectory($directory) | Out-Null
$archive = Join-Path $directory 'gh.zip'
Invoke-WebRequest -UseBasicParsing "https://github.com/cli/cli/releases/download/v$version/gh_${version}_windows_amd64.zip" -OutFile $archive
if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected) { throw 'GitHub CLI archive integrity mismatch.' }
Expand-Archive -LiteralPath $archive -DestinationPath (Join-Path $directory 'tool')
$executable = Join-Path $directory 'tool/bin/gh.exe'
if (!(Test-Path -LiteralPath $executable -PathType Leaf)) { throw 'Pinned GitHub CLI executable is missing.' }
& $executable --version
if ($LASTEXITCODE -ne 0) { throw 'Pinned GitHub CLI did not start.' }
"MATERIAL_RELEASE_GH=$executable" | Out-File -LiteralPath $env:GITHUB_ENV -Encoding utf8 -Append
