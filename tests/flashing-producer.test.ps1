param([Parameter(Mandatory=$true)][string]$Workspace)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../scripts/build/toolchains.ps1')
function Assert-True($Condition,[string]$Message){if(!$Condition){throw $Message}}
function Assert-Rejected([scriptblock]$Action,[string]$Message){$rejected=$false;try{& $Action|Out-Null}catch{$rejected=$true};Assert-True $rejected $Message}
$workspaceRoot=[IO.Path]::GetFullPath($Workspace)
Assert-NoReparse $workspaceRoot
if(Test-Path -LiteralPath $workspaceRoot){throw 'Test workspace must be absent; no existing directory is changed.'}
[IO.Directory]::CreateDirectory($workspaceRoot)|Out-Null
. (Join-Path $PSScriptRoot '../scripts/build/flashing.ps1')
Assert-True (@(Get-ChildItem -LiteralPath $workspaceRoot -Force).Count -eq 0) 'Dot-sourcing flashing code performed filesystem work.'
$cache=Join-Path $workspaceRoot 'verified tool cache'
[IO.Directory]::CreateDirectory($cache)|Out-Null
[IO.File]::WriteAllText((Join-Path $cache 'sentinel'),'cache stays in place')
$output=Join-Path $workspaceRoot 'output with spaces/nested/final helper'
$work=New-FlashingProducerDirectory $output
Assert-True ([IO.Path]::GetDirectoryName($work) -eq [IO.Path]::GetDirectoryName($output)) 'Producer is not a sibling of the final output.'
Assert-True ([IO.Path]::GetPathRoot($work) -eq [IO.Path]::GetPathRoot($output)) 'Producer and output roots differ.'
Assert-True (!(Test-Path -LiteralPath $output)) 'Producer setup created the final destination.'
$second=New-FlashingProducerDirectory (Join-Path ([IO.Path]::GetDirectoryName($output)) 'second helper')
Assert-True ($second -ne $work) 'Producer directories were reused.'
$publish=Join-Path $work 'publish'
[IO.Directory]::CreateDirectory($publish)|Out-Null
[IO.File]::WriteAllText((Join-Path $publish 'result.txt'),'simulated output, no compilation')
[IO.Directory]::Move($publish,$output)
Assert-True ([IO.File]::ReadAllText((Join-Path $output 'result.txt')) -eq 'simulated output, no compilation') 'Same-volume publication lost bytes.'
Assert-Rejected {New-FlashingProducerDirectory $output} 'Existing output directory was accepted.'
$existing=Join-Path $workspaceRoot 'existing-file'
[IO.File]::WriteAllText($existing,'preserve')
Assert-Rejected {New-FlashingProducerDirectory $existing} 'Existing output file was accepted.'
Assert-True ([IO.File]::ReadAllText($existing) -eq 'preserve') 'Existing file changed.'
$target=Join-Path $workspaceRoot 'junction target'
[IO.Directory]::CreateDirectory($target)|Out-Null
$link=Join-Path $workspaceRoot 'junction parent'
New-Item -ItemType Junction -Path $link -Target $target|Out-Null
Assert-Rejected {New-FlashingProducerDirectory (Join-Path $link 'new-output')} 'Reparse ancestor was accepted.'
Assert-Rejected {New-FlashingProducerDirectory $link} 'Reparse destination was accepted.'
Assert-True (@(Get-ChildItem -LiteralPath $target -Force).Count -eq 0) 'Reparse rejection wrote to its target.'
Assert-True ([IO.File]::ReadAllText((Join-Path $cache 'sentinel')) -eq 'cache stays in place') 'Verified cache fixture changed.'
$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot '../scripts/build/flashing.ps1'),[ref]$null,[ref]$null)
$entry=$ast.Find({param($node)$node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Invoke-FlashingBuild'},$true)
$call=$entry.Body.FindAll({param($node)$node -is [Management.Automation.Language.CommandAst] -and $node.GetCommandName() -eq 'New-FlashingProducerDirectory'},$true)
Assert-True ($call.Count -eq 1 -and $call[0].CommandElements[1].Extent.Text -eq '$output') 'Build entrypoint does not use the output-bound producer helper.'
Write-Output 'PASS: producer sibling creation, unique directories, same-volume move, spaces, existing-output preservation, reparse rejection and cache preservation. No compilation or download was run.'
