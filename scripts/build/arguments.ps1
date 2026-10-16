function Read-BuildArguments([string[]]$Values = @(), [string]$SilentValue = $env:SILENT, [string]$RunValue = $env:RUN_AFTER_BUILD) {
    $parsed = @{target='desktop'; silent=($SilentValue -eq '1'); run=($RunValue -eq '1'); installer=$false; dependenciesOnly=$false; payloadCache=$null}
    for ($i=0; $i -lt $Values.Count; $i++) {
        switch -Exact ($Values[$i]) {
            '/s' { $parsed.silent=$true }
            '--silent' { $parsed.silent=$true }
            '/run' { $parsed.run=$true }
            '--run' { $parsed.run=$true }
            '--installer' { $parsed.installer=$true }
            '--dependencies-only' { $parsed.dependenciesOnly=$true }
            '--payload-cache' { $i++; if ($i -ge $Values.Count -or ![IO.Path]::IsPathRooted($Values[$i])) { throw '--payload-cache requires an absolute cache directory.' }; $parsed.payloadCache=$Values[$i] }
            '--target' { $i++; if ($i -ge $Values.Count) { throw '--target requires a value.' }; $parsed.target=$Values[$i] }
            default { throw ('Unknown build argument: ' + $Values[$i]) }
        }
    }
    if ($parsed.installer -and $parsed.run) { throw 'Installer production cannot launch the application. Use build.bat --run separately.' }
    return $parsed
}
