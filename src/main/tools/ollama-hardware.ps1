$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$items = @(Get-CimInstance -ClassName Win32_VideoController -OperationTimeoutSec 2 | Select-Object -First 16 | ForEach-Object {
    [ordered]@{ name = [string]$_.Name; vendor = [string]$_.AdapterCompatibility; driverVersion = [string]$_.DriverVersion; reportedAdapterRamBytes = $(if ($null -eq $_.AdapterRAM) { $null } else { [uint32]$_.AdapterRAM }) }
})
[ordered]@{ adapters = $items } | ConvertTo-Json -Depth 4 -Compress
