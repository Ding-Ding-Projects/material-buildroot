Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Sourced by the root build pipeline. Discovery never installs or modifies VS.
function Get-NativeToolchainPlan {
    [pscustomobject]@{
        version = '17.14.42'
        fileVersion = '17.14.37806.7'
        url = 'https://download.visualstudio.microsoft.com/download/pr/c95450be-0a45-4779-b142-33f567ccfd6e/68978bb28916156802e60e04c5ee50b94348d802fe151a3ca24433f27984187b/vs_BuildTools.exe'
        sha256 = '68978bb28916156802e60e04c5ee50b94348d802fe151a3ca24433f27984187b'
        length = 4474848
        components = @('Microsoft.VisualStudio.Component.VC.Tools.x86.x64', 'Microsoft.VisualStudio.Component.Windows11SDK.26100')
        license = 'https://visualstudio.microsoft.com/license-terms/'
        installPath = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio/2022/MaterialBuildrootBuildTools'
    }
}

function Assert-MicrosoftExecutable([string]$Path) {
    $signature = Get-AuthenticodeSignature -LiteralPath $Path
    if ($signature.Status -ne 'Valid' -or !$signature.SignerCertificate -or
        $signature.SignerCertificate.Subject -notmatch '(^|,\s*)O=Microsoft Corporation(,|$)') {
        throw 'Native tool executable lacks a valid Microsoft Authenticode signature.'
    }
}

