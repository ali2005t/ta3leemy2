@echo off
chcp 65001
cls
echo ===================================================
echo       🛠️ Ta3leemy Flutter Auto-Installer 🛠️
echo ===================================================
echo.
echo [1] Checking for Winget...
where winget >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Winget not found. Please update Windows.
    pause
    exit /b
)

echo [2] Installing Flutter SDK via Winget...
echo     (This might take a while - 1GB+ download)
echo.
winget install Google.Flutter --accept-source-agreements --accept-package-agreements

echo.
echo [3] Installing Android Command Line Tools...
echo     (Required for building APKs)
winget install Google.Android.SDKPlatformTools --accept-source-agreements --accept-package-agreements

echo.
echo ===================================================
echo ✅ Installation Attempt Complete!
echo.
echo IMPORTANT STEPS NOW:
echo 1. Close this window.
echo 2. Close VS Code (completely).
echo 3. Re-open VS Code.
echo 4. Try running 'flutter build apk' again.
echo.
echo NOTE: If it still fails, you might need to install "Android Studio" manually.
echo ===================================================
pause
