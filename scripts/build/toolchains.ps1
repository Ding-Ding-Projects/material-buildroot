Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

function Get-ExtendedFilePath([string]$Path) {
    # Extended-length paths stay inside file I/O. Executables receive ordinary
    # paths, without changing any machine-wide long-path setting.
    if ($Path.StartsWith('\\?\', [StringComparison]::Ordinal)) { return $Path }
    $absolute = [IO.Path]::GetFullPath($Path)
    if ($absolute.StartsWith('\\', [StringComparison]::Ordinal)) { return '\\?\UNC\' + $absolute.Substring(2) }
    return '\\?\' + $absolute
}

function Get-Sha256([string]$Path) {
    $stream = [IO.File]::OpenRead((Get-ExtendedFilePath $Path))
    $sha = [Security.Cryptography.SHA256]::Create()
    try { return [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-', '').ToLowerInvariant() }
    finally { $sha.Dispose(); $stream.Dispose() }
}

function Assert-NoReparse([string]$Path) {
    $cursor = [IO.Path]::GetFullPath($Path)
    while ($cursor) {
        if (Test-Path -LiteralPath $cursor) {
            if ((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) {
                throw 'A dependency path contains a reparse point.'
            }
        }
        $parent = [IO.Path]::GetDirectoryName($cursor)
        if ($parent -eq $cursor) { break }
        $cursor = $parent
    }
}

function Write-AtomicJson([string]$Path, $Value) {
    $temporary = $Path + '.' + [guid]::NewGuid().ToString('N') + '.tmp'
    [IO.File]::WriteAllText($temporary, ($Value | ConvertTo-Json -Depth 20), [Text.UTF8Encoding]::new($false))
    if (Test-Path -LiteralPath $Path) {
        [IO.File]::Replace($temporary, $Path, [System.Management.Automation.Language.NullString]::Value)
    } else { [IO.File]::Move($temporary, $Path) }
}

function Get-PinnedArchive($Spec, [string]$Directory) {
    $archive = Join-Path $Directory ($Spec.sha256 + '.zip')
    Assert-NoReparse $archive
    if (Test-Path -LiteralPath $archive) {
        if ((Get-Sha256 $archive) -eq $Spec.sha256) { return $archive }
        [IO.File]::Move($archive, ($archive + '.invalid-' + [guid]::NewGuid().ToString('N')))
    }
    $partial = $archive + '.download-' + [guid]::NewGuid().ToString('N')
    Write-Host ('Downloading {0} {1} from {2}' -f $Spec.id, $Spec.version, $Spec.url)
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Add-Type -AssemblyName System.Net.Http
    $client = [Net.Http.HttpClient]::new()
    $client.Timeout = [TimeSpan]::FromMinutes(5)
    $cancellation = [Threading.CancellationTokenSource]::new([TimeSpan]::FromMinutes(5))
    try {
        $response = $client.GetAsync($Spec.url, [Net.Http.HttpCompletionOption]::ResponseHeadersRead, $cancellation.Token).GetAwaiter().GetResult()
        try {
            $response.EnsureSuccessStatusCode() | Out-Null
            if ($response.Content.Headers.ContentLength -gt $Spec.maxDownloadBytes) { throw 'Dependency exceeds its download limit.' }
            $inputStream = $response.Content.ReadAsStreamAsync().GetAwaiter().GetResult()
            $outputStream = [IO.File]::Open($partial, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
            try {
                $buffer = New-Object byte[] 1048576
                [long]$total = 0
                while (($count = $inputStream.ReadAsync($buffer, 0, $buffer.Length, $cancellation.Token).GetAwaiter().GetResult()) -gt 0) {
                    $total += $count
                    if ($total -gt $Spec.maxDownloadBytes) { throw 'Dependency exceeds its download limit.' }
                    $outputStream.Write($buffer, 0, $count)
                }
                $outputStream.Flush($true)
            } finally { $outputStream.Dispose(); $inputStream.Dispose() }
        } finally { $response.Dispose() }
        if ((Get-Sha256 $partial) -ne $Spec.sha256) { throw 'Dependency SHA-256 does not match the manifest.' }
        [IO.File]::Move($partial, $archive)
        return $archive
    } finally { $client.Dispose(); $cancellation.Dispose() }
}

function Get-ArchiveInventory([string]$Archive, $Spec) {
    $zip = [IO.Compression.ZipFile]::OpenRead($Archive)
    try {
        $files = [Collections.Generic.Dictionary[string,object]]::new([StringComparer]::OrdinalIgnoreCase)
        [long]$expanded = 0
        foreach ($entry in $zip.Entries) {
            $name = $entry.FullName.Replace('\', '/')
            if ($Spec.stripPrefix -and !$name.StartsWith($Spec.stripPrefix, [StringComparison]::Ordinal)) {
                throw 'Archive contains an unexpected root.'
            }
            $name = $name.Substring($Spec.stripPrefix.Length)
            if (!$name -or $name.EndsWith('/')) { continue }
            if ($name -match '(^/|(^|/)\.\.?(/|$)|[:\x00-\x1f]|[ .](/|$))' -or $name -match '(^|/)(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|/|$)') {
                throw 'Archive contains an unsafe member name.'
            }
            if ((($entry.ExternalAttributes -shr 16) -band 0xF000) -eq 0xA000) { throw 'Archive symbolic links are not supported.' }
            if ($files.ContainsKey($name)) { throw 'Archive contains duplicate member paths.' }
            $expanded += $entry.Length
            if ($expanded -gt $Spec.maxExpandedBytes -or $files.Count -ge 50000) { throw 'Archive exceeds extraction limits.' }
            $stream = $entry.Open()
            $sha = [Security.Cryptography.SHA256]::Create()
            try { $hash = [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-', '').ToLowerInvariant() }
            finally { $sha.Dispose(); $stream.Dispose() }
            $files.Add($name, @{sha256=$hash; length=$entry.Length; source=$entry.FullName})
        }
        foreach ($required in $Spec.required) {
            if (!$files.ContainsKey($required) -or $files[$required].length -le 0) { throw 'Archive lacks a required executable or resource.' }
        }
        return ,$files
    } finally { $zip.Dispose() }
}

function Test-ExtractedTree([string]$Root, $Inventory) {
    if (!(Test-Path -LiteralPath $Root -PathType Container)) { return $false }
    try {
        Assert-NoReparse $Root
        $extendedRoot = (Get-ExtendedFilePath $Root).TrimEnd('\')
        $pending = [Collections.Generic.Stack[string]]::new()
        $pending.Push($extendedRoot)
        $fileCount = 0
        while ($pending.Count) {
            $directory = $pending.Pop()
            foreach ($entry in [IO.Directory]::EnumerateFileSystemEntries($directory)) {
                $attributes = [IO.File]::GetAttributes($entry)
                if ($attributes -band [IO.FileAttributes]::ReparsePoint) { return $false }
                if ($attributes -band [IO.FileAttributes]::Directory) { $pending.Push($entry); continue }
                $relative = $entry.Substring($extendedRoot.Length + 1).Replace('\', '/')
                if (!$Inventory.ContainsKey($relative)) { return $false }
                $fileCount++
                if (([IO.FileInfo]::new($entry)).Length -ne $Inventory[$relative].length -or (Get-Sha256 $entry) -ne $Inventory[$relative].sha256) { return $false }
            }
        }
        if ($fileCount -ne $Inventory.Count) { return $false }
        return $true
    } catch { return $false }
}

function Expand-VerifiedArchive([string]$Archive, [string]$Destination, $Inventory) {
    $extendedDestination = (Get-ExtendedFilePath $Destination).TrimEnd('\')
    [IO.Directory]::CreateDirectory($extendedDestination) | Out-Null
    $zip = [IO.Compression.ZipFile]::OpenRead($Archive)
    try {
        foreach ($name in $Inventory.Keys) {
            $destinationFile = [IO.Path]::GetFullPath($extendedDestination + '\' + $name.Replace('/', '\'))
            if (!$destinationFile.StartsWith($extendedDestination + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Extraction path escaped its destination.' }
            [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($destinationFile)) | Out-Null
            $inputStream = $zip.GetEntry($Inventory[$name].source).Open()
            $outputStream = [IO.File]::Open($destinationFile, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
            try { $inputStream.CopyTo($outputStream); $outputStream.Flush($true) }
            finally { $outputStream.Dispose(); $inputStream.Dispose() }
        }
    } finally { $zip.Dispose() }
    if (!(Test-ExtractedTree $Destination $Inventory)) { throw 'Extracted dependency tree verification failed.' }
}

function Install-PinnedTool($Spec, [string]$ToolsRoot) {
    if ($Spec.id -notmatch '^[a-z][a-z0-9-]{0,31}$' -or $Spec.version -notmatch '^[0-9.]+$' -or $Spec.sha256 -notmatch '^[a-f0-9]{64}$') { throw 'Invalid tool manifest.' }
    if (([uri]$Spec.url).Scheme -ne 'https') { throw 'Tool archive URL must use HTTPS.' }
    $directory = [IO.Path]::GetFullPath((Join-Path $ToolsRoot ($Spec.id + '-' + $Spec.version)))
    Assert-NoReparse $directory
    [IO.Directory]::CreateDirectory($directory) | Out-Null
    $lockPath = Join-Path $directory 'activation.lock'
    Assert-NoReparse $lockPath
    $deadline = [DateTime]::UtcNow.AddSeconds(45)
    $lock = $null
    while (!$lock) {
        try { $lock = [IO.File]::Open($lockPath, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None) }
        catch [IO.IOException] {
            if ([DateTime]::UtcNow -gt $deadline) { throw 'Another dependency activation still owns the lock.' }
            Start-Sleep -Milliseconds 250
        }
    }
    try {
        $archive = Get-PinnedArchive $Spec $directory
        $inventory = Get-ArchiveInventory $archive $Spec
        $active = Join-Path $directory 'active'
        $journal = Join-Path $directory 'activation.json'
        Assert-NoReparse $journal
        $hasJournal = Test-Path -LiteralPath $journal
        if (Test-ExtractedTree $active $inventory) {
            if ($hasJournal) { [IO.File]::Move($journal, ($journal + '.recovered-' + [guid]::NewGuid().ToString('N'))) }
            Write-Host ('Verified complete cached tree: {0} {1}' -f $Spec.id, $Spec.version)
            return $active
        }
        # Recovery never trusts paths or state supplied by journal bytes.
        if ($hasJournal) {
            $candidates = @(Get-ChildItem -LiteralPath $directory -Directory | Where-Object { $_.Name -match '^(backup|stage)-[0-9a-f]{32}$' })
            foreach ($candidate in $candidates) {
                if (Test-ExtractedTree $candidate.FullName $inventory) {
                    if (Test-Path -LiteralPath $active) { [IO.Directory]::Move($active, (Join-Path $directory ('invalid-' + [guid]::NewGuid().ToString('N')))) }
                    [IO.Directory]::Move($candidate.FullName, $active)
                    [IO.File]::Move($journal, ($journal + '.recovered-' + [guid]::NewGuid().ToString('N')))
                    Write-Host ('Recovered verified dependency: {0} {1}' -f $Spec.id, $Spec.version)
                    return $active
                }
            }
            throw 'Interrupted activation has no verified active, backup or staged tree. Journal retained; manual recovery is required.'
        }
        $generation = [guid]::NewGuid().ToString('N')
        $stage = Join-Path $directory ('stage-' + $generation)
        $backup = Join-Path $directory ('backup-' + $generation)
        Expand-VerifiedArchive $archive $stage $inventory
        Write-AtomicJson $journal @{schemaVersion=1; id=$Spec.id; version=$Spec.version; sha256=$Spec.sha256; generation=$generation; phase='prepared'}
        if (Test-Path -LiteralPath $active) { [IO.Directory]::Move($active, $backup) }
        Write-AtomicJson $journal @{schemaVersion=1; id=$Spec.id; version=$Spec.version; sha256=$Spec.sha256; generation=$generation; phase='old-moved'}
        [IO.Directory]::Move($stage, $active)
        if (!(Test-ExtractedTree $active $inventory)) { throw 'Activated dependency did not verify; recovery journal retained.' }
        [IO.File]::Move($journal, ($journal + '.complete-' + $generation))
        Write-Host ('Activated verified dependency: {0} {1}' -f $Spec.id, $Spec.version)
        return $active
    } finally { $lock.Dispose() }
}
