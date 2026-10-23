param([Parameter(Mandatory=$true)][string]$UnsignedPath)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../scripts/build/native-toolchain.ps1')
$inheritedModulePath=$env:PSModulePath
Assert-MicrosoftExecutable (Join-Path $env:SystemRoot 'System32/notepad.exe')
if ($env:PSModulePath -cne $inheritedModulePath) { throw 'The caller module path was not restored.' }
$signatureCommand=Get-Command Get-AuthenticodeSignature -CommandType Cmdlet
$assemblyPath=[IO.Path]::GetFullPath($signatureCommand.ImplementingType.Assembly.Location)
$windowsRoot=[Environment]::GetFolderPath('Windows')+[IO.Path]::DirectorySeparatorChar
if (!$assemblyPath.StartsWith($windowsRoot,[StringComparison]::OrdinalIgnoreCase)) {
    throw 'Signature verification did not select the current PowerShell host module.'
}
$unsignedRejected=$false
try { Assert-MicrosoftExecutable $UnsignedPath }
catch {
    if ($_.Exception.Message -ne 'Native tool executable lacks a valid Microsoft Authenticode signature.') { throw }
    $unsignedRejected=$true
}
if (!$unsignedRejected) { throw 'An unsigned fixture was accepted.' }
if ($env:PSModulePath -cne $inheritedModulePath) { throw 'The caller module path changed after rejection.' }
Write-Output 'PASS: host-owned signature module selected'
