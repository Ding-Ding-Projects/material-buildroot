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
$sources = @(
    @{label='release/publish'; directory=(Join-Path $root 'release/publish')},
    @{label='release/installer'; directory=(Join-Path $root 'release/installer')},
    @{label='release/installer/squirrel-windows'; directory=(Join-Path $root 'release/installer/squirrel-windows')}
)
function Assert-UnlinkedPath([string]$Path) {
    $cursor = [IO.Path]::GetFullPath($Path)
    while ($cursor) {
        if ((Test-Path -LiteralPath $cursor) -and ((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Diagnostic producer path is linked.' }
        $parent = [IO.Path]::GetDirectoryName($cursor)
        if ($parent -eq $cursor) { break }
        $cursor = $parent
    }
}
$ownership = @{schemaVersion=1; source=$env:GITHUB_SHA; state='unavailable'; reason='No exact owned installer staging record was admitted.'}
try {
    $pointerPath = Join-Path $root '.cache/installer-producer.json'
    if (Test-Path -LiteralPath $pointerPath -PathType Leaf) {
        Assert-UnlinkedPath $pointerPath
        if ((Get-Item -LiteralPath $pointerPath).Length -gt 8192) { throw 'Producer pointer is oversized.' }
        $pointer = Get-Content -LiteralPath $pointerPath -Raw | ConvertFrom-Json
        if ($pointer.schemaVersion -ne 1 -or $pointer.source -ne $env:GITHUB_SHA -or $pointer.generation -notmatch '^[a-f0-9-]{36}$') { throw 'Producer pointer source is inconsistent.' }
        $staging = [IO.Path]::GetFullPath($pointer.staging)
        $temporary = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\','/')
        if (!$staging.StartsWith($temporary + [IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($staging) -notmatch '^mbr-[A-Za-z0-9]{6}$' -or [IO.Path]::GetDirectoryName($staging).TrimEnd('\','/') -ne $temporary) { throw 'Producer staging is not an exclusive direct temporary child.' }
        Assert-UnlinkedPath $staging
        $ownerPath = Join-Path $staging 'producer-owner.json'
        Assert-UnlinkedPath $ownerPath
        if ((Get-Item -LiteralPath $ownerPath).Length -gt 8192) { throw 'Producer owner receipt is oversized.' }
        $owner = Get-Content -LiteralPath $ownerPath -Raw | ConvertFrom-Json
        if ($owner.schemaVersion -ne 1 -or $owner.source -ne $env:GITHUB_SHA -or ![string]::Equals([string]$owner.root,$root,[StringComparison]::OrdinalIgnoreCase) -or $owner.purpose -ne 'Squirrel installer production') { throw 'Producer ownership does not match this checkout and source.' }
        $created = [DateTimeOffset]::Parse($owner.createdAt).ToUniversalTime().ToString('o')
        # Keep the original private owner receipt in place. Publish only this projection.
        $ownership = @{schemaVersion=1; source=$owner.source; generation=$pointer.generation; state='owned-staging-admitted'; purpose=$owner.purpose; createdAt=$created; ownerReceiptSha256=(Get-FileHash -LiteralPath $ownerPath -Algorithm SHA256).Hash.ToLowerInvariant(); compilation=@()}
        foreach ($spec in @(@{directory='native-broker'; file='broker-manifest.json'; expected='material-file-broker.exe'},@{directory='squirrel-writezip'; file='helper-manifest.json'; expected='WriteZipToSetup.exe'})) {
            $manifestPath = Join-Path $root ('.cache/{0}/{1}/{2}' -f $spec.directory,$pointer.generation,$spec.file)
            if (!(Test-Path -LiteralPath $manifestPath -PathType Leaf)) { continue }
            Assert-UnlinkedPath $manifestPath
            if ((Get-Item -LiteralPath $manifestPath).Length -gt 1048576) { continue }
            $compiled = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
            if ($compiled.schemaVersion -eq 1 -and $compiled.file -eq $spec.expected -and $compiled.sha256 -match '^[a-f0-9]{64}$' -and $compiled.runtimeVerified -eq $false) {
                $compiledRecord = @{file=$compiled.file; sha256=$compiled.sha256; runtimeVerified=$false}
                if ($compiled.PSObject.Properties.Name -contains 'genuineSha256' -and $compiled.genuineSha256 -match '^[a-f0-9]{64}$') { $compiledRecord['genuineHelperSha256']=$compiled.genuineSha256 }
                if ($compiled.PSObject.Properties.Name -contains 'proxySourceSha256' -and $compiled.proxySourceSha256 -match '^[a-f0-9]{64}$') { $compiledRecord['proxySourceSha256']=$compiled.proxySourceSha256 }
                if ($compiled.PSObject.Properties.Name -contains 'role' -and $compiled.role -eq 'genuine-helper-invocation-observer') { $compiledRecord['role']=$compiled.role }
                $ownership.compilation += $compiledRecord
            }
        }
        $sources += @{label='retained-installer'; directory=(Join-Path $staging 'output')}
        $sources += @{label='retained-installer/squirrel-windows'; directory=(Join-Path $staging 'output/squirrel-windows')}
    }
} catch {
    $ownership = @{schemaVersion=1; source=$env:GITHUB_SHA; state='staging-admission-failed'; reason='The bounded local producer ownership check failed. No temporary directory was scanned or copied.'}
}
Write-Inventory 'producer-ownership.json' $ownership
foreach ($source in $sources) {
    $sourceRoot = $source.directory
    $relativeRoot = $source.label
    if (!(Test-Path -LiteralPath $sourceRoot -PathType Container)) { continue }
    try { Assert-UnlinkedPath $sourceRoot } catch { continue }
    # Only direct known package outputs are collected. Never recurse into arbitrary build trees.
    foreach ($file in @(Get-ChildItem -LiteralPath $sourceRoot -File | Sort-Object Name | Select-Object -First 64)) {
        if ($file.Name -notmatch '^(Setup\.exe|RELEASES|[A-Za-z0-9_.-]+-(full|delta)\.nupkg|provenance\.json|SHA256SUMS\.txt|build-receipt\.json|setup-format\.json|setup-embedding\.json)$') { continue }
        if (($file.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { continue }
        $record = @{path="$relativeRoot/$($file.Name)"; bytes=$file.Length; sha256=(Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant(); copied=$false}
        if ($file.Length -le 1400000000 -and $total + $file.Length -le $limit) {
            $index++
            $copyName = '{0:D3}-{1}' -f $index,$file.Name
            Copy-Item -LiteralPath $file.FullName -Destination (Join-Path $destination $copyName)
            $record.copied=$true
            $record['evidenceName']=$copyName
            $total += $file.Length
        } else { $record['reason']='Evidence byte budget exceeded; only file identity is retained, with no binary transfer or publication claim.' }
        $records += $record
    }
}
Write-Inventory 'outputs.json' @{schemaVersion=1; source=$env:GITHUB_SHA; runId=$env:GITHUB_RUN_ID; attempt=$env:GITHUB_RUN_ATTEMPT; status=$env:RELEASE_JOB_STATUS; byteLimit=$limit; copiedBytes=$total; outputs=$records}


