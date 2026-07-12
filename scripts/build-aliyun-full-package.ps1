param(
    [string]$ReleaseName = "efv-aliyun-full-20260712-v2"
)

$ErrorActionPreference = "Stop"

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$releaseRoot = [System.IO.Path]::GetFullPath((Join-Path $repoRoot "release"))
$stageRoot = [System.IO.Path]::GetFullPath((Join-Path $releaseRoot $ReleaseName))
$zipPath = [System.IO.Path]::GetFullPath((Join-Path $releaseRoot ($ReleaseName + ".zip")))
$hashPath = $zipPath + ".sha256"

if (-not $stageRoot.StartsWith($releaseRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to stage outside the release directory."
}

New-Item -ItemType Directory -Path $releaseRoot -Force | Out-Null
if (Test-Path -LiteralPath $zipPath) {
    throw "Release already exists: $ReleaseName"
}
if (Test-Path -LiteralPath $stageRoot) {
    Remove-Item -LiteralPath $stageRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $stageRoot | Out-Null

function Get-RepoRelativePath([string]$FullName) {
    $rootPrefix = $repoRoot.TrimEnd('\') + '\'
    if (-not $FullName.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Path is outside the repository: $FullName"
    }
    return $FullName.Substring($rootPrefix.Length)
}

$excludedTopFiles = @(
    "ai_context.html",
    "contribution_guide.html",
    "gdd_scope_review.html"
)
$allowedRootNames = @(
    "play-server.py",
    ".htaccess",
    ".user.ini",
    "robots.txt",
    "sitemap.xml"
)
$allowedRootExtensions = @(".html", ".css", ".js")

$files = Get-ChildItem -LiteralPath $repoRoot -Recurse -File -Force | Where-Object {
    $relative = Get-RepoRelativePath $_.FullName
    $parts = $relative -split "[\\/]"
    $top = $parts[0]

    if ($top -in @(".git", "dict", "release", "scripts", "share", "tmp")) { return $false }
    if ($parts -contains "__pycache__") { return $false }
    if ($relative -like "play-data.sqlite3*") { return $false }
    if ($_.Extension -in @(".log", ".md", ".txt", ".zip")) { return $false }
    if ($parts.Count -eq 1 -and $_.Name -in $excludedTopFiles) { return $false }

    if ($top -in @("assets", "vendor")) { return $true }
    if ($parts.Count -ne 1) { return $false }
    return ($_.Name -in $allowedRootNames) -or ($_.Extension -in $allowedRootExtensions)
}

foreach ($file in $files) {
    $relative = Get-RepoRelativePath $file.FullName
    $destination = Join-Path $stageRoot $relative
    $destinationDir = Split-Path -Parent $destination
    New-Item -ItemType Directory -Path $destinationDir -Force | Out-Null
    Copy-Item -LiteralPath $file.FullName -Destination $destination
}

$tar = Get-Command tar.exe -ErrorAction Stop
& $tar.Source -a -c -f $zipPath -C $stageRoot .
if ($LASTEXITCODE -ne 0) {
    throw "tar.exe failed with exit code $LASTEXITCODE"
}

$hash = Get-FileHash -LiteralPath $zipPath -Algorithm SHA256
Set-Content -LiteralPath $hashPath -Encoding ascii -Value ("{0}  {1}" -f $hash.Hash.ToLowerInvariant(), (Split-Path -Leaf $zipPath))

Remove-Item -LiteralPath $stageRoot -Recurse -Force

$sizeMiB = [Math]::Round((Get-Item -LiteralPath $zipPath).Length / 1MB, 2)
Write-Output ("Package: {0}" -f $zipPath)
Write-Output ("SHA256: {0}" -f $hash.Hash.ToLowerInvariant())
Write-Output ("Files: {0}" -f $files.Count)
Write-Output ("Size: {0} MiB" -f $sizeMiB)
