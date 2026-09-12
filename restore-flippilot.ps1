# ================================
# FLIPPILOT FULL TSX RESTORE SCRIPT
# ================================

# Path to your backup folder on USB
$backup = "D:\flippilot-backup-2024-08-24\src"

# Path to your current project
$project = "C:\Users\andre\Desktop\flippilot-office-backup-v2\src"

Write-Host "=== Restoring clean TSX files from backup ===" -ForegroundColor Cyan

# Find all TSX files in backup
$files = Get-ChildItem -Recurse -Path $backup -Include *.tsx

foreach ($file in $files) {
    # Build relative path
    $relative = $file.FullName.Replace($backup, "")
    $dest = Join-Path $project $relative

    # Ensure destination folder exists
    $destDir = Split-Path $dest
    if (!(Test-Path $destDir)) {
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }

    # Copy file
    Copy-Item $file.FullName $dest -Force
    Write-Host "Restored: $relative" -ForegroundColor Green
}

Write-Host "`n=== Running TypeScript check ===" -ForegroundColor Yellow
npx tsc --project "C:\Users\andre\Desktop\flippilot-office-backup-v2\tsconfig.web.json" --noEmit

Write-Host "`n=== Restore complete ===" -ForegroundColor Cyan
