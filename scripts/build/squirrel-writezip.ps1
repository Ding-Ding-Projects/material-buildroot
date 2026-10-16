param([Parameter(Mandatory=$true)][string]$OutputDirectory)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$destination = [IO.Path]::GetFullPath($OutputDirectory)
if (!$destination.StartsWith($root + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Squirrel helper output must remain inside this build checkout.' }
. (Join-Path $PSScriptRoot 'toolchains.ps1')
Assert-NoReparse $destination
if (Test-Path -LiteralPath $destination) { throw 'Existing Squirrel helper output is retained; choose a fresh producer generation.' }
$sourceRoot = Join-Path $root 'native/squirrel-writezip'
$provenance = Get-Content -LiteralPath (Join-Path $sourceRoot 'provenance.json') -Raw | ConvertFrom-Json
if ($provenance.schemaVersion -ne 1 -or $provenance.revision -ne 'eef37460aef77b2f9de8cd2237c1e55b344a6554') { throw 'Squirrel helper source identity is unavailable.' }
foreach ($file in $provenance.files) {
    if ($file.path -notin @('WriteZipToSetup.cpp','stdafx.h','COPYING')) { throw 'Unexpected Squirrel helper source member.' }
    $source = Join-Path $sourceRoot $file.path
    Assert-NoReparse $source
    if ((Get-Item -LiteralPath $source).Length -ne $file.bytes -or (Get-Sha256 $source) -ne $file.sha256) { throw 'Genuine Squirrel source bytes differ from their immutable provenance.' }
}
$compiler = Get-Command cl.exe -ErrorAction SilentlyContinue
if (!$compiler -or $env:VSCMD_ARG_TGT_ARCH -ne 'x64') { throw 'Genuine Squirrel helper production requires the root-initialized supported MSVC x64 environment.' }
[IO.Directory]::CreateDirectory($destination) | Out-Null
$genuine = Join-Path $destination 'WriteZipToSetup.Genuine.exe'
# Compile unchanged official source. This does not create a substitute SFX format.
& $compiler.Source /nologo /EHsc /W3 /O2 /MT /DUNICODE /D_UNICODE (Join-Path $sourceRoot 'WriteZipToSetup.cpp') ('/Fe:' + $genuine) ('/Fo:' + (Join-Path $destination 'WriteZipToSetup.Genuine.obj')) /link /MACHINE:X64 /DYNAMICBASE /NXCOMPAT /HIGHENTROPYVA
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$bytes = [IO.File]::ReadAllBytes($genuine)
$pe = [BitConverter]::ToUInt32($bytes,60)
if ([BitConverter]::ToUInt16($bytes,$pe+4) -ne 0x8664) { throw 'Genuine Squirrel embedding helper is not an x64 executable.' }
$executable = Join-Path $destination 'WriteZipToSetup.exe'
$proxySource = Join-Path $sourceRoot 'invocation-proxy.cpp'
& $compiler.Source /nologo /std:c++17 /EHsc /W3 /O2 /MT /DUNICODE /D_UNICODE $proxySource ('/Fe:' + $executable) ('/Fo:' + (Join-Path $destination 'invocation-proxy.obj')) /link /MACHINE:X64 /DYNAMICBASE /NXCOMPAT /HIGHENTROPYVA bcrypt.lib
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$proxyBytes = [IO.File]::ReadAllBytes($executable)
$proxyPe = [BitConverter]::ToUInt32($proxyBytes,60)
if ([BitConverter]::ToUInt16($proxyBytes,$proxyPe+4) -ne 0x8664) { throw 'Squirrel invocation observer is not an x64 executable.' }
$receipt = @{schemaVersion=1; source=$provenance.revision; architecture='x64'; file='WriteZipToSetup.exe'; sha256=(Get-Sha256 $executable); genuineFile='WriteZipToSetup.Genuine.exe'; genuineSha256=(Get-Sha256 $genuine); proxySourceSha256=(Get-Sha256 $proxySource); role='genuine-helper-invocation-observer'; runtimeVerified=$false}
[IO.File]::WriteAllText((Join-Path $destination 'helper-manifest.json'),($receipt | ConvertTo-Json),[Text.UTF8Encoding]::new($false))
