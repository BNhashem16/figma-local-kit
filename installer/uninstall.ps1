# Figma Local Bridge - removes the Claude connections. Your Figma files are not touched.
$env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User") + ";$env:USERPROFILE\.local\bin"
if (Get-Command claude -ErrorAction SilentlyContinue) { claude mcp remove figma-local -s user 2>$null | Out-Null; Write-Host "Removed from Claude Code" }
Remove-Item -Recurse -Force (Join-Path $env:USERPROFILE ".claude\skills\figma-local") -ErrorAction SilentlyContinue
Write-Host "Removed the figma-local skill"
$Unmerge = Join-Path (Split-Path -Parent $PSScriptRoot) "installer\claude-desktop-config.js"
$Files = @(Join-Path $env:APPDATA "Claude\claude_desktop_config.json")
$Files += Get-ChildItem (Join-Path $env:LOCALAPPDATA "Packages") -Directory -Filter "Claude_*" -ErrorAction SilentlyContinue | ForEach-Object { Join-Path $_.FullName "LocalCache\Roaming\Claude\claude_desktop_config.json" }
foreach ($f in $Files) { if ((Test-Path $f) -and (Get-Command node -ErrorAction SilentlyContinue)) { node $Unmerge remove $f; Write-Host "Removed from the Claude desktop app" } }
Write-Host ""
Write-Host "To remove the plugin from Figma: Plugins > Development > Manage plugins in development > Figma Local Bridge > Remove."
Write-Host "You can delete the folder $env:USERPROFILE\FigmaLocalKit."
Read-Host "Press Enter to close" | Out-Null
