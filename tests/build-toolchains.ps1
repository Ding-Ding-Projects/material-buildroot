param([string]$Workspace)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../scripts/build/toolchains.ps1')
. (Join-Path $PSScriptRoot '../scripts/build/arguments.ps1')
function Assert-True($Condition, [string]$Message) { if (!$Condition) { throw $Message } }
function Assert-Rejected([scriptblock]$Action, [string]$Message) {
    $rejected = $false
    try { & $Action | Out-Null } catch { $rejected = $true }
    Assert-True $rejected $Message
}
$arguments = Read-BuildArguments
Assert-True ($arguments.target -eq 'desktop') 'No-argument parsing did not select the desktop.'
$arguments = Read-BuildArguments @('/s','--target','design-reference') '0' '0'
Assert-True ($arguments.silent -and !$arguments.run -and $arguments.target -eq 'design-reference') 'Silent reference arguments did not parse.'
$arguments = Read-BuildArguments @('/run') '1' '0'
Assert-True ($arguments.silent -and $arguments.run) 'Environment and explicit run aliases did not parse.'
Assert-Rejected { Read-BuildArguments @('--target') } 'Missing target argument was accepted.'
Assert-Rejected { Read-BuildArguments @('--unknown') } 'Unknown argument was accepted.'
Assert-Rejected { Read-BuildArguments @('--installer','--run') } 'Installer launch was accepted.'
[IO.Directory]::CreateDirectory($Workspace) | Out-Null
$source = Join-Path $Workspace 'source'
[IO.Directory]::CreateDirectory($source) | Out-Null
[IO.File]::WriteAllText((Join-Path $source 'tool.exe'), 'fixture executable bytes')
[IO.File]::WriteAllText((Join-Path $source 'resource.dat'), 'fixture resource bytes')
$zip = Join-Path $Workspace 'fixture.zip'
[IO.Compression.ZipFile]::CreateFromDirectory($source, $zip)
$spec = [pscustomobject]@{id='fixture';version='1.0';url='https://example.invalid/not-used';sha256=(Get-Sha256 $zip);stripPrefix='';required=@('tool.exe','resource.dat');maxDownloadBytes=100000;maxExpandedBytes=100000}
$toolRoot = Join-Path $Workspace 'tools'
$directory = Join-Path $toolRoot 'fixture-1.0'
[IO.Directory]::CreateDirectory($directory) | Out-Null
[IO.File]::Copy($zip,(Join-Path $directory ($spec.sha256+'.zip')))
$active = Install-PinnedTool $spec $toolRoot
$inventory = Get-ArchiveInventory $zip $spec
Assert-True (Test-ExtractedTree $active $inventory) 'Cold activation did not produce the complete tree.'
$warm = Install-PinnedTool $spec $toolRoot
Assert-True ($warm -eq $active) 'Warm activation changed the location.'
[IO.File]::WriteAllText((Join-Path $active 'tool.exe'),'tampered')
Assert-True (!(Test-ExtractedTree $active $inventory)) 'Tampering was not detected.'
$repaired = Install-PinnedTool $spec $toolRoot
Assert-True (Test-ExtractedTree $repaired $inventory) 'Tampered tree was not repaired.'
$journal = Join-Path $directory 'activation.json'
Write-AtomicJson $journal @{phase='first'}
Write-AtomicJson $journal @{phase='second'}
Assert-True ((Get-Content -LiteralPath $journal -Raw | ConvertFrom-Json).phase -eq 'second') 'PowerShell 5.1 replacement did not preserve the new journal.'
[IO.File]::WriteAllText($journal,'{malformed')
$recovered = Install-PinnedTool $spec $toolRoot
Assert-True (Test-ExtractedTree $recovered $inventory) 'Malformed journal prevented verified active-tree recovery.'
Assert-True (!(Test-Path -LiteralPath $journal)) 'Recovered malformed journal was not quarantined.'
$backup = Join-Path $directory ('backup-'+[guid]::NewGuid().ToString('N'))
[IO.Directory]::Move($active,$backup)
[IO.File]::WriteAllText($journal,'{truncated')
$recovered = Install-PinnedTool $spec $toolRoot
Assert-True (Test-ExtractedTree $recovered $inventory) 'Interrupted old-to-backup move did not recover.'
$staged = Join-Path $directory ('stage-'+[guid]::NewGuid().ToString('N'))
[IO.Directory]::Move($active,$staged)
Write-AtomicJson $journal @{phase='old-moved';path='../../outside'}
$recovered = Install-PinnedTool $spec $toolRoot
Assert-True (Test-ExtractedTree $recovered $inventory) 'Valid staged generation did not recover independently of untrusted journal paths.'
$lock = [IO.File]::Open((Join-Path $directory 'activation.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
try {
    Assert-Rejected { [IO.File]::Open((Join-Path $directory 'activation.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None) } 'Concurrent exclusive lock acquisition was accepted.'
} finally { $lock.Dispose() }
[IO.File]::WriteAllText((Join-Path $active 'extra.dat'),'unexpected')
Assert-True (!(Test-ExtractedTree $active $inventory)) 'Unexpected extracted files were accepted.'
Write-AtomicJson $journal @{phase='unknown'}
Assert-Rejected { Install-PinnedTool $spec $toolRoot } 'Recovery accepted a generation without valid active or backup bytes.'
Assert-True (Test-Path -LiteralPath $journal) 'Unrecoverable journal evidence was discarded.'
$badZip = Join-Path $Workspace 'unsafe.zip'
$bad = [IO.Compression.ZipFile]::Open($badZip,[IO.Compression.ZipArchiveMode]::Create)
try { $entry=$bad.CreateEntry('../escape.exe');$stream=$entry.Open();try {$stream.WriteByte(1)}finally{$stream.Dispose()} } finally {$bad.Dispose()}
Assert-Rejected { Get-ArchiveInventory $badZip $spec } 'Traversal archive member was accepted.'
Write-Host 'PASS: complete-tree acquisition, warm reuse, tamper rejection/repair, journal replacement, malformed/interrupted recovery, exclusive ownership, unexpected files and traversal.'
