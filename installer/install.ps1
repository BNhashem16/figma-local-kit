# Figma Local Bridge - installer for Windows (run through Install-Windows.bat).
$ErrorActionPreference = "Continue"
$Src = Split-Path -Parent $PSScriptRoot
$Kit = Join-Path $env:USERPROFILE "FigmaLocalKit"

function Step($t) { Write-Host ""; Write-Host "==> $t" -ForegroundColor Magenta }
function Ok($t)   { Write-Host "    [OK] $t" -ForegroundColor Green }
function Warn($t) { Write-Host "    [!] $t" -ForegroundColor Yellow }
function Done($code) { Write-Host ""; Read-Host "Press Enter to close this window" | Out-Null; exit $code }
function Refresh-Path {
  $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User") + ";$env:USERPROFILE\.local\bin;$env:ProgramFiles\nodejs"
}

Clear-Host
Write-Host "Figma Local Bridge - Installer"
Write-Host "This sets up Claude to work on your Figma files locally."

# 1) Copy the kit to a fixed place
Step "1/5  Copying files to $Kit"
if ($Src -ne $Kit) {
  New-Item -ItemType Directory -Force -Path $Kit | Out-Null
  robocopy $Src $Kit /MIR /XD .git logs /XF .bridge-token /NFL /NDL /NJH /NJS /NP | Out-Null
}
Ok "Files are in $Kit"

# 2) Node.js
Step "2/5  Checking Node.js"
Refresh-Path
function Node-Ok { try { [int]((node -p "process.versions.node.split('.')[0]") 2>$null) -ge 18 } catch { $false } }
if (-not (Node-Ok)) {
  Warn "Node.js is missing. Installing it now..."
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
  } else {
    $list = (Invoke-WebRequest -UseBasicParsing "https://nodejs.org/dist/latest-v22.x/").Content
    $msi = [regex]::Match($list, 'node-v22[0-9.]*-x64\.msi').Value
    $out = Join-Path $env:TEMP $msi
    Invoke-WebRequest -UseBasicParsing "https://nodejs.org/dist/latest-v22.x/$msi" -OutFile $out
    Start-Process msiexec.exe -ArgumentList "/i `"$out`"" -Wait
  }
  Refresh-Path
  if (-not (Node-Ok)) { Warn "Node.js is still not found. Restart the computer and run this installer again."; Done 1 }
}
$Node = (Get-Command node).Source
Ok "Node.js $(node -v) at $Node"

# 3) Claude Code
Step "3/5  Checking Claude Code"
Refresh-Path
if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
  Warn "Claude Code is missing. Installing it with the official installer..."
  Invoke-RestMethod https://claude.ai/install.ps1 | Invoke-Expression
  Refresh-Path
}
$HasClaude = [bool](Get-Command claude -ErrorAction SilentlyContinue)
if ($HasClaude) { Ok "Claude Code is installed" } else { Warn "Claude Code could not be installed. You can still use the Claude desktop app." }

# 4) Connect the bridge to Claude
Step "4/5  Connecting the bridge to Claude"
$Server = Join-Path $Kit "server\figma-local-mcp.mjs"
if ($HasClaude) {
  claude mcp remove figma-local -s user 2>$null | Out-Null
  claude mcp add figma-local -s user -- "$Node" "$Server" | Out-Null
  Ok "Added to Claude Code"
  $SkillDir = Join-Path $env:USERPROFILE ".claude\skills\figma-local"
  New-Item -ItemType Directory -Force -Path $SkillDir | Out-Null
  Copy-Item (Join-Path $Kit "skill\SKILL.md") (Join-Path $SkillDir "SKILL.md") -Force
  Ok "Added the figma-local skill"
}
$Desktops = @(Join-Path $env:APPDATA "Claude")
$Desktops += Get-ChildItem (Join-Path $env:LOCALAPPDATA "Packages") -Directory -Filter "Claude_*" -ErrorAction SilentlyContinue | ForEach-Object { Join-Path $_.FullName "LocalCache\Roaming\Claude" }
$Merge = Join-Path $Kit "installer\claude-desktop-config.js"
foreach ($d in $Desktops) {
  if (Test-Path $d) {
    & $Node $Merge add (Join-Path $d "claude_desktop_config.json") $Node $Server
    Ok "Added to the Claude desktop app (close it fully and open it again)"
  }
}

# 5) Figma plugin
Step "5/5  Figma plugin"
$Manifest = Join-Path $Kit "plugin\manifest.json"
Set-Clipboard -Value $Manifest
Ok "The plugin path is copied. You will paste it in Figma."
Write-Host ""
Write-Host "Now do this in the Figma desktop app (one time only):"
Write-Host "  1. Open your design file."
Write-Host "  2. Menu: Plugins > Development > Import plugin from manifest..."
Write-Host "  3. In the file window, click the 'File name' box, press Ctrl+V, then Enter."
Write-Host ""
Write-Host "Every time you work:"
Write-Host "  - Figma: Plugins > Development > Figma Local Bridge   (keep its small window open)"
Write-Host "  - Open Claude and ask, for example: 'Check the connection to Figma'"
Write-Host ""
Write-Host "Done" -ForegroundColor Green
Done 0
