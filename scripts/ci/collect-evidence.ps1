param([switch]$CollectOutputs)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$destination = Join-Path $env:RUNNER_TEMP 'material-release-evidence'
[IO.Directory]::CreateDirectory($destination) | Out-Null
$root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
function Write-Inventory($Name, $Value) {
    $Value | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $destination $Name) -Encoding UTF8
}
if (!$CollectOutputs) {
    if ($env:RUNNER_OS -ne 'Windows' -or $env:RUNNER_ARCH -ne 'X64') { throw 'Release execution requires Windows X64.' }
    $tools = @()
    foreach ($item in @(@{name='git'; file='git.exe'}, @{name='cmake'; file='cmake.exe'}, @{name='publication-cli'; file=$env:MATERIAL_RELEASE_GH})) {
        $command = Get-Command $item.file -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($command) {
            $file = Get-Item -LiteralPath $command.Source
            $tools += @{name=$item.name; available=$true; version=$file.VersionInfo.FileVersion; sha256=(Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()}
        } else { $tools += @{name=$item.name; available=$false} }
    }
    $inputs = @()
    foreach ($relative in @('build.bat','build-installer.bat','.github/workflows/release.yml','scripts/release/bootstrap-gh.ps1','package.json','package-lock.json','CMakeLists.txt','build-manifest.json')) {
        $path = Join-Path $root $relative
        if (Test-Path -LiteralPath $path -PathType Leaf) { $inputs += @{path=$relative; bytes=(Get-Item -LiteralPath $path).Length; sha256=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()} }
    }
    Write-Inventory 'bootstrap.json' @{schemaVersion=1; source=$env:GITHUB_SHA; runId=$env:GITHUB_RUN_ID; attempt=$env:GITHUB_RUN_ATTEMPT; runnerOS=$env:RUNNER_OS; runnerArch=$env:RUNNER_ARCH; runnerImage=$env:ImageOS; runnerImageVersion=$env:ImageVersion; selectedTarget=$env:MATERIAL_EXECUTION_TARGET; tools=$tools; inputs=$inputs; fallback='Only fixed hosted Windows X64 images are supported. No external cloud or self-hosted credentials are configured.'}
    exit 0
}
$installed = @()
$manifest = Get-Content -LiteralPath (Join-Path $root 'build-manifest.json') -Raw | ConvertFrom-Json
foreach ($spec in @($manifest.toolchains | Where-Object { $_.id -in @('node','git') } | Select-Object -First 2)) {
    if ($spec.version -notmatch '^[0-9.]+$') { continue }
    $binary = if ($spec.id -eq 'node') { 'node.exe' } else { 'cmd/git.exe' }
    $toolPath = Join-Path $root ('.cache/toolchains/{0}-{1}/active/{2}' -f $spec.id,$spec.version,$binary)
    if (Test-Path -LiteralPath $toolPath -PathType Leaf) {
        $tool = Get-Item -LiteralPath $toolPath
        $installed += @{id=$spec.id; version=$tool.VersionInfo.FileVersion; sha256=(Get-FileHash -LiteralPath $toolPath -Algorithm SHA256).Hash.ToLowerInvariant(); available=$true}
    } else { $installed += @{id=$spec.id; available=$false} }
}
Write-Inventory 'installed-tools.json' @{schemaVersion=1; source=$env:GITHUB_SHA; tools=$installed}
$records = @()
$total = [long]0
$limit = [long]1200000000
$index = 0
foreach ($relativeRoot in @('release/publish','release/installer')) {
    $sourceRoot = Join-Path $root $relativeRoot
    if (!(Test-Path -LiteralPath $sourceRoot -PathType Container)) { continue }
    # Only direct known package outputs are collected. Never recurse into arbitrary build trees.
    foreach ($file in @(Get-ChildItem -LiteralPath $sourceRoot -File | Sort-Object Name | Select-Object -First 64)) {
        if ($file.Name -notmatch '^(Setup\.exe|RELEASES|[A-Za-z0-9_.-]+-(full|delta)\.nupkg|provenance\.json|SHA256SUMS\.txt|build-receipt\.json)$') { continue }
        if (($file.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { continue }
        $record = @{path="$relativeRoot/$($file.Name)"; bytes=$file.Length; sha256=(Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant(); copied=$false}
        if ($total + $file.Length -le $limit) {
            $index++
            $copyName = '{0:D3}-{1}' -f $index,$file.Name
            Copy-Item -LiteralPath $file.FullName -Destination (Join-Path $destination $copyName)
            $record.copied=$true
            $record['evidenceName']=$copyName
            $total += $file.Length
        } else { $record['reason']='Evidence byte budget exceeded; release download remains authoritative.' }
        $records += $record
    }
}
Write-Inventory 'outputs.json' @{schemaVersion=1; source=$env:GITHUB_SHA; runId=$env:GITHUB_RUN_ID; attempt=$env:GITHUB_RUN_ATTEMPT; status=$env:RELEASE_JOB_STATUS; byteLimit=$limit; copiedBytes=$total; outputs=$records}


