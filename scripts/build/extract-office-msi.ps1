param(
  [Parameter(Mandatory=$true)][string]$Database,
  [Parameter(Mandatory=$true)][string]$ExtractedCab,
  [Parameter(Mandatory=$true)][string]$Output
)
$ErrorActionPreference = 'Stop'
# Read-only MSI database access. Never invoke an install action or custom action.
$installer = New-Object -ComObject WindowsInstaller.Installer
$db = $installer.OpenDatabase([IO.Path]::GetFullPath($Database), 0)
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
$destination = [IO.Path]::GetFullPath($Output)
if (Test-Path -LiteralPath $destination) { throw 'Office output already exists and is retained.' }
[void][IO.Directory]::CreateDirectory($destination)
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
  if ($parts | Where-Object { $_ -in @('.', '..') -or $_ -match '[\\/:\x00-\x1f]' -or $_ -match '[. ]$' }) { throw 'Invalid MSI target path.' }
  if ($row[0] -match '[\\/:\x00-\x1f]') { throw 'Invalid MSI cabinet member.' }
  $target = [IO.Path]::GetFullPath((Join-Path $destination ($parts -join '/')))
  if (-not $target.StartsWith($destination + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -or $seenTargets.ContainsKey($target)) { throw 'MSI target collision or escape.' }
  $seenTargets[$target] = $true
  $source = Join-Path $ExtractedCab $row[0]
  $info = Get-Item -LiteralPath $source
  if ($info.PSIsContainer -or ($info.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'MSI cabinet member is not a regular file.' }
  [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($target))
  [IO.File]::Copy($source, $target, $false)
  $copied++
}
if ($copied -lt 100 -or -not (Test-Path -LiteralPath (Join-Path $destination 'program/soffice.exe'))) { throw 'Office payload is incomplete.' }
Write-Output ('Reconstructed {0} original files using read-only MSI metadata; no installer action was executed.' -f $copied)
