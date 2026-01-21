@echo off
echo Setting up environment for Flutter Build...

:: 1. Try to find Java 17 (Microsoft or Standard)
set "JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.8.7-hotspot"
if not exist "%JAVA_HOME%" (
    :: Fallback check for general Program Files
    for /d %%i in ("C:\Program Files\Microsoft\jdk-17*") do set "JAVA_HOME=%%i"
)

if not exist "%JAVA_HOME%" (
    echo ❌ Could not find Java 17 automatically.
    echo Please make sure you ran 'fix_java.bat' and it finished successfully.
    pause
    exit /b
)

echo ✅ Found Java at: %JAVA_HOME%
set "PATH=%JAVA_HOME%\bin;%PATH%"

:: 2. Run Flutter Build
echo 🚀 Building APK...
C:\flutter\bin\flutter.bat build apk --release

echo.
if %errorlevel% neq 0 (
    echo ❌ Build Failed.
) else (
    echo ✅ Build SUCCEEDED!
    echo APK Location: build\app\outputs\flutter-apk\app-release.apk
    explorer build\app\outputs\flutter-apk\
)
pause
