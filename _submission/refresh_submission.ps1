# Refresh the submission package from the current repository state.
# Run this again after anyone on the team pushes changes - it re-copies the documents,
# the landing page and the poster, and rebuilds the source-code ZIP.
#
#   powershell -ExecutionPolicy Bypass -File _submission\refresh_submission.ps1
#
# It does NOT touch 04_Feedback/ (the report and the evidence) or 05_Screenshots/.

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot        # repository root
$sub  = $PSScriptRoot

Write-Host "Repository: $root"

# ---- 1. documents ------------------------------------------------------------
Copy-Item "$root\docs\PROJECT.md"  "$sub\01_Project_Document\Rooftop_Escape_Project_Document.md" -Force
Copy-Item "$root\DESIGN.md"        "$sub\01_Project_Document\Rooftop_Escape_Design_Document.md"  -Force
Copy-Item "$root\README.md"        "$sub\01_Project_Document\Repository_README.md"               -Force
Write-Host "  documents refreshed"

# ---- 2. landing page (offline copy: layout only) -----------------------------
Copy-Item "$root\index.html" "$sub\02_Landing_Page\index.html" -Force
Copy-Item "$root\css\*"      "$sub\02_Landing_Page\css\"       -Force
New-Item -ItemType Directory -Force "$sub\02_Landing_Page\assets\promo" | Out-Null
Copy-Item "$root\assets\promo\*" "$sub\02_Landing_Page\assets\promo\" -Force
Write-Host "  landing page refreshed"

# ---- 3. poster ---------------------------------------------------------------
Copy-Item "$root\poster.png"  "$sub\03_Poster\Rooftop_Escape_Poster.png" -Force
Copy-Item "$root\poster.html" "$sub\03_Poster\poster_source.html"        -Force
Write-Host "  poster refreshed"

# ---- 4. source-code ZIP ------------------------------------------------------
$stage = Join-Path $env:TEMP 'rooftop_src'
if (Test-Path $stage) { Remove-Item -Recurse -Force $stage }
New-Item -ItemType Directory -Force $stage | Out-Null

foreach ($f in @('index.html','play.html','poster.html','poster.png','README.md','DESIGN.md','SUBMISSION.md','package.json','.nojekyll')) {
  if (Test-Path "$root\$f") { Copy-Item "$root\$f" $stage }
}
foreach ($d in @('css','js','assets','docs','_sim')) {
  if (Test-Path "$root\$d") { Copy-Item "$root\$d" $stage -Recurse }
}

$zip = "$sub\06_Source_Code\Rooftop_Escape_Source_Code.zip"
if (Test-Path $zip) { Remove-Item $zip }
Compress-Archive -Path "$stage\*" -DestinationPath $zip -CompressionLevel Optimal
Remove-Item -Recurse -Force $stage

$files = (Get-ChildItem $sub -Recurse -File).Count
$size  = (Get-ChildItem $sub -Recurse -File | Measure-Object Length -Sum).Sum / 1MB
Write-Host ("  source ZIP rebuilt: {0:N1} MB" -f ((Get-Item $zip).Length / 1MB))
Write-Host ("DONE - submission package: {0} files, {1:N1} MB" -f $files, $size)
Write-Host "ZIP it as:  Group 01+Rooftop Escape_Project.zip"
