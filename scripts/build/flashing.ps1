# Dot-source from the root build entrypoint. Loading this file performs no build.
function Get-FlashingArchive([object]$Spec, [string]$Cache) {
    if ($Spec.sha512 -notmatch '^[a-f0-9]{128}$' -or $Spec.version -notmatch '^8\.0\.[0-9]+$' -or $Spec.url -notmatch '^https://builds\.dotnet\.microsoft\.com/dotnet/(Sdk|Runtime)/') { throw 'Invalid flashing tool input.' }
    Assert-NoReparse $Cache
    [IO.Directory]::CreateDirectory($Cache) | Out-Null
    $archive = Join-Path $Cache ($Spec.id + '-' + $Spec.version + '.zip')
    Assert-NoReparse $archive
    if (!(Test-Path -LiteralPath $archive)) {
        Add-Type -AssemblyName System.Net.Http
        $partial = $archive + '.' + [guid]::NewGuid().ToString('N') + '.partial'
        $client = [Net.Http.HttpClient]::new()
        $client.Timeout = [TimeSpan]::FromMinutes(10)
        $timeout = [Threading.CancellationTokenSource]::new([TimeSpan]::FromMinutes(10))
        try {
            $response = $client.GetAsync($Spec.url, [Net.Http.HttpCompletionOption]::ResponseHeadersRead, $timeout.Token).GetAwaiter().GetResult()
            try {
                $response.EnsureSuccessStatusCode() | Out-Null
                if ($response.Content.Headers.ContentLength -gt $Spec.maxDownloadBytes) { throw 'Flashing input exceeds download limit.' }
                $inputStream = $response.Content.ReadAsStreamAsync().GetAwaiter().GetResult()
                $outputStream = [IO.File]::Open($partial, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
                try {
                    $buffer = New-Object byte[] 1048576
                    [long]$total = 0
                    while (($read = $inputStream.ReadAsync($buffer, 0, $buffer.Length, $timeout.Token).GetAwaiter().GetResult()) -gt 0) {
                        $total += $read
                        if ($total -gt $Spec.maxDownloadBytes) { throw 'Flashing input exceeds download limit.' }
                        $outputStream.Write($buffer, 0, $read)
                    }
                    $outputStream.Flush($true)
                } finally { $outputStream.Dispose(); $inputStream.Dispose() }
            } finally { $response.Dispose() }
            if ((Get-FileHash -LiteralPath $partial -Algorithm SHA512).Hash.ToLowerInvariant() -ne $Spec.sha512) { throw 'Flashing archive SHA-512 mismatch; partial retained.' }
            [IO.File]::Move($partial, $archive)
        } finally { $client.Dispose(); $timeout.Dispose() }
    }
    if ((Get-FileHash -LiteralPath $archive -Algorithm SHA512).Hash.ToLowerInvariant() -ne $Spec.sha512) { throw 'Cached flashing archive SHA-512 mismatch; cache retained.' }
    return $archive
}

function Expand-FlashingInput([object]$Spec, [string]$ToolsRoot) {
    $archive = Get-FlashingArchive $Spec (Join-Path $ToolsRoot 'downloads')
    $inventory = Get-ArchiveInventory $archive $Spec
    $destination = Join-Path $ToolsRoot ($Spec.id + '-' + $Spec.version)
    Assert-NoReparse $destination
    if (Test-Path -LiteralPath $destination) {
        if (!(Test-ExtractedTree $destination $inventory)) { throw 'Flashing tool cache changed; preserve it and select a fresh tools root.' }
        return $destination
    }
    $temporary = $destination + '.staging-' + [guid]::NewGuid().ToString('N')
    Expand-VerifiedArchive $archive $temporary $inventory
    [IO.Directory]::Move($temporary, $destination)
    return $destination
}

# Producer files share the final output volume; verified tool caches stay separate.
function New-FlashingProducerDirectory([string]$OutputDirectory) {
    $output = [IO.Path]::GetFullPath($OutputDirectory)
    Assert-NoReparse $output
    if (Test-Path -LiteralPath $output) { throw 'Flashing output must be a new directory; existing output is preserved.' }
    $parent = [IO.Path]::GetDirectoryName($output)
    if (!$parent) { throw 'Flashing output requires a parent directory.' }
    Assert-NoReparse $parent
    [IO.Directory]::CreateDirectory($parent) | Out-Null
    Assert-NoReparse $parent
    Assert-NoReparse $output
    if (Test-Path -LiteralPath $output) { throw 'Flashing output appeared during producer setup; existing output is preserved.' }
    $work = Join-Path $parent ('.flashing-producer-' + [guid]::NewGuid().ToString('N'))
    Assert-NoReparse $work
    if (Test-Path -LiteralPath $work) { throw 'Flashing producer directory already exists; existing files are preserved.' }
    [IO.Directory]::CreateDirectory($work) | Out-Null
    Assert-NoReparse $work
    Assert-NoReparse $output
    if (Test-Path -LiteralPath $output) { throw 'Flashing output appeared during producer setup; producer and output are retained.' }
    return $work
}

function Invoke-FlashingBuild {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)][string]$RepositoryRoot,
        [Parameter(Mandatory=$true)][string]$ToolsRoot,
        [Parameter(Mandatory=$true)][string]$OutputDirectory
    )
    $ErrorActionPreference = 'Stop'
    $root = [IO.Path]::GetFullPath($RepositoryRoot)
    $tools = [IO.Path]::GetFullPath($ToolsRoot)
    $output = [IO.Path]::GetFullPath($OutputDirectory)
    . (Join-Path $root 'scripts/build/toolchains.ps1')
    Assert-NoReparse $root
    Assert-NoReparse $tools
    Assert-NoReparse $output
    if (Test-Path -LiteralPath $output) { throw 'Flashing output must be a new directory; existing output is preserved.' }
    [IO.Directory]::CreateDirectory($tools) | Out-Null
    $lockPath = Join-Path $tools 'flashing-build.lock'
    Assert-NoReparse $lockPath
    $lock = [IO.File]::Open($lockPath, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
    try {
        $inputsPath = Join-Path $root 'native/flashing/build-inputs.json'
        $inputs = Get-Content -LiteralPath $inputsPath -Raw | ConvertFrom-Json
        if ($inputs.schemaVersion -ne 1) { throw 'Unsupported flashing build input version.' }
        $sdk = Expand-FlashingInput $inputs.sdk $tools
        $runtime = Expand-FlashingInput $inputs.runtime $tools
        $work = New-FlashingProducerDirectory $output
        foreach ($name in @('Program.cs','app.manifest','MaterialBuildroot.Flash.csproj')) {
            Copy-Item -LiteralPath (Join-Path $root ('native/flashing/' + $name)) -Destination (Join-Path $work $name)
        }
        [IO.File]::WriteAllText((Join-Path $work 'global.json'), (@{sdk=@{version=$inputs.sdk.version;rollForward='disable';allowPrerelease=$false}} | ConvertTo-Json -Depth 4), [Text.UTF8Encoding]::new($false))
        $publish = Join-Path $work 'publish'
        Push-Location $work
        try {
            & (Join-Path $sdk 'dotnet.exe') publish (Join-Path $work 'MaterialBuildroot.Flash.csproj') --configuration Release --runtime win-x64 --self-contained true --output $publish --disable-build-servers --nologo '-p:PublishSingleFile=true' '-p:IncludeNativeLibrariesForSelfExtract=true' '-p:PublishTrimmed=false' '-p:DebugType=None' '-p:DebugSymbols=false' '-p:TargetLatestRuntimePatch=false' (('-p:RuntimeFrameworkVersion={0}' -f $inputs.runtime.version)) '--source' 'https://api.nuget.org/v3/index.json' '--packages' (Join-Path $work 'packages')
            if ($LASTEXITCODE -ne 0) { throw ('Flashing helper compilation failed with exit code ' + $LASTEXITCODE) }
        } finally { Pop-Location }
        $executable = Join-Path $publish 'MaterialBuildroot.Flash.exe'
        if (!(Test-Path -LiteralPath $executable -PathType Leaf) -or (Get-Item -LiteralPath $executable).Length -le 0) { throw 'Flashing helper executable was not produced.' }
        $notices = Join-Path $publish 'notices'
        [IO.Directory]::CreateDirectory($notices) | Out-Null
        foreach ($name in @('LICENSE.txt','ThirdPartyNotices.txt')) {
            Copy-Item -LiteralPath (Join-Path $sdk $name) -Destination (Join-Path $notices ('dotnet-sdk-' + $name))
            Copy-Item -LiteralPath (Join-Path $runtime $name) -Destination (Join-Path $notices ('dotnet-runtime-' + $name))
        }
        $sources = @{}
        foreach ($name in @('Program.cs','app.manifest','MaterialBuildroot.Flash.csproj','build-inputs.json')) { $sources[$name] = Get-Sha256 (Join-Path $root ('native/flashing/' + $name)) }
        $manifest = @{protocol=1;sha256=(Get-Sha256 $executable);sdkVersion=$inputs.sdk.version;runtimeVersion=$inputs.runtime.version;runtimeIdentifier='win-x64';selfContained=$true;unsigned=$true;debugType='None';debugSymbols=$false;sourceHashes=$sources;buildInputsSha256=(Get-Sha256 $inputsPath);runtimeAcceptance='unverified'}
        Write-AtomicJson (Join-Path $publish 'manifest.json') $manifest
        Assert-NoReparse $publish
        Assert-NoReparse $output
        if (Test-Path -LiteralPath $output) { throw 'Flashing output appeared during compilation; producer and output are retained.' }
        [IO.Directory]::Move($publish, $output)
        Assert-NoReparse $output
        return [pscustomobject]@{Directory=$output;Executable=(Join-Path $output 'MaterialBuildroot.Flash.exe');Manifest=(Join-Path $output 'manifest.json');Sha256=$manifest.sha256;RuntimeAcceptance='unverified'}
    } finally { $lock.Dispose() }
}
