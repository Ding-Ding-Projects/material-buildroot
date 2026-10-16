param([Parameter(Mandatory=$true)][string]$OutputDirectory)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
# Called by the repository root build entrypoint, never a replacement entrypoint.
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$source = Join-Path $root 'native/file-broker/main.cpp'
$compiler = Get-Command cl.exe -ErrorAction SilentlyContinue
if (!$compiler) {
    throw 'Native file broker requires an initialized supported MSVC x64 and Windows SDK environment. No compiler was downloaded or substituted.'
}
if (!$env:VSCMD_ARG_TGT_ARCH -or $env:VSCMD_ARG_TGT_ARCH -ne 'x64') {
    throw 'Native file broker requires the MSVC x64 developer environment.'
}
$destination = [IO.Path]::GetFullPath($OutputDirectory)
if (!$destination.StartsWith($root + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Broker output must remain inside this build checkout.'
}
$cursor = $destination
while ($cursor) {
    if ((Test-Path -LiteralPath $cursor) -and ((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Broker output contains a reparse point.' }
    $parent = [IO.Path]::GetDirectoryName($cursor)
    if ($parent -eq $cursor) { break }
    $cursor = $parent
}
[IO.Directory]::CreateDirectory($destination) | Out-Null
$executable = Join-Path $destination 'material-file-broker.exe'
& $compiler.Source /nologo /std:c++17 /EHsc /W4 /WX /O2 /MT /guard:cf /DUNICODE /D_UNICODE $source ('/Fe:' + $executable) ('/Fo:' + (Join-Path $destination 'material-file-broker.obj')) /link /DYNAMICBASE /NXCOMPAT /HIGHENTROPYVA userenv.lib advapi32.lib ole32.lib bcrypt.lib
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
if (!(Test-Path -LiteralPath $executable -PathType Leaf)) { throw 'Compiler did not produce the broker.' }
$hash = (Get-FileHash -LiteralPath $executable -Algorithm SHA256).Hash.ToLowerInvariant()
$receipt = [ordered]@{ schemaVersion=1; file='material-file-broker.exe'; sha256=$hash; mechanism='appcontainer-handle-job'; runtimeVerified=$false }
[IO.File]::WriteAllText((Join-Path $destination 'broker-manifest.json'), ($receipt | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
