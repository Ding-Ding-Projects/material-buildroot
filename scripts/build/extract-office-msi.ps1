param(
  [Parameter(Mandatory=$true)][string]$Database,
  [Parameter(Mandatory=$true)][string]$ExtractedCab,
  [Parameter(Mandatory=$true)][string]$Output
)
$ErrorActionPreference = 'Stop'
function SafeSegment([string]$Value) {
  return ($Value -and $Value -notin @('.', '..') -and $Value -notmatch '[\\/<>:"|?*\x00-\x1f]' -and $Value -notmatch '[. ]$' -and $Value -notmatch '^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)')
}
function AbsolutePath([string]$Value) {
  $valuePath = $Value.Replace('/', '\')
  if ($valuePath.StartsWith('\\?\UNC\', [StringComparison]::OrdinalIgnoreCase)) { $valuePath = '\\' + $valuePath.Substring(8) }
  elseif ($valuePath.StartsWith('\\?\')) { $valuePath = $valuePath.Substring(4) }
  if ($valuePath -notmatch '^[A-Za-z]:\\' -and -not $valuePath.StartsWith('\\')) {
    if ($valuePath -match '^[A-Za-z]:|^\\') { throw 'Ambiguous Office source path.' }
    $valuePath = $PWD.ProviderPath.TrimEnd('\') + '\' + $valuePath
  }
  if ($valuePath -match '^[A-Za-z]:\\') { $segments = $valuePath.Substring(3).TrimEnd('\').Split('\') }
  elseif ($valuePath.StartsWith('\\')) {
    $segments = $valuePath.Substring(2).TrimEnd('\').Split('\')
    if ($segments.Length -lt 3) { throw 'Office UNC path must name a file or directory below its share.' }
  } else { throw 'Office path is not absolute.' }
  foreach ($segment in $segments) { if (-not (SafeSegment $segment)) { throw 'Invalid Office source path segment.' } }
  return $valuePath.TrimEnd('\')
}
function ExtendedPath([string]$Value) {
  if ($Value.StartsWith('\\')) { return '\\?\UNC\' + $Value.Substring(2) }
  return '\\?\' + $Value
}
$databasePath = AbsolutePath $Database
$cabPath = AbsolutePath $ExtractedCab
$destination = AbsolutePath $Output
# Read-only MSI database access. Never invoke an install action or custom action.
$installer = New-Object -ComObject WindowsInstaller.Installer
$db = $installer.OpenDatabase((ExtendedPath $databasePath), 0)
function Rows([string]$Sql, [int]$Columns) {
  $view = $db.OpenView($Sql)
  try {
    [void]$view.Execute()
    for ($row = $view.Fetch(); $null -ne $row; $row = $view.Fetch()) {
      $values = @()
      for ($column=1; $column -le $Columns; $column++) { $values += $row.StringData($column) }
      ,$values
    }
  } finally { [void]$view.Close() }
}
function LongName([string]$Name) {
  if ([string]::IsNullOrEmpty($Name)) { return '' }
  ($Name -split ':')[0].Split('|')[-1]
}
$directories = @{}
foreach ($row in (Rows 'SELECT `Directory`, `Directory_Parent`, `DefaultDir` FROM `Directory`' 3)) {
  $directories[$row[0]] = @{ Parent=$row[1]; Name=(LongName $row[2]) }
}
$components = @{}
foreach ($row in (Rows 'SELECT `Component`, `Directory_` FROM `Component`' 2)) { $components[$row[0]] = $row[1] }
function RelativeDirectory([string]$Id) {
  $parts = @()
  $seen = @{}
  while ($Id -and $Id -ne 'INSTALLLOCATION') {
    if ($seen.ContainsKey($Id) -or -not $directories.ContainsKey($Id)) { throw 'Invalid MSI directory graph.' }
    $seen[$Id] = $true
    $entry = $directories[$Id]
    if ($entry.Name -and $entry.Name -ne '.') { $parts = @($entry.Name) + $parts }
    $Id = $entry.Parent
  }
  if ($Id -ne 'INSTALLLOCATION') { return $null }
  return ($parts -join '/')
}
$destinationIo = ExtendedPath $destination
if ([IO.Directory]::Exists($destinationIo) -or [IO.File]::Exists($destinationIo)) { throw 'Office output already exists and is retained.' }
[void][IO.Directory]::CreateDirectory($destinationIo)
$seenTargets = @{}
$copied = 0
foreach ($row in (Rows 'SELECT `File`, `Component_`, `FileName` FROM `File`' 3)) {
  $relative = RelativeDirectory $components[$row[1]]
  $name = LongName $row[2]
  if ($null -eq $relative) {
    # The MSI also embeds the Microsoft app-local runtime. Keep its original x64
    # DLL bytes beside soffice.exe; never write to Windows or the global WinSxS tree.
    if ($row[0] -notmatch '^(msvcp140(?:_[a-z0-9_]+)?|vcruntime140(?:_[a-z0-9_]+)?)\.dll_amd64\.') { continue }
    $relative = 'program'
  }
  $parts = @($relative -split '/' | Where-Object { $_ }) + @($name)
  foreach ($part in $parts) { if (-not (SafeSegment $part)) { throw 'Invalid MSI target path.' } }
  if (-not (SafeSegment $row[0])) { throw 'Invalid MSI cabinet member.' }
  # All segments are validated before concatenation. Avoid GetFullPath/Join-Path
  # on a long target: legacy framework normalization can reject it before IO.
  $target = $destination + '\' + ($parts -join '\')
  if (-not $target.StartsWith($destination + '\', [StringComparison]::OrdinalIgnoreCase) -or $seenTargets.ContainsKey($target)) { throw 'MSI target collision or escape.' }
  $seenTargets[$target] = $true
  $sourceIo = ExtendedPath ($cabPath + '\' + $row[0])
  $attributes = [IO.File]::GetAttributes($sourceIo)
  if (($attributes -band [IO.FileAttributes]::Directory) -or ($attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'MSI cabinet member is not a regular file.' }
  $parentIo = ExtendedPath ($target.Substring(0, $target.LastIndexOf('\')))
  [void][IO.Directory]::CreateDirectory($parentIo)
  [IO.File]::Copy($sourceIo, (ExtendedPath $target), $false)
  $copied++
}
if ($copied -lt 100 -or -not [IO.File]::Exists((ExtendedPath ($destination + '\program\soffice.exe')))) { throw 'Office payload is incomplete.' }
Write-Output ('Reconstructed {0} original files using read-only MSI metadata; no installer action was executed.' -f $copied)
