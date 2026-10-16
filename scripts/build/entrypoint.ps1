param([Parameter(ValueFromRemainingArguments=$true)][string[]]$BuildArguments = @())
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$producerLock = $null
try {
    if (![Environment]::Is64BitOperatingSystem -or $env:OS -ne 'Windows_NT') { throw 'This build entrypoint supports Windows x64 only.' }
    $root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
    Set-Location -LiteralPath $root
    . (Join-Path $PSScriptRoot 'toolchains.ps1')
    . (Join-Path $PSScriptRoot 'arguments.ps1')
    $manifest = Get-Content -LiteralPath (Join-Path $root 'build-manifest.json') -Raw | ConvertFrom-Json
    if ($manifest.schemaVersion -ne 1 -or $manifest.platform -ne 'win32-x64') { throw 'Unsupported build manifest.' }
    $parsed = Read-BuildArguments $BuildArguments
    if ($parsed.target -notin @($manifest.targets.PSObject.Properties.Name)) { throw 'Unknown build target.' }
    $target = $manifest.targets.($parsed.target)
    if ($parsed.installer -and !$target.installable) { throw 'This target has no installer. Choose desktop after its implementation is admitted.' }
    if ($parsed.run -and !$target.launch) { throw 'This target has no desktop launch action. Its static output must be served through an explicit preview route.' }
    if (!$parsed.dependenciesOnly -and !(Test-Path -LiteralPath (Join-Path $root $target.input) -PathType Leaf)) { throw ('Target source is not implemented: ' + $target.input) }
    Write-Host 'Using project-local portable tools. No administrator rights or machine-wide changes are required.'
    $cacheRoot = Join-Path $root '.cache'
    Assert-NoReparse $cacheRoot
    [IO.Directory]::CreateDirectory($cacheRoot) | Out-Null
    $producerLockPath = Join-Path $cacheRoot 'producer.lock'
    Assert-NoReparse $producerLockPath
    try { $producerLock = [IO.File]::Open($producerLockPath, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None) }
    catch [IO.IOException] { throw 'Another build or dependency operation owns this checkout. Retry after that operation finishes.' }
    $toolsRoot = Join-Path $root '.cache/toolchains'
    $nodeRoot = Install-PinnedTool ($manifest.toolchains | Where-Object id -eq 'node') $toolsRoot
    $gitRoot = Install-PinnedTool ($manifest.toolchains | Where-Object id -eq 'git') $toolsRoot
    $env:PATH = $nodeRoot + ';' + (Join-Path $gitRoot 'cmd') + ';' + $env:PATH
    $node = Join-Path $nodeRoot 'node.exe'
    $env:MATERIAL_BUILD_GIT = Join-Path $gitRoot 'cmd/git.exe'
    $env:MATERIAL_BUILD_NODE = $node
    $env:MATERIAL_BUILD_NPM = Join-Path $nodeRoot 'node_modules/npm/bin/npm-cli.js'
    & $node --version
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & $env:MATERIAL_BUILD_GIT --version
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    $driverArguments = @((Join-Path $PSScriptRoot 'driver.cjs'), '--target', $parsed.target)
    if ($parsed.silent) { $driverArguments += '--silent' }
    if ($parsed.run) { $driverArguments += '--run' }
    if ($parsed.installer) { $driverArguments += '--installer' }
    if ($parsed.dependenciesOnly) { $driverArguments += '--dependencies-only' }
    if ($parsed.payloadCache) { $driverArguments += @('--payload-cache', $parsed.payloadCache) }
    if ($parsed.target -eq 'desktop') {
        $electronRoot = Install-PinnedTool $manifest.electron $toolsRoot
        $env:MATERIAL_BUILD_ELECTRON_DIST = $electronRoot
    }
    & $node @driverArguments
    exit $LASTEXITCODE
} catch {
    [Console]::Error.WriteLine('Build stopped: ' + $_.Exception.Message)
    exit 1
} finally { if ($producerLock) { $producerLock.Dispose() } }
