Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$destination = Join-Path $env:RUNNER_TEMP 'material-release-evidence'
[IO.Directory]::CreateDirectory($destination) | Out-Null
$record = @{schemaVersion=1; source=$env:GITHUB_SHA; runId=$env:GITHUB_RUN_ID; attempt=$env:GITHUB_RUN_ATTEMPT; eligible=$null; state='checking'}
try {
    if ($env:GITHUB_SHA -notmatch '^[a-fA-F0-9]{40}$') { throw 'Exact workflow source SHA is required.' }
    & git fetch --no-tags origin '+refs/heads/main:refs/remotes/origin/main'
    if ($LASTEXITCODE -ne 0) { throw 'Publication admission could not refresh origin/main.' }
    $main = & git rev-parse --verify 'refs/remotes/origin/main^{commit}'
    if ($LASTEXITCODE -ne 0) { throw 'Publication admission could not resolve refreshed main.' }
    $source = & git rev-parse --verify "$($env:GITHUB_SHA)^{commit}"
    if ($LASTEXITCODE -ne 0 -or $source -ne $env:GITHUB_SHA) { throw 'Publication admission could not resolve the exact source.' }
    $record['mainSource'] = "$main".Trim()
    & git merge-base --is-ancestor $env:GITHUB_SHA refs/remotes/origin/main
    $ancestryExit = $LASTEXITCODE
    if ($ancestryExit -eq 0) {
        $record.eligible=$true
        $record.state='eligible'
        'eligible=true' | Out-File -LiteralPath $env:GITHUB_OUTPUT -Encoding utf8 -Append
        '## Publication eligible' | Out-File -LiteralPath $env:GITHUB_STEP_SUMMARY -Encoding utf8 -Append
        'The exact workflow source belongs to freshly fetched main. The strict publisher will perform its own admission checks.' | Out-File -LiteralPath $env:GITHUB_STEP_SUMMARY -Encoding utf8 -Append
    } elseif ($ancestryExit -eq 1) {
        $record.eligible=$false
        $record.state='publication-deferred'
        $record['reason']='The source is not an ancestor of freshly fetched main. The preservation build does not publish a release.'
        'eligible=false' | Out-File -LiteralPath $env:GITHUB_OUTPUT -Encoding utf8 -Append
        '## Publication deferred' | Out-File -LiteralPath $env:GITHUB_STEP_SUMMARY -Encoding utf8 -Append
        $record.reason | Out-File -LiteralPath $env:GITHUB_STEP_SUMMARY -Encoding utf8 -Append
    } else { throw "Publication ancestry lookup failed with exit code $ancestryExit." }
} catch {
    $record.state='admission-failed'
    $record['reason']='Publication admission failed. No eligibility result was granted; inspect the failing step.'
    throw
} finally {
    $record | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $destination 'publication-eligibility.json') -Encoding UTF8
}
