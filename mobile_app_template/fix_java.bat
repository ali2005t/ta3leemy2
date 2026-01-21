@echo off
chcp 65001
cls
echo ===================================================
echo       ☕ Updating Java (JDK 17) for Flutter
echo ===================================================
echo.
echo The build failed because your Java version is too old (Java 8).
echo We need to install Java 17 to build modern Android apps.
echo.
echo [1] Installing Microsoft OpenJDK 17...
winget install Microsoft.OpenJDK.17 --accept-source-agreements --accept-package-agreements

echo.
echo ===================================================
echo ✅ Java Installation Complete!
echo.
echo IMPORTANT:
echo 1. Close this window.
echo 2. RESTART VS CODE (Close all windows and open again).
echo 3. Run the build command again:
echo    C:\flutter\bin\flutter.bat build apk --release
echo ===================================================
pause