function Initialize-NativeToolchain {
    if ($env:OS -ne 'Windows_NT' -or ![Environment]::Is64BitOperatingSystem) { throw 'Native toolchain requires Windows x64.' }
    $vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio/Installer/vswhere.exe'
    if (!(Test-Path -LiteralPath $vswhere -PathType Leaf)) {
        throw 'Native compiler is unavailable: registered Visual Studio discovery is absent. No installation was attempted.'
    }
    Assert-MicrosoftExecutable $vswhere
    $json = & $vswhere -products '*' -version '[17.0,19.0)' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -format json -utf8
    if ($LASTEXITCODE -ne 0) { throw 'Visual Studio discovery did not complete successfully.' }
    $instances = @((($json -join "`n") | ConvertFrom-Json) | Where-Object { $_.isComplete -and $_.isLaunchable } | Sort-Object installationVersion -Descending)
    if (!$instances.Count) { throw 'No complete supported Visual Studio C++ installation was found. No installation was attempted.' }
    $instance = $instances[0]
    $devcmd = [IO.Path]::GetFullPath((Join-Path $instance.installationPath 'Common7/Tools/VsDevCmd.bat'))
    if (!(Test-Path -LiteralPath $devcmd -PathType Leaf) -or $devcmd -match '["%!\r\n]') { throw 'Installed developer command path is unavailable or unsafe.' }
    $start = [Diagnostics.ProcessStartInfo]::new()
    $start.FileName = Join-Path ([Environment]::GetFolderPath('System')) 'cmd.exe'
    $start.Arguments = '/d /v:off /s /c "call "' + $devcmd + '" -no_logo -arch=x64 -host_arch=x64 >nul && set"'
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $process = [Diagnostics.Process]::new()
    $process.StartInfo = $start
    try {
        if (!$process.Start()) { throw 'Developer environment initialization did not start.' }
        $stdout = $process.StandardOutput.ReadToEndAsync()
        $stderr = $process.StandardError.ReadToEndAsync()
        if (!$process.WaitForExit(120000)) { $process.Kill(); throw 'Developer environment initialization exceeded two minutes.' }
        $output = $stdout.GetAwaiter().GetResult()
        $null = $stderr.GetAwaiter().GetResult()
        if ($process.ExitCode -ne 0) { throw 'Developer environment initialization failed. Environment output was not logged.' }
    } finally { $process.Dispose() }
    $environment = @{}
    foreach ($line in ($output -split "`r?`n")) {
        if ($line -match '^([^=]+)=(.*)$') { $environment[$matches[1]] = $matches[2] }
    }
    if ($environment['VSCMD_ARG_TGT_ARCH'] -ne 'x64' -or !$environment['VCToolsInstallDir'] -or !$environment['WindowsSdkDir'] -or !$environment['WindowsSDKVersion']) {
        throw 'Installed environment lacks the x64 compiler or Windows SDK.'
    }
    $compiler = Join-Path $environment['VCToolsInstallDir'] 'bin/Hostx64/x64/cl.exe'
    $linker = Join-Path $environment['VCToolsInstallDir'] 'bin/Hostx64/x64/link.exe'
    $sdk = Join-Path $environment['WindowsSdkDir'] ('Lib/' + $environment['WindowsSDKVersion'].TrimEnd('\') + '/um/x64/kernel32.lib')
    $headers = Join-Path $environment['WindowsSdkDir'] ('Include/' + $environment['WindowsSDKVersion'].TrimEnd('\') + '/um/Windows.h')
    foreach ($required in @($compiler, $linker, $sdk, $headers)) {
        if (!(Test-Path -LiteralPath $required -PathType Leaf)) { throw 'Installed native compiler or SDK is incomplete. Existing installation was preserved.' }
    }
    Assert-MicrosoftExecutable $compiler
    Assert-MicrosoftExecutable $linker
    # Import only into this build process, never persist PATH or settings.
    foreach ($name in $environment.Keys) { [Environment]::SetEnvironmentVariable($name, $environment[$name], 'Process') }
    Write-Host ('Initialized installed MSVC x64 and Windows SDK from Visual Studio {0}.' -f $instance.installationVersion)
    return [pscustomobject]@{ compiler=$compiler; linker=$linker; installationVersion=$instance.installationVersion; sdkVersion=$environment['WindowsSDKVersion'].TrimEnd('\'); origin='installed' }
}

function Get-PinnedNativeBootstrapper([Parameter(Mandatory=$true)][string]$CacheDirectory) {
    $plan = Get-NativeToolchainPlan
    . (Join-Path $PSScriptRoot 'toolchains.ps1')
    $directory = [IO.Path]::GetFullPath($CacheDirectory)
    Assert-NoReparse $directory
    [IO.Directory]::CreateDirectory($directory) | Out-Null
    $path = Join-Path $directory ('vs-BuildTools-' + $plan.version + '.exe')
    Assert-NoReparse $path
    if (!(Test-Path -LiteralPath $path -PathType Leaf)) {
        $temporary = $path + '.download-' + [guid]::NewGuid().ToString('N')
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -UseBasicParsing -Uri $plan.url -OutFile $temporary -TimeoutSec 300
        if ((Get-Item -LiteralPath $temporary).Length -ne $plan.length -or (Get-Sha256 $temporary) -ne $plan.sha256) { throw 'Native bootstrapper download differs from the pinned bytes. Download retained.' }
        Assert-MicrosoftExecutable $temporary
        [IO.File]::Move($temporary, $path)
    }
    if ((Get-Item -LiteralPath $path).Length -ne $plan.length -or (Get-Sha256 $path) -ne $plan.sha256) { throw 'Cached native bootstrapper differs from the pinned bytes. Cache retained.' }
    Assert-MicrosoftExecutable $path
    return $path
}

function Install-PinnedNativeToolchain {
    param([Parameter(Mandatory=$true)][string]$CacheDirectory, [switch]$OwnerApprovedInstallation, [switch]$LicenseAccepted)
    if (!$OwnerApprovedInstallation -or !$LicenseAccepted) { throw 'Native installation requires explicit owner approval of the installation and Microsoft license terms.' }
    $plan = Get-NativeToolchainPlan
    if (Test-Path -LiteralPath $plan.installPath) { throw 'Dedicated native installation destination already exists. It was preserved; automatic modification is not permitted.' }
    $bootstrapper = Get-PinnedNativeBootstrapper $CacheDirectory
    $arguments = @('--quiet', '--wait', '--norestart', '--installPath', ('"' + $plan.installPath + '"'), '--addProductLang', 'en-US')
    foreach ($component in $plan.components) { $arguments += @('--add', $component) }
    # RunAs uses native UAC. No restart, force-close, removal or security setting changes.
    try { $installation = Start-Process -FilePath $bootstrapper -Verb RunAs -ArgumentList $arguments -Wait -PassThru }
    catch { throw 'Native installer launch was canceled or unavailable. Installation remains incomplete.' }
    if ($installation.ExitCode -eq 3010) { throw 'Native installation requires a host restart. Build remains incomplete; no restart was requested.' }
    if ($installation.ExitCode -ne 0) { throw ('Native installation did not complete, exit code ' + $installation.ExitCode + '. Existing state and setup logs were retained.') }
    return Initialize-NativeToolchain
}
