param(
    [string]$ReleaseName = "efv-aliyun-full-20260716-boss-animation"
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
$excludedRuntimeAssets = @(
    "assets\cg\p1boss-end.MOV",
    "assets\cg\p1boss-end.mp4",
    "assets\chapter1\concepts\*",
    "assets\chapter1\maps\ch1_m05_sakura_tongji_avenue\background\ch1-m05-sakura-middle-v2.webp",
    "assets\chapter1\maps\ch1_m05_sakura_tongji_avenue\background\ch1-m05-sakura-north-v2.webp",
    "assets\chapter1\maps\ch1_m05_sakura_tongji_avenue\background\ch1-m05-sakura-north-v3.webp",
    "assets\chapter1\maps\ch1_m05_sakura_tongji_avenue\background\ch1-m05-sakura-south-v2.webp",
    "assets\chapter1\maps\ch1_m05_sakura_tongji_avenue\background\ch1-m05-sakura-tongji-avenue-v2.webp",
    "assets\game\bosses\m04-structural-instability-boss-sheet-v2.png",
    "assets\game\bosses\m04-structural-instability-boss-sheet-v3-hd.png",
    "assets\game\bosses\m04-structural-instability-boss-sheet-v4.png",
    "assets\game\bosses\m04-structural-instability-boss-sheet-v5.png",
    "assets\game\bosses\m04-structural-instability-boss-sheet-v6.png",
    "assets\game\bosses\m04-structural-instability-boss-sheet-v7.png",
    "assets\sprites\ayu-sprites-v17-unarmed-walk-seat-lina-edge.png",
    "assets\sprites\ayu-sprites-v18-alternating-walk-cat-transition.png",
    "assets\sprites\ayu-sprites-v19-redrawn-walk-cat-end.png",
    "assets\sprites\jiangxun-sprites-v8-lina-edge.png",
    "assets\sprites\jiangxun-sprites-v9-cat-paw-walk.png",
    "assets\sprites\laodeng-sprites-v7-lina-edge.png",
    "assets\sprites\laodeng-sprites-v8-cat-run-safe.png",
    "assets\sprites\zhixia\zhixia-animation-reference.mp4"
)

$files = Get-ChildItem -LiteralPath $repoRoot -Recurse -File -Force | Where-Object {
    $relative = Get-RepoRelativePath $_.FullName
    $parts = $relative -split "[\\/]"
    $top = $parts[0]

    if ($top -in @(".git", "dict", "release", "scripts", "share", "tmp")) { return $false }
    if ($parts -contains "__pycache__") { return $false }
    if ($relative -like "play-data.sqlite3*") { return $false }
    if ($_.Extension -in @(".log", ".md", ".txt", ".zip")) { return $false }
    if ($parts.Count -eq 1 -and $_.Name -in $excludedTopFiles) { return $false }
    foreach ($pattern in $excludedRuntimeAssets) {
        if ($relative -like $pattern) { return $false }
    }

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

$branch = (& git -C $repoRoot branch --show-current).Trim()
$commit = (& git -C $repoRoot rev-parse HEAD).Trim()
$builtAt = Get-Date -Format "yyyy-MM-dd HH:mm:ss K"
$readmeTemplatePath = Join-Path $repoRoot "deployment\ALIYUN_UPDATE_README_TEMPLATE.txt"
$readme = (Get-Content -LiteralPath $readmeTemplatePath -Raw -Encoding UTF8)
$readme = $readme.Replace("{{BUILT_AT}}", $builtAt).Replace("{{BRANCH}}", $branch).Replace("{{COMMIT}}", $commit)
Set-Content -LiteralPath (Join-Path $stageRoot "ALIYUN_UPDATE_README.txt") -Encoding utf8 -Value $readme
Set-Content -LiteralPath (Join-Path $stageRoot "VERSION.txt") -Encoding ascii -Value @(
    "release=$ReleaseName",
    "branch=$branch",
    "commit=$commit",
    "built_at=$builtAt"
)

$manifestPath = Join-Path $stageRoot "FILE-MANIFEST.sha256"
$manifestLines = Get-ChildItem -LiteralPath $stageRoot -Recurse -File | Where-Object {
    $_.FullName -ne $manifestPath
} | Sort-Object FullName | ForEach-Object {
    $relative = $_.FullName.Substring($stageRoot.TrimEnd('\').Length + 1).Replace('\', '/')
    $fileHash = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    "{0}  {1}" -f $fileHash, $relative
}
Set-Content -LiteralPath $manifestPath -Encoding ascii -Value $manifestLines

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
Write-Output ("Files: {0}" -f ($files.Count + 3))
Write-Output ("Size: {0} MiB" -f $sizeMiB)
